-- ============================================
-- Script di Cleanup: Duplicati courier_configs
-- ============================================
-- 
-- ⚠️ ESECUIRE PRIMA DI APPLICARE MIGRAZIONE 052
-- 
-- Questo script:
-- 1. Identifica duplicati su (owner_user_id, provider_id)
-- 2. Mantiene il record più recente (created_at DESC)
-- 3. Elimina i duplicati più vecchi
-- ============================================

-- ============================================
-- STEP 1: Verifica duplicati (READ-ONLY)
-- ============================================

-- Query per vedere duplicati
SELECT 
  owner_user_id, 
  provider_id, 
  COUNT(*) as count,
  array_agg(id ORDER BY created_at DESC) as config_ids,
  array_agg(created_at ORDER BY created_at DESC) as created_dates,
  array_agg(name ORDER BY created_at DESC) as names
FROM courier_configs
WHERE owner_user_id IS NOT NULL
GROUP BY owner_user_id, provider_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- ============================================
-- STEP 2: Preview record da eliminare (READ-ONLY)
-- ============================================

-- Mostra quali record verranno eliminati (mantiene il più recente)
SELECT 
  id,
  owner_user_id,
  provider_id,
  name,
  created_at,
  'DA ELIMINARE' as action
FROM (
  SELECT 
    id,
    owner_user_id,
    provider_id,
    name,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY owner_user_id, provider_id 
      ORDER BY created_at DESC
    ) as rn
  FROM courier_configs
  WHERE owner_user_id IS NOT NULL
) ranked
WHERE rn > 1
ORDER BY owner_user_id, provider_id, created_at DESC;

-- ============================================
-- STEP 3: Elimina duplicati (MANTIENE PIÙ RECENTE)
-- ============================================
-- 
-- ⚠️ ATTENZIONE: Questo elimina record duplicati!
-- ⚠️ Mantiene il record con created_at più recente
-- ⚠️ Verifica prima con STEP 1 e STEP 2
-- 

-- BEGIN TRANSACTION; -- Scommenta per transazione

DELETE FROM courier_configs
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY owner_user_id, provider_id 
        ORDER BY created_at DESC
      ) as rn
    FROM courier_configs
    WHERE owner_user_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- COMMIT; -- Scommenta per confermare

-- ============================================
-- STEP 4: Verifica risultato
-- ============================================

-- Verifica che non ci siano più duplicati
SELECT 
  owner_user_id, 
  provider_id, 
  COUNT(*) as count
FROM courier_configs
WHERE owner_user_id IS NOT NULL
GROUP BY owner_user_id, provider_id
HAVING COUNT(*) > 1;

-- Risultato atteso: 0 righe (nessun duplicato)

-- ============================================
-- STEP 5: Statistiche finali
-- ============================================

SELECT 
  COUNT(*) as total_configs,
  COUNT(DISTINCT owner_user_id) as unique_owners,
  COUNT(DISTINCT provider_id) as unique_providers,
  COUNT(*) FILTER (WHERE owner_user_id IS NOT NULL) as personal_configs,
  COUNT(*) FILTER (WHERE owner_user_id IS NULL) as global_configs
FROM courier_configs;

