# P0 Audit Fixes - Implementation Guide

**Status**: In Progress
**Priority**: P0 (Bloccanti Go-Live)
**Date**: 2026-01-11

---

## 1. SuperAdmin Wallet Bypass Kill-Switch + Alerting ✅ IMPLEMENTED

### Problema Originale

SuperAdmin poteva bypassare il wallet check senza controlli, logging limitato, e nessun kill-switch.

### Soluzione Implementata

#### 1.1 Kill-Switch Environment Variable

**Env Var**: `ALLOW_SUPERADMIN_WALLET_BYPASS`

- **Default**: `undefined` (bypass DISABILITATO)
- **Produzione**: `false` (bypass DISABILITATO)
- **Testing/Emergenza**: `true` (bypass ABILITATO)

**Comportamento**:

- Se `undefined` o `false` → SuperAdmin paga come utenti normali
- Se `true` → Bypass consentito MA ogni uso loggato come CRITICAL security event

#### 1.2 Security Event Logging

Ogni bypass viene tracciato in `audit_logs` con:

- `action`: `'superadmin_wallet_bypass'`
- `severity`: `'CRITICAL'`
- `actor_id`: SuperAdmin che esegue bypass
- `target_id`: User beneficiario (può essere stesso SuperAdmin o impersonation)
- `metadata`:
  - `amount`: Importo operazione
  - `currentBalance`: Balance corrente user
  - `deficit`: Quanto manca (se balance insufficiente)
  - `impersonating`: Flag se impersonation attiva
  - `reason`: Motivo operazione (da ActingContext)
  - `requires_review`: `true` (flag per processo manuale)

#### 1.3 Alerting Setup (TODO)

**Query per monitoring system** (Grafana/Datadog/custom):

```sql
SELECT
  created_at,
  actor_id,
  target_id,
  audit_metadata->>'amount' AS amount,
  audit_metadata->>'currentBalance' AS balance,
  audit_metadata->>'deficit' AS deficit,
  audit_metadata->>'reason' AS reason
FROM audit_logs
WHERE action = 'superadmin_wallet_bypass'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

**Alert rule**:

- Trigger: ANY `superadmin_wallet_bypass` event
- Severity: CRITICAL
- Notification: Slack #security + Email team lead
- SLA: Revisione manuale entro 4 ore

#### 1.4 File Modificati

1. `lib/wallet/credit-check.ts`:
   - Aggiunto check `ALLOW_SUPERADMIN_WALLET_BYPASS`
   - Logging security event su ogni bypass
   - Esteso `CreditCheckResult` con `bypassUsed` e `bypassReason`

2. `lib/security/security-events.ts`:
   - Aggiunta funzione `logSuperAdminWalletBypass()`
   - Nuovo event type `'superadmin_wallet_bypass'`

3. `lib/security/audit-actions.ts`:
   - Aggiunta azione `SUPERADMIN_WALLET_BYPASS`

#### 1.5 Testing

**Test manuale**:

```bash
# Test 1: Bypass disabilitato (default)
# Env: ALLOW_SUPERADMIN_WALLET_BYPASS non configurato
# Expected: SuperAdmin con balance insufficiente → FALLISCE

# Test 2: Bypass abilitato
# Env: ALLOW_SUPERADMIN_WALLET_BYPASS=true
# Expected: SuperAdmin con balance insufficiente → SUCCESSO + security log

# Test 3: Verifica security event
# Query audit_logs WHERE action='superadmin_wallet_bypass'
# Expected: Record presente con severity='CRITICAL'
```

**Smoke test** (da creare):

```typescript
// scripts/smoke-test-superadmin-bypass-killswitch.ts
// 1. Test bypass disabled
// 2. Test bypass enabled + verify security log
// 3. Test impersonation + bypass
```

---

## 2. Idempotency Wallet Standalone (TODO)

### Problema

`decrement_wallet_balance()` è atomico ma NON idempotent standalone.
Se chiamato direttamente (fuori da shipment flow) → no protezione doppio addebito.

### Soluzione Pianificata

#### Migration: 040.1_wallet_idempotency_standalone.sql

```sql
-- Aggiungi colonna idempotency_key opzionale
ALTER TABLE wallet_transactions
ADD COLUMN idempotency_key TEXT;

