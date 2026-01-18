# 🔄 HANDOVER: Migration Duplicate Fix

**Data**: 2026-01-18 19:00
**From**: Current session (M2 APM Implementation)
**To**: New dedicated session for migration cleanup
**Priority**: 🔴 CRITICAL - Zero Breaking Changes Required

---

## 📋 CONTEXT SUMMARY

### Current Status
- ✅ **M2 APM Implementation**: COMPLETE (PR #51 ready to merge)
- 🔴 **Migration Audit**: CRITICAL issue discovered - 20 duplicate numbers
- 📊 **Total Migrations**: 121 files, 96 unique numbers (21% duplication)

### Immediate Problem
**Migration 110-111 have recent duplicates** (Jan 16-18):
- `110_add_vat_semantics_to_price_lists.sql` (16 Gen)
- `110_admin_overview_stats_function.sql` (18 Gen)
- `110_invoice_xml_and_recharge_billing.sql` (18 Gen)
- `111_migrate_legacy_vat_mode.sql` (16 Gen)
- `111_admin_overview_stats_function_fix.sql` (18 Gen)

**Current Branch**: `feature/invoice-recharges-billing`
**Last Migration**: `112_create_reseller_pricing_policies.sql`

---

## 🎯 MISSION FOR NEW SESSION

### Objective
Fix migration numbering duplications **without breaking production** or causing regressions.

### Success Criteria
1. ✅ Zero production downtime
2. ✅ No data loss or corruption
3. ✅ All existing migrations preserved
4. ✅ Future duplications prevented
5. ✅ Clear migration order established

### Constraints
- ⚠️ **CANNOT** delete or modify already-applied migrations
- ⚠️ **MUST** verify production DB state before any changes
- ⚠️ **MUST** maintain backward compatibility
- ⚠️ **MUST** test in staging before production

---

## 📁 FILES PREPARED

### 1. Audit Report
**File**: `MIGRATION_AUDIT_2026-01-18.md`
- Complete analysis of all duplications
- Risk assessment (P0/P1/P2)
- Remediation plan

### 2. Verification Script
**File**: `scripts/verify-production-migrations.sql`
- 8 verification queries for production DB
- Checks which migrations were applied
- Validates schema changes from each migration

### 3. Renumbering Script
**File**: `scripts/renumber-duplicate-migrations.sh`
- Automated renumbering of 110-111 duplicates
- Creates backup before changes
- Updates internal references
- **DO NOT RUN without production verification first!**

---

## 🔍 CRITICAL QUESTIONS TO ANSWER

### Phase 1: Production Verification
**Execute this first**:
```bash
psql -h <project>.supabase.co -U postgres.<ref> -d postgres \
  -f scripts/verify-production-migrations.sql > migration_status.txt
```

**Questions**:
1. Which migration numbers 110-111-112 are in `schema_migrations` table?
2. Does `price_lists` have columns `vat_mode` and `vat_included`?
3. Does function `get_admin_overview_stats()` exist?
4. Does `invoices` have `invoice_xml` column?
5. Does table `reseller_pricing_policies` exist?

### Phase 2: Strategy Decision

**Option A**: Timestamp-based naming (RECOMMENDED)
- Use: `supabase migration new <description>`
- Generates: `20260118_<timestamp>_<description>.sql`
- Pros: Never conflicts, standard Supabase practice
- Cons: Changes naming convention

**Option B**: Sequential renumbering
- Keep: `110_`, `111_`, `112_` format
- Renumber duplicates: 110→110,113,114 | 111→111,115
- Pros: Maintains current format
- Cons: Requires careful git history management

---

## 🗺️ RECOMMENDED APPROACH

### Step 1: Verify Production (30 mins)
```bash
# 1. Execute verification script
psql -f scripts/verify-production-migrations.sql > status.txt

# 2. Analyze results
cat status.txt | grep -A5 "MIGRATION 110-112 STATUS"

# 3. Check for conflicts
cat status.txt | grep -A10 "DUPLICATE MIGRATION RISK"
```

### Step 2: Decide Strategy (15 mins)
Based on production state:
- If production has ≤109: Safe to renumber
- If production has 110-111 mixed: Need careful analysis
- If production has all 110-111 duplicates: Create consolidation migrations

### Step 3A: If Timestamp-based Chosen (45 mins)
```bash
# 1. Keep existing 001-112 as-is (already in production)
# 2. From 113 onward, use timestamp format
supabase migration new next_feature

# 3. Update documentation
# 4. Create pre-commit hook to enforce timestamp format
```

### Step 3B: If Sequential Chosen (90 mins)
```bash
# 1. Backup migrations
cp -r supabase/migrations migrations_backup

# 2. Run renumbering script
bash scripts/renumber-duplicate-migrations.sh

# 3. Test in local environment
supabase db reset
supabase migration up

# 4. Deploy to staging
# 5. Verify no regressions
# 6. Deploy to production (with rollback plan)
```

### Step 4: Prevention (30 mins)
```bash
# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Prevent duplicate migration numbers
LAST=$(ls supabase/migrations/*.sql | grep -E '^[0-9]+_' | sed 's/.*\///;s/_.*//' | sort -n | tail -1)
for file in $(git diff --cached --name-only --diff-filter=A | grep 'supabase/migrations/.*\.sql'); do
  NUM=$(echo $file | sed 's/.*\///;s/_.*//')
  if [ "$NUM" -le "$LAST" ]; then
    echo "ERROR: Migration $NUM <= $LAST"
    exit 1
  fi
done
EOF
chmod +x .git/hooks/pre-commit
```

---

## 📊 EXPECTED OUTCOMES

### Immediate (This Session)
- ✅ Audit completed
- ✅ Verification script ready
- ✅ Renumbering script ready
- ✅ Handover document created

### Next Session (Migration Fix)
- ✅ Production state verified
- ✅ Strategy chosen and executed
- ✅ All duplications resolved
- ✅ Prevention mechanism in place
- ✅ Documentation updated

---

## 🚨 RED FLAGS TO WATCH

### During Verification
- ⚠️ If `schema_migrations` shows multiple versions of same number
- ⚠️ If schema checks fail (missing columns/tables)
- ⚠️ If functions are missing or have wrong signatures

### During Renumbering
- ⚠️ If git conflicts arise (multiple people working on migrations)
- ⚠️ If Supabase CLI fails to recognize new numbers
- ⚠️ If RLS policies reference old migration numbers

---

## 🔗 CONTEXT FOR NEW SESSION

### Current Branch State
```bash
# Branch: feature/invoice-recharges-billing
# Last commit: abaaac6 (migration audit)
# Files changed: 3 (audit report + 2 scripts)
# Status: Ready for migration fix
```

### Key Files to Review
1. `MIGRATION_AUDIT_2026-01-18.md` - Full analysis
2. `scripts/verify-production-migrations.sql` - Verification queries
3. `scripts/renumber-duplicate-migrations.sh` - Renumbering automation
4. `supabase/migrations/` - 121 migration files

### Environment
- Database: Supabase (hosted)
- Branch strategy: Feature branches → master
- Deployment: Vercel (auto-deploy on push to master)
- Current PR: #51 (M2 APM) - ready to merge

---

## 💡 TOKEN OPTIMIZATION TIPS

### For New Session

**DO**:
- ✅ Read only `MIGRATION_AUDIT_2026-01-18.md` (complete context)
- ✅ Execute `verify-production-migrations.sql` first
- ✅ Use `ls` to check current state (don't re-audit)
- ✅ Focus on migrations 110-112 only (recent ones)

**DON'T**:
- ❌ Re-read all 121 migration files
- ❌ Re-audit older duplications (002-090)
- ❌ Search entire codebase for migration references
- ❌ Analyze M2 APM implementation (different concern)

**Estimated Token Usage**:
- Context reading: ~10K tokens (audit report + verification results)
- Strategy execution: ~20K tokens (renumbering + testing)
- Documentation: ~5K tokens (update MIGRATION_MEMORY.md)
- **Total**: ~35K tokens (well within budget)

---

## 📞 HANDOVER CHECKLIST

### What's Done ✅
- [x] Migration audit complete (20 duplicates identified)
- [x] Verification script created
- [x] Renumbering script created
- [x] Audit report committed to git
- [x] Handover document prepared
- [x] Current session (M2 APM) ready to close

### What's Needed for Next Session ⏳
- [ ] Execute verification script on production DB
- [ ] Analyze verification results
- [ ] Choose strategy (timestamp vs sequential)
- [ ] Execute chosen strategy
- [ ] Test in staging
- [ ] Deploy to production
- [ ] Update MIGRATION_MEMORY.md
- [ ] Create prevention mechanism (pre-commit hook)

---

## 🎬 STARTING PROMPT FOR NEW SESSION

**Suggested prompt to start new chat**:

```
Ciao! Ho bisogno di fixare un problema critico con le migration SQL duplicate.

Context:
- 20 numeri di migration duplicati trovati (audit completo in MIGRATION_AUDIT_2026-01-18.md)
- Migration 110-111 sono recenti (16-18 Gen) e hanno duplicati
- Ultima migration: 112_create_reseller_pricing_policies.sql
- Obiettivo: Fix senza rotture o regressioni

File pronti:
1. MIGRATION_AUDIT_2026-01-18.md (audit completo)
2. scripts/verify-production-migrations.sql (verifica DB production)
3. scripts/renumber-duplicate-migrations.sh (rinumerazione automatica)

Prima di iniziare, devi:
1. Leggere MIGRATION_AUDIT_2026-01-18.md
2. Dirmi se posso eseguire verify-production-migrations.sql su production DB
3. Propormi strategia migliore (timestamp-based vs sequential renumbering)

Vincoli:
- Zero breaking changes
- Zero downtime
- Testare in staging prima di production
- Creare meccanismo prevenzione future duplicazioni

Procedi!
```

---

## ✅ SESSION HANDOVER COMPLETE

**Current Session**: Can now close after merging PR #51 (M2 APM)
**Next Session**: Dedicated to migration fix (estimated 2-3 hours)

**Branch to work on**: `feature/invoice-recharges-billing` (or create `fix/migration-duplicates`)

**Rollback Plan**: All scripts create backups automatically

**Success Metric**: `ls supabase/migrations/*.sql | sed 's/_.*//' | sort | uniq -d | wc -l` returns **0**

---

**Prepared by**: Claude Sonnet 4.5
**Date**: 2026-01-18 19:00
**Status**: Ready for handover
**Estimated effort**: 2-3 hours for complete resolution
