/**
 * NextAuth API Route Handler
 *
 * Exports GET and POST handlers for all /api/auth/* routes.
 * Configuration is in src/auth.ts
 */

import { handlers } from '@/auth';

export const { GET, POST } = handlers;
