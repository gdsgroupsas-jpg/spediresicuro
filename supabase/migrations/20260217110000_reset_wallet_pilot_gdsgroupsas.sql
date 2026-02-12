-- Reset wallet pilot gdsgroupsas@gmail.com a 0€
-- Motivo: reset per nuovo ciclo di test pilot

-- 1. Inserisci transazione wallet negativa per tracciabilità (PRIMA del reset)
INSERT INTO public.wallet_transactions (user_id, amount, type, description, created_by)
SELECT
  u.id,
  -(u.wallet_balance),
  'adjustment',
  'Reset wallet pilot - nuovo ciclo test',
  u.id
FROM public.users u
WHERE u.email = 'gdsgroupsas@gmail.com'
  AND u.wallet_balance > 0;

-- 2. Audit log con saldo precedente
INSERT INTO public.audit_logs (action, resource_type, user_email, severity, message, metadata)
SELECT
  'wallet_reset_pilot',
  'wallet',
  'gdsgroupsas@gmail.com',
  'info',
  'Reset wallet pilot gdsgroupsas@gmail.com a 0€',
  jsonb_build_object(
    'previous_balance', u.wallet_balance,
    'new_balance', 0,
    'reason', 'Reset wallet pilot - nuovo ciclo test',
    'migration', '20260217110000_reset_wallet_pilot_gdsgroupsas'
  )
FROM public.users u
WHERE u.email = 'gdsgroupsas@gmail.com';

-- 3. Reset wallet_balance a 0
UPDATE public.users
SET wallet_balance = 0
WHERE email = 'gdsgroupsas@gmail.com';
