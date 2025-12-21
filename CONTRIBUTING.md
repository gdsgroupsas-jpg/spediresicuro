# 🤝 Contributing to SpedireSicuro

Thank you for your interest in contributing to SpedireSicuro! This document provides guidelines and best practices for contributing code.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Workflow](#development-workflow)
4. [Code Standards](#code-standards)
5. [Security Guidelines](#security-guidelines)
6. [Database Migrations](#database-migrations)
7. [Pull Request Process](#pull-request-process)
8. [Testing Requirements](#testing-requirements)

---

## Code of Conduct

- Be respectful and constructive in discussions
- Focus on the code, not the person
- Help others learn and improve
- Report security issues privately (see [SECURITY.md](docs/SECURITY.md))

---

## Getting Started

### Fork and Clone

```bash
# 1. Fork repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/spediresicuro.git
cd spediresicuro

# 3. Add upstream remote
git remote add upstream https://github.com/gdsgroupsas-jpg/spediresicuro.git

# 4. Install dependencies
npm install

# 5. Set up environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 6. Verify setup
npm run setup:check
```

### Sync with Upstream

```bash
# Fetch latest changes
git fetch upstream

# Merge into your main branch
git checkout main
git merge upstream/main

# Push to your fork
git push origin main
```

---

## Development Workflow

### Create a Branch

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or bugfix branch
git checkout -b fix/issue-123-description
```

### Make Changes

1. Write code following our [Code Standards](#code-standards)
2. Test locally (`npm run dev`)
3. Run linting and type checking:
   ```bash
   npm run lint
   npm run type-check
   ```
4. Commit with descriptive messages:
   ```bash
   git commit -m "feat: add shipment bulk import"
   # OR
   git commit -m "fix: prevent duplicate wallet transactions"
   ```

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Updating build tasks, package manager configs, etc.

**Examples:**
```
feat(wallet): add XPay credit card integration
fix(shipments): prevent orphan shipments after DB failure
docs(security): update RLS policy documentation
refactor(auth): migrate to requireSafeAuth() pattern
```

---

## Code Standards

### TypeScript

- **Strict Mode:** All code must compile with `strict: true`
- **No `any` types:** Use specific types or `unknown`
- **Explicit return types:** On all exported functions

```typescript
// ✅ Good
export async function getUser(id: string): Promise<User | null> {
  const { data } = await supabase.from('users').select('*').eq('id', id).single()
  return data
}

// ❌ Bad
export async function getUser(id) {
  return await supabase.from('users').select('*').eq('id', id).single()
}
```

### ESLint Rules

**Critical Rules:**
- **No direct `auth()` import** in `/app/api/**` and `/app/actions/**`
  - ✅ Use: `requireSafeAuth()` or `getSafeAuth()`
  - ❌ Banned: `import { auth } from '@/lib/auth-config'`

### React Components

- **Server Components by default:** Use `'use client'` only when needed
- **TypeScript interfaces:** Define props interfaces
- **Descriptive names:** `UserWalletBalance` not `Balance`

```typescript
// ✅ Good Server Component
interface UserWalletBalanceProps {
  userId: string
}

export async function UserWalletBalance({ userId }: UserWalletBalanceProps) {
  const balance = await getWalletBalance(userId)
  return <div>Balance: €{balance.toFixed(2)}</div>
}

// ✅ Good Client Component (when interactivity needed)
'use client'

interface WalletTopUpButtonProps {
  onSuccess: () => void
}

export function WalletTopUpButton({ onSuccess }: WalletTopUpButtonProps) {
  // ... interactive logic
}
```

### Styling

- **Tailwind CSS:** Use Tailwind utilities, avoid custom CSS
- **Shadcn/UI:** Prefer Shadcn components over custom components
- **Responsive:** Mobile-first (test on 320px width minimum)

---

## Security Guidelines

### Security Gate Checklist

**All PRs must pass these checks:**

#### Database Security
- [ ] All new tenant tables have RLS enabled
- [ ] All queries use `context.target.id` (not hardcoded user_id)
- [ ] No direct `supabaseAdmin` usage in client components

#### Authentication
- [ ] No `auth()` direct usage in `/app/api/**` or `/app/actions/**`
- [ ] Use `requireSafeAuth()` for all protected routes/actions
- [ ] Proper error handling (don't leak sensitive data in errors)

#### Audit Logging
- [ ] Audit log written for sensitive operations:
  - Shipment create/update/delete
  - Wallet credit/debit
  - User role changes
  - Impersonation start/stop
  - Courier credential access

#### Input Validation
- [ ] All user inputs validated with Zod schemas
- [ ] SQL injection prevention (use parameterized queries)
- [ ] XSS prevention (sanitize HTML if rendering user content)

#### Secrets
- [ ] No hardcoded secrets or API keys
- [ ] All secrets in environment variables
- [ ] `.env.local` not committed (in `.gitignore`)

**Example: Secure Server Action**
```typescript
'use server'

import { z } from 'zod'
import { requireSafeAuth } from '@/lib/safe-auth'
import { writeAuditLog } from '@/lib/security/audit-log'
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions'

const CreateShipmentSchema = z.object({
  recipient: z.object({
    name: z.string().min(1).max(100),
    address: z.string().min(1).max(200),
    // ... other fields
  }),
  // ... other fields
})

export async function createShipment(input: unknown) {
  // 1. Authenticate
  const context = await requireSafeAuth()
  
  // 2. Validate input
  const validated = CreateShipmentSchema.parse(input)
  
  // 3. Business logic
  const shipment = await createShipmentInternal(context.target.id, validated)
  
  // 4. Audit log
  await writeAuditLog({
    context,
    action: AUDIT_ACTIONS.CREATE_SHIPMENT,
    resourceType: 'shipment',
    resourceId: shipment.id,
  })
  
  return { success: true, data: shipment }
}
```

---

## Database Migrations

### Creating Migrations

```bash
# Create new migration
npx supabase migration new your_migration_name
```

### Migration Best Practices

**1. Idempotent:**
```sql
-- ✅ Good - Safe to run multiple times
CREATE TABLE IF NOT EXISTS my_table (...);
ALTER TABLE users ADD COLUMN IF NOT EXISTS new_column TEXT;

-- ❌ Bad - Fails on second run
CREATE TABLE my_table (...);
ALTER TABLE users ADD COLUMN new_column TEXT;
```

**2. Backward Compatible:**
```sql
-- ✅ Good - Add column with default
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';

-- ❌ Bad - Breaks existing code
ALTER TABLE users DROP COLUMN old_column;
```

**3. Include Rollback:**
```sql
-- Migration: Add status column
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Rollback (in comments or separate file):
-- ALTER TABLE users DROP COLUMN IF EXISTS status;
```

**4. Test Locally:**
```bash
# Reset DB and apply all migrations
npx supabase db reset

# Verify migration applied
npx supabase migration list
```

### Migration Template

```sql
-- ============================================
-- MIGRATION: NNN_description.sql
-- DESCRIZIONE: Brief description
-- DATA: YYYY-MM
-- PREREQUISITO: Previous migrations required (if any)
-- ROLLBACK: Instructions for rollback (if complex)
-- ============================================

DO $$ 
BEGIN
  -- Check if change needed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'new_column'
  ) THEN
    -- Apply change
    ALTER TABLE users ADD COLUMN new_column TEXT;
    RAISE NOTICE '✅ Added column: users.new_column';
  ELSE
    RAISE NOTICE '⚠️ Already exists: users.new_column';
  END IF;
END $$;

-- Final notice
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed: NNN_description';
END $$;
```

---

## Pull Request Process

### Before Opening PR

1. ✅ All tests pass (`npm run lint`, `npm run type-check`)
2. ✅ Code follows style guidelines
3. ✅ Security checklist completed (if applicable)
4. ✅ Documentation updated (if changing APIs or features)
5. ✅ Commit messages follow Conventional Commits

### Opening PR

**PR Title:** Use Conventional Commits format
```
feat: add bulk shipment import
fix: prevent duplicate wallet debits
docs: update security architecture
```

**PR Description Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changes Made
- Added X
- Fixed Y
- Updated Z

## Security Checklist (if applicable)
- [ ] RLS policies added/updated
- [ ] Audit logging implemented
- [ ] Input validation with Zod
- [ ] No secrets in code

## Testing
- [ ] Tested locally
- [ ] Added tests (if applicable)
- [ ] Verified with different user roles

## Screenshots (if UI changes)
[Add screenshots here]

## Related Issues
Closes #123
```

### PR Review

**Reviewers will check:**
- Code quality and style
- Security compliance
- Performance implications
- Test coverage
- Documentation accuracy

**Feedback:**
- Address all comments before merging
- Re-request review after changes
- Discuss disagreements constructively

---

## Testing Requirements

### Current Testing (Minimal)

```bash
# Type checking (required)
npm run type-check

# Linting (required)
npm run lint

# E2E tests (if available)
npm run test:e2e
```

### Future Testing (Recommended)

When adding tests, follow these patterns:

**Unit Tests (lib/ functions):**
```typescript
import { describe, it, expect } from 'vitest'
import { calculateWalletBalance } from '@/lib/wallet'

describe('calculateWalletBalance', () => {
  it('sums positive and negative transactions', () => {
    const transactions = [
      { amount: 100 },
      { amount: -50 },
      { amount: 25 },
    ]
    expect(calculateWalletBalance(transactions)).toBe(75)
  })
})
```

**Integration Tests (API routes):**
```typescript
import { POST } from '@/app/api/wallet/topup/route'

describe('POST /api/wallet/topup', () => {
  it('creates top-up request', async () => {
    const request = new Request('http://localhost:3000/api/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ amount: 100, fileUrl: 'https://...' }),
    })
    
    const response = await POST(request)
    expect(response.status).toBe(200)
  })
})
```

---

## Questions?

- **Technical questions:** Open a [GitHub Discussion](https://github.com/gdsgroupsas-jpg/spediresicuro/discussions)
- **Bug reports:** Open a [GitHub Issue](https://github.com/gdsgroupsas-jpg/spediresicuro/issues)
- **Security issues:** See [SECURITY.md](docs/SECURITY.md)

---

**Thank you for contributing to SpedireSicuro!** 🚀
