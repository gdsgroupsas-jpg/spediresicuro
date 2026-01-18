#!/bin/bash

# =====================================================
# Script: renumber-duplicate-migrations.sh
# Descrizione: Rinumera migration duplicate 110-111
# Data: 2026-01-18
# =====================================================

# ⚠️ WARNING: ESEGUIRE SOLO DOPO VERIFICA PRODUCTION DB
# ⚠️ Questo script rinumera le migration duplicate per evitare conflitti

set -e  # Exit on error

echo "==================================================="
echo "MIGRATION RENUMBERING SCRIPT"
echo "==================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Confirm before proceeding
echo -e "${YELLOW}⚠️  WARNING: This script will rename migration files${NC}"
echo -e "${YELLOW}⚠️  Make sure you have:${NC}"
echo -e "${YELLOW}   1. Verified production DB state${NC}"
echo -e "${YELLOW}   2. Backed up the migrations folder${NC}"
echo -e "${YELLOW}   3. Committed current changes to git${NC}"
echo ""
read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo -e "${RED}Aborted by user${NC}"
  exit 1
fi

cd supabase/migrations

echo ""
echo "==================================================="
echo "STEP 1: Backup Current State"
echo "==================================================="

# Create backup
BACKUP_DIR="../migrations_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp *.sql "$BACKUP_DIR/"
echo -e "${GREEN}✓ Backup created: $BACKUP_DIR${NC}"

echo ""
echo "==================================================="
echo "STEP 2: Renumber Migration 110 (Triple)"
echo "==================================================="

# 110a: Keep as 110 (vat_semantics - must be first)
echo "110_add_vat_semantics_to_price_lists.sql → 110 (unchanged)"

# 110b: Rename to 112 (invoice_xml - depends on schema)
if [ -f "110_invoice_xml_and_recharge_billing.sql" ]; then
  git mv "110_invoice_xml_and_recharge_billing.sql" "113_invoice_xml_and_recharge_billing.sql"
  echo -e "${GREEN}✓ 110_invoice_xml_and_recharge_billing.sql → 113_invoice_xml_and_recharge_billing.sql${NC}"
else
  echo -e "${YELLOW}⚠️  110_invoice_xml_and_recharge_billing.sql not found (may already be renamed)${NC}"
fi

# 110c: Rename to 113 (admin_overview_stats)
if [ -f "110_admin_overview_stats_function.sql" ]; then
  git mv "110_admin_overview_stats_function.sql" "114_admin_overview_stats_function.sql"
  echo -e "${GREEN}✓ 110_admin_overview_stats_function.sql → 114_admin_overview_stats_function.sql${NC}"
else
  echo -e "${YELLOW}⚠️  110_admin_overview_stats_function.sql not found (may already be renamed)${NC}"
fi

echo ""
echo "==================================================="
echo "STEP 3: Renumber Migration 111 (Double)"
echo "==================================================="

# 111a: Keep as 111 (vat_mode_migration - depends on 110)
echo "111_migrate_legacy_vat_mode.sql → 111 (unchanged)"

# 111b: Rename to 115 (admin_overview_stats_fix - depends on 114)
if [ -f "111_admin_overview_stats_function_fix.sql" ]; then
  git mv "111_admin_overview_stats_function_fix.sql" "115_admin_overview_stats_function_fix.sql"
  echo -e "${GREEN}✓ 111_admin_overview_stats_function_fix.sql → 115_admin_overview_stats_function_fix.sql${NC}"
else
  echo -e "${YELLOW}⚠️  111_admin_overview_stats_function_fix.sql not found (may already be renamed)${NC}"
fi

echo ""
echo "==================================================="
echo "STEP 4: Verification"
echo "==================================================="

echo ""
echo "Current migration order (110-115):"
ls -1 {110,111,112,113,114,115}_*.sql 2>/dev/null | sed 's/^/  /' || echo "  (none found)"

echo ""
echo "==================================================="
echo "STEP 5: Update Internal References"
echo "==================================================="

# Update references in SQL files (if any)
echo "Checking for internal references to renamed migrations..."

for file in 113_invoice_xml_and_recharge_billing.sql 114_admin_overview_stats_function.sql 115_admin_overview_stats_function_fix.sql; do
  if [ -f "$file" ]; then
    # Update comments referencing old migration number
    sed -i.bak "s/Migration: 110_/Migration: $(echo $file | cut -d_ -f1)_/g" "$file" 2>/dev/null || true
    sed -i.bak "s/Migration: 111_/Migration: $(echo $file | cut -d_ -f1)_/g" "$file" 2>/dev/null || true
    rm -f "$file.bak"
    echo -e "${GREEN}✓ Updated references in $file${NC}"
  fi
done

echo ""
echo "==================================================="
echo "FINAL MIGRATION ORDER (110-115)"
echo "==================================================="
echo ""
echo "110 → 110_add_vat_semantics_to_price_lists.sql (schema)"
echo "111 → 111_migrate_legacy_vat_mode.sql (data migration)"
echo "112 → 112_create_reseller_pricing_policies.sql (new table)"
echo "113 → 113_invoice_xml_and_recharge_billing.sql (invoice features)"
echo "114 → 114_admin_overview_stats_function.sql (stats function)"
echo "115 → 115_admin_overview_stats_function_fix.sql (fix stats)"
echo ""

echo -e "${GREEN}==================================================="
echo "✓ RENUMBERING COMPLETE"
echo "===================================================${NC}"
echo ""
echo "NEXT STEPS:"
echo "1. Review changes: git diff"
echo "2. Test migrations in local/staging environment"
echo "3. Commit changes: git add . && git commit -m 'refactor: Renumber duplicate migrations 110-111'"
echo "4. Update MIGRATION_MEMORY.md with new numbers"
echo ""
echo "ROLLBACK (if needed):"
echo "  git reset --hard HEAD"
echo "  cp $BACKUP_DIR/*.sql ."
echo ""
