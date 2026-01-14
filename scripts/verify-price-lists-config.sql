-- ============================================
-- VERIFICA CONFIGURAZIONE LISTINI GLS vs POSTE ITALIANE
-- ============================================
-- 
-- Questo script verifica:
-- 1. list_type (supplier vs custom)
-- 2. master_list_id (se presente, il listino ha un master)
-- 3. default_margin_percent/default_margin_fixed (margini configurati)
-- 4. metadata (contract_code, carrier_code)
-- 
-- Esegui questa query nel Supabase SQL Editor
-- ============================================

-- LISTINI GLS ATTIVI
SELECT 
  pl.id,
  pl.name,
  pl.list_type,
  pl.master_list_id,
  pl.default_margin_percent,
  pl.default_margin_fixed,
  pl.status,
  pl.metadata->>'contract_code' as contract_code,
  pl.metadata->>'carrier_code' as carrier_code,
  pl.source_metadata->>'contract_code' as source_contract_code,
  pl.source_metadata->>'carrier_code' as source_carrier_code,
  pl.courier_id,
  pl.created_by,
  CASE 
    WHEN pl.list_type = 'custom' AND pl.master_list_id IS NOT NULL THEN 
      '✅ CUSTOM con master → supplierPrice calcolato'
    WHEN pl.list_type = 'supplier' AND pl.master_list_id IS NULL THEN 
      CASE 
        WHEN pl.default_margin_percent IS NULL AND pl.default_margin_fixed IS NULL THEN 
          '❌ SUPPLIER senza master e senza margine → supplierPrice = undefined, finalPrice = totalCost'
        ELSE 
          '⚠️ SUPPLIER senza master ma con margine → supplierPrice = undefined ma finalPrice = totalCost + margin'
      END
    WHEN pl.list_type = 'custom' AND pl.master_list_id IS NULL THEN 
      '⚠️ CUSTOM senza master → supplierPrice = undefined'
    ELSE 
      '❓ Configurazione non standard'
  END as analisi_logica
FROM price_lists pl
WHERE pl.status = 'active'
  AND (
    pl.metadata->>'carrier_code' ILIKE '%gls%' 
    OR pl.metadata->>'contract_code' ILIKE '%gls%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%gls%'
    OR pl.source_metadata->>'contract_code' ILIKE '%gls%'
    OR pl.name ILIKE '%gls%'
  )
ORDER BY pl.created_at DESC;

-- LISTINI POSTE ITALIANE ATTIVI
SELECT 
  pl.id,
  pl.name,
  pl.list_type,
  pl.master_list_id,
  pl.default_margin_percent,
  pl.default_margin_fixed,
  pl.status,
  pl.metadata->>'contract_code' as contract_code,
  pl.metadata->>'carrier_code' as carrier_code,
  pl.source_metadata->>'contract_code' as source_contract_code,
  pl.source_metadata->>'carrier_code' as source_carrier_code,
  pl.courier_id,
  pl.created_by,
  CASE 
    WHEN pl.list_type = 'custom' AND pl.master_list_id IS NOT NULL THEN 
      '✅ CUSTOM con master → supplierPrice calcolato'
    WHEN pl.list_type = 'supplier' AND pl.master_list_id IS NULL THEN 
      CASE 
        WHEN pl.default_margin_percent IS NULL AND pl.default_margin_fixed IS NULL THEN 
          '❌ SUPPLIER senza master e senza margine → supplierPrice = undefined, finalPrice = totalCost'
        ELSE 
          '⚠️ SUPPLIER senza master ma con margine → supplierPrice = undefined ma finalPrice = totalCost + margin'
      END
    WHEN pl.list_type = 'custom' AND pl.master_list_id IS NULL THEN 
      '⚠️ CUSTOM senza master → supplierPrice = undefined'
    ELSE 
      '❓ Configurazione non standard'
  END as analisi_logica
