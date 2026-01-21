# 📊 Migration Audit Trail

## Overview

This document tracks all database migrations applied to the SpedireSicuro database. Migrations are numbered sequentially and **must be idempotent** (safe to run multiple times).

**Total Migrations:** 49 (as of December 21, 2025)

---

## Migration Principles

### Rules

1. **Idempotent:** Always use `IF NOT EXISTS`, `IF EXISTS`, `DO $$ BEGIN ... END $$`
2. **Backward Compatible:** Don't drop columns immediately (deprecate first, drop later)
3. **Small Commits:** One logical change per migration
4. **Tested Locally:** Always test with `npx supabase db reset` before production
5. **Rollback Plan:** Include rollback instructions in comments or separate file

### Naming Convention

```
NNN_description.sql
```

- `NNN`: Sequential number (001, 002, ..., 035)
- `description`: Kebab-case description of change

### Migration Template

```sql
-- ============================================
-- MIGRATION: NNN_description.sql
-- DESCRIZIONE: Brief description in Italian
-- DATA: YYYY-MM
-- PREREQUISITO: Previous migrations required
-- ============================================

-- Check if change needed
DO $$
BEGIN
  IF NOT EXISTS (...) THEN
    -- Apply change
    ...
    RAISE NOTICE '✅ Applied: ...';
  ELSE
    RAISE NOTICE '⚠️ Already exists: ...';
  END IF;
END $$;

-- Completamento
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: NNN_description';
END $$;
```

---

## Migration History

### Phase 1: Core Schema (001-010)

#### 001_complete_schema.sql

**Date:** Initial setup  
**Description:** Complete schema for logistics platform  
**Changes:**

- Created core tables: `users`, `couriers`, `shipments`, `price_lists`
- Created ENUMs: `user_role`, `shipment_status`, `courier_service_type`
- Added indexes for performance
- Initial RLS policies

**Breaking Changes:** None (initial setup)

---

#### 002_anne_setup.sql

**Date:** Q1 2025  
**Description:** Setup for Anne, AI Executive Business Partner  
**Changes:**

- Created `audit_logs` table for AI interaction logging
- Added AI conversation tracking

**Breaking Changes:** None

---

#### 003_fix_security_issues.sql

**Date:** Q1 2025  
**Description:** Security fixes from Security Advisor audit  
**Changes:**

- Enhanced RLS policies on `users` table
- Fixed permission leaks
- Added security constraints

**Breaking Changes:** None

---

#### 006_roles_and_permissions.sql

**Date:** Q1 2025  
**Description:** Role-based access control system  
**Changes:**

- Created `killer_features`, `user_features`, `role_permissions` tables
- Implemented feature flag system
- Added admin action logging

**Breaking Changes:** None

---

#### 009_create_superadmin.sql

**Date:** Q1 2025  
**Description:** Create initial SuperAdmin user  
**Changes:**

- Inserted first SuperAdmin account
- Set up admin permissions

**Breaking Changes:** None

---

#### 009_gdpr_privacy_policies.sql

**Date:** Q1 2025  
**Description:** GDPR compliance features  
**Changes:**

- Added privacy consent tracking
- Data export capabilities
- Anonymization support

**Breaking Changes:** None

---

#### 010_courier_configs_system.sql

**Date:** Q2 2025  
**Description:** Courier API credentials management  
**Changes:**

- Created `courier_configs` table
- Encrypted password storage
- Session data support

**Breaking Changes:** Deprecated environment-variable-based courier auth

---

### Phase 2: Automation & Monitoring (011-018)

#### 013_audit_logs_unified_schema.sql

**Date:** Q2 2025  
**Description:** Unified audit logging schema  
**Changes:**

- Reconciled multiple audit_logs implementations
- Standardized audit metadata format
- Added indexes for performance

**Breaking Changes:** Merged duplicate audit_logs tables

---

#### 016_automation_locks.sql

**Date:** Q2 2025  
**Description:** Prevent automation race conditions  
**Changes:**

- Created `automation_locks` table
- Prevents concurrent automation runs
- Auto-expiring locks

