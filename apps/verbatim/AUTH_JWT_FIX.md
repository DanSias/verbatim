# Auth.js JWT Session Fix

## Problem Diagnosed

**Sign-in loop:** `/auth/signin` → Google OAuth → callback → back to `/auth/signin`

**Root cause:** Middleware expects JWT tokens (`getToken()`) but Auth.js was configured with database sessions (`strategy: 'database'`). With database sessions, no JWT token is created, so middleware always sees `null` and redirects back to sign-in.

## Solution Applied

Switched Auth.js to use **JWT sessions** while keeping the Prisma adapter for user/account persistence.

### Architecture

- **User & Account records**: Still persisted to database via `PrismaAdapter(db)`
- **Session management**: Handled via JWT tokens (no Session table writes)
- **Middleware**: Can validate authentication via `getToken()` (edge-compatible)
- **Role storage**: User roles fetched from database on sign-in, cached in JWT

## Files Changed

### 1. `src/auth.ts`

**Changed:**
- `session.strategy` from `'database'` to `'jwt'`
- Enhanced `jwt()` callback to populate token with `id`, `email`, `name`, `picture`, and `role`
- Simplified `session()` callback to read from token instead of database
- Updated `signIn()` callback to redirect non-allowlisted users to `/auth/not-authorized` (not error page)
- Added optional debug logging via `AUTH_DEBUG=1` env var

**Key changes:**
```typescript
// Before
session: { strategy: 'database' }

// After
session: { strategy: 'jwt' }

// JWT callback now populates token
async jwt({ token, user }) {
  if (user) {
    token.id = user.id;
    token.email = user.email;
    token.name = user.name;
    token.picture = user.image;
    // Fetch role from database on sign-in
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    token.role = dbUser?.role ?? 'member';
  }
  return token;
}

// Session callback reads from token
async session({ session, token }) {
  if (session.user && token) {
    session.user.id = token.id as string;
    session.user.email = token.email as string;
    session.user.name = token.name as string;
    session.user.image = token.picture as string;
    session.user.role = (token.role as string) ?? 'member';
  }
  return session;
}
```

### 2. `src/middleware.ts`

**Changed:**
- Added debug logging via `AUTH_DEBUG=1` env var
- Improved email type safety (handle `token.email` as `string | null | undefined`)
- Added debug logs for token presence, email extraction, and allowlist checks

**No breaking changes** - middleware was already edge-safe.

## Environment Variables

### Required (unchanged)
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/verbatim"
AUTH_SECRET="<generate with: openssl rand -base64 32>"
GOOGLE_CLIENT_ID="<from Google Cloud Console>"
GOOGLE_CLIENT_SECRET="<from Google Cloud Console>"
```

### Optional Allowlist (unchanged)
```bash
# Allow specific domains (comma-separated)
AUTH_ALLOWED_DOMAINS="company.com,partner.com"

# Allow specific emails (comma-separated)
AUTH_ALLOWED_EMAILS="admin@example.com,user@company.com"

# If both are empty: any Google account can sign in
```

### New: Optional Debug Logging
```bash
# Enable debug logging for auth and middleware
AUTH_DEBUG=1
```

When enabled, logs:
- `[auth] Sign-in allowed/rejected for email: ...`
- `[auth] JWT created for user ..., role: ...`
- `[middleware] Path: ..., Token exists: true/false`
- `[middleware] Token email: ...`
- `[middleware] Email not allowed: ..., redirecting...`
- `[middleware] Access granted for email: ...`

## Manual Test Steps

### Prerequisites
1. Start PostgreSQL database
2. Run `npm run db:push --workspace=apps/verbatim` (if not done already)
3. Run `npm run db:generate --workspace=apps/verbatim`
4. Ensure `.env` has all required auth variables

### Test 1: Successful Sign-In (Allowlisted User)

```bash
# Optional: Enable debug logging
export AUTH_DEBUG=1

