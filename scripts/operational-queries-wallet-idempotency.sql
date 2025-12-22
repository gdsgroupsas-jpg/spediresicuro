-- ============================================
-- QUERY OPERATIVE - WALLET & IDEMPOTENCY
-- ============================================
--
-- Query per support/admin per monitorare:
-- - Lock in_progress bloccati
-- - Lock failed (pagamenti "in limbo")
-- - Metriche retry/lock
--
-- ============================================

-- ============================================
-- QUERY 1: Lock in_progress > X minuti (stuck operations)
-- ============================================
-- Identifica operazioni bloccate che potrebbero richiedere intervento

SELECT 
  il.idempotency_key,
  il.user_id,
  u.email AS user_email,
  il.status,
  il.created_at,
  il.expires_at,
  EXTRACT(EPOCH FROM (NOW() - il.created_at)) / 60 AS minutes_since_creation,
  EXTRACT(EPOCH FROM (il.expires_at - NOW())) / 60 AS minutes_until_expiry,
  il.metadata
FROM idempotency_locks il
JOIN users u ON il.user_id = u.id
WHERE il.status = 'in_progress'
  AND il.created_at < NOW() - INTERVAL '5 minutes'  -- Modifica X minuti qui
ORDER BY il.created_at ASC;

-- Esempio: Lock in_progress > 10 minuti
-- WHERE il.created_at < NOW() - INTERVAL '10 minutes'

-- ============================================
-- QUERY 2: Lock failed nelle ultime 24h
-- ============================================
-- Identifica pagamenti "in limbo" (debit avvenuto ma shipment non creata)

SELECT 
  il.idempotency_key,
  il.user_id,
  u.email AS user_email,
  il.status,
  il.last_error,
  il.created_at,
  il.expires_at,
  EXTRACT(EPOCH FROM (NOW() - il.created_at)) / 60 AS minutes_since_creation,
  -- Verifica se esiste shipment associata (non dovrebbe esistere se failed)
  (SELECT COUNT(*) FROM shipments s WHERE s.idempotency_key = il.idempotency_key) AS shipment_exists,
  -- Verifica wallet_transactions per questo user_id nello stesso periodo
  (SELECT COUNT(*) 
   FROM wallet_transactions wt 
   WHERE wt.user_id = il.user_id 
     AND wt.created_at BETWEEN il.created_at - INTERVAL '1 minute' AND il.created_at + INTERVAL '1 minute'
     AND wt.amount < 0  -- Solo addebiti
  ) AS wallet_debits_count
FROM idempotency_locks il
JOIN users u ON il.user_id = u.id
WHERE il.status = 'failed'
  AND il.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY il.created_at DESC;

-- ============================================
-- QUERY 3: Metriche aggregate - Lock per stato
-- ============================================

SELECT 
  status,
  COUNT(*) AS count,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) AS last_hour,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) AS last_24h,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 60) AS avg_age_minutes
FROM idempotency_locks
WHERE expires_at > NOW() - INTERVAL '24 hours'  -- Solo lock recenti
GROUP BY status
ORDER BY status;

-- ============================================
-- QUERY 4: Lock in_progress con dettagli utente
-- ============================================
-- Per support: vedere chi ha operazioni bloccate

SELECT 
  il.idempotency_key,
  u.email AS user_email,
  u.name AS user_name,
  il.status,
  il.created_at,
  NOW() - il.created_at AS age,
  il.expires_at,
  CASE 
    WHEN il.expires_at < NOW() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END AS expiry_status,
  -- Verifica se esiste shipment (non dovrebbe se in_progress)
  (SELECT id FROM shipments s WHERE s.idempotency_key = il.idempotency_key LIMIT 1) AS shipment_id
FROM idempotency_locks il
JOIN users u ON il.user_id = u.id
WHERE il.status = 'in_progress'
ORDER BY il.created_at ASC;

-- ============================================
-- QUERY 5: Lock failed con dettagli per recovery
-- ============================================
-- Per admin: identificare pagamenti da recuperare

