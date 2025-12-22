# Observability - Wallet & Idempotency

## Overview

Questo documento descrive come monitorare e operare sul sistema wallet e idempotency usando log strutturati e query SQL.

## Log Strutturati

Tutti i log critici sono emessi in formato JSON per facilitare aggregazione e analisi.

### Eventi Loggati

#### 1. Wallet Retry

**Evento:** `wallet_retry`
**Quando:** Retry automatico scatta per lock contention (55P03/P0001)

```json
{
  "event_type": "wallet_retry",
  "operation_name": "shipment_debit",
  "attempt": 2,
  "max_retries": 3,
  "delay_ms": 50,
  "error_code": "P0001",
  "error_message": "Wallet locked by concurrent operation...",
  "timestamp": "2025-12-22T10:30:45.123Z"
}
```

**Metrica:** Conta eventi `wallet_retry` per periodo = `wallet_retry_count`

#### 2. Wallet Retry Success

**Evento:** `wallet_retry_success`
**Quando:** Retry riesce dopo tentativo precedente

```json
{
  "event_type": "wallet_retry_success",
  "operation_name": "shipment_debit",
  "attempt": 1,
  "max_retries": 3,
  "timestamp": "2025-12-22T10:30:45.200Z"
}
```

#### 3. Wallet Retry Failed

**Evento:** `wallet_retry_failed`
**Quando:** Tutti i retry falliscono

```json
{
  "event_type": "wallet_retry_failed",
  "operation_name": "shipment_debit",
  "max_retries": 3,
  "error_code": "P0001",
  "error_message": "Wallet locked by concurrent operation...",
  "timestamp": "2025-12-22T10:30:45.500Z"
}
```

#### 4. Idempotency Lock In Progress

**Evento:** `idempotency_lock_in_progress`
**Quando:** Acquire lock ritorna `status='in_progress'` (operazione già in corso)

```json
{
  "event_type": "idempotency_lock_in_progress",
  "idempotency_key": "abc123...",
  "user_id": "user-uuid",
  "message": "Lock already in progress, preventing duplicate request",
  "timestamp": "2025-12-22T10:30:45.123Z"
}
```

**Metrica:** Conta eventi `idempotency_lock_in_progress` = `idempotency_lock_in_progress_count`

#### 5. Idempotency Lock Failed

**Evento:** `idempotency_lock_failed`
**Quando:** Acquire lock ritorna `status='failed'` (tentativo precedente fallito)

```json
{
  "event_type": "idempotency_lock_failed",
  "idempotency_key": "abc123...",
  "user_id": "user-uuid",
  "error_message": "Database error after wallet debit",
  "requires_manual_review": true,
  "timestamp": "2025-12-22T10:30:45.123Z"
}
```

**Metrica:** Conta eventi `idempotency_lock_failed` = `idempotency_lock_failed_count`

#### 6. Idempotency Lock Marked Failed

**Evento:** `idempotency_lock_marked_failed`
**Quando:** Lock viene marcato come failed dopo errore (dopo debit ma prima shipment)

```json
{
  "event_type": "idempotency_lock_marked_failed",
  "idempotency_key": "abc123...",
  "user_id": "user-uuid",
  "error_message": "Database error after wallet debit",
  "note": "Lock marked as failed after wallet debit, preventing re-debit on retry",
  "timestamp": "2025-12-22T10:30:45.123Z"
}
```

## Query SQL Operative

### Query Rapide per Support

#### 1. Lock In Progress Bloccati (>5 minuti)

```sql
SELECT 
  il.idempotency_key,
  u.email AS user_email,
  il.created_at,
  EXTRACT(EPOCH FROM (NOW() - il.created_at)) / 60 AS minutes_stuck
FROM idempotency_locks il
JOIN users u ON il.user_id = u.id
WHERE il.status = 'in_progress'
  AND il.created_at < NOW() - INTERVAL '5 minutes'
ORDER BY il.created_at ASC;
```

**Uso:** Identifica operazioni bloccate che potrebbero richiedere intervento.

#### 2. Lock Failed (Pagamenti "In Limbo")