-- Indice UNIQUE per prevenire duplicati
CREATE UNIQUE INDEX wallet_transactions_idempotency_key_idx
ON wallet_transactions(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Refactor function con idempotency support
CREATE OR REPLACE FUNCTION decrement_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL  -- NEW: opzionale per backward compat
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_existing_transaction UUID;
BEGIN
  -- Se idempotency_key fornito, check duplicati
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_transaction
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      -- Transazione già eseguita: idempotent replay
      RAISE NOTICE 'Idempotent replay: transaction already exists for key %', p_idempotency_key;
      RETURN TRUE;
    END IF;
  END IF;

  -- Resto della logica esistente (lock + validations + update)
  -- ...

  -- Registra transaction con idempotency_key
  INSERT INTO wallet_transactions (
    user_id, amount, type, idempotency_key
  ) VALUES (
    p_user_id, -p_amount, 'DEBIT', p_idempotency_key
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Status**: TODO (P0)

---

## 3. GDPR OCR Compliance (TODO)

### Problema

OCR processa PII (immagini con indirizzi) senza:

- Consent esplicito
- Data retention policy
- DPA con provider (Google/Anthropic)

### Soluzione Pianificata

#### 3.1 Consent Flow

UI modifiche:

- `components/ocr/ocr-upload.tsx`: Checkbox consent obbligatorio
- Testo: "Accetto che l'immagine caricata sia processata da servizi AI esterni (Google Vision/Anthropic Claude) per l'estrazione dati. L'immagine sarà eliminata automaticamente dopo 7 giorni."

DB migration:

```sql
-- User preferences table
ALTER TABLE users
ADD COLUMN ocr_consent_given_at TIMESTAMPTZ;

-- OCR uploads tracking
CREATE TABLE ocr_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  file_path TEXT NOT NULL,
  provider_used TEXT, -- 'google-vision' | 'claude-vision' | 'tesseract'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete
);
```

#### 3.2 Data Retention Policy

CRON job cleanup:

```typescript
// app/api/cron/ocr-cleanup/route.ts
// DELETE FROM ocr_uploads WHERE created_at < NOW() - INTERVAL '7 days'
// + Delete file da storage
```

#### 3.3 Kill-Switch

Env var: `ENABLE_OCR_VISION=true` (default: `true`)

- Se `false` → OCR Vision disabilitato, fallback solo Tesseract local

#### 3.4 DPA Documentation

File: `docs/GDPR_DPA_PROCESSORS.md`

- Google Cloud Vision DPA reference
- Anthropic Claude DPA reference
- Privacy Policy update con disclosure

**Status**: TODO (P0)

---

## 4. Compensation Queue Observability (TODO)

### Problema

Compensation queue implementata ma:

- Zero metriche
- No dashboard
- No alerting
- No dead-letter queue

### Soluzione Pianificata

#### 4.1 Dashboard Metriche

Grafana dashboard (o custom):

- Pending records (status='pending')
- Expired records (status='expired')
- Average resolution time
- Failure rate per action type

Query:

```sql
-- Pending > 24h (ALERT)
SELECT COUNT(*)
FROM compensation_queue
WHERE status='pending'
  AND created_at < NOW() - INTERVAL '24 hours';

-- Resolution time (AVG)
SELECT
  action,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_resolution_seconds
FROM compensation_queue
WHERE status='expired'
GROUP BY action;
```

#### 4.2 Alerting

Alert rules:

- `pending > 24h` AND `count > 0` → Slack #eng-alerts
- `pending > 7d` AND `count > 0` → Email + PagerDuty

#### 4.3 Dead-Letter Queue

Migration:

```sql
ALTER TABLE compensation_queue
ADD COLUMN retry_count INTEGER DEFAULT 0,
ADD COLUMN max_retries INTEGER DEFAULT 3,
ADD COLUMN next_retry_at TIMESTAMPTZ;

-- DLQ table per failures permanenti
CREATE TABLE compensation_queue_dlq (
  -- Same schema as compensation_queue
  -- + failed_permanently_at TIMESTAMPTZ
);
```

**Status**: TODO (P0)

---

## Deployment Checklist

### Environment Variables

**Produzione**:

```env
# P0.1: SuperAdmin bypass (DISABILITATO in prod)
ALLOW_SUPERADMIN_WALLET_BYPASS=false

# P0.3: OCR Vision (ABILITATO ma con consent)
ENABLE_OCR_VISION=true
```

**Staging**:

```env
# Testing bypass scenarios
ALLOW_SUPERADMIN_WALLET_BYPASS=true

# OCR enabled
ENABLE_OCR_VISION=true
```

### Database Migrations

1. ✅ `040_wallet_atomic_operations.sql` (already applied)
2. ✅ `044_idempotency_locks.sql` (already applied)
3. ⏳ `040.1_wallet_idempotency_standalone.sql` (TODO)
4. ⏳ `095_ocr_uploads_tracking.sql` (TODO)
5. ⏳ `096_compensation_queue_dlq.sql` (TODO)

### Monitoring Setup

1. ⏳ Grafana dashboard import (compensation queue + wallet bypass)
2. ⏳ Alert rules configuration
3. ⏳ Slack webhook integration
4. ⏳ PagerDuty escalation policy

### Documentation Updates

1. ✅ `P0_AUDIT_FIXES.md` (this file)
2. ⏳ Privacy Policy update (OCR disclosure)
3. ⏳ `GDPR_DPA_PROCESSORS.md`
4. ⏳ Runbook: "Handling SuperAdmin wallet bypass alerts"

---

## Sign-Off

**Implementation**: Development Team
**Review Required**: Security Team + Legal (for GDPR)
**Deployment Target**: Before Go-Live Production
**ETA**: TBD (in progress)