SELECT 
  il.idempotency_key,
  u.email AS user_email,
  u.wallet_balance AS current_wallet_balance,
  il.last_error,
  il.created_at,
  -- Verifica wallet_transactions per vedere quanto è stato addebitato
  (SELECT SUM(ABS(amount))
   FROM wallet_transactions wt
   WHERE wt.user_id = il.user_id
     AND wt.created_at BETWEEN il.created_at - INTERVAL '1 minute' AND il.created_at + INTERVAL '1 minute'
     AND wt.amount < 0
  ) AS debited_amount,
  -- Verifica se shipment esiste (non dovrebbe)
  (SELECT id FROM shipments s WHERE s.idempotency_key = il.idempotency_key LIMIT 1) AS shipment_id,
  il.metadata
FROM idempotency_locks il
JOIN users u ON il.user_id = u.id
WHERE il.status = 'failed'
  AND il.created_at >= NOW() - INTERVAL '7 days'  -- Ultimi 7 giorni
ORDER BY il.created_at DESC;

-- ============================================
-- QUERY 6: Cleanup suggerito (lock scaduti > 24h)
-- ============================================
-- Query per vedere cosa verrebbe cancellato da cleanup

SELECT 
  COUNT(*) AS expired_locks_count,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) AS expired_in_progress,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS expired_failed,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) AS expired_completed,
  MIN(created_at) AS oldest_lock,
  MAX(created_at) AS newest_lock
FROM idempotency_locks
WHERE expires_at < NOW() - INTERVAL '24 hours';

-- ============================================
-- QUERY 7: Dashboard rapida - Stato sistema
-- ============================================
-- Overview veloce per operatori

SELECT 
  'Lock in_progress' AS metric,
  COUNT(*) AS count,
  COUNT(CASE WHEN created_at < NOW() - INTERVAL '5 minutes' THEN 1 END) AS stuck_5min,
  COUNT(CASE WHEN created_at < NOW() - INTERVAL '10 minutes' THEN 1 END) AS stuck_10min
FROM idempotency_locks
WHERE status = 'in_progress'
  AND expires_at > NOW()

UNION ALL

SELECT 
  'Lock failed (last 24h)' AS metric,
  COUNT(*) AS count,
  NULL AS stuck_5min,
  NULL AS stuck_10min
FROM idempotency_locks
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Lock completed (last 24h)' AS metric,
  COUNT(*) AS count,
  NULL AS stuck_5min,
  NULL AS stuck_10min
FROM idempotency_locks
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '24 hours';

-- ============================================
-- QUERY 8: Verifica coerenza - Lock failed senza shipment
-- ============================================
-- Identifica casi dove debit è avvenuto ma shipment non creata

SELECT 
  il.idempotency_key,
  il.user_id,
  u.email AS user_email,
  il.last_error,
  il.created_at,
  -- Verifica addebito wallet
  (SELECT SUM(ABS(amount))
   FROM wallet_transactions wt
   WHERE wt.user_id = il.user_id
     AND wt.created_at BETWEEN il.created_at - INTERVAL '1 minute' AND il.created_at + INTERVAL '1 minute'
     AND wt.amount < 0
  ) AS debited_amount,
  -- Verifica shipment (non dovrebbe esistere)
  (SELECT id FROM shipments s WHERE s.idempotency_key = il.idempotency_key LIMIT 1) AS shipment_id,
  CASE 
    WHEN (SELECT id FROM shipments s WHERE s.idempotency_key = il.idempotency_key LIMIT 1) IS NOT NULL 
    THEN '⚠️ INCONSISTENCY: Shipment exists but lock is failed'
    WHEN (SELECT SUM(ABS(amount)) FROM wallet_transactions wt WHERE wt.user_id = il.user_id AND wt.created_at BETWEEN il.created_at - INTERVAL '1 minute' AND il.created_at + INTERVAL '1 minute' AND wt.amount < 0) > 0
    THEN '✅ DEBIT CONFIRMED: Requires manual recovery'
    ELSE '⚠️ NO DEBIT: Lock failed before debit'
  END AS status_analysis
FROM idempotency_locks il
JOIN users u ON il.user_id = u.id
WHERE il.status = 'failed'
  AND il.created_at >= NOW() - INTERVAL '7 days'
ORDER BY il.created_at DESC;