FROM price_lists pl
WHERE pl.status = 'active'
  AND (
    pl.metadata->>'carrier_code' ILIKE '%poste%' 
    OR pl.metadata->>'contract_code' ILIKE '%poste%'
    OR pl.metadata->>'carrier_code' ILIKE '%postedelivery%'
    OR pl.metadata->>'contract_code' ILIKE '%postedelivery%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%poste%'
    OR pl.source_metadata->>'contract_code' ILIKE '%poste%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%postedelivery%'
    OR pl.source_metadata->>'contract_code' ILIKE '%postedelivery%'
    OR pl.name ILIKE '%poste%'
    OR pl.name ILIKE '%pdb%'
  )
ORDER BY pl.created_at DESC;

-- CONFRONTO RIEPILOGATIVO
SELECT 
  'GLS' as corriere,
  COUNT(*) FILTER (WHERE pl.list_type = 'custom' AND pl.master_list_id IS NOT NULL) as custom_con_master,
  COUNT(*) FILTER (WHERE pl.list_type = 'supplier' AND pl.master_list_id IS NULL AND pl.default_margin_percent IS NULL AND pl.default_margin_fixed IS NULL) as supplier_senza_margine,
  COUNT(*) as totale_attivi
FROM price_lists pl
WHERE pl.status = 'active'
  AND (
    pl.metadata->>'carrier_code' ILIKE '%gls%' 
    OR pl.metadata->>'contract_code' ILIKE '%gls%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%gls%'
    OR pl.source_metadata->>'contract_code' ILIKE '%gls%'
    OR pl.name ILIKE '%gls%'
  )

UNION ALL

SELECT 
  'Poste Italiane' as corriere,
  COUNT(*) FILTER (WHERE pl.list_type = 'custom' AND pl.master_list_id IS NOT NULL) as custom_con_master,
  COUNT(*) FILTER (WHERE pl.list_type = 'supplier' AND pl.master_list_id IS NULL AND pl.default_margin_percent IS NULL AND pl.default_margin_fixed IS NULL) as supplier_senza_margine,
  COUNT(*) as totale_attivi
FROM price_lists pl
WHERE pl.status = 'active'
  AND (
    pl.metadata->>'carrier_code' ILIKE '%poste%' 
    OR pl.metadata->>'contract_code' ILIKE '%poste%'
    OR pl.metadata->>'carrier_code' ILIKE '%postedelivery%'
    OR pl.metadata->>'contract_code' ILIKE '%postedelivery%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%poste%'
    OR pl.source_metadata->>'contract_code' ILIKE '%poste%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%postedelivery%'
    OR pl.source_metadata->>'contract_code' ILIKE '%postedelivery%'
    OR pl.name ILIKE '%poste%'
    OR pl.name ILIKE '%pdb%'
  );

-- ============================================
-- QUERY DETTAGLIATA: Listini CUSTOM con margini
-- ============================================
-- Verifica se i listini CUSTOM hanno margini configurati

SELECT 
  pl.id,
  pl.name,
  pl.list_type,
  pl.master_list_id,
  pl.default_margin_percent,
  pl.default_margin_fixed,
  pl.status,
  pl.metadata->>'contract_code' as contract_code,
  CASE 
    WHEN pl.list_type = 'custom' AND pl.master_list_id IS NOT NULL THEN 
      CASE 
        WHEN pl.default_margin_percent IS NULL AND pl.default_margin_fixed IS NULL THEN 
          '❌ CUSTOM con master ma SENZA margine → supplierPrice calcolato ma finalPrice = totalCost (senza margine)'
        ELSE 
          '✅ CUSTOM con master e CON margine → OK'
      END
    ELSE 
      'N/A'
  END as analisi_dettagliata
FROM price_lists pl
WHERE pl.status = 'active'
  AND pl.list_type = 'custom'
  AND pl.master_list_id IS NOT NULL
  AND (
    pl.metadata->>'carrier_code' ILIKE '%gls%' 
    OR pl.metadata->>'contract_code' ILIKE '%gls%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%gls%'
    OR pl.source_metadata->>'contract_code' ILIKE '%gls%'
    OR pl.name ILIKE '%gls%'
    OR pl.metadata->>'carrier_code' ILIKE '%poste%' 
    OR pl.metadata->>'contract_code' ILIKE '%poste%'
    OR pl.metadata->>'carrier_code' ILIKE '%postedelivery%'
    OR pl.metadata->>'contract_code' ILIKE '%postedelivery%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%poste%'
    OR pl.source_metadata->>'contract_code' ILIKE '%poste%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%postedelivery%'
    OR pl.source_metadata->>'contract_code' ILIKE '%postedelivery%'
    OR pl.name ILIKE '%poste%'
    OR pl.name ILIKE '%pdb%'
  )
