-- ============================================
-- Migration: Fix reseller_role NULL for existing resellers
-- Date: 2025-12-29
-- Description: Aggiorna account reseller esistenti che hanno is_reseller=true ma reseller_role=NULL
--              Questo fix è necessario perché toggleResellerStatus() non settava reseller_role
--              fino alla correzione del 2025-12-29
-- ============================================

-- Aggiorna tutti gli account reseller che hanno reseller_role NULL
-- Questi account sono stati probabilmente promossi a reseller con toggleResellerStatus()
-- prima della fix che aggiunge automaticamente reseller_role='admin'
UPDATE users
SET
  reseller_role = 'admin',
  updated_at = NOW()
WHERE
  is_reseller = true
  AND reseller_role IS NULL;

-- Log del numero di record aggiornati
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Fix completato: % account reseller aggiornati con reseller_role=admin', updated_count;
END $$;
