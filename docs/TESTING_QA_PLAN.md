# 🧪 Testing & QA Plan - Sprint 1, 2, 3

## 📋 Obiettivo

Verificare che tutte le funzionalità implementate funzionino correttamente in produzione.

---

## ✅ PRE-REQUISITI

- [ ] Migrations 090-094 applicate con successo
- [ ] Environment variables configurate in Vercel
- [ ] Deploy completato su produzione/staging

---

## 🧪 TEST SUITE AUTOMATIZZATA

### Unit Tests

```bash
npx vitest run
```

**Expected:** 811/811 tests passed ✅

### Test Specifici Financial Tracking

```bash
npx vitest run tests/unit/platform-cost-recorder.test.ts tests/unit/platform-cost-calculator.test.ts
```

**Expected:** 29/29 tests passed ✅

---

## 🔍 TEST MANUALI - SPRINT 1: Financial Tracking

### 1. Creazione Spedizione con Tracking Costi

**Scenario:** Creare una spedizione che usa contratti piattaforma

**Steps:**

1. Login come Reseller o BYOC user
2. Crea nuova spedizione
3. Seleziona corriere con contratto piattaforma
4. Completa la spedizione

**Verifica:**

- [ ] Spedizione creata con successo
- [ ] Campo `api_source` popolato in `shipments` table
- [ ] Record creato in `platform_provider_costs` table
- [ ] Margine calcolato correttamente (`billed_amount - provider_cost`)
- [ ] Se margine negativo, alert creato in `financial_audit_log`

**Query di verifica:**

```sql
-- Verifica api_source
SELECT id, tracking_number, api_source, price_list_id
FROM shipments
WHERE id = '<shipment_id>';

-- Verifica costo registrato
SELECT * FROM platform_provider_costs
WHERE shipment_id = '<shipment_id>';

-- Verifica alert se margine negativo
SELECT * FROM financial_audit_log
WHERE event_type = 'margin_alert'
ORDER BY created_at DESC LIMIT 5;
```

---

### 2. Financial Dashboard - SuperAdmin

**Scenario:** Visualizzare P&L e statistiche finanziarie

**Steps:**

1. Login come SuperAdmin
2. Naviga a `/dashboard/super-admin/financial`
3. Verifica tutte le sezioni

**Verifica:**

- [ ] Stats Cards caricate correttamente (8 cards)
- [ ] Monthly P&L chart visualizzato
- [ ] Alerts Table mostra margini negativi
- [ ] Reconciliation Table mostra spedizioni pending
- [ ] Period Selector funziona (7d, 30d, 90d, YTD, all)
- [ ] Export CSV funziona
- [ ] Tab Analytics mostra:
  - [ ] Margin By Courier Chart
  - [ ] Top Resellers Table

---

## 🔍 TEST MANUALI - SPRINT 2: UX Unification

### 3. Dashboard Clienti Reseller

**Scenario:** Gestire clienti con listini inline

**Steps:**

1. Login come Reseller
2. Naviga a `/dashboard/reseller/clienti`
3. Verifica funzionalità

**Verifica:**

- [ ] Client Stats Cards mostrano dati corretti
- [ ] Lista clienti con badge listino inline
- [ ] Filtri funzionano (nome, email, con/senza listino)
- [ ] Ordinamento funziona (data, nome, saldo, spedizioni)
- [ ] Assegnazione listino da dropdown menu
- [ ] Link rapidi funzionano (wallet, spedizioni, creazione listino)

**Query di verifica:**

```sql
-- Verifica clienti con listini
SELECT u.id, u.email, pl.name as listino_name
FROM users u
LEFT JOIN price_lists pl ON u.assigned_price_list_id = pl.id
WHERE u.parent_user_id = '<reseller_id>';
```

---

### 4. Navigation Update

**Scenario:** Verificare nuove voci di navigazione

**Steps:**

1. Login come Reseller → verifica sidebar
2. Login come SuperAdmin → verifica sidebar

**Verifica Reseller:**

- [ ] Voce "I Miei Clienti" punta a `/dashboard/reseller/clienti`
- [ ] Descrizione aggiornata: "Gestisci clienti, listini e wallet"

