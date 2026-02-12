-- Reset richieste di ricarica per gdsgroupsas@gmail.com
-- Motivo: reset completo wallet pilot per nuovo ciclo test

-- 1. Audit log prima della cancellazione
INSERT INTO public.audit_logs (action, resource_type, user_email, metadata)
SELECT
  'topup_requests_reset_pilot',
  'top_up_requests',
  'gdsgroupsas@gmail.com',
  jsonb_build_object(
    'reason', 'Reset richieste ricarica pilot - nuovo ciclo test',
    'deleted_count', (
      SELECT count(*) FROM public.top_up_requests tr
      JOIN public.users u ON tr.user_id = u.id
      WHERE u.email = 'gdsgroupsas@gmail.com'
    ),
    'migration', '20260217120000_reset_topup_requests_pilot_gdsgroupsas'
  );

-- 2. Elimina tutte le richieste di ricarica dell'utente
DELETE FROM public.top_up_requests
WHERE user_id = (
  SELECT id FROM public.users WHERE email = 'gdsgroupsas@gmail.com'
);

-- 3. Elimina anche le wallet_transactions per pulizia completa pilot
DELETE FROM public.wallet_transactions
WHERE user_id = (
  SELECT id FROM public.users WHERE email = 'gdsgroupsas@gmail.com'
);
