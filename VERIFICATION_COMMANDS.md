# Verification Commands

## Setup Commands (Run Once)

```bash
# 1. Navigate to app directory
cd apps/verbatim

# 2. Ensure Postgres is running
# (Check your local Postgres setup - Docker, Homebrew, etc.)

# 3. Generate Prisma Client with Auth.js models
npm run db:generate

# 4. Create database tables
npm run db:push

# 5. Start development server
npm run dev
```

## Verification Steps

### 1. Check Database Connection
```bash
# Test Postgres connection
psql postgresql://verbatim:verbatim@localhost:5432/verbatim -c "SELECT NOW();"
```

### 2. Verify Auth.js Tables Created
```sql
-- Connect to database
psql postgresql://verbatim:verbatim@localhost:5432/verbatim

-- List tables
\dt

-- Should see:
-- users
-- accounts
-- sessions
-- verification_tokens
-- workspaces
-- documents
-- chunks
-- conversations
-- messages
-- query_events
-- api_keys
```

### 3. Test OAuth Flow
```bash
# 1. Open browser to http://localhost:3000/pilot
# 2. Should redirect to /auth/signin?callbackUrl=/pilot
# 3. Click "Sign in with Google"
# 4. Complete OAuth consent
# 5. Should redirect to /pilot (if allowlisted) or /auth/not-authorized
```

### 4. Verify User Record Created
```sql
-- After first sign-in
SELECT id, email, name, role, "createdAt" FROM users;

-- Expected: One row with your Google account email
```

### 5. Verify Account Record Created
```sql
-- Check OAuth account linkage
SELECT
  a.provider,
  a.type,
  a."providerAccountId",
  u.email
FROM accounts a
JOIN users u ON a."userId" = u.id;

-- Expected: provider='google', type='oauth'
```

### 6. Verify Session Created
```sql
-- Check active session
SELECT
  s."sessionToken",
  s.expires,
  u.email
FROM sessions s
JOIN users u ON s."userId" = u.id;

-- Expected: One session with future expiry date
```

## Manual Testing Checklist

- [ ] Unauthenticated user visits /pilot → redirects to /auth/signin
- [ ] User signs in with allowlisted email → redirects to /pilot
- [ ] User signs in with non-allowlisted email → redirects to /auth/not-authorized
- [ ] User refreshes /pilot → stays authenticated (session persists)
- [ ] User signs out → loses access to /pilot
- [ ] Middleware does not block /auth/signin or /auth/not-authorized

## Debug Commands

### Check Environment Variables
```bash
cd apps/verbatim
cat .env | grep -E "^(DATABASE_URL|AUTH_SECRET|GOOGLE_)"
```

### View Server Logs
```bash
# Watch for auth-related logs
npm run dev 2>&1 | grep -i auth
```

### Check Prisma Client Generation
```bash
# Verify Prisma client is generated
ls -la node_modules/.prisma/client/

# Should contain:
# - index.js
# - schema.prisma (copy)
# - libquery_engine-*.node
```

### Verify Middleware Bundling
```bash
# Build the app to check for edge runtime issues
npm run build

# Should NOT see errors about:
# - pg-connection-string
# - node:process
# - Prisma imports in middleware
```

## Common Fixes

### Fix: "Can't reach database server"
```bash
# Check if Postgres is running
pg_isready -h localhost -p 5432

# Start Postgres (varies by installation)
brew services start postgresql@14  # Homebrew
docker-compose up -d postgres       # Docker
```

### Fix: "DATABASE_URL environment variable is not set"
```bash
# Add to apps/verbatim/.env
echo 'DATABASE_URL="postgresql://verbatim:verbatim@localhost:5432/verbatim?schema=public"' >> .env
```

### Fix: "Invalid prisma.account.findUnique()"
```bash
# Recreate Auth.js tables
npm run db:push --force-reset
# WARNING: This drops ALL tables. Use with caution.
```

### Fix: Middleware import errors
```bash
# Verify middleware doesn't import db
grep -n "from '@/lib/db'" src/middleware.ts
# Should return nothing

# Verify middleware doesn't import auth
grep -n "from '@/auth'" src/middleware.ts
# Should return nothing
```

## Success Indicators

✅ Dev server starts without errors
✅ Visiting /pilot redirects unauthenticated users
✅ Google OAuth flow completes successfully
✅ User record created in database
✅ Session persists across page reloads
✅ Allowlist enforcement works correctly
✅ No middleware bundling errors in build

## Rollback Plan

If auth breaks completely:

```bash
# 1. Remove auth tables (preserves workspace data)
psql postgresql://verbatim:verbatim@localhost:5432/verbatim -c "
DROP TABLE IF EXISTS verification_tokens CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS users CASCADE;
"

# 2. Revert code changes
git checkout HEAD -- apps/verbatim/prisma/schema.prisma
git checkout HEAD -- apps/verbatim/src/auth.ts
git checkout HEAD -- apps/verbatim/src/lib/auth/types.ts
git checkout HEAD -- OPERATIONS.md

# 3. Regenerate Prisma client
npm run db:generate

# 4. Recreate tables
npm run db:push

# 5. Restart dev server
npm run dev
```
