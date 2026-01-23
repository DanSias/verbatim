/**
 * NextAuth Type Augmentations
 *
 * Extends the default NextAuth types to include custom user properties.
 */

import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Extend the Session interface to include user.id and user.role
   */
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession['user'];
  }
}