**Breaking Changes:** None

---

#### 017_encrypt_automation_passwords.sql

**Date:** Q2 2025  
**Description:** Encrypt stored automation passwords  
**Changes:**

- Migrated plaintext passwords to encrypted
- Uses `ENCRYPTION_KEY` environment variable

**Breaking Changes:** Requires `ENCRYPTION_KEY` to be set

---

#### 018_FINAL_UNIFIED_ANNE_COMPLETE.sql

**Date:** Q2 2025  
**Description:** Complete Anne AI integration  
**Changes:**

- Finalized AI conversation schema
- Added multimodal input support
- LangGraph state tracking

**Breaking Changes:** None

---

### Phase 3: Financial System (019-030)

#### 019_reseller_system_and_wallet.sql

**Date:** Q3 2025  
**Description:** Reseller hierarchy and wallet system  
**Changes:**

- Added `wallet_balance` to `users`
- Created `wallet_transactions` table
- Reseller parent-child relationships
- Wallet auto-update trigger

**Breaking Changes:** None (additive)

**Critical:**

- `wallet_balance` has CHECK constraint (>= 0)
- Trigger auto-updates balance on transaction insert

---

#### 020_advanced_price_lists_system.sql

**Date:** Q3 2025  
**Description:** Advanced pricing for resellers  
**Changes:**

- Created advanced price list tables
- Per-reseller pricing
- Zone-based pricing

**Breaking Changes:** None

---

#### 025_add_invoices_system.sql

**Date:** Q4 2025  
**Description:** Invoice and revenue tracking  
**Changes:**

- Created `invoices` and `invoice_items` tables
- Invoice generation support
- Payment tracking

**Breaking Changes:** None

---

#### 026_add_leads_system.sql

**Date:** Q4 2025  
**Description:** CRM lead management  
**Changes:**

- Created `leads` table
- Lead status workflow
- Conversion tracking to users

**Breaking Changes:** None

---

#### 027_wallet_topups.sql

**Date:** December 2025  
**Description:** Bank transfer top-up requests  
**Changes:**

- Created `top_up_requests` table
- Manual approval workflow
- File upload support

**Breaking Changes:** None

---

#### 028_wallet_security_fixes.sql

**Date:** December 2025  
**Description:** Wallet security hardening  
**Changes:**

- Added €10,000 limit to `add_wallet_credit()` function
- Added `file_hash` column for duplicate detection
- Added `approved_by`, `approved_at`, `approved_amount` tracking

**Breaking Changes:**

- `add_wallet_credit()` now rejects amounts > €10,000
- Requires splitting large top-ups

**Critical:**

- Prevents fraud via large single transactions
- File hash prevents duplicate receipt uploads

---

#### 029_add_topup_update_policy.sql

**Date:** December 2025  
**Description:** RLS policy for top-up admin updates  
**Changes:**

- Added UPDATE policy for admins on `top_up_requests`

**Breaking Changes:** None

---

#### 030_add_topup_approve_function.sql

**Date:** December 2025  
**Description:** Dedicated function for approving top-ups  
**Changes:**

- Created `approve_top_up_request()` RPC function
- Atomic approval workflow
- Status validation

**Breaking Changes:** None

---

### Phase 4: Security & Compliance (031-035)

#### 033_fix_shipments_rls_security.sql

**Date:** December 2025  
**Description:** Enhanced shipment RLS policies  
**Changes:**

- Fixed RLS policy leaks
- Ensured tenant isolation
- Admin override support

**Breaking Changes:** None

---

#### 034_remediate_orphan_shipments.sql

**Date:** December 2025  
**Description:** Cleanup orphan shipments (no valid user)  
**Changes:**

- Identified orphan shipments
- Created cleanup script
- Added compensation queue entries

**Breaking Changes:** None

---

#### 035_prevent_orphan_shipments.sql

**Date:** December 2025  
**Description:** Prevent future orphan shipments  
**Changes:**

- Added RLS policy to reject shipments with deleted users
- Added CHECK constraint on user_id foreign key

**Breaking Changes:** None

**Critical:**

