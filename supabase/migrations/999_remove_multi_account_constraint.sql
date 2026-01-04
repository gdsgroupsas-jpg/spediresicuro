-- Migration: 999 - Remove unique constraint/index on courier_configs(owner_user_id, provider_id)
-- Description: Permette ad un utente di avere più account per lo stesso provider (es. Spedisci.Online)
-- ============================================

-- Rimuove l'indice creato nella migrazione 052
DROP INDEX IF EXISTS idx_courier_configs_unique_owner_provider;

-- Rimuove il constraint se creato con un nome specifico (come visto nell'errore dell'utente)
ALTER TABLE courier_configs DROP CONSTRAINT IF EXISTS uq_courier_configs_owner_provider;

-- Verifica che il sistema ora permetta duplicati è gestita dagli script di test.