**Verifica SuperAdmin:**

- [ ] Nuova sezione "Finanza Piattaforma" visibile
- [ ] Voce "Financial Dashboard" punta a `/dashboard/super-admin/financial`
- [ ] Voce "Listini Master" presente

---

## 🔍 TEST MANUALI - SPRINT 3: Optimization & Monitoring

### 5. Cron Job - Financial Alerts

**Scenario:** Verificare invio alert automatici

**Steps:**

1. Configura Slack/Telegram/Email (vedi `docs/ALERTS_SETUP.md`)
2. Crea spedizioni con margini negativi (o aspetta il cron)
3. Trigger manuale: `GET /api/cron/financial-alerts`

**Verifica:**

- [ ] Endpoint risponde con `200 OK`
- [ ] Alert inviati a tutti i canali configurati:
  - [ ] Slack (se configurato)
  - [ ] Telegram (se configurato)
  - [ ] Email (se configurato)
- [ ] Alert loggati in `financial_audit_log`
- [ ] Response JSON mostra `channels: { slack: true, telegram: true, email: true }`

**Test manuale:**

```bash
curl -X GET https://tuo-dominio.vercel.app/api/cron/financial-alerts \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

### 6. Cron Job - Auto Reconciliation

**Scenario:** Verificare riconciliazione automatica

**Steps:**

1. Crea spedizioni con margine positivo > 7 giorni fa
2. Trigger manuale: `GET /api/cron/auto-reconciliation`

**Verifica:**

- [ ] Endpoint risponde con `200 OK`
- [ ] Spedizioni con margine positivo > 7gg marcate come `matched`
- [ ] Spedizioni con margine negativo marcate come `discrepancy`
- [ ] Response JSON mostra stats aggiornate

**Query di verifica:**

```sql
-- Verifica auto-matched
SELECT COUNT(*) FROM platform_provider_costs
WHERE reconciliation_status = 'matched'
AND reconciled_by = '00000000-0000-0000-0000-000000000000'
AND reconciliation_notes LIKE 'Auto-riconciliato%';

-- Verifica auto-flagged
SELECT COUNT(*) FROM platform_provider_costs
WHERE reconciliation_status = 'discrepancy'
AND reconciliation_notes LIKE 'Auto-flaggato%';
```

---

## 🔒 SECURITY TESTING

### 7. RPC Permissions Security (Migration 095)

**Scenario:** Verificare che funzioni RPC critiche siano accessibili solo da service_role

**Funzioni da testare:**

- `record_platform_provider_cost()`
- `log_financial_event()`
- `log_wallet_operation()`

**Steps:**

1. **Test come utente autenticato (NON service_role):**
   - Apri Supabase SQL Editor
   - Esegui come utente autenticato (non service_role)

**Query di test (dovrebbero FALLIRE):**

```sql
-- Test 1: record_platform_provider_cost
SELECT record_platform_provider_cost(
  '00000000-0000-0000-0000-000000000000'::UUID,
  'TEST123',
  '00000000-0000-0000-0000-000000000000'::UUID,
  100.00,
  50.00,
  'platform',
  'brt',
  'standard',
  NULL,
  NULL,
  'estimate'
);
-- Expected: ERROR - permission denied for function record_platform_provider_cost

-- Test 2: log_financial_event
SELECT log_financial_event(
  'test_event',
  NULL,
  NULL,
  100.00,
  'Test message',
  'info',
  '{}'::jsonb,
  NULL,
  NULL
);
-- Expected: ERROR - permission denied for function log_financial_event

-- Test 3: log_wallet_operation
SELECT log_wallet_operation(
  '00000000-0000-0000-0000-000000000000'::UUID,
  'credit',
  100.00,
  0.00,
  100.00,
  'Test',
  NULL,
  NULL
);
-- Expected: ERROR - permission denied for function log_wallet_operation
```

**Verifica:**

- [ ] Tutte e 3 le chiamate falliscono con errore "permission denied"
- [ ] Nessun record inserito nelle tabelle
- [ ] Solo codice server-side (service_role) può chiamare queste funzioni

**Query di verifica permessi:**

```sql
-- Verifica che PUBLIC non abbia permessi
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'record_platform_provider_cost',
    'log_financial_event',
    'log_wallet_operation'
  )
  AND grantee = 'PUBLIC';
