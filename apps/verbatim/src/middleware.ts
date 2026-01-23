/**
 * Middleware for route protection
 *
 * Protects /pilot/* routes with authentication and allowlist checks.
 * Future phases may extend this to protect API routes.
 *
 * IMPORTANT: This middleware runs on Edge runtime and must NOT import
 * Prisma/pg or any Node.js-only modules. Uses next-auth/jwt for token
 * decoding instead of the auth() wrapper.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isEmailAllowed } from '@/lib/auth/allowlist';

const debug = process.env.AUTH_DEBUG === '1';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Only protect /pilot/* routes
  if (!pathname.startsWith('/pilot')) {
    return NextResponse.next();
  }

  // Get auth secret (try AUTH_SECRET first, fallback to NEXTAUTH_SECRET)
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  // Decode JWT token (Edge-compatible)
  const token = await getToken({ req, secret });

  if (debug) {
    console.log(`[middleware] Path: ${pathname}, Token exists: ${!!token}`);
  }

  // Not signed in - redirect to sign-in page
  if (!token) {
    if (debug) {
      console.log(`[middleware] No token found, redirecting to sign-in`);
    }
    const signInUrl = new URL('/auth/signin', req.url);
    // Preserve full path including query params
    const callbackUrl = pathname + search;
    signInUrl.searchParams.set('callbackUrl', callbackUrl);
    return NextResponse.redirect(signInUrl);
  }

  // Extract email from token (handle both string and null/undefined)
  const email = typeof token.email === 'string' ? token.email : null;

  if (debug) {
    console.log(`[middleware] Token email: ${email}`);
  }

  // Signed in but not allowlisted - redirect to not-authorized page
  if (!isEmailAllowed(email)) {
    if (debug) {
      console.log(`[middleware] Email not allowed: ${email}, redirecting to not-authorized`);
    }
    const notAuthorizedUrl = new URL('/auth/not-authorized', req.url);
    return NextResponse.redirect(notAuthorizedUrl);
  }

  if (debug) {
    console.log(`[middleware] Access granted for email: ${email}`);
  }

  // Signed in and allowlisted - allow access
  return NextResponse.next();
}

/**
 * Matcher configuration for middleware
 * Only run middleware on /pilot/* routes
 */
export const config = {
  matcher: ['/pilot/:path*'],
};
