-- ============================================================
-- Migration: Aggiunge CHECK constraint su users.wallet_balance
-- ============================================================
-- La tabella workspaces ha già CHECK (wallet_balance >= 0).
-- La tabella users NO — le RPC v1 (ancora presenti) operano su users
-- e potrebbero portare il saldo negativo senza errore DB.
--
-- Questa constraint garantisce che NESSUN path (v1, v2, trigger, manuale)
-- possa portare users.wallet_balance sotto zero.
-- ============================================================

-- Prerequisito: assicurarsi che non ci siano saldi negativi
-- (se ci fossero, la constraint fallirebbe)
UPDATE users SET wallet_balance = 0 WHERE wallet_balance < 0;

-- Aggiunge la constraint
ALTER TABLE users
  ADD CONSTRAINT users_wallet_balance_non_negative
  CHECK (wallet_balance >= 0);

-- Commento per documentazione
COMMENT ON CONSTRAINT users_wallet_balance_non_negative ON users
  IS 'Impedisce saldo wallet negativo. Allineato a workspaces.wallet_balance CHECK.';
