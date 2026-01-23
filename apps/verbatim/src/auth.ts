/**
 * Auth.js (NextAuth v5) Configuration
 *
 * Provides Google OAuth authentication with Prisma adapter.
 * Uses JWT sessions for edge middleware compatibility.
 * User and Account records are still persisted to database via adapter.
 */

import NextAuth from 'next-auth';
import type { NextAuthResult } from 'next-auth';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { db } from '@/lib/db';
import { isEmailAllowed } from '@/lib/auth/allowlist';

// Import type augmentations for session.user.id and session.user.role
import '@/lib/auth/types';

const debug = process.env.AUTH_DEBUG === '1';

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
  // Use JWT sessions for edge middleware compatibility
  // User/Account records still persist to database via adapter
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    /**
     * signIn callback - enforce email allowlist
     * Returns false to reject sign-in, true to allow
     */
    async signIn({ user }) {
      const allowed = isEmailAllowed(user.email);
      if (!allowed) {
        if (debug) {
          console.warn(`[auth] Sign-in rejected for email: ${user.email}`);
        }
        // Redirect to not-authorized instead of showing error
        return '/auth/not-authorized';
      }
      if (debug) {
        console.log(`[auth] Sign-in allowed for email: ${user.email}`);
      }
      return true;
    },

    /**
     * jwt callback - populate JWT token with user data for edge middleware
     * This runs when the token is created or updated
     */
    async jwt({ token, user }) {
      // On sign-in, copy user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;

        // Fetch role from database
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        });
        token.role = dbUser?.role ?? 'member';

        if (debug) {
          console.log(`[auth] JWT created for user ${user.id}, role: ${token.role}`);
        }
      }

      return token;
    },

    /**
     * session callback - expose user data in session
     * This runs every time the session is checked
     */
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
        session.user.role = (token.role as string) ?? 'member';
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
