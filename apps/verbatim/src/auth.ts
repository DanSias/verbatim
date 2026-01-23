/**
 * Auth.js (NextAuth v5) Configuration
 *
 * Provides Google OAuth authentication with Prisma adapter.
 * Includes email allowlist enforcement and user role in session.
 */

import NextAuth from 'next-auth';
import type { NextAuthResult } from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import { isEmailAllowed } from '@/lib/auth/allowlist';

// Import type augmentations for session.user.id and session.user.role
import '@/lib/auth/types';

/**
 * Initialize NextAuth with configuration
 */
const authResult: NextAuthResult = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  // Use database sessions (required for Prisma adapter with user roles)
  session: {
    strategy: 'database',
  },
  callbacks: {
    /**
     * signIn callback - enforce email allowlist
     * Returns false to reject sign-in, true to allow
     */
    async signIn({ user }) {
      const allowed = isEmailAllowed(user.email);
      if (!allowed) {
        // Log rejection for debugging
        console.warn(`[auth] Sign-in rejected for email: ${user.email}`);
        return false;
      }
      return true;
    },

    /**
     * session callback - include user.id and user.role in session
     * This runs every time the session is checked
     */
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Fetch role from database user record
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        session.user.role = dbUser?.role ?? 'member';
      }
      return session;
    },
  },
  pages: {
    // Custom error page for rejected sign-ins
    error: '/auth/error',
  },
  // Trust the host header in production (Vercel, proxies)
  trustHost: true,
});

// Export handlers and helper functions with explicit types
export const handlers: NextAuthResult['handlers'] = authResult.handlers;
export const signIn: NextAuthResult['signIn'] = authResult.signIn;
export const signOut: NextAuthResult['signOut'] = authResult.signOut;
export const auth: NextAuthResult['auth'] = authResult.auth;
