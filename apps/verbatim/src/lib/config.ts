/**
 * Application configuration.
 * Environment variable validation and defaults.
 */

export const config = {
  // Feature flags
  enableFreshdeskTickets: process.env.ENABLE_FRESHDESK_TICKETS === 'true',

  // Debug mode
  debug: process.env.DEBUG === 'true',

  // Chunking defaults (per ARCHITECTURE.md Section 8.4)
  chunking: {
    maxChars: 4000,
    overlapChars: 400,
  },
} as const;
