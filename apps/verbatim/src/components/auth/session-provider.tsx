/**
 * Session Provider Wrapper
 *
 * Client component wrapper for NextAuth SessionProvider.
 * Enables useSession() hook in client components.
 */

'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