ORDER BY pl.name;

-- ============================================
-- QUERY DETTAGLIATA: Listini CUSTOM con margini
-- ============================================
-- Verifica se i listini CUSTOM hanno margini configurati

SELECT 
  pl.id,
  pl.name,
  pl.list_type,
  pl.master_list_id,
  pl.default_margin_percent,
  pl.default_margin_fixed,
  pl.status,
  pl.metadata->>'contract_code' as contract_code,
  CASE 
    WHEN pl.list_type = 'custom' AND pl.master_list_id IS NOT NULL THEN 
      CASE 
        WHEN pl.default_margin_percent IS NULL AND pl.default_margin_fixed IS NULL THEN 
          '❌ CUSTOM con master ma SENZA margine → supplierPrice calcolato ma finalPrice = totalCost (senza margine)'
        ELSE 
          '✅ CUSTOM con master e CON margine → OK'
      END
    ELSE 
      'N/A'
  END as analisi_dettagliata
FROM price_lists pl
WHERE pl.status = 'active'
  AND pl.list_type = 'custom'
  AND pl.master_list_id IS NOT NULL
  AND (
    pl.metadata->>'carrier_code' ILIKE '%gls%' 
    OR pl.metadata->>'contract_code' ILIKE '%gls%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%gls%'
    OR pl.source_metadata->>'contract_code' ILIKE '%gls%'
    OR pl.name ILIKE '%gls%'
    OR pl.metadata->>'carrier_code' ILIKE '%poste%' 
    OR pl.metadata->>'contract_code' ILIKE '%poste%'
    OR pl.metadata->>'carrier_code' ILIKE '%postedelivery%'
    OR pl.metadata->>'contract_code' ILIKE '%postedelivery%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%poste%'
    OR pl.source_metadata->>'contract_code' ILIKE '%poste%'
    OR pl.source_metadata->>'carrier_code' ILIKE '%postedelivery%'
    OR pl.source_metadata->>'contract_code' ILIKE '%postedelivery%'
    OR pl.name ILIKE '%poste%'
    OR pl.name ILIKE '%pdb%'
  )
ORDER BY pl.name;

-- ============================================
-- SPIEGAZIONE RISULTATI:
-- ============================================
-- 
-- Se GLS ha "custom_con_master" > 0:
--   → Listini CUSTOM con master_list_id → supplierPrice viene calcolato correttamente
--   → Nel route: supplierPrice = quoteResult.supplierPrice (dal master)
--   → Risultato: costo fornitore ≠ prezzo vendita ✅
--
-- Se Poste ha "supplier_senza_margine" > 0:
--   → Listini SUPPLIER senza master_list_id e senza margine
--   → supplierPrice = undefined (non viene calcolato)
--   → Nel route: supplierPrice = quoteResult.totalCost (fallback errato)
--   → finalPrice = totalCost (senza margine)
--   → Risultato: costo fornitore = prezzo vendita = 4.40 ❌
--
-- ⚠️ NUOVO PROBLEMA IDENTIFICATO:
-- Se il listino CUSTOM di Poste ha master_list_id ma NON ha margine configurato:
--   → supplierPrice viene calcolato correttamente dal master
--   → MA finalPrice = totalCost (senza margine aggiunto)
--   → Nel route: supplierPrice = quoteResult.supplierPrice (corretto)
--   → MA finalPrice = totalCost = supplierPrice (se non c'è margine)
--   → Risultato: costo fornitore = prezzo vendita = 4.40 ❌
--
-- SOLUZIONE:
--   1. Verificare che il listino CUSTOM di Poste abbia default_margin_percent o default_margin_fixed configurato
--   2. Se manca, aggiungere margine al listino CUSTOM:
--      UPDATE price_lists 
--      SET default_margin_percent = 10  -- o valore desiderato
--      WHERE id = '<id_listino_custom_poste>';
--   3. Oppure creare nuovo listino CUSTOM per Poste che clona il SUPPLIER con margine
-- ============================================