```sql
SELECT 
  il.idempotency_key,
  u.email AS user_email,
  il.last_error,
  il.created_at,
  (SELECT SUM(ABS(amount))
   FROM wallet_transactions wt
   WHERE wt.user_id = il.user_id
     AND wt.created_at BETWEEN il.created_at - INTERVAL '1 minute' AND il.created_at + INTERVAL '1 minute'
     AND wt.amount < 0
  ) AS debited_amount
FROM idempotency_locks il
JOIN users u ON il.user_id = u.id
WHERE il.status = 'failed'
  AND il.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY il.created_at DESC;
```

**Uso:** Identifica pagamenti dove debit è avvenuto ma shipment non creata (richiede recovery manuale).

#### 3. Dashboard Rapida

```sql
SELECT 
  'Lock in_progress' AS metric,
  COUNT(*) AS count,
  COUNT(CASE WHEN created_at < NOW() - INTERVAL '5 minutes' THEN 1 END) AS stuck_5min
FROM idempotency_locks
WHERE status = 'in_progress'
  AND expires_at > NOW()

UNION ALL

SELECT 
  'Lock failed (last 24h)' AS metric,
  COUNT(*) AS count,
  NULL AS stuck_5min
FROM idempotency_locks
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours';
```

**Uso:** Overview veloce dello stato sistema.

## Metriche Aggregabili

### Da Log (JSON)

Usa aggregazione log (es. CloudWatch, Datadog, ELK) per contare eventi:

- `wallet_retry_count`: Conta `event_type='wallet_retry'`
- `wallet_retry_success_count`: Conta `event_type='wallet_retry_success'`
- `wallet_retry_failed_count`: Conta `event_type='wallet_retry_failed'`
- `idempotency_lock_in_progress_count`: Conta `event_type='idempotency_lock_in_progress'`
- `idempotency_lock_failed_count`: Conta `event_type='idempotency_lock_failed'`

### Da Database (Query SQL)

```sql
-- Metriche aggregate lock per stato
SELECT 
  status,
  COUNT(*) AS count,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '1 hour' THEN 1 END) AS last_hour,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) AS last_24h
FROM idempotency_locks
WHERE expires_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

## Workflow Support/Admin

### Scenario 1: Utente segnala "Pagamento addebitato ma spedizione non creata"

1. **Query:** Esegui Query 2 (Lock Failed)
2. **Verifica:** Cerca `idempotency_key` dell'utente
3. **Analisi:**
   - Se `debited_amount > 0` → Debit confermato, shipment mancante
   - Se `shipment_id IS NULL` → Conferma problema
4. **Azione:**
   - Recovery manuale: crea shipment manualmente OPPURE
   - Compensazione: rimborsa wallet e chiedi riprovare

### Scenario 2: Operazioni bloccate (>10 minuti)

1. **Query:** Esegui Query 1 con `INTERVAL '10 minutes'`
2. **Verifica:** Controlla se lock è ancora valido (`expires_at > NOW()`)
3. **Azione:**
   - Se lock scaduto ma ancora `in_progress` → Possibile cleanup
   - Se lock attivo ma bloccato → Investigare errore applicativo

### Scenario 3: Monitoraggio Proattivo

1. **Dashboard:** Esegui Query 3 ogni 5 minuti
2. **Alert:** Se `stuck_5min > 5` → Notifica team
3. **Alert:** Se `failed (last 24h) > 10` → Review manuale richiesta

## Best Practices

1. **Log Aggregation:** Configura aggregazione log per metriche automatiche
2. **Alerting:** Imposta alert su:
   - `wallet_retry_failed_count > threshold`
   - `idempotency_lock_failed_count > threshold`
   - Lock stuck > 10 minuti
3. **Review Periodico:** Esegui Query 2 settimanalmente per review manuale
4. **Cleanup:** Esegui `cleanup_expired_idempotency_locks()` periodicamente (cron job)

## File di Riferimento

- Query SQL: `scripts/operational-queries-wallet-idempotency.sql`
- Log strutturati: `lib/wallet/retry.ts`, `app/api/shipments/create/route.ts`

