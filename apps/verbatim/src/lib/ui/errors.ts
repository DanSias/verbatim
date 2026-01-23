export type ErrorCategory =
  | 'rate_limit'
  | 'auth'
  | 'timeout'
  | 'upstream'
  | 'validation'
  | 'network'
  | 'unknown';

export type FriendlyError = {
  category: ErrorCategory;
  title: string;
  message: string;
  action?: string;
  requestId?: string;
  provider?: string;
  model?: string;
  status?: number;
  code?: string;
  raw?: string;
  details?: unknown;
};

function stringifySafe(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeMessage(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof Error) return input.message;
  if (input && typeof input === 'object' && 'error' in input) {
    const err = (input as { error?: unknown }).error;
    if (typeof err === 'string') return err;
  }
  return '';
}

export function detectErrorCategory(input: {
  code?: string;
  message?: string;
  status?: number;
  raw?: string;
}): ErrorCategory {
  const code = input.code?.toUpperCase();
  const status = input.status;
  const message = (input.message || input.raw || '').toLowerCase();

  if (code === 'RATE_LIMITED') return 'rate_limit';
  if (code === 'LLM_TIMEOUT') return 'timeout';
  if (code === 'VALIDATION_ERROR' || code === 'INVALID_JSON') return 'validation';
  if (code === 'LLM_ERROR') {
    if (message.includes('401') || message.includes('403') || message.includes('unauthorized')) {
      return 'auth';
    }
    if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
      return 'rate_limit';
    }
    return 'upstream';
  }

  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status === 408 || status === 504) return 'timeout';

  if (message.includes('quota') || message.includes('rate limit') || message.includes('429')) {
    return 'rate_limit';
  }
  if (
    message.includes('unauthorized') ||
    message.includes('api key') ||
    message.includes('permission') ||
    message.includes('403') ||
    message.includes('401')
  ) {
    return 'auth';
  }
  if (message.includes('timeout') || message.includes('timed out') || message.includes('504')) {
    return 'timeout';
  }
  if (
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('network')
  ) {
    return 'network';
  }

  return 'unknown';
}

export function toFriendlyError(input: unknown): FriendlyError {
  const message = normalizeMessage(input);
  const status =
    input && typeof input === 'object' && 'status' in input
      ? Number((input as { status?: unknown }).status)
      : undefined;
  const code =
    input && typeof input === 'object' && 'code' in input
      ? String((input as { code?: unknown }).code)
      : undefined;
  const requestId =
    input && typeof input === 'object' && 'requestId' in input
      ? String((input as { requestId?: unknown }).requestId)
      : undefined;
  const provider =
    input && typeof input === 'object' && 'provider' in input
      ? String((input as { provider?: unknown }).provider)
      : undefined;
  const model =
    input && typeof input === 'object' && 'model' in input
      ? String((input as { model?: unknown }).model)
      : undefined;
  const details =
    input && typeof input === 'object' && 'details' in input
      ? (input as { details?: unknown }).details
      : undefined;

  const raw =
    typeof input === 'string'
      ? input
      : input instanceof Error
      ? input.stack || input.message
      : input && typeof input === 'object'
      ? stringifySafe(input)
      : '';

  const category = detectErrorCategory({ code, message, status, raw });

  const templates: Record<
    ErrorCategory,
    { title: string; message: string; action?: string }
  > = {
    rate_limit: {
      title: 'Usage limit reached',
      message: 'The current LLM provider is temporarily rate-limiting requests.',
      action: 'Try again in a minute, switch providers, or use a paid key.',
    },
    auth: {
      title: 'Provider credentials not working',
      message: 'The provider rejected the request due to credentials or permissions.',
      action: 'Check API keys and allowed domains.',
    },
    timeout: {
      title: 'Request timed out',
      message: 'The provider took too long to respond.',
      action: 'Try again, reduce Top K, or switch providers.',
    },
    upstream: {
      title: 'Provider error',
      message: 'The provider returned an unexpected error.',
      action: 'Try again or switch providers.',
    },
    validation: {
      title: 'Invalid request',
      message: 'One or more fields are missing or invalid.',
      action: 'Check form values.',
    },
    network: {
      title: 'Network error',
      message: 'The request could not reach the server.',
      action: 'Check your connection or local server.',
    },
    unknown: {
      title: 'Something went wrong',
      message: 'An unexpected error occurred.',
    },
  };

  const template = templates[category];

  return {
    category,
    title: template.title,
    message: template.message,
    action: template.action,
    requestId,
    provider,
    model,
    status: Number.isNaN(status) ? undefined : status,
    code,
    raw: raw || undefined,
    details,
  };
}
