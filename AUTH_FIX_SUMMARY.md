# Auth.js Fix Summary

## Problems Fixed

### 1. Prisma Adapter Failure
**Root Cause:** Missing `url` parameter in `datasource db` block in schema.prisma
- Prisma couldn't connect to database
- Auth.js adapter couldn't query Account table

**Fix:** Added `url = env("DATABASE_URL")` to datasource configuration

### 2. Edge Middleware Compatibility
**Status:** Already correctly implemented
- Middleware uses `getToken` from `next-auth/jwt` (edge-compatible)
- Does NOT import Prisma or db client
- Allowlist logic is pure JavaScript (edge-safe)

### 3. JWT Token for Middleware
**Enhancement:** Added JWT callback to ensure token contains email and role
- Database sessions work for authenticated routes
- JWT tokens populated for edge middleware access
- Hybrid approach: best of both strategies

## Files Changed

### 1. `prisma/schema.prisma`
- Added `url = env("DATABASE_URL")` to datasource block

### 2. `src/auth.ts`
- Added `jwt()` callback to populate token with user id, email, and role
- Updated `session()` callback to handle both database and JWT strategies

### 3. `src/lib/auth/types.ts`
- Added JWT type augmentation for `id` and `role` fields

### 4. `OPERATIONS.md`
- Added Section 11.3: Database Setup
- Documents required `db:generate` and `db:push` steps
- Clarifies setup order: env vars → db setup → dev server

### 5. `src/middleware.ts`
- No changes needed (already edge-safe)

## Verification Steps

### Step 1: Start Postgres
```bash
# Ensure Postgres is running on localhost:5432
# Verify DATABASE_URL in .env points to running instance
```

### Step 2: Generate Prisma Client
```bash
cd apps/verbatim
npm run db:generate
```

Expected output: "Generated Prisma Client"

### Step 3: Push Schema to Database
```bash
npm run db:push
```

Expected output:
- Creates tables: users, accounts, sessions, verification_tokens
- Plus existing tables: workspaces, documents, chunks, etc.

### Step 4: Start Development Server
```bash
npm run dev
```

### Step 5: Test OAuth Flow
1. Navigate to http://localhost:3000/pilot
2. Should redirect to http://localhost:3000/auth/signin?callbackUrl=/pilot
3. Click "Sign in with Google"
4. Complete Google OAuth consent
5. Should redirect back to /pilot (if email is allowlisted)
6. OR redirect to /auth/not-authorized (if email not allowlisted)

### Step 6: Verify Middleware Protection
Test scenarios:
- ✅ Unauthenticated → /pilot → redirects to /auth/signin
- ✅ Authenticated + allowlisted → /pilot → access granted
- ✅ Authenticated + not allowlisted → /pilot → redirects to /auth/not-authorized

### Step 7: Verify Database Records
After successful sign-in:
```sql
-- Check User record created
SELECT id, email, name, role FROM users;

-- Check Account record created
SELECT provider, type FROM accounts WHERE "userId" = '<user-id>';

-- Check Session record created
SELECT "sessionToken", expires FROM sessions WHERE "userId" = '<user-id>';
```

## Environment Variables Required

```bash
# Database
DATABASE_URL="postgresql://verbatim:verbatim@localhost:5432/verbatim?schema=public"

# Auth.js Secret
AUTH_SECRET="<generate with: openssl rand -base64 32>"

# Google OAuth
GOOGLE_CLIENT_ID="<from Google Cloud Console>"
GOOGLE_CLIENT_SECRET="<from Google Cloud Console>"

# Optional: Allowlists (if empty, any Google account can sign in)
AUTH_ALLOWED_DOMAINS="rocketgate.com"
AUTH_ALLOWED_EMAILS="daniel@example.com"
```

## Architecture Decisions

### Why Database Sessions + JWT?
- **Database sessions**: Primary strategy for authenticated routes
  - User roles stored in DB, fetched on each session check
  - Supports immediate role changes
- **JWT tokens**: For edge middleware access
  - Contains email for allowlist checking
  - No database access in middleware (edge-compatible)
  - Token synced on sign-in via jwt() callback

### Why Not Pure JWT Sessions?
- Would work, but loses immediate role updates
- Database sessions are fine for App Router (not edge)
- Current hybrid gives best of both

### Middleware Edge Safety
- ✅ Uses `getToken` (edge-compatible)
- ✅ No Prisma imports
- ✅ No Node.js-only dependencies (pg, crypto)
- ✅ Pure JavaScript allowlist parsing
- ✅ `process.env` is available in edge runtime

## Common Issues

### Issue: "Can't reach database server"
**Solution:** Start Postgres before running db:push

### Issue: "Invalid prisma.account.findUnique() invocation"
**Solution:** Run `npm run db:push` to create Auth.js tables

### Issue: Middleware import errors (pg-connection-string)
**Status:** Fixed - middleware doesn't import auth.ts or db.ts

### Issue: Allowlist not working
**Check:**
1. ENV vars are set (AUTH_ALLOWED_DOMAINS or AUTH_ALLOWED_EMAILS)
2. Email format matches (case-insensitive)
3. Domain extracted correctly (after @)

## Next Steps

After verification:
1. Test sign-in with allowlisted email
2. Test sign-in with non-allowlisted email
3. Test direct /pilot access (should redirect)
4. Test sign-out flow
5. Verify session persistence across page reloads

## Migration Path for Existing Installs

If you've been running Verbatim without auth:
1. Pull latest code
2. Update .env with AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
3. Run `npm run db:generate`
4. Run `npm run db:push` (adds auth tables, preserves existing data)
5. Restart dev server
6. First user sign-in creates User + Account records

Existing workspace data is unaffected.
