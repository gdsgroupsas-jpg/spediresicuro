# 🚀 TODO SPRINT 1: Financial Tracking Infrastructure

> **Sprint:** 1 of 3  
> **Durata:** 2 settimane  
> **Start Date:** ___________  
> **End Date:** ___________  
> **Owner:** ___________  

---

## 📋 PRE-SPRINT CHECKLIST

Prima di iniziare, verificare:

- [ ] Branch feature creato: `feature/financial-tracking-v1`
- [ ] Staging environment pronto
- [ ] Access credentials per tutti i dev
- [ ] Backup database staging eseguito
- [ ] Team briefing completato

---

## 🗓️ GIORNO 1-2: DATABASE SCHEMA

### Task 1.1: Tabella `platform_provider_costs`

**File:** `supabase/migrations/090_platform_provider_costs.sql`

- [ ] Creare file migration
- [ ] Definire schema tabella
- [ ] Aggiungere computed columns (margin, margin_percent)
- [ ] Creare indici performance
- [ ] Implementare RLS (solo superadmin)
- [ ] Aggiungere comments
- [ ] **TEST:** Eseguire su staging
- [ ] **TEST:** Verificare RLS funziona
- [ ] **REVIEW:** Code review

**Comando test:**
```bash
npx supabase db push --db-url $STAGING_DB_URL
```

### Task 1.2: Estensione `shipments`

**File:** `supabase/migrations/091_shipments_api_source.sql`

- [ ] Aggiungere campo `api_source`
- [ ] Aggiungere campo `price_list_used_id`
- [ ] Creare indice
- [ ] **TEST:** Verificare non breaking su record esistenti
- [ ] **TEST:** Default 'unknown' applicato
- [ ] **REVIEW:** Code review

### Task 1.3: Viste P&L

**File:** `supabase/migrations/092_platform_pnl_views.sql`

- [ ] Creare `v_platform_daily_pnl`
- [ ] Creare `v_reseller_monthly_platform_usage`
- [ ] **TEST:** Query performance < 500ms
- [ ] **REVIEW:** Code review

### Task 1.4: Audit Log Finanziario

**File:** `supabase/migrations/093_financial_audit_log.sql`

- [ ] Creare tabella `financial_audit_log`
- [ ] Implementare RLS
- [ ] **TEST:** Insert funziona
- [ ] **REVIEW:** Code review

### ✅ MILESTONE DAY 2: Schema Complete

**Acceptance Criteria:**
- [ ] Tutte le migration applicate su staging
- [ ] Zero errori
- [ ] RLS policies verificate
- [ ] Performance queries OK

---

## 🗓️ GIORNO 3-4: BUSINESS LOGIC

### Task 2.1: API Source Detection

**File:** `lib/shipments/create-shipment-core.ts`

**Modifiche:**
- [ ] Importare dipendenze necessarie
- [ ] Aggiungere parametro `priceListId` se mancante
- [ ] Implementare logica detection:
  ```
  SE listino ha master_list_id → 'platform'
  SE listino is_global → 'platform'  
  SE listino assegnato da superadmin → 'platform'
  ALTRIMENTI → 'reseller_own' o 'byoc_own'
  ```
- [ ] Chiamare `recordPlatformCost()` dopo successo
- [ ] Update shipment con `api_source`
- [ ] **TEST:** Unit test detection logic
- [ ] **TEST:** Integration test full flow
- [ ] **REVIEW:** Code review

### Task 2.2: Platform Cost Recording

**File:** `lib/shipments/platform-cost-recorder.ts` (NUOVO)

- [ ] Creare file
- [ ] Implementare `recordPlatformCost()`
- [ ] Gestire errori gracefully (no blocking)
- [ ] Audit log per failure
- [ ] **TEST:** Record created correctly
- [ ] **TEST:** Margin calculated correctly
- [ ] **TEST:** Failure non blocca spedizione
- [ ] **REVIEW:** Code review

### Task 2.3: Provider Cost Calculator

**File:** `lib/pricing/platform-cost-calculator.ts` (NUOVO)

- [ ] Creare file
- [ ] Implementare `calculatePlatformProviderCost()`
- [ ] Fallback chain: API → Master List → Historical Average → Estimate
- [ ] Source tracking
- [ ] **TEST:** Ogni fallback funziona
- [ ] **TEST:** Precision check
- [ ] **REVIEW:** Code review

### ✅ MILESTONE DAY 4: Logic Complete

**Acceptance Criteria:**
- [ ] Detection logic 100% coverage
- [ ] Recording funziona end-to-end
- [ ] Cost calculation ha fallback robusti
- [ ] Zero regression su spedizioni esistenti

---

## 🗓️ GIORNO 5: SECURITY HARDENING

### Task 3.1: Audit Logging Integration

**Modifiche in più file:**

- [ ] `lib/shipments/create-shipment-core.ts` - Log wallet operations
- [ ] `actions/wallet.ts` - Log credit/debit
- [ ] Nuovo: `lib/audit/financial-logger.ts`

```typescript
// Template
export async function logFinancialEvent(params: {
  eventType: FinancialEventType;
  userId: string;
  shipmentId?: string;
  amount?: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  // Implementation
}
```

- [ ] **TEST:** Log inserito per ogni operazione
- [ ] **REVIEW:** Code review

### Task 3.2: Security Review Checklist