-- Expected: 0 rows (nessun permesso PUBLIC)

-- Verifica che service_role abbia permessi
SELECT
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'record_platform_provider_cost',
    'log_financial_event',
    'log_wallet_operation'
  )
  AND grantee = 'service_role';
-- Expected: 3 rows (una per funzione)
```

---

### 8. Row Level Security (RLS)

**Scenario:** Verificare che solo SuperAdmin veda dati finanziari

**Steps:**

1. Login come Reseller normale
2. Prova ad accedere a `/dashboard/super-admin/financial`

**Verifica:**

- [ ] Accesso negato (redirect o 403)
- [ ] Solo SuperAdmin può vedere:
  - [ ] `platform_provider_costs` table
  - [ ] `financial_audit_log` table
  - [ ] Financial Dashboard

**Test SQL (come Reseller):**

```sql
-- Dovrebbe fallire o restituire 0 righe
SELECT * FROM platform_provider_costs LIMIT 1;
```

---

### 8. Cron Endpoint Security

**Scenario:** Verificare protezione cron endpoints

**Steps:**

1. Chiama `/api/cron/financial-alerts` senza token
2. Chiama con token errato

**Verifica:**

- [ ] Senza token → `401 Unauthorized` (se `CRON_SECRET` configurato)
- [ ] Con token errato → `401 Unauthorized`
- [ ] Con token corretto → `200 OK`

---

## 📊 PERFORMANCE TESTING

### 9. Query Performance

**Scenario:** Verificare performance delle query finanziarie

**Steps:**

1. Esegui EXPLAIN ANALYZE su query principali

**Query da testare:**

```sql
-- P&L giornaliero
EXPLAIN ANALYZE
SELECT * FROM platform_daily_pnl
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY date DESC;

-- Margini per corriere
EXPLAIN ANALYZE
SELECT courier_code,
       SUM(platform_margin) as total_margin,
       COUNT(*) as shipments
FROM platform_provider_costs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY courier_code;

-- Top resellers
EXPLAIN ANALYZE
SELECT billed_user_id,
       SUM(billed_amount) as total_billed,
       COUNT(*) as shipments
FROM platform_provider_costs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY billed_user_id
ORDER BY total_billed DESC
LIMIT 10;
```

**Verifica:**

- [ ] Query execution time < 500ms
- [ ] Indici utilizzati correttamente
- [ ] Nessun sequential scan su tabelle grandi

---

## 🐛 REGRESSION TESTING

### 10. Funzionalità Esistenti

**Scenario:** Verificare che non abbiamo rotto nulla

**Steps:**

1. Testa funzionalità core esistenti

**Verifica:**

- [ ] Creazione spedizione normale (senza tracking costi) funziona
- [ ] Listini esistenti funzionano
- [ ] Wallet operations funzionano
- [ ] Dashboard esistenti caricano correttamente
- [ ] Nessun errore in console browser
- [ ] Nessun errore in server logs

---

## 📝 CHECKLIST FINALE

### Pre-Deploy

- [ ] Tutti i test unitari passano (811/811)
- [ ] Migrations testate su staging
- [ ] Environment variables configurate
- [ ] Documentazione aggiornata

### Post-Deploy

- [ ] Test manuali completati
- [ ] Performance verificata
- [ ] Security verificata
- [ ] Alert configurati e funzionanti
- [ ] Nessuna regressione

### Monitoring

- [ ] Vercel logs puliti
- [ ] Supabase logs puliti
- [ ] Alert ricevuti correttamente
- [ ] Cron jobs eseguiti correttamente

---

## 🚨 KNOWN ISSUES / LIMITATIONS

- [ ] Documentare eventuali limitazioni note
- [ ] Documentare workaround temporanei

---

## 📞 SUPPORT

In caso di problemi:

1. Verifica logs Vercel
2. Verifica logs Supabase
3. Controlla `financial_audit_log` per errori
4. Verifica environment variables
