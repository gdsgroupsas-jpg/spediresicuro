-- ============================================
-- Migration: 051 - Add reseller_role
-- Description: Aggiunge campo reseller_role per distinguere admin reseller da user reseller
-- ============================================

-- Aggiungi campo reseller_role alla tabella users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reseller_role TEXT CHECK (reseller_role IN ('admin', 'user')) DEFAULT NULL;

-- Commento campo
COMMENT ON COLUMN users.reseller_role IS 'Ruolo all''interno del reseller: admin (può gestire config) o user (solo uso)';

-- Indice per query RBAC
CREATE INDEX IF NOT EXISTS idx_users_reseller_role ON users(reseller_role) WHERE reseller_role IS NOT NULL;

-- Aggiorna reseller esistenti: se is_reseller = true e reseller_role è NULL, imposta 'admin' (default)
UPDATE users
SET reseller_role = 'admin'
WHERE is_reseller = true 
  AND reseller_role IS NULL;