- [ ] **RLS:** Tutte le nuove tabelle hanno RLS
- [ ] **Input Validation:** Nessun user input non validato
- [ ] **SQL Injection:** Solo parametri tipizzati
- [ ] **Authorization:** Check permessi su ogni endpoint
- [ ] **Audit Trail:** Ogni operazione loggata
- [ ] **Error Handling:** No info leak in messaggi errore

### ✅ MILESTONE DAY 5: Security Complete

---

## 🗓️ GIORNO 6-7: TESTING

### Task 4.1: Unit Tests

**File:** `tests/unit/platform-costs.test.ts`

- [ ] Test API source detection - master list
- [ ] Test API source detection - assigned list
- [ ] Test API source detection - own list
- [ ] Test margin calculation
- [ ] Test negative margin handling
- [ ] Test fallback chain

### Task 4.2: Integration Tests

**File:** `tests/integration/platform-costs.integration.test.ts`

- [ ] Test full flow: create shipment → record cost
- [ ] Test with real DB (staging)
- [ ] Test RLS enforcement
- [ ] Test concurrent shipments

### Task 4.3: Performance Tests

- [ ] Create 1000 shipments in batch
- [ ] Measure time < 60s
- [ ] Check no memory leaks
- [ ] Verify DB connections pooled

### ✅ MILESTONE DAY 7: Testing Complete

**Acceptance Criteria:**
- [ ] Coverage > 85%
- [ ] All tests green
- [ ] Performance within limits
- [ ] No critical/high vulnerabilities

---

## 🗓️ GIORNO 8-9: STAGING VALIDATION

### Task 5.1: Staging Deployment

- [ ] Deploy migrations
- [ ] Deploy code changes
- [ ] Verify no errors in logs
- [ ] Smoke test: create 10 shipments manually

### Task 5.2: Validation Checklist

| Scenario | Expected | Actual | Pass? |
|----------|----------|--------|-------|
| Reseller usa proprio listino | api_source='reseller_own' | | |
| Reseller usa listino assegnato | api_source='platform', record in costs | | |
| BYOC usa proprio contratto | api_source='byoc_own' | | |
| Superadmin vede costs | Tutti i record visibili | | |
| Reseller vede costs | Nessun record visibile | | |
| Margin negativo | Alert/discrepancy flag | | |

### Task 5.3: Backfill Script (Optional)

**File:** `scripts/backfill-api-source.ts`

- [ ] Analizza shipments esistenti
- [ ] Determina api_source best-effort
- [ ] Update in batch (1000 alla volta)
- [ ] Log results
- [ ] **NON OBBLIGATORIO** per go-live, può essere post-launch

### ✅ MILESTONE DAY 9: Staging Validated

---

## 🗓️ GIORNO 10: PRODUCTION DEPLOY

### Pre-Deploy Checklist

- [ ] All tests green on CI
- [ ] Staging validated
- [ ] Rollback script ready
- [ ] Monitoring dashboards ready
- [ ] Team on standby
- [ ] Communication sent to stakeholders

### Deploy Steps

```bash
# 1. Backup production DB
pg_dump $PROD_DB_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migrations
npx supabase db push --db-url $PROD_DB_URL

# 3. Deploy application (Vercel auto-deploy or manual)
git push origin master

# 4. Verify
curl -s https://spediresicuro.it/api/health | jq .

# 5. Smoke test
# Create 1 test shipment, verify in DB
```

### Post-Deploy Verification

- [ ] No errors in Vercel logs
- [ ] No errors in Supabase logs
- [ ] Test shipment created successfully
- [ ] platform_provider_costs record exists
- [ ] api_source populated

### Rollback Procedure (if needed)

```bash
# 1. Revert code
git revert HEAD
git push origin master

# 2. Revert migrations (CAREFULLY!)
# Run down scripts in reverse order
```

### ✅ MILESTONE DAY 10: Production Live

---

## 📊 SPRINT 1 SUMMARY

### Deliverables

| Item | Status |
|------|--------|
| Migration 090 | 🔲 |
| Migration 091 | 🔲 |
| Migration 092 | 🔲 |
| Migration 093 | 🔲 |
| API Source Detection | 🔲 |
| Platform Cost Recording | 🔲 |
| Provider Cost Calculator | 🔲 |
| Unit Tests | 🔲 |
| Integration Tests | 🔲 |
| Production Deploy | 🔲 |

### Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Test Coverage | > 85% | |
| Query Performance | < 500ms | |
| Zero Downtime Deploy | Yes | |
| Critical Bugs | 0 | |

### Lessons Learned

*Da compilare a fine sprint*

1. ___________
2. ___________
3. ___________

---

## 🚨 BLOCKERS & ESCALATIONS

| Issue | Owner | Status | Resolution |
|-------|-------|--------|------------|
| | | | |

---

## 📝 DAILY STANDUP TEMPLATE

```
### [DATA]

**Ieri:**
- 

**Oggi:**
- 

**Blockers:**
- 
```

---

## 🔗 LINKS UTILI

- [ROADMAP Completa](./ROADMAP_ENTERPRISE_LISTINI_WALLET.md)
- [MONEY_FLOWS](./MONEY_FLOWS.md)
- [ARCHITECTURE](./ARCHITECTURE.md)
- [Staging URL](https://staging.spediresicuro.it)
- [Supabase Dashboard](https://app.supabase.com/project/xxx)

---

**Buon lavoro! 💪**
