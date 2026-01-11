/**
 * Script di correzione: Fix carrier_code e contract_code nei metadata dei price_lists
 * 
 * PROBLEMA: I valori sono invertiti nei metadata esistenti
 * - carrier_code contiene valori completi (es. "gls-GLS-5000") → dovrebbe essere solo "gls"
 * - contract_code contiene nomi semplici (es. "Gls") o è NULL → dovrebbe essere "gls-GLS-5000"
 * 
 * SCHEMA CORRETTO:
 * - carrier_code = solo prefisso (es. "gls") → nome base del corriere
 * - contract_code = codice completo (es. "gls-GLS-5000") → identificatore contratto univoco
 */

-- ============================================
-- STEP 1: Verifica dati attuali (prima della correzione)
-- ============================================
SELECT 
  id,
  name,
  list_type,
  status,
  metadata->>'carrier_code' as carrier_code_attuale,
  metadata->>'contract_code' as contract_code_attuale,
  CASE 
    WHEN metadata->>'carrier_code' LIKE '%-%' THEN 'DA CORREGGERE'
    ELSE 'OK'
  END as stato
FROM price_lists
WHERE metadata IS NOT NULL
  AND metadata->>'carrier_code' IS NOT NULL
ORDER BY created_at DESC;

-- ============================================
-- STEP 2: CORREZIONE - Caso principale
-- ============================================
-- Se carrier_code contiene trattini (es. "gls-GLS-5000"):
--   - Estrai prefisso per carrier_code (es. "gls")
--   - Sposta valore completo in contract_code (es. "gls-GLS-5000")
UPDATE price_lists
SET metadata = jsonb_set(
  jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{carrier_code}',
    to_jsonb(LOWER(split_part(metadata->>'carrier_code', '-', 1)))
  ),
  '{contract_code}',
  to_jsonb(metadata->>'carrier_code')
)
WHERE metadata IS NOT NULL
  AND metadata->>'carrier_code' IS NOT NULL
  AND metadata->>'carrier_code' LIKE '%-%' -- Contiene trattini (valore completo)
  AND (
    metadata->>'contract_code' IS NULL 
    OR metadata->>'contract_code' NOT LIKE '%-%' -- contract_code non è già completo
  );

-- ============================================
-- STEP 3: Verifica dati dopo la correzione
-- ============================================
SELECT 
  id,
  name,
  list_type,
  status,
  metadata->>'carrier_code' as carrier_code_corretto,
  metadata->>'contract_code' as contract_code_corretto,
  CASE 
    WHEN metadata->>'carrier_code' LIKE '%-%' THEN '⚠️ ANCORA DA CORREGGERE'
    WHEN metadata->>'contract_code' IS NULL THEN '⚠️ CONTRACT_CODE MANCANTE'
    ELSE '✅ OK'
  END as stato
FROM price_lists
WHERE metadata IS NOT NULL
  AND metadata->>'carrier_code' IS NOT NULL
ORDER BY created_at DESC;

-- ============================================
-- STEP 4: Riepilogo
-- ============================================
SELECT 
  COUNT(*) FILTER (WHERE metadata->>'carrier_code' LIKE '%-%') as da_correggere,
  COUNT(*) FILTER (WHERE metadata->>'carrier_code' NOT LIKE '%-%' AND metadata->>'contract_code' IS NOT NULL) as corretti,
  COUNT(*) as totali
FROM price_lists
WHERE metadata IS NOT NULL
  AND metadata->>'carrier_code' IS NOT NULL;

-- ============================================
-- STEP 5: Verifica dettagliata (per debug)
-- ============================================
-- Mostra tutti i listini con i loro metadata per verificare che siano corretti
SELECT 
  id,
  name,
  list_type,
  status,
  metadata->>'carrier_code' as carrier_code,
  metadata->>'contract_code' as contract_code,
  metadata->>'courier_config_id' as courier_config_id,
  CASE 
    WHEN metadata->>'carrier_code' LIKE '%-%' THEN '❌ DA CORREGGERE (carrier_code contiene trattini)'
    WHEN metadata->>'contract_code' IS NULL THEN '⚠️ CONTRACT_CODE MANCANTE'
    WHEN metadata->>'contract_code' NOT LIKE '%-%' THEN '⚠️ CONTRACT_CODE NON COMPLETO'
    ELSE '✅ OK'
  END as stato
FROM price_lists
WHERE metadata IS NOT NULL
  AND metadata->>'carrier_code' IS NOT NULL
ORDER BY created_at DESC;
