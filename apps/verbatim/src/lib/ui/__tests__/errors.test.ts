import { describe, it, expect } from 'vitest';
import { toFriendlyError } from '@/lib/ui/errors';

describe('toFriendlyError', () => {
  it('categorizes quota errors as rate_limit', () => {
    const raw = 'Gemini API error: quota exceeded (429) for model gemini-1.5-pro';
    const result = toFriendlyError(raw);
    expect(result.category).toBe('rate_limit');
    expect(result.title).toBe('Usage limit reached');
  });

  it('uses RATE_LIMITED code for rate_limit', () => {
    const result = toFriendlyError({ error: 'Too many requests', code: 'RATE_LIMITED' });
    expect(result.category).toBe('rate_limit');
  });

  it('detects timeout errors', () => {
    const result = toFriendlyError({ error: 'Request timed out after 30s' });
    expect(result.category).toBe('timeout');
  });

  it('detects validation errors', () => {
    const result = toFriendlyError({ error: 'Missing workspaceId', code: 'VALIDATION_ERROR' });
    expect(result.category).toBe('validation');
  });
});
