-- ============================================
-- Migration: 052 - Add UNIQUE constraint on (owner_user_id, provider_id)
-- Description: Aggiunge constraint UNIQUE per permettere upsert in savePersonalConfiguration
-- ============================================
-- 
-- PROBLEMA:
-- savePersonalConfiguration fa upsert con onConflict: 'owner_user_id,provider_id'
-- ma non esiste constraint UNIQUE su queste colonne, causando errore 42P10.
--
-- SOLUZIONE:
-- Aggiunge UNIQUE INDEX/CONSTRAINT su (owner_user_id, provider_id)
-- per configurazioni personali (owner_user_id IS NOT NULL).
-- Configurazioni globali (owner_user_id IS NULL) non sono vincolate.
--
-- ⚠️ IMPORTANTE: Prima di applicare, verifica duplicati con script di cleanup.
-- ============================================

-- ============================================
-- STEP 1: Verifica duplicati esistenti
-- ============================================
-- 
-- ⚠️ ESECUIRE PRIMA DI APPLICARE LA MIGRAZIONE:
-- 
-- SELECT 
--   owner_user_id, 
--   provider_id, 
--   COUNT(*) as count,
--   array_agg(id ORDER BY created_at DESC) as config_ids,
--   array_agg(created_at ORDER BY created_at DESC) as created_dates
-- FROM courier_configs
-- WHERE owner_user_id IS NOT NULL
-- GROUP BY owner_user_id, provider_id
-- HAVING COUNT(*) > 1;
--
-- Se ci sono duplicati, usa lo script di cleanup in CLEANUP_DUPLICATE_CONFIGS.sql
-- ============================================

-- ============================================
-- STEP 2: Cleanup duplicati (mantieni più recente)
-- ============================================
-- 
-- ⚠️ ESECUIRE SOLO SE CI SONO DUPLICATI:
-- 
-- DELETE FROM courier_configs
-- WHERE id IN (
--   SELECT id
--   FROM (
--     SELECT 
--       id,
--       ROW_NUMBER() OVER (
--         PARTITION BY owner_user_id, provider_id 
--         ORDER BY created_at DESC
--       ) as rn
--     FROM courier_configs
--     WHERE owner_user_id IS NOT NULL
--   ) ranked
--   WHERE rn > 1
-- );
-- ============================================

-- ============================================
-- STEP 3: Aggiungi UNIQUE INDEX parziale
-- ============================================
-- 
-- ⚠️ UNIQUE solo per configurazioni personali (owner_user_id IS NOT NULL)
-- Configurazioni globali (owner_user_id IS NULL) possono avere più config per provider
-- 

-- Verifica se l'indice esiste già
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'courier_configs'
      AND indexname = 'idx_courier_configs_unique_owner_provider'
  ) THEN
    -- Crea UNIQUE INDEX parziale (solo per owner_user_id NOT NULL)
    CREATE UNIQUE INDEX idx_courier_configs_unique_owner_provider
    ON public.courier_configs(owner_user_id, provider_id)
    WHERE owner_user_id IS NOT NULL;
    
    RAISE NOTICE '✅ UNIQUE INDEX creato: idx_courier_configs_unique_owner_provider';
  ELSE
    RAISE NOTICE '⚠️ UNIQUE INDEX già esistente: idx_courier_configs_unique_owner_provider';
  END IF;
END $$;

-- Commento per documentazione
COMMENT ON INDEX idx_courier_configs_unique_owner_provider IS 
  'UNIQUE constraint su (owner_user_id, provider_id) per configurazioni personali. 
   Garantisce che ogni utente abbia al massimo una configurazione per provider.
   Permette upsert in savePersonalConfiguration.';

-- ============================================
-- STEP 4: Verifica finale
-- ============================================

DO $$
DECLARE
  v_index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'courier_configs'
      AND indexname = 'idx_courier_configs_unique_owner_provider'
  ) INTO v_index_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 052 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'UNIQUE INDEX: %', 
    CASE WHEN v_index_exists THEN '✅ Presente' ELSE '❌ Mancante' END;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ IMPORTANTE:';
  RAISE NOTICE '  - L''indice è parziale (solo owner_user_id IS NOT NULL)';
  RAISE NOTICE '  - Configurazioni globali (owner_user_id IS NULL) non sono vincolate';
  RAISE NOTICE '  - Upsert in savePersonalConfiguration ora funzionerà';
  RAISE NOTICE '========================================';
END $$;

