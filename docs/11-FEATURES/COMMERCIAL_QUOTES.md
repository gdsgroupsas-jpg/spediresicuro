# Preventivatore Commerciale - SpedireSicuro

## Overview

Il Preventivatore Commerciale e' il modulo che consente ai reseller di generare preventivi PDF brandizzati per nuovi clienti (prospect). Copre l'intero ciclo di vita: creazione preventivo con matrice prezzi, invio al prospect via email con PDF allegato, negoziazione con timeline eventi, conversione prospect in cliente operativo con listino personalizzato. Include analytics dashboard, auto-scadenza con reminder, e sistema di revisioni immutabili.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Comprensione del sistema listini (`PRICE_LISTS.md`)
- Familiarita' con workspace hierarchy (`RESELLER_HIERARCHY.md`)
- Conoscenza base di Resend (email provider)

## Quick Reference

| Sezione               | File Principale                                         | Link                                         |
| --------------------- | ------------------------------------------------------- | -------------------------------------------- |
| Pipeline preventivi   | `components/commercial-quotes/quote-pipeline.tsx`       | [Pipeline](#pipeline-preventivi)             |
| Creazione preventivo  | `components/commercial-quotes/quote-form.tsx`           | [Creazione](#creazione-preventivo)           |
| Matrice prezzi        | `lib/commercial-quotes/matrix-builder.ts`               | [Matrice](#matrice-prezzi)                   |
| PDF brandizzato       | `lib/commercial-quotes/pdf-generator.ts`                | [PDF](#generazione-pdf)                      |
| Clausole standard     | `lib/commercial-quotes/clauses.ts`                      | [Clausole](#clausole-contrattuali)           |
| Analytics             | `lib/commercial-quotes/analytics.ts`                    | [Analytics](#analytics-dashboard)            |
| Conversione cliente   | `lib/commercial-quotes/conversion.ts`                   | [Conversione](#conversione-prospect-cliente) |
| Auto-scadenza         | `app/api/cron/expire-quotes/route.ts`                   | [Cron](#auto-scadenza-cron)                  |
| Timeline negoziazione | `components/commercial-quotes/negotiation-timeline.tsx` | [Timeline](#timeline-negoziazione)           |
| Tipi TypeScript       | `types/commercial-quotes.ts`                            | [Tipi](#tipi-principali)                     |
| Server Actions        | `actions/commercial-quotes.ts`                          | [Actions](#server-actions)                   |

## Content

### Architettura Generale

Il modulo e' composto da:

```
actions/commercial-quotes.ts          ← 10+ server actions (cuore logica)
types/commercial-quotes.ts            ← Tipi, status, eventi, analytics
lib/commercial-quotes/
  ├── matrix-builder.ts               ← Costruzione matrice prezzi da listino
  ├── pdf-generator.ts                ← Generazione PDF con jsPDF
  ├── clauses.ts                      ← Clausole standard + custom
  ├── analytics.ts                    ← Funzione pura computeAnalytics()
  └── conversion.ts                   ← Logica prospect -> cliente
components/commercial-quotes/
  ├── quote-form.tsx                  ← Form creazione preventivo
  ├── quote-pipeline.tsx              ← Pipeline con filtri e azioni
  ├── quote-detail-dialog.tsx         ← Dialog dettaglio con timeline
  ├── quote-analytics.tsx             ← Dashboard analytics (Recharts)
  ├── matrix-preview.tsx              ← Anteprima matrice prezzi
  ├── negotiation-timeline.tsx        ← Timeline eventi verticale
  ├── status-change-dialog.tsx        ← Dialog cambio stato con note
  └── convert-dialog.tsx              ← Dialog conversione in cliente
app/dashboard/reseller/preventivo/
  └── page.tsx                        ← Pagina principale (3 tab)
app/api/commercial-quotes/
  └── [id]/pdf/route.ts               ← API download PDF
app/api/cron/
  └── expire-quotes/route.ts          ← Cron auto-scadenza
supabase/migrations/
  ├── 20260207100000_commercial_quotes_module.sql
  └── 20260208100000_commercial_quotes_analytics_index.sql
```

### Pipeline Preventivi

#### Stati e Transizioni

```
draft ──────→ sent ──────→ negotiating ──→ accepted ──→ [CONVERSIONE]
                │              │              │
                │              │              └──→ rejected
                │              │
                │              └──→ rejected
                │
                └──→ expired (auto, via cron)
                              │
                              └──→ [RINNOVO] → draft (nuova revisione)
```

| Stato         | Descrizione                       | Transizioni possibili                            |
| ------------- | --------------------------------- | ------------------------------------------------ |
| `draft`       | Bozza in lavorazione              | `sent`                                           |
| `sent`        | Inviato al prospect (email + PDF) | `negotiating`, `accepted`, `rejected`, `expired` |
| `negotiating` | In trattativa attiva              | `accepted`, `rejected`, `expired`                |
| `accepted`    | Accettato dal prospect            | Conversione in cliente                           |
| `rejected`    | Rifiutato dal prospect            | Terminale                                        |
| `expired`     | Scaduto (automatico via cron)     | Rinnovo (crea nuova revisione draft)             |

#### Transizioni con Note Obbligatorie

- **negotiating**: note obbligatorie (motivo trattativa)
- **rejected**: note obbligatorie (motivo rifiuto)
- **accepted**: note opzionali

### Creazione Preventivo

#### Dati Prospect

| Campo                       | Obbligatorio | Descrizione                                    |
| --------------------------- | ------------ | ---------------------------------------------- |
| `prospect_company`          | Si           | Ragione sociale                                |
| `prospect_contact_name`     | No           | Referente                                      |
| `prospect_email`            | No           | Email (per invio PDF)                          |
| `prospect_phone`            | No           | Telefono                                       |
| `prospect_sector`           | No           | Settore (e-commerce, food, farmaceutico, etc.) |
| `prospect_estimated_volume` | No           | Volume stimato spedizioni/mese                 |

#### Settori Disponibili

```typescript
const PROSPECT_SECTORS = [
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'pharma', label: 'Farmaceutico' },
  { value: 'fashion', label: 'Moda & Abbigliamento' },
  { value: 'tech', label: 'Tecnologia & Elettronica' },
  { value: 'industrial', label: 'Industriale' },
  { value: 'publishing', label: 'Editoria' },
  { value: 'other', label: 'Altro' },
] as const;
```

#### Configurazione Preventivo

- **Corriere**: selezionato dal listino master del workspace
- **Margine %**: ricarico applicato ai prezzi base (es. 20%)
- **Validita' giorni**: durata validita' preventivo (default 30)
- **Clausole**: standard (IVA, pagamento, validita') + custom
- **Delivery mode**: `carrier_pickup` | `own_fleet` | `client_dropoff`
- **Processing fee**: tariffa lavorazione merce (opzionale)

### Matrice Prezzi

La matrice viene costruita da `buildPriceMatrix()` a partire dal listino master:

1. Legge le fasce peso dal listino attivo del workspace per il corriere selezionato
2. Raggruppa per zona di destinazione
3. Applica il margine percentuale a ogni prezzo base
4. Arrotonda a 2 decimali

**Struttura output:**

```typescript
interface CommercialQuotePriceMatrix {
  carrier_code: string;
  carrier_display_name: string;
  margin_percent: number;
  delivery_mode: DeliveryMode;
  processing_fee: number | null;
  weight_ranges: string[]; // ["0-1", "1-3", "3-5", ...]
  zones: {
    zone_name: string;
    prices: number[]; // Prezzo per ogni fascia peso
  }[];
}
```

### Generazione PDF

Il PDF brandizzato viene generato con `jsPDF` e include:

- Header con logo/branding del workspace
- Dati prospect (azienda, contatto, email)
- Matrice prezzi completa (tabella zone x pesi)
- Clausole contrattuali
- Data creazione e validita'
- Footer con riferimenti

Il PDF viene:

1. Generato on-the-fly alla creazione
2. Uploadato su Supabase Storage (`commercial-quotes/{workspace_id}/{quote_id}.pdf`)
3. Servito via API route `/api/commercial-quotes/[id]/pdf`
4. Allegato all'email di invio al prospect

### Clausole Contrattuali

Clausole standard incluse automaticamente:

```typescript
const STANDARD_CLAUSES = [
  { title: 'IVA', text: 'Tutti i prezzi sono IVA esclusa 22%', type: 'standard' },
  { title: 'Pagamento', text: 'Pagamento a 30 giorni data fattura', type: 'standard' },
  { title: "Validita'", text: 'Offerta valida {validity_days} giorni', type: 'standard' },
  {
    title: 'Supplementi',
    text: 'Eventuali supplementi carburante applicati secondo tariffario corriere',
    type: 'standard',
  },
];
```

Il reseller puo' aggiungere clausole custom dal form.

### Immutabilita' Snapshot

**Regola fondamentale**: dopo l'invio (`status !== 'draft'`), il preventivo diventa immutabile.

- `price_matrix` e' un JSON snapshot salvato nel record
- Non dipende piu' dal listino corrente (che puo' cambiare)
- Per modificare un preventivo inviato: creare una **nuova revisione**

#### Sistema Revisioni

```
root (rev 1) ── parent_quote_id: null
  └── rev 2 ── parent_quote_id: root.id
  └── rev 3 ── parent_quote_id: root.id
```

- Ogni revisione punta al root (`parent_quote_id`)
- `revision` incrementale (1, 2, 3...)
- `original_margin_percent` preservato dal root (per analytics self-learning)
- La pipeline mostra solo l'ultima revisione per ogni root

### Sistema Email

#### 3 Template Email

1. **Email al Prospect** (`sendQuoteToProspectEmail`)
   - Trigger: reseller clicca "Invia"
   - Contenuto: presentazione, dettagli validita', PDF allegato
   - Non-bloccante: errore email non blocca l'invio del preventivo

2. **Reminder Scadenza** (`sendQuoteExpiryReminderEmail`)
   - Trigger: cron, 5 giorni prima della scadenza
   - Destinatario: reseller (non prospect)
   - Stile: warning amber con data scadenza
   - Deduplicazione: un solo reminder per preventivo (evento `reminder_sent`)

3. **Email Benvenuto** (`sendWelcomeEmail`)
   - Trigger: conversione prospect in cliente
   - Contenuto: credenziali accesso, link login, avviso cambio password
   - Non-bloccante

### Auto-Scadenza (Cron)

**Endpoint**: `POST /api/cron/expire-quotes`
**Schedule**: ogni 4 ore (`0 */4 * * *` in `vercel.json`)
**Auth**: header `x-cron-secret` o Bearer `CRON_SECRET`

**Step 1 - Auto-expire:**

- Query: `expires_at < NOW()` AND `status IN ('sent', 'negotiating')`
- Azione: UPDATE `status = 'expired'` + evento `expired` + audit log

**Step 2 - Reminder:**

- Query: `expires_at BETWEEN NOW() AND NOW() + 5 days` AND `status IN ('sent', 'negotiating')`
- Check dedup: esiste gia' evento `reminder_sent`?
- Se no: invia email + crea evento

### Timeline Negoziazione

Ogni preventivo (e la sua catena di revisioni) ha una timeline di eventi:

| Tipo Evento     | Etichetta             | Colore |
| --------------- | --------------------- | ------ |
| `created`       | Preventivo creato     | Blu    |
| `updated`       | Preventivo aggiornato | Grigio |
| `sent`          | Inviato al prospect   | Blu    |
| `viewed`        | Visualizzato          | Grigio |
| `revised`       | Nuova revisione       | Indigo |
| `accepted`      | Accettato             | Verde  |
| `rejected`      | Rifiutato             | Rosso  |
| `expired`       | Scaduto               | Rosso  |
| `reminder_sent` | Reminder inviato      | Amber  |
| `renewed`       | Rinnovato             | Indigo |
| `converted`     | Convertito in cliente | Verde  |

La timeline carica eventi per l'intera catena di revisioni (root + figli) con nomi attori e note.

### Rinnovo Preventivi Scaduti

Un preventivo `expired` puo' essere rinnovato:

1. Crea nuova revisione `draft` con gli stessi dati (prospect, corriere, clausole)
2. Opzionalmente modifica margine e validita'
3. Se il margine cambia, ricalcola la matrice prezzi
4. Registra evento `renewed` sul preventivo scaduto + `created` sulla nuova revisione

### Conversione Prospect → Cliente

Quando un preventivo viene accettato, il reseller puo' convertire il prospect in cliente operativo:

1. **Crea utente** su Supabase Auth con email e password temporanea
2. **Inserisce record** nella tabella `users`
3. **Crea listino personalizzato** basato sulla matrice del preventivo accettato
4. **Assegna listino** al nuovo cliente
5. **Aggiorna preventivo**: `converted_user_id`, evento `converted`
6. **Invia email benvenuto** con credenziali (non-bloccante)

### Analytics Dashboard

Dashboard con 6 visualizzazioni basate su `computeAnalytics()` (funzione pura, zero dipendenze):

#### KPI Cards

- **Tasso Conversione**: % preventivi accettati su totale
- **Margine Medio Accettati**: margine % medio dei preventivi accettati
- **Giorni Medi Chiusura**: tempo medio da invio a risposta
- **Valore Convertito**: conteggio clienti convertiti

#### Grafici

1. **Funnel Conversione**: BarChart orizzontale (created → sent → negotiating → accepted)
2. **Analisi Margini**: BarChart grouped (originale vs finale, accettati vs rifiutati)
3. **Performance per Corriere**: BarChart con acceptance rate e margine medio
4. **Performance per Settore**: PieChart distribuzione
5. **Timeline Settimanale**: LineChart preventivi per settimana ISO

### Sicurezza

- **Workspace-scoped**: ogni query filtra per `workspace_id`
- **RLS**: Row Level Security su `commercial_quotes` e `commercial_quote_events`
- **Audit logging**: ogni azione critica registrata in `audit_logs`
- **Immutabilita'**: snapshot prezzi non modificabile dopo invio
- **Email non-bloccanti**: errori email non bloccano le operazioni principali

### Server Actions

| Action                              | Descrizione                                    |
| ----------------------------------- | ---------------------------------------------- |
| `createCommercialQuoteAction`       | Crea preventivo draft con matrice              |
| `getCommercialQuotesAction`         | Lista preventivi workspace con filtri          |
| `getCommercialQuoteByIdAction`      | Dettaglio preventivo + revisioni               |
| `sendCommercialQuoteAction`         | Invia (genera PDF, upload, email, status→sent) |
| `updateQuoteStatusAction`           | Cambia stato con note e audit                  |
| `createRevisionAction`              | Nuova revisione da preventivo esistente        |
| `convertQuoteToClientAction`        | Converti prospect in cliente operativo         |
| `getQuoteAnalyticsAction`           | Carica dati analytics                          |
| `getQuoteNegotiationTimelineAction` | Timeline eventi catena revisioni               |
| `renewExpiredQuoteAction`           | Rinnova preventivo scaduto come draft          |

### Tipi Principali

```typescript
type CommercialQuoteStatus = 'draft' | 'sent' | 'negotiating' | 'accepted' | 'rejected' | 'expired';

type CommercialQuoteEventType =
  | 'created'
  | 'updated'
  | 'sent'
  | 'viewed'
  | 'revised'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'reminder_sent'
  | 'renewed'
  | 'converted';

type DeliveryMode = 'carrier_pickup' | 'own_fleet' | 'client_dropoff';

interface CommercialQuote {
  id: string;
  workspace_id: string;
  created_by: string;
  status: CommercialQuoteStatus;
  revision: number;
  parent_quote_id: string | null;
  prospect_company: string;
  prospect_email: string | null;
  carrier_code: string;
  margin_percent: number;
  original_margin_percent: number;
  validity_days: number;
  price_matrix: CommercialQuotePriceMatrix;
  clauses: CommercialQuoteClause[];
  delivery_mode: DeliveryMode;
  processing_fee: number | null;
  sent_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
  converted_user_id: string | null;
  // ...altri campi
}
```

### Database

#### Tabella `commercial_quotes`

Contiene tutti i preventivi con snapshot immutabile della matrice prezzi.

#### Tabella `commercial_quote_events`

Timeline lifecycle di ogni preventivo (created, sent, accepted, etc.).

#### Indici Ottimizzati

```sql
-- Aggregazioni analytics (solo root quotes)
CREATE INDEX idx_commercial_quotes_analytics
  ON commercial_quotes(workspace_id, status, carrier_code, prospect_sector)
  WHERE parent_quote_id IS NULL;

-- Timeline per settimana
CREATE INDEX idx_commercial_quotes_created_at
  ON commercial_quotes(workspace_id, created_at DESC);

-- Cron auto-scadenza
CREATE INDEX idx_commercial_quotes_expires_at
  ON commercial_quotes(expires_at)
  WHERE expires_at IS NOT NULL AND status IN ('sent', 'negotiating');
```

### Test

19 file di test con 224+ test unitari:

| File Test                         | Test | Copertura                               |
| --------------------------------- | ---- | --------------------------------------- |
| `commercial-quote-matrix-builder` | 22   | Costruzione matrice, fasce peso, zone   |
| `commercial-quote-pdf`            | 18   | Generazione PDF, layout, clausole       |
| `commercial-quote-clauses`        | 21   | Clausole standard, custom, validazione  |
| `commercial-quote-pipeline`       | 14   | Transizioni stato, filtri, validazione  |
| `commercial-quote-immutability`   | 19   | Snapshot immutabile, revisioni          |
| `commercial-quote-audit-actions`  | 9    | Audit logging, costanti                 |
| `commercial-quote-delivery-mode`  | 22   | Modi consegna, processing fee           |
| `commercial-quote-analytics`      | 26   | KPI, funnel, margini, corriere, settore |
| `commercial-quote-expiry`         | 24   | Auto-scadenza, reminder, dedup          |
| `commercial-quote-email`          | 16   | Email prospect, reminder, attachment    |
| `commercial-quote-negotiation`    | 21   | Timeline, rinnovo, preservazione dati   |
| `commercial-quote-welcome-email`  | 12   | Email benvenuto, fallback branding      |

## Related Documentation

- [Gestione Listini](PRICE_LISTS.md) - Sistema listini master e personalizzati
- [Gerarchia Reseller](RESELLER_HIERARCHY.md) - Workspace e ruoli
- [Wallet](WALLET.md) - Pagamenti e crediti
- [Workflow Flow 6](../00-HANDBOOK/workflows/WORKFLOWS.md) - Flusso operativo preventivatore

## Changelog

| Data       | Versione | Modifiche                                                 | Autore    |
| ---------- | -------- | --------------------------------------------------------- | --------- |
| 2026-02-07 | 1.0      | MVP: pipeline, matrice, PDF, conversione                  | AI + Team |
| 2026-02-07 | 2.0      | Fase A: delivery mode, processing fee, multi-corriere     | AI + Team |
| 2026-02-07 | 3.0      | Fasi B+C+D: analytics, auto-scadenza, email, negoziazione | AI + Team |

_Last Updated: 2026-02-07_
_Status: Active_
_Maintainer: Dev Team_
