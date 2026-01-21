# Supabase Migrations Strategy

## Overview

This project uses **timestamp-based migrations** managed via the Supabase Dashboard.

## Migration Format

All migrations must use the timestamp format: `YYYYMMDDHHMMSS_description.sql`

Example: `20251221201850_audit_actor_schema.sql`

## Current Migrations

| Migration                                   | Description             | Applied       |
| ------------------------------------------- | ----------------------- | ------------- |
| `20251221201850_audit_actor_schema.sql`     | Audit actor schema      | ✅ Production |
| `20251229120000_fix_reseller_role_null.sql` | Fix null reseller roles | ✅ Production |

## Legacy Files

The following files are **NOT migrations** but utility SQL scripts:

- `110_admin_overview_stats_function.sql` - Admin stats RPC
- `111_admin_overview_stats_function_fix.sql` - Fix for above
- `112_cascading_platform_fees.sql` - Fee cascade logic
- `112_create_reseller_pricing_policies.sql` - Reseller policies

These are applied manually via Dashboard SQL Editor when needed, not through migration system.

## Recreating a Fresh Environment

1. **Create new Supabase project** at [supabase.com](https://supabase.com)

2. **Apply base schema** - Import from production using Supabase CLI:

   ```bash
   supabase db dump --db-url "postgresql://..." > schema.sql
   ```

3. **Apply timestamp migrations** in order:

   ```bash
   supabase db push
   ```

4. **Configure environment variables** in `.env.local`

## Why No Sequential Migrations?

The sequential files (`001_`, `002_`, etc.) were removed on 2026-01-18 because:

- Production DB already had working schema
- Sequential files were never applied (created for documentation)
- Caused confusion with duplicate numbers (110, 111, 112)
- Supabase Dashboard uses timestamp-based migrations

See commit `ee09a20` for details.

## Adding New Migrations

1. Create file with timestamp:

   ```bash
   touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql
   ```

2. Write SQL migration

3. Apply via Dashboard or CLI:

   ```bash
   supabase db push
   ```

4. Commit to repository

## Production DB Info

- **Provider**: Supabase (hosted)
- **Region**: EU (Frankfurt)
- **Applied migrations**: Managed via Supabase Dashboard