- Prevents data integrity issues
- Shipment creation fails if user doesn't exist

---

#### 20251221201850_audit_actor_schema.sql

**Date:** December 21, 2025  
**Description:** Acting Context audit schema  
**Changes:**

- Added `actor_id`, `target_id` columns to `audit_logs`
- Added `impersonation_active` flag
- Created `log_acting_context_audit()` RPC function
- Migrated legacy audit logs to new schema

**Breaking Changes:** None (backward compatible)

**Critical:**

- Enables impersonation tracking
- All new audit logs use acting context

---

## Migration Statistics

### By Category

- **Core Schema:** 10 migrations
- **Security:** 8 migrations
- **Financial:** 12 migrations
- **Automation:** 6 migrations
- **AI/Anne:** 5 migrations
- **CRM/Leads:** 2 migrations
- **Other:** 6 migrations

### Breaking Changes Summary

Only 2 migrations introduced breaking changes:

1. **010_courier_configs_system.sql** - Deprecated env-var auth (soft break)
2. **028_wallet_security_fixes.sql** - Added €10k limit (hard break for large top-ups)

All other migrations are **backward compatible**.

---

## Pending Migrations (Backlog)

### Planned Q1 2026

- [ ] Add payment_transactions full implementation (XPay integration)
- [ ] Add invoice auto-generation trigger
- [ ] Add wallet transaction reconciliation job
- [ ] Add soft delete for users (deleted_at column)
- [ ] Add cascade delete rules review

### Future Considerations

- Database sharding for multi-region support
- Read replicas for analytics
- Partitioning for large tables (audit_logs, wallet_transactions)

---

## Rollback Procedures

### General Rollback

```sql
-- Most migrations are additive, so rollback = drop added objects

-- If migration added table
DROP TABLE IF EXISTS new_table CASCADE;

-- If migration added column
ALTER TABLE existing_table DROP COLUMN IF EXISTS new_column;

-- If migration added function
DROP FUNCTION IF EXISTS new_function(arg_types);

-- If migration modified data (NO EASY ROLLBACK - restore from backup)
```

### Critical Rollbacks

#### Rollback 028 (Wallet Security Fixes)

```sql
-- Remove limit from function (restore old version)
CREATE OR REPLACE FUNCTION add_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Remove MAX_SINGLE_AMOUNT check
  INSERT INTO wallet_transactions (user_id, amount, type, description, created_by)
  VALUES (p_user_id, p_amount, 'deposit', p_description, p_created_by)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove columns (non-destructive, keep data)
-- ALTER TABLE top_up_requests DROP COLUMN file_hash;  -- Don't drop, keep for safety
```

#### Rollback 035 (Prevent Orphan Shipments)

```sql
-- Drop RLS policy
DROP POLICY IF EXISTS "prevent_orphan_shipments" ON shipments;
```

---

## Best Practices Checklist

Before applying migration to production:

- [ ] Tested locally with `npx supabase db reset`
- [ ] Verified idempotent (can run multiple times)
- [ ] Checked for breaking changes
- [ ] Documented rollback procedure
- [ ] Reviewed by another developer
- [ ] Backed up production database (< 24h old)
- [ ] Scheduled during low-traffic window if impactful
- [ ] Prepared monitoring queries to verify success

---

## Tools

### Apply Migration

```bash
# Local testing
npx supabase db reset  # Applies all migrations from scratch

# Production (Supabase Dashboard)
# Copy migration SQL → Run in SQL Editor

# Production (CLI)
npx supabase link --project-ref [project-ref]
npx supabase db push
```

### Verify Migration Applied

```sql
-- Check migration history (if using Supabase migrations table)
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;

-- Verify specific table exists
SELECT EXISTS (
  SELECT 1 FROM pg_tables
  WHERE schemaname = 'public' AND tablename = 'your_table'
);

-- Verify specific column exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'your_table'
    AND column_name = 'your_column'
);
```

### Generate New Migration

```bash
npx supabase migration new your_migration_name
```

---

**Document Owner:** Database Team  
**Last Updated:** December 21, 2025  
**Review Cycle:** After each migration
