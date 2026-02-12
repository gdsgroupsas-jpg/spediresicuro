# Sistema Fatturazione Ricariche e Fatturazione Elettronica

## Overview

Sistema completo per fatturazione ricariche wallet con supporto:

- **Fatturazione automatica** per ricariche Stripe
- **Fatturazione manuale** per bonifici (dopo approvazione)
- **Fatturazione periodica** (mensile/trimestrale/riepilogativa)
- **Generazione PDF** conforme normativa italiana
- **Generazione XML FatturaPA** per fatturazione elettronica (SDI, Aruba, Fatturazione e Corrispettivi)

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents

## Quick Reference

| Sezione                | Link                                  |
| ---------------------- | ------------------------------------- |
| Generazione XML        | [XML Generator](#xml-generator)       |
| Fatturazione Ricariche | [Recharge Billing](#recharge-billing) |
| API Actions            | [Server Actions](#server-actions)     |
| Database Schema        | [Database](#database-schema)          |

---

## XML Generator

### Generatore XML FatturaPA

**File:** `lib/invoices/xml-generator.ts`

Genera XML conformi al formato **FatturaPA 1.2.1** (standard italiano fatturazione elettronica).

#### Compatibilità

- ✅ Sistema di Interscambio (SDI) Agenzia delle Entrate
- ✅ Aruba Fatturazione Elettronica
- ✅ Fatturazione e Corrispettivi

#### Funzioni Principali

```typescript
import {
  generateInvoiceXML,
  validateFatturaPAData,
  FatturaPAData,
} from '@/lib/invoices/xml-generator';

// Valida dati prima di generare
const errors = validateFatturaPAData(data);
if (errors.length > 0) {
  throw new Error(`Dati incompleti: ${errors.join(', ')}`);
}

// Genera XML
const xmlBuffer = await generateInvoiceXML(data);
```

#### Validazione

La funzione `validateFatturaPAData()` verifica:

- ✅ P.IVA mittente (min 11 caratteri)
- ✅ Codice Fiscale mittente (16 caratteri)
- ✅ Dati destinatario (P.IVA o C.F.)
- ✅ Codice SDI o PEC destinatario
- ✅ Almeno una riga fattura
- ✅ Quantità e prezzi validi

#### Sicurezza

- ✅ **Escape XML**: Previene injection XML (`&`, `<`, `>`, `"`, `'`)
- ✅ **Validazione input**: Verifica tutti i campi obbligatori
- ✅ **Type safety**: TypeScript per prevenire errori runtime

---

## Recharge Billing

### Sistema Fatturazione Ricariche

**File:** `actions/invoice-recharges.ts`

Sistema flessibile per fatturare ricariche wallet con tre modalità:

#### 1. Fatturazione Automatica (Stripe)

**Quando:** Dopo webhook Stripe `checkout.session.completed`

**Come funziona:**

1. Utente completa pagamento Stripe
2. Webhook accredita wallet
3. Sistema verifica regola automatica attiva
4. Genera fattura automaticamente (PDF + XML)
5. Emette fattura (draft → issued)

**Configurazione:**

```typescript
await configureInvoiceGenerationRuleAction({
  userId: 'user-id',
  generationType: 'automatic',
  includeStripe: true,
  includeBankTransfer: false,
});
```

#### 2. Fatturazione Manuale (Bonifici)

**Quando:** Dopo approvazione bonifico da admin

**Come funziona:**

1. Admin approva bonifico
2. Admin seleziona ricariche da fatturare
3. Genera fattura manualmente
4. Emette fattura

**Esempio:**

```typescript
const result = await generateInvoiceFromRechargesAction({
  userId: 'user-id',
  transactionIds: ['tx-1', 'tx-2'],
  invoiceType: 'manual',
  generateXML: true,
});
```

#### 3. Fatturazione Periodica

**Quando:** Mensile/Trimestrale/Annuale (configurabile)

**Come funziona:**

1. Sistema aggrega ricariche nel periodo
2. Genera fattura riepilogativa
3. Include tutte le ricariche non ancora fatturate

**Configurazione:**

```typescript
await configureInvoiceGenerationRuleAction({
  userId: 'user-id',
  generationType: 'periodic',
  periodFrequency: 'monthly',
  periodDay: 1, // Primo del mese
});
```

**Generazione:**

```typescript
const result = await generatePeriodicInvoiceAction({
  userId: 'user-id',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  periodType: 'monthly',
});
```

---

## Server Actions

### `generateInvoiceFromRechargesAction`

Genera fattura da ricariche wallet.

**Parametri:**

- `userId`: ID utente
- `transactionIds`: Array ID transazioni wallet
- `invoiceType`: Tipo fattura (`recharge` | `periodic` | `manual`)
- `periodStart` / `periodEnd`: Date periodo (opzionale)
- `notes`: Note fattura (opzionale)
- `generateXML`: Se true, genera anche XML FatturaPA

**Ritorna:**

```typescript
{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}
```

### `generateAutomaticInvoiceForStripeRecharge`

Genera fattura automatica per ricarica Stripe.

**Chiamata da:** Webhook Stripe `checkout.session.completed`

**Parametri:**

- `transactionId`: ID transazione wallet della ricarica

### `generatePeriodicInvoiceAction`

Genera fattura periodica aggregando ricariche nel periodo.

**Parametri:**

- `userId`: ID utente
- `periodStart`: Data inizio periodo (ISO)
- `periodEnd`: Data fine periodo (ISO)
- `periodType`: Tipo periodo (`monthly` | `quarterly` | `yearly`)

### `configureInvoiceGenerationRuleAction`

Configura regola generazione fatture per utente.

**Parametri:**

- `userId`: ID utente
- `generationType`: Tipo generazione (`automatic` | `manual` | `periodic`)
- `periodFrequency`: Frequenza (solo per `periodic`)
- `periodDay`: Giorno del mese/trimestre
- `includeStripe`: Include ricariche Stripe
- `includeBankTransfer`: Include bonifici
- `minAmount`: Importo minimo

### `listUninvoicedRechargesAction`

Lista ricariche non ancora fatturate per utente.

**Parametri:**

- `userId`: ID utente

**Ritorna:**

```typescript
{
  success: boolean;
  recharges?: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    created_at: string;
  }>;
  error?: string;
}
```

---

## Database Schema

### Tabella `invoices` (Estesa)

**Nuove colonne:**

- `xml_url` (TEXT): URL XML FatturaPA su Storage
- `invoice_type` (TEXT): Tipo fattura (`shipment` | `recharge` | `periodic` | `manual`)
- `period_start` (DATE): Data inizio periodo (per fatture periodiche)
- `period_end` (DATE): Data fine periodo (per fatture periodiche)

### Tabella `invoice_recharge_links`

Collegamento N:N tra ricariche wallet e fatture.

**Colonne:**

- `id` (UUID): Primary key
- `invoice_id` (UUID): Riferimento fattura
- `wallet_transaction_id` (UUID): Riferimento transazione wallet
- `amount` (DECIMAL): Importo ricarica
- `created_at` (TIMESTAMPTZ): Timestamp creazione

**Vincoli:**

- `UNIQUE(wallet_transaction_id)`: Una ricarica può essere inclusa solo in una fattura

### Tabella `invoice_generation_rules`

Regole per generazione automatica/manuale/periodica fatture.

**Colonne:**

- `id` (UUID): Primary key
- `user_id` (UUID): Utente
- `generation_type` (TEXT): Tipo generazione (`automatic` | `manual` | `periodic`)
- `period_frequency` (TEXT): Frequenza (`monthly` | `quarterly` | `yearly`)
- `period_day` (INTEGER): Giorno del mese/trimestre
- `include_stripe` (BOOLEAN): Include ricariche Stripe
- `include_bank_transfer` (BOOLEAN): Include bonifici
- `min_amount` (DECIMAL): Importo minimo
- `is_active` (BOOLEAN): Regola attiva

**Vincoli:**

- `UNIQUE(user_id, generation_type) WHERE is_active = true`: Un utente può avere una sola regola attiva per tipo

### Funzione SQL `generate_invoice_from_recharges`

Genera fattura da ricariche wallet.

**Parametri:**

- `p_user_id` (UUID): ID utente
- `p_transaction_ids` (UUID[]): Array ID transazioni
- `p_invoice_type` (TEXT): Tipo fattura
- `p_period_start` (DATE): Data inizio periodo (opzionale)
- `p_period_end` (DATE): Data fine periodo (opzionale)
- `p_notes` (TEXT): Note fattura (opzionale)

**Ritorna:** UUID fattura creata

**Sicurezza:**

- ✅ Verifica che tutte le transazioni siano ricariche positive
- ✅ Verifica che le ricariche non siano già fatturate
- ✅ Calcola totali (imponibile, IVA 22%, totale)
- ✅ Genera numero progressivo automatico
- ✅ Crea links ricariche → fattura

---

## API Endpoints

### `GET /api/invoices/[id]/xml`

Scarica XML FatturaPA per una fattura emessa.

**Autenticazione:** Richiesta

**Permessi:**

- Utente: Solo proprie fatture
- Admin: Tutte le fatture

**Response:**

- `200 OK`: XML file
- `401 Unauthorized`: Non autenticato
- `403 Forbidden`: Non autorizzato
- `404 Not Found`: Fattura non trovata
- `400 Bad Request`: Fattura non emessa

**Headers:**

- `Content-Type: application/xml`
- `Content-Disposition: attachment; filename="YYYY-XXXX.xml"`

---

## Flusso Completo

### Fatturazione Automatica Stripe

```
1. Utente completa pagamento Stripe
   ↓
2. Webhook: checkout.session.completed
   ↓
3. Sistema accredita wallet (add_wallet_credit)
   ↓
4. Sistema verifica regola automatica attiva
   ↓
5. Genera fattura (PDF + XML)
   ↓
6. Emette fattura (draft → issued)
   ↓
7. Collega ricarica → fattura (invoice_recharge_links)
```

### Fatturazione Manuale Bonifico

```
1. Admin approva bonifico
   ↓
2. Admin seleziona ricariche da fatturare
   ↓
3. Chiama generateInvoiceFromRechargesAction()
   ↓
4. Sistema genera fattura (PDF + XML)
   ↓
5. Admin emette fattura manualmente
   ↓
6. Collega ricariche → fattura
```

### Fatturazione Periodica

```
1. Sistema esegue job periodico (es. primo del mese)
   ↓
2. Per ogni utente con regola periodica attiva:
   ↓
3. Recupera ricariche non fatturate nel periodo
   ↓
4. Genera fattura riepilogativa (PDF + XML)
   ↓
5. Emette fattura
   ↓
6. Collega tutte le ricariche → fattura
```

---

## Sicurezza

### Validazione Input

- ✅ **Server-side validation**: Tutti i parametri validati
- ✅ **Type safety**: TypeScript per prevenire errori
- ✅ **SQL injection**: Parametri preparati
- ✅ **XML injection**: Escape caratteri speciali

### Permessi

- ✅ **RLS abilitato**: Su tutte le tabelle
- ✅ **Admin only**: Solo admin può generare/modificare fatture
- ✅ **Utente vede solo proprie**: Policy RLS

### Audit Trail

- ✅ **Collegamento ricariche → fatture**: Tracciabile
- ✅ **Timestamp creazione**: Su tutti i record
- ✅ **Immutabilità**: Ricariche non possono essere modificate dopo fatturazione

---

## Testing

### Unit Tests

**File:** `tests/unit/invoice-xml-generator.test.ts`

Testa:

- ✅ Generazione XML valido
- ✅ Validazione dati
- ✅ Escape caratteri speciali
- ✅ Calcolo IVA e totali
- ✅ Fatture con più righe

### Integration Tests

**File:** `tests/integration/invoice-recharges.integration.test.ts`

Testa:

- ✅ Generazione fattura da ricariche
- ✅ Collegamento ricariche → fatture
- ✅ Prevenzione doppia fatturazione
- ✅ Vincoli database

---

## Esempi d'Uso

### Esempio 1: Fattura Automatica Stripe

```typescript
// Configura regola automatica
await configureInvoiceGenerationRuleAction({
  userId: 'user-123',
  generationType: 'automatic',
  includeStripe: true,
});

// Dopo webhook Stripe, la fattura viene generata automaticamente
// (gestito in app/api/stripe/webhook/route.ts)
```

### Esempio 2: Fattura Manuale Bonifico

```typescript
// Admin seleziona ricariche da fatturare
const recharges = await listUninvoicedRechargesAction('user-123');

// Genera fattura
const result = await generateInvoiceFromRechargesAction({
  userId: 'user-123',
  transactionIds: recharges.recharges?.map((r) => r.id) || [],
  invoiceType: 'manual',
  generateXML: true,
});

if (result.success) {
  // Fattura creata con PDF e XML
  console.log('Fattura:', result.invoice?.invoice_number);
}
```

### Esempio 3: Fattura Periodica Mensile

```typescript
// Configura regola periodica
await configureInvoiceGenerationRuleAction({
  userId: 'user-123',
  generationType: 'periodic',
  periodFrequency: 'monthly',
  periodDay: 1, // Primo del mese
});

// Genera fattura mensile
const result = await generatePeriodicInvoiceAction({
  userId: 'user-123',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  periodType: 'monthly',
});
```

---

## Migration

**File:** `supabase/migrations/110_invoice_xml_and_recharge_billing.sql`

**Cosa fa:**

1. Estende `invoices` con `xml_url`, `invoice_type`, `period_start`, `period_end`
2. Crea `invoice_recharge_links` per collegamento ricariche → fatture
3. Crea `invoice_generation_rules` per regole generazione
4. Crea funzione SQL `generate_invoice_from_recharges`
5. Configura RLS policies

**Sicurezza:**

- ✅ RLS abilitato su tutte le nuove tabelle
- ✅ Validazione input in funzione SQL
- ✅ Unicità ricariche (una ricarica = una fattura)

---

## Note Implementative

### Gestione Errori

- ✅ **Non bloccante**: Generazione XML non blocca se fallisce (fattura già creata con PDF)
- ✅ **Graceful degradation**: Se XML non può essere generato, la fattura rimane valida con solo PDF
- ✅ **Logging**: Tutti gli errori loggati per investigazione

### Performance

- ✅ **Indici database**: Su `invoice_type`, `period_start/end`, `invoice_id`, `wallet_transaction_id`
- ✅ **Lazy loading**: XML generato solo se richiesto
- ✅ **Caching**: XML salvato su Storage per download successivi

### Compatibilità

- ✅ **Retrocompatibilità**: Fatture esistenti continuano a funzionare
- ✅ **Campo opzionale**: `xml_url` è nullable (fatture vecchie non hanno XML)
- ✅ **Default values**: `invoice_type` default `'shipment'` per fatture esistenti

---

## Troubleshooting

### XML non generato

**Problema:** Fattura creata ma `xml_url` è NULL

**Possibili cause:**

1. Dati incompleti (P.IVA, C.F., SDI)
2. Validazione fallita
3. Errore upload Storage

**Soluzione:**

- Verifica dati utente completi
- Chiama `generateXMLForInvoice()` manualmente
- Controlla logs per errori specifici

### Ricarica già fatturata

**Problema:** Errore "ricarica già fatturata"

**Causa:** La ricarica è già collegata a una fattura

**Soluzione:**

- Verifica `invoice_recharge_links` per vedere quale fattura
- Se errore, elimina link e rigenera fattura

### Fattura automatica non generata

**Problema:** Ricarica Stripe completata ma nessuna fattura

**Possibili cause:**

1. Nessuna regola automatica attiva per l'utente
2. Errore nella generazione (check logs)

**Soluzione:**

- Verifica `invoice_generation_rules` per l'utente
- Configura regola automatica se mancante
- Genera fattura manualmente se necessario

---

## Fatturazione Postpagata (dal 2026-02-12)

### Flusso

Per utenti con `billing_mode = 'postpagato'`, le spedizioni creano record `POSTPAID_CHARGE` in `wallet_transactions` senza toccare il saldo wallet. A fine mese, il Reseller genera la fattura mensile.

### Server Action

```typescript
import { generatePostpaidMonthlyInvoice } from '@/actions/invoice-recharges';

const result = await generatePostpaidMonthlyInvoice(subUserId, '2026-02');
// result: { success, invoiceId, totalAmount, itemsCount }
```

### Logica

1. Verifica auth reseller + ownership sub-user (parent_id + workspace V2)
2. Query `wallet_transactions` con `type = 'POSTPAID_CHARGE'` per il mese specificato
3. Filtra transazioni gia fatturate (join `invoice_recharge_links`)
4. Crea fattura con tipo `periodic`, period_start/period_end
5. Crea `invoice_items` per ogni spedizione
6. Crea `invoice_recharge_links` per collegare transazioni a fattura
7. Rollback atomico se items o links falliscono

### Vista SQL

```sql
-- postpaid_monthly_summary: aggrega consumo mensile per utente postpagato
SELECT user_id, date_trunc('month', created_at) AS month,
       SUM(ABS(amount)) AS total_consumed, COUNT(*) AS shipments_count
FROM wallet_transactions WHERE type = 'POSTPAID_CHARGE'
GROUP BY user_id, date_trunc('month', created_at);
```

**File:** `supabase/migrations/20260216200000_postpaid_billing_support.sql`

---

## Roadmap Futura

- [ ] Job automatico per fatture periodiche (cron)
- [ ] Notifica email quando fattura generata
- [ ] Dashboard fatture ricariche
- [ ] Export CSV fatture per contabilita
- [ ] Integrazione con software contabili esterni
