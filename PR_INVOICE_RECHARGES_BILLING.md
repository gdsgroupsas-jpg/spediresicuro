# PR: Sistema Fatturazione Ricariche e Fatturazione Elettronica (FatturaPA)

## 🎯 Obiettivo

Implementazione sistema completo per fatturazione ricariche wallet con supporto:
- ✅ **Fatturazione automatica** per ricariche Stripe
- ✅ **Fatturazione manuale** per bonifici (dopo approvazione)
- ✅ **Fatturazione periodica** (mensile/trimestrale/riepilogativa)
- ✅ **Generazione PDF** conforme normativa italiana
- ✅ **Generazione XML FatturaPA** per fatturazione elettronica (SDI, Aruba, Fatturazione e Corrispettivi)

## 📋 Modifiche

### 1. Generatore XML FatturaPA

**File:** `lib/invoices/xml-generator.ts` (NUOVO)

- Genera XML conformi formato FatturaPA 1.2.1
- Validazione dati completa
- Escape caratteri XML speciali (sicurezza)
- Supporto PEC e Codice SDI
- Calcolo automatico IVA e totali

### 2. Migration Database

**File:** `supabase/migrations/110_invoice_xml_and_recharge_billing.sql` (NUOVO)

**Estensioni tabella `invoices`:**
- `xml_url` (TEXT): URL XML FatturaPA su Storage
- `invoice_type` (TEXT): Tipo fattura (`shipment` | `recharge` | `periodic` | `manual`)
- `period_start` / `period_end` (DATE): Date periodo per fatture periodiche

**Nuove tabelle:**
- `invoice_recharge_links`: Collegamento N:N ricariche → fatture
- `invoice_generation_rules`: Regole generazione automatica/manuale/periodica

**Nuova funzione SQL:**
- `generate_invoice_from_recharges()`: Genera fattura da ricariche wallet

### 3. Server Actions

**File:** `actions/invoice-recharges.ts` (NUOVO)

**Funzioni principali:**
- `generateInvoiceFromRechargesAction()`: Genera fattura da ricariche
- `generateAutomaticInvoiceForStripeRecharge()`: Fatturazione automatica Stripe
- `generatePeriodicInvoiceAction()`: Fatturazione periodica
- `configureInvoiceGenerationRuleAction()`: Configura regole generazione
- `listUninvoicedRechargesAction()`: Lista ricariche non fatturate

### 4. Integrazione Stripe Webhook

**File:** `app/api/stripe/webhook/route.ts` (MODIFICATO)

- Aggiunta generazione fattura automatica dopo accredito wallet
- Non bloccante: se fallisce, la ricarica è comunque completata

### 5. Estensione Actions Fatture

**File:** `app/actions/invoices.ts` (MODIFICATO)

- Aggiunta funzione `generateXMLForInvoice()` per generare XML per fatture esistenti
- Import generatore XML

### 6. API Endpoint

**File:** `app/api/invoices/[id]/xml/route.ts` (NUOVO)

- `GET /api/invoices/[id]/xml`: Scarica XML FatturaPA per fattura emessa
- Verifica permessi (utente vede solo proprie, admin vede tutte)
- Genera XML on-demand se non esiste

### 7. Types

**File:** `types/invoices.ts` (MODIFICATO)

- Aggiunto `xml_url` a `Invoice`
- Aggiunto `invoice_type`, `period_start`, `period_end` a `Invoice`

### 8. Test

**File:** `tests/unit/invoice-xml-generator.test.ts` (NUOVO)
- Test generazione XML
- Test validazione dati
- Test escape caratteri speciali
- Test calcolo IVA e totali

**File:** `tests/integration/invoice-recharges.integration.test.ts` (NUOVO)
- Test generazione fattura da ricariche
- Test collegamento ricariche → fatture
- Test prevenzione doppia fatturazione
- Test vincoli database

### 9. Documentazione

**File:** `docs/11-FEATURES/INVOICE_RECHARGES.md` (NUOVO)

- Documentazione completa sistema
- Esempi d'uso
- Troubleshooting
- Flussi completi

## 🔒 Sicurezza

- ✅ **RLS abilitato** su tutte le nuove tabelle
- ✅ **Validazione input** server-side
- ✅ **Escape XML** per prevenire injection
- ✅ **Type safety** TypeScript
- ✅ **SQL injection** prevenuto con parametri preparati
- ✅ **Permessi**: Solo admin può generare/modificare fatture

## ✅ Testing

- ✅ **Unit tests**: Generatore XML (8 test)
- ✅ **Integration tests**: Sistema fatturazione ricariche (3 test)
- ✅ **Type check**: Passato
- ✅ **Linting**: Nessun errore

## 🚀 Deployment

### Prerequisiti

1. **Variabili ambiente** (opzionali per XML):
   - `COMPANY_SDI_CODE`: Codice SDI mittente
   - `COMPANY_PEC`: PEC mittente

2. **Storage Supabase**:
   - Bucket `documents` deve esistere
   - Permessi: pubblico per download

### Migration

```bash
# Applica migration
supabase migration up 110_invoice_xml_and_recharge_billing
```

### Post-Deployment

1. Configurare regole fatturazione per utenti esistenti (se necessario)
2. Verificare che Storage bucket `documents` esista
3. Testare generazione XML con dati reali

## 📊 Impatto

### Breaking Changes

**Nessuno** - Tutte le modifiche sono retrocompatibili:
- Campi nuovi sono opzionali
- Fatture esistenti continuano a funzionare
- `invoice_type` default `'shipment'` per fatture esistenti

### Performance

- ✅ Indici database su colonne critiche
- ✅ Lazy loading XML (generato solo se richiesto)
- ✅ Caching XML su Storage

### Compatibilità

- ✅ Retrocompatibile con fatture esistenti
- ✅ Supporta fatture spedizioni (esistenti)
- ✅ Supporta fatture ricariche (nuove)

## 🧪 Test Manuali

### Test 1: Generazione XML

```typescript
import { generateInvoiceXML, validateFatturaPAData } from '@/lib/invoices/xml-generator';

const data = { /* dati fattura */ };
const errors = validateFatturaPAData(data);
if (errors.length === 0) {
  const xml = await generateInvoiceXML(data);
  // XML valido generato
}
```

### Test 2: Fatturazione Automatica Stripe

1. Configura regola automatica per utente
2. Completa pagamento Stripe
3. Verifica che fattura sia generata automaticamente
4. Verifica PDF e XML disponibili

### Test 3: Fatturazione Manuale

1. Crea ricariche wallet
2. Chiama `generateInvoiceFromRechargesAction()`
3. Verifica fattura creata con PDF e XML
4. Verifica links ricariche → fattura

## 📝 Note

- **XML FatturaPA**: Conforme formato 1.2.1 (D.M. 17/06/2014)
- **Compatibilità**: SDI, Aruba, Fatturazione e Corrispettivi
- **Sicurezza**: Escape XML previene injection
- **Performance**: XML generato on-demand, cached su Storage

## 🔗 Link Utili

- [Documentazione Completa](./docs/11-FEATURES/INVOICE_RECHARGES.md)
- [Migration SQL](./supabase/migrations/110_invoice_xml_and_recharge_billing.sql)
- [XML Generator](./lib/invoices/xml-generator.ts)
- [Server Actions](./actions/invoice-recharges.ts)

---

**Status:** ✅ Ready for Review
**Type:** Feature
**Priority:** P1 - Fatturazione
**Breaking Changes:** No
