/**
 * Auth Module Exports
 *
 * Re-exports auth utilities and types.
 */

export { isEmailAllowed, parseAllowedDomains, parseAllowedEmails } from './allowlist';
export { generateApiKey, hashApiKey, verifyApiKey, isValidApiKeyFormat } from './api-keys';

// Type augmentations are auto-imported via src/auth.ts
