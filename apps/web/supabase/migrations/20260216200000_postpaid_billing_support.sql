-- ============================================
-- MIGRAZIONE: Supporto Postpaid Billing
-- ============================================
-- Crea vista aggregazione consumo mensile per utenti postpagato.
-- Il campo users.billing_mode esiste gia' (migrazione 20260204120000).
-- Il tipo wallet_transactions.type e' TEXT libero, supporta POSTPAID_CHARGE.

-- Vista per riepilogo consumo mensile postpagato
-- Usata da: generatePostpaidMonthlyInvoice(), postpaid-summary-card.tsx
CREATE OR REPLACE VIEW public.postpaid_monthly_summary AS
SELECT
  wt.user_id,
  date_trunc('month', wt.created_at) AS month,
  SUM(ABS(wt.amount)) AS total_consumed,
  COUNT(*) AS shipments_count,
  MIN(wt.created_at) AS first_charge_at,
  MAX(wt.created_at) AS last_charge_at
FROM public.wallet_transactions wt
WHERE wt.type = 'POSTPAID_CHARGE'
GROUP BY wt.user_id, date_trunc('month', wt.created_at);

-- Commento descrittivo
COMMENT ON VIEW public.postpaid_monthly_summary IS
  'Aggregazione mensile consumo spedizioni postpagato per utente. Usata per fatturazione a fine mese.';

-- Indice su wallet_transactions per query postpaid efficienti
-- (type + user_id + created_at per la vista e per le query fatturazione)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_postpaid
ON public.wallet_transactions (type, user_id, created_at)
WHERE type = 'POSTPAID_CHARGE';
