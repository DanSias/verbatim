/**
 * Email Allowlist Helpers
 *
 * Environment-driven access control for authentication.
 * Supports both domain-based and email-based allowlists.
 *
 * ENV variables:
 * - AUTH_ALLOWED_DOMAINS: comma-separated domains (e.g., "rocketgate.com,example.com")
 * - AUTH_ALLOWED_EMAILS: comma-separated emails (e.g., "daniel@domain.com,other@example.com")
 *
 * Behavior:
 * - If both are empty: allow any authenticated user (OSS default)
 * - If either is set: user must match at least one allowed domain or email
 */

/**
 * Parse comma-separated domains from env, normalized to lowercase.
 * Removes empty entries and trims whitespace.
 */
export function parseAllowedDomains(): string[] {
  const raw = process.env.AUTH_ALLOWED_DOMAINS || '';
  if (!raw.trim()) return [];

  return raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}

/**
 * Parse comma-separated emails from env, normalized to lowercase.
 * Removes empty entries and trims whitespace.
 */
export function parseAllowedEmails(): string[] {
  const raw = process.env.AUTH_ALLOWED_EMAILS || '';
  if (!raw.trim()) return [];

  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

/**
 * Check if an email is allowed based on the allowlist configuration.
 *
 * @param email - The email to check (can be null/undefined)
 * @returns true if allowed, false otherwise
 *
 * Logic:
 * 1. If email is null/undefined: not allowed
 * 2. If both allowlists are empty: allow (OSS mode)
 * 3. Otherwise: check if email matches allowed emails or domains
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  // No email provided - not allowed
  if (!email) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const allowedDomains = parseAllowedDomains();
  const allowedEmails = parseAllowedEmails();

  // If both lists are empty, allow everyone (OSS default)
  if (allowedDomains.length === 0 && allowedEmails.length === 0) {
    return true;
  }

  // Check if email is in the allowed emails list
  if (allowedEmails.includes(normalizedEmail)) {
    return true;
  }

  // Check if email domain is in the allowed domains list
  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex !== -1) {
    const domain = normalizedEmail.slice(atIndex + 1);
    if (allowedDomains.includes(domain)) {
      return true;
    }
  }

  return false;
}