# Start dev server
npm run dev --workspace=apps/verbatim
```

Steps:
1. Navigate to http://localhost:3000/pilot
2. **Expected:** Redirect to `/auth/signin?callbackUrl=/pilot`
3. Click "Sign in with Google"
4. **Expected:** Google OAuth consent screen
5. Complete OAuth (select your Google account)
6. **Expected:** Redirect back to `/pilot` ✅
7. **Expected:** Pilot dashboard loads successfully ✅

### Test 2: Rejected Sign-In (Non-Allowlisted User)

Set allowlist in `.env`:
```bash
AUTH_ALLOWED_DOMAINS="example.com"
```

Steps:
1. Sign out if signed in
2. Navigate to http://localhost:3000/pilot
3. Click "Sign in with Google"
4. Complete OAuth with an email NOT on example.com
5. **Expected:** Redirect to `/auth/not-authorized` ✅
6. **Expected:** See message "Access Not Authorized" ✅
7. **Expected:** Your email shown on page ✅

### Test 3: Session Persistence

Steps:
1. Sign in successfully (Test 1)
2. Navigate to http://localhost:3000/pilot/ask
3. **Expected:** Page loads without redirect ✅
4. Refresh page (Cmd+R)
5. **Expected:** Still authenticated, no redirect ✅
6. Close browser tab
7. Open new tab to http://localhost:3000/pilot
8. **Expected:** If JWT cookie still valid, no sign-in required ✅

### Test 4: Sign-Out Flow

Steps:
1. Sign in successfully
2. Navigate to http://localhost:3000/pilot
3. Click sign-out (if UI has button) or navigate to sign-out URL
4. **Expected:** Signed out, JWT cookie cleared ✅
5. Navigate to http://localhost:3000/pilot
6. **Expected:** Redirect to `/auth/signin` ✅

### Test 5: Open Allowlist (OSS Mode)

Remove allowlist from `.env`:
```bash
# Comment out or remove these lines:
# AUTH_ALLOWED_DOMAINS=""
# AUTH_ALLOWED_EMAILS=""
```

Steps:
1. Restart dev server (to pick up env changes)
2. Sign in with ANY Google account
3. **Expected:** Sign-in succeeds regardless of email domain ✅

## Verification Checklist

After applying fix:

- [ ] Dev server starts without errors
- [ ] No TypeScript compilation errors (ignore pre-existing warnings)
- [ ] Sign-in redirects to `/pilot` (not back to `/auth/signin`)
- [ ] Non-allowlisted users see `/auth/not-authorized`
- [ ] Session persists across page refreshes
- [ ] Middleware protects `/pilot/*` routes
- [ ] User and Account records created in database
- [ ] JWT token contains email for middleware access

## Database Impact

### Tables Still Used
- **User**: Created on first sign-in, stores email and role
- **Account**: Links User to Google OAuth provider
- **VerificationToken**: (if using email magic links - not currently)

### Table No Longer Used
- **Session**: Not written to when using JWT strategy

## Debugging Tips

### If sign-in still loops:

1. Check JWT secret is set:
```bash
echo $AUTH_SECRET
# Should output a base64 string
```

2. Enable debug logging:
```bash
export AUTH_DEBUG=1
npm run dev --workspace=apps/verbatim
```

3. Check middleware logs:
```
[middleware] Path: /pilot, Token exists: false
```
If token is `false` after sign-in, JWT strategy is not working.

4. Check browser cookies:
```javascript
// In browser console:
document.cookie
// Should see: authjs.session-token=...
```

5. Verify middleware can decode token:
```typescript
// Add temporary log in middleware.ts:
console.log('Token:', token);
// Should show: { id, email, name, role, ... }
```

### If allowlist not working:

1. Check env vars are loaded:
```bash
# In src/middleware.ts or src/auth.ts, temporarily add:
console.log('ALLOWED_DOMAINS:', process.env.AUTH_ALLOWED_DOMAINS);
console.log('ALLOWED_EMAILS:', process.env.AUTH_ALLOWED_EMAILS);
```

2. Check email normalization:
```typescript
// Emails are normalized to lowercase
// "Daniel@Example.com" becomes "daniel@example.com"
```

3. Check domain extraction:
```typescript
// Domain extracted after last @
// "user@mail.example.com" → domain is "example.com"
```

## Migration from Database Sessions

If you were previously using database sessions:

1. **User/Account data**: Preserved (still in database)
2. **Active sessions**: Will be invalidated
   - Users need to sign in again after upgrade
   - Old Session records can be manually deleted (optional)

```sql
-- Optional: Clean up old database sessions
DELETE FROM "Session";
```

## Performance Impact

### Before (Database Sessions)
- Every authenticated page load: 1 database query (fetch session)
- Session writes on every auth change

### After (JWT Sessions)
- Authenticated page loads: 0 database queries
- JWT token decoded locally
- Database only queried on sign-in (to fetch role)

**Result:** Faster page loads, reduced database load.

## Security Considerations

### JWT Token Contents
- User ID, email, name, picture, role
- Signed with AUTH_SECRET (cannot be tampered)
- Stored in HTTP-only cookie (not accessible via JavaScript)

### Token Expiry
- Default: 30 days (Auth.js default)
- Can be customized via `jwt.maxAge` in auth.ts

### Role Updates
- User role changes require sign-out/sign-in to take effect
- Role cached in JWT token (not fetched on every request)
- Trade-off for performance (no DB query per request)

## Rollback Plan

If JWT sessions cause issues:

```typescript
// In src/auth.ts, change back to:
session: {
  strategy: 'database',
}

// Then restart dev server
```

**Note:** This will re-enable the sign-in loop bug. Middleware would need to be updated to not use `getToken()`.
