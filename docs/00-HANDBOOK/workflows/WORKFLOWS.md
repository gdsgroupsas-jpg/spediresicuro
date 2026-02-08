---
title: Workflows
scope: workflows
audience: all
owner: product
status: active
source_of_truth: true
updated: 2026-01-19
---

# User Flows - SpedireSicuro

## Overview

Questa documentazione descrive i principali user flows di SpedireSicuro, dal form spedizione al booking, passando per la gestione wallet e listini.

## Target Audience

- [x] Developers
- [ ] DevOps
- [x] Business/PM
- [ ] AI Agents
- [x] Nuovi team member

## Prerequisites

- Conoscenza base UI/UX
- Familiarità con sistema SpedireSicuro
- Comprensione flusso business

## Quick Reference

| Sezione               | Pagina                                  | Link                                                          |
| --------------------- | --------------------------------------- | ------------------------------------------------------------- |
| Creazione Spedizione  | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [Nuova Spedizione](#flow-1-creazione-spedizione)              |
| Gestione Wallet       | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [Wallet](#flow-2-gestione-wallet)                             |
| Gestione Listini      | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [Listini](#flow-3-gestione-listini)                           |
| Admin Dashboard       | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [Admin](#flow-4-admin-dashboard)                              |
| Contrassegni (COD)    | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [COD](#flow-5-gestione-contrassegni-cod)                      |
| Prev. Commerciale     | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [Preventivi](#flow-6-preventivatore-commerciale)              |
| Anne CRM Intelligence | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [CRM Intelligence](#flow-7-anne-crm-intelligence-read--write) |
| Outreach Multi-Canale | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [Outreach](#flow-8-outreach-multi-canale)                     |
| Processo Operativo AI | docs/00-HANDBOOK/workflows/WORKFLOWS.md | [AI Process](#flow-0-processo-operativo-ai)                   |

## Content

<a id="ai-process"></a>

### Flow 0: Processo Operativo AI

**Obiettivo:** Eseguire task in autonomia e consegnare solo dopo validazione.

**Steps:**

1. **Task Assignment**
   - Riceve i task e conferma l'interpretazione.

2. **Esecuzione Autonoma**
   - Implementa le modifiche senza richiedere micro-decisioni.

3. **Testing Obbligatorio**
   - Aggiorna o aggiunge test specifici per il componente modificato.
   - Esegue i test pertinenti (unit/integration/e2e).
   - Se cambia un comportamento UI, aggiorna la doc UI e aggiunge un test unitario dedicato quando possibile.
   - Se aggiungi telemetria UX, descrivi eventi e payload minimi nelle doc di riferimento.

4. **Validazione**
   - Considera il lavoro "finito" solo con test verdi.
   - Riporta risultati e rischi residui.

5. **Documentazione e Rules**
   - Dopo un lavoro testato, richiede approvazione prima di aggiornare documentazione e/o rules/workflow se il processo o l'approccio devono migliorare.

### Flow 1: Creazione Spedizione

**Obiettivo:** Creare una nuova spedizione con preventivo e booking.

**URL:** `/dashboard/spedizioni/nuova`

**Steps:**

1. **Selezione Modalità Input**
   - **Manuale:** Inserimento dati manualmente
   - **AI Import:** Upload immagine con estrazione automatica dati (OCR)

2. **Compilazione Dati Mittente**
   - Nome completo
   - Indirizzo
   - Città + Provincia + CAP (autocomplete con validazione)
   - Telefono (formato italiano +39)
   - Email (opzionale)
   - _Validazione:_ Campi obbligatori con feedback visivo in tempo reale

3. **Compilazione Dati Destinatario**
   - Nome completo
   - Indirizzo
   - Città + Provincia + CAP (autocomplete)
   - Telefono (obbligatorio se contrassegno attivo)
   - Email (opzionale)
   - _Validazione:_ Stesso pattern di mittente

4. **Inserimento Dati Pacco**
   - Peso (kg) - obbligatorio
   - Dimensioni: Lunghezza, Larghezza, Altezza (cm)
   - Tipo Spedizione: Standard, Express, Assicurata
   - Note (opzionale)

5. **Contrassegno (COD)**
   - Campo numerico (€)
   - Se > 0, telefono destinatario diventa obbligatorio
   - Validazione automatica

6. **Preventivo Intelligente**
   - **Attivazione automatica** quando dati completi:
     - Peso > 0
     - CAP destinatario inserito
     - Provincia destinatario inserita
     - Dimensioni complete (lunghezza, larghezza, altezza)
   - **Chiamata DB:** Una sola chiamata generica che restituisce tutti i rates
   - **Mapping:** Mappa rates ai contratti configurati dell'utente
   - **Filtro destinazione:** Esclude contratti internazionali per destinazioni italiane
   - **Visualizzazione tabella:**
     - Corriere (nome display)
     - Costo Fornitore (prezzo listino)
     - Prezzo Vendita (prezzo cliente)
     - Cache indicator (se da cache)

7. **Selezione Servizi Accessori**
   - Se corriere selezionato supporta servizi accessori
   - Dropdown con servizi disponibili (es. Exchange, Document Return, Saturday Service)
   - Costi stimati visualizzati
   - Prezzo finale calcolato automaticamente

8. **Conferma Selezione**
   - Click su "Conferma Selezione"
   - Corriere e servizi accessori salvati
   - ConfigId API salvato (per multi-config)
   - Prezzo esatto salvato

9. **Creazione Spedizione**
   - Click su "Genera Spedizione"
   - Validazione finale dei campi obbligatori
   - Invio a `/api/spedizioni`
   - **Backend flow:**
     1. Idempotency check
     2. Acquire lock (previene doppio debit)
     3. Recupera configurazione corriere (multi-tenant)
     4. Stima costo (+20% buffer)
     5. Wallet debit (atomica con `decrement_wallet_balance` RPC)
     6. Chiamata corriere API
     7. Aggiustamento wallet (differenza reale vs stimato)
     8. Creazione spedizione nel DB
     9. Complete lock idempotency
     10. Audit log
   - **Compensazione se errore:** Ripristina wallet + cancella label corriere

10. **Successo**
    - Messaggio successo con tracking number
    - Download automatico etichetta (PDF o URL)
    - Fallback: Ticket interno se etichetta non disponibile
    - Reset form dopo 2 secondi (per inserimento rapido)

**Edge Cases:**

- **Nessun contratto disponibile:** Messaggio di avviso, pulsante disabilitato
- **Credito insufficiente:** Errore 402 con messaggio specifico
- **Corriere fallito:** Compensazione wallet + queue manuale retry
- **Etichetta non creata:** Ticket generato automaticamente

---

### Flow 2: Gestione Wallet

**Obiettivo:** Ricaricare o gestire il credito wallet.

**URL:** `/dashboard/wallet`

**Steps:**

1. **Visualizzazione Saldo**
   - Saldo corrente in evidenza
   - Grafico transazioni (ultimi 30 giorni)
   - Statistiche: totale transazioni, ultimo movimento

2. **Ricarica Wallet (Admin/Superadmin)**
   - Click su "Ricarica Wallet"
   - Inserimento importo (€)
   - Inserimento motivazione (opzionale)
   - Conferma ricarica
   - **Backend:**
     1. Verifica ruolo (ADMIN/SUPERADMIN)
     2. Chiamata RPC `add_wallet_credit` (atomica)
     3. Creazione record `wallet_transactions`
     4. Audit log completo
   - **Response:** Nuovo saldo aggiornato

3. **Richiesta Ricarica (Utenti Normali)**
   - Click su "Richiedi Ricarica"
   - Inserimento importo desiderato
   - Invio richiesta
   - **TODO:** Sistema approvazioni admin (non ancora implementato)

4. **Storico Transazioni**
   - Tabella transazioni (ultime 100)
   - Colonne: Data, Tipo, Importo, Descrizione, Stato
   - Filtri: Tipo (ricarica, addebito, storno), Periodo
   - Paginazione

5. **Scarica Fattura**
   - Se transazione fatturata
   - Click su "Scarica Fattura"
   - Generazione PDF automatica
   - Download immediato

**Server Actions:**

```typescript
import { rechargeMyWallet, getMyWalletTransactions } from '@/actions/wallet';

// Ricarica wallet (admin)
const result = await rechargeMyWallet(100, 'Ricarica manuale admin');
// Returns: { success: true, newBalance: 123.45 }

// Ottieni transazioni
const transactions = await getMyWalletTransactions();
// Returns: { success: true, transactions: [...] }
```

**Edge Cases:**

- **Utente normale:** Non può ricaricare direttamente, solo richiedere
- **Saldo insufficiente:** Messaggio visibile, pulsante ricarica evidenziato
- **Transazione fallita:** Stato = "failed", messaggio errore visibile

---

### Flow 3: Gestione Listini (Reseller)

**Obiettivo:** Clonare listino fornitore, assegnarlo a clienti, modificare prezzi.

**URL:** `/dashboard/reseller/listini` (tab "Fornitore" + tab "Personalizzati")

**Flusso a cascata Superadmin → Reseller → Client:**

```
Superadmin possiede listini SUPPLIER (costi reali corrieri)
    │
    ├─ Crea listino CUSTOM con margine (i suoi prezzi di vendita)
    │
    └─ Assegna listino CUSTOM al Reseller
         (via price_list_assignments o assigned_price_list_id)
         │
         ├─ Reseller vede il listino in "Listini Personalizzati"
         │
         ├─ Reseller clona il listino con ulteriore margine
         │   → Crea il proprio listino custom per i suoi clienti
         │
         └─ Reseller assegna il listino clonato ai suoi sub-user
              → I clienti finali vedono solo i prezzi del reseller
```

> **Nota sicurezza:** I listini SUPPLIER del superadmin non sono mai visibili ai reseller.
> Ogni reseller vede solo: listini creati da lui + listini esplicitamente assegnati.
> Isolamento multi-tenant garantito per account.

**Steps:**

1. **Visualizzazione Listini Master**
   - Tabella con tutti i listini fornitori propri + listini custom assegnati dal superadmin
   - Colonne: Nome, Fornitore, Aggiornato al, Voci, Azioni
   - Filtri: Fornitore, Data aggiornamento

2. **Clona Listino**
   - Click su "Clona" su listino master o listino custom assegnato
   - **Dialog:**
     - Nome listino personalizzato (obbligatorio)
     - Margine (%) da applicare (default: 0%)
     - Seleziona clienti (multi-select)
     - Opzioni aggiuntive:
       - Copia tutte le voci (default: sì)
       - Copia solo voci attive
       - Applica margine a tutte le voci
   - **Backend:**
     1. Copia listino master → listino reseller
     2. Copia voci listino → voci listino personalizzato
     3. Applica margine a prezzi
     4. Assegna listino ai clienti selezionati
     5. Audit log
   - **Response:** Listino clonato con ID

3. **Assegna Listino a Clienti**
   - Click su "Assegna" su listino personalizzato
   - **Dialog:**
     - Multi-select clienti
     - Sostituisci listino esistente (opzionale)
   - **Backend:**
     1. Aggiorna `customers.price_list_id`
     2. Assegna configurazione corriere
     3. Audit log

4. **Modifica Listino Personalizzato**
   - Click su "Modifica" su listino personalizzato
   - **Pagina dettaglio:**
     - Informazioni generali
     - Tabella voci (paginata)
     - Azioni in blocco:
       - Aggiorna prezzo massivo (es. +5%)
       - Attiva/disattiva voci
       - Esporta CSV
     - **Upload CSV:** Sostituisce voci massivamente

5. **Sincronizzazione Automatica**
   - Click su "Sincronizza con Spedisci.Online"
   - **Backend:**
     1. Chiamata API Spedisci.Online
     2. Recupera rates aggiornati
     3. Aggiorna voci listino
     4. Mappa servizi accessori
     5. Audit log
   - **Response:** Numero voci aggiornate

6. **Test API**
   - Click su "Test Validazione API"
   - **Dialog:**
     - Inserisci peso, CAP, destinazione
     - Chiama API con configurazione corriere
     - Mostra rates ricevuti
   - Confronta con voci listino

**Server Actions:**

```typescript
import {
  cloneSupplierPriceList,
  assignPriceListToCustomer,
  syncPriceListWithSpedisciOnline,
} from '@/actions/reseller-price-lists';

// Clona listino
const result = await cloneSupplierPriceList({
  supplierPriceListId: 'master-list-id',
  name: 'Listino Personalizzato Cliente X',
  marginPercentage: 10,
  assignToCustomers: ['customer-1', 'customer-2'],
});

// Assegna a cliente
await assignPriceListToCustomer({
  customerId: 'customer-1',
  priceListId: 'custom-list-id',
});

// Sincronizza
await syncPriceListWithSpedisciOnline({
  priceListId: 'custom-list-id',
});
```

**Edge Cases:**

- **Listino non sincronizzato:** Avviso "Ultimo aggiornamento: 30 giorni fa"
- **Nessun rate per destinazione:** Messaggio "Nessun servizio disponibile per questa zona"
- **Margine eccessivo:** Warning se margine > 50%
- **Clona già esistente:** Messaggio "Esiste già un listino con questo nome"

---

### Flow 4: Admin Dashboard

**Obiettivo:** Gestire piattaforma come SuperAdmin.

**URL:** `/dashboard/admin` e `/dashboard/super-admin`

**Steps:**

1. **Overview Dashboard**
   - **Utenti:**
     - Totale utenti
     - Admin vs utenti normali
     - Nuovi oggi/settimana/mese
   - **Spedizioni:**
     - Totale spedizioni
     - Oggi/settimana/mese
     - Per stato: In attesa, In transito, Consegnate, Fallite
   - **Fatturato:**
     - Revenue totale
     - Oggi/settimana/mese
   - **Quick Actions:**
     - Configurazioni corrieri
     - Features piattaforma
     - Automazione
     - Gestione team
     - Log diagnostici

2. **Gestione Utenti**
   - Tabella utenti (ultimi 10)
   - Colonne: Utente (nome + email), Ruolo, Provider, Configurazione Corriere, Registrato, Azioni
   - **Azioni per utente:**
     - **Dettaglio:** Apri pagina dettaglio utente (`/dashboard/admin/users/[id]`)
     - **Gestisci Features:** Apri modale features
     - **Elimina:** Conferma eliminazione

3. **Assegna Configurazione Corriere**
   - Select nella tabella utenti
   - Scegli tra configurazioni disponibili
   - **Opzioni:**
     - Configurazione personale dell'utente
     - Configurazione assegnata (default)
     - Configurazione default per provider
   - **Backend:**
     1. Aggiorna `users.assigned_config_id`
     2. Audit log

4. **Toggle AI Features (Reseller)**
   - Apri modale "Gestisci Features"
   - Se utente è reseller, mostra AI features toggle
   - **Features disponibili:**
     - `can_manage_pricelists` - Gestione listini AI
     - `can_use_anne_chat` - Chat AI Anne
     - `can_ocr_import` - OCR import documenti
   - **Backend:**
     1. Aggiorna `users.metadata.ai_can_manage_pricelists`
     2. Aggiorna `user_features` (record feature assegnate)
     3. Audit log

5. **Gestione Spedizioni**
   - Tabella spedizioni (ultime 20)
   - Colonne: Tracking, Destinatario, Status, Prezzo, Data, Azioni
   - **Stato:** Badge colorato per status
   - **Azioni:**
     - **Visualizza dettaglio:** Apri pagina spedizione
     - **Elimina:** Conferma eliminazione

6. **Gestione Features Piattaforma**
   - Naviga a `/dashboard/admin/features`
   - Tabella features disponibili
   - Colonne: Nome, Descrizione, Categoria, Gratuita/Premium, Disponibile
   - **Azioni:**
     - **Attiva/Disattiva:** Toggle feature per utente
     - **Scadenza:** Imposta scadenza per feature premium

7. **Killer Features Dashboard**
   - Sezione dashboard con features principali
   - **Features:**
     - AI Anne (chat, OCR, pricing)
     - Multi-tenant (configurazioni multiple)
     - Reseller hierarchy
     - Wallet with atomic operations
     - Idempotency locks
     - Audit logging completo

**Acting Context (Impersonation):**

```typescript
// Backend usa Acting Context per impersonation
const context = await requireSafeAuth();

// target: chi riceve l'azione (es. chi paga)
const targetId = context.target.id;

// actor: chi esegue l'azione (es. chi clicca)
const actorId = context.actor.id;

// isImpersonating: true se actor != target
const isImpersonating = context.isImpersonating;

// Esempio: Superadmin agisce per conto reseller
// target = reseller-id
// actor = superadmin-id
// isImpersonating = true
```

**API Endpoints:**

```typescript
// Admin overview
GET / api / admin / overview;
// Returns: { stats, users, shipments, killerFeatures }

// User features
GET / api / admin / users / [id] / features;
// Returns: { features, metadata }

// Toggle feature
POST / api / admin / features;
// Body: { targetUserEmail, featureCode, activate, activationType }
```

**Edge Cases:**

- **Utente non trovato:** Messaggio "Utente non trovato o eliminato"
- **Permesso negato:** 403 se non admin/superadmin
- **Feature già attiva:** Messaggio informativo
- **Configurazione non disponibile:** Select vuota + avviso

---

### Flow 5: Gestione Contrassegni (COD)

**Obiettivo:** Gestire i contrassegni (Cash On Delivery) ricevuti dai corrieri, matchare con spedizioni, creare distinte di pagamento per i clienti.

**URL:** `/dashboard/contrassegni`

**Ruoli:** Solo Admin / SuperAdmin

**Steps:**

1. **Upload File Corriere**
   - Tab "Distinte Contrassegni" → sezione Upload
   - Seleziona parser (Formato Generico o carrier-specifico)
   - Upload file Excel/CSV (drag & drop o click)
   - **Backend:**
     1. Parsing file con parser modulare (`lib/cod/parsers/`)
     2. Match automatico LDV → `shipments.tracking_number` o `shipments.ldv`
     3. Creazione `cod_files` + `cod_items`
     4. Calcolo totali: file vs sistema
     5. Alert discrepanza se importi non corrispondono
     6. Audit log `cod_file_uploaded`

2. **Verifica Contrassegni**
   - Tab "Lista Contrassegni"
   - Filtri: Cliente, Stato COD (in_attesa/assegnato/rimborsato), Date (da/a), Ricerca testo
   - Tabella: LDV, Rif. Mittente, Contrassegno €, Pagato €, Destinatario, Stato, Data
   - Checkbox per selezione multipla

3. **Creazione Distinte**
   - Seleziona contrassegni → Click "Crea Distinte"
   - **Backend:**
     1. Raggruppa items per `client_id`
     2. Crea una `cod_distinte` per cliente
     3. Aggiorna `cod_items.distinta_id` e `status = 'assegnato'`
     4. Audit log `cod_distinta_created` per ogni distinta

4. **Pagamento Distinta**
   - Tab "Distinte Contrassegni" → Tabella distinte
   - Click icona € → Dialog con metodo pagamento (Assegno, SEPA, Contanti, Compensata)
   - **Backend:**
     1. Aggiorna `cod_distinte.status = 'pagata'`
     2. Aggiorna `cod_items.status = 'rimborsato'`
     3. Ricalcola `cod_files.total_cod_paid`
     4. Notifica in-app al cliente (tipo `refund_processed`)
     5. Audit log `cod_distinta_paid`

5. **Export e Stampa**
   - Export Excel singola distinta (`/api/cod/distinte/export?id=`)
   - Stampa distinta (finestra dedicata con dettaglio items e totali)

6. **Eliminazione Distinta**
   - Click Trash → Conferma eliminazione
   - **Backend:**
     1. Scollega items (`distinta_id = null`, `status = 'in_attesa'`)
     2. Elimina distinta
     3. Audit log `cod_distinta_deleted`

**Stati COD Item:** `in_attesa` → `assegnato` → `rimborsato`

**Stati Distinta:** `in_lavorazione` → `pagata`

**API Endpoints:**

```typescript
POST /api/cod/upload           // Upload + parse file
GET  /api/cod/items            // Lista items con filtri
GET  /api/cod/files            // Lista file caricati
GET  /api/cod/clients          // Clienti distinti per filtro
GET  /api/cod/parsers          // Parser disponibili
POST /api/cod/distinte         // Crea distinte
GET  /api/cod/distinte         // Lista distinte
PATCH /api/cod/distinte        // Segna pagata
DELETE /api/cod/distinte       // Elimina
GET  /api/cod/distinte/export  // Export Excel
```

**Edge Cases:**

- **File senza match:** Items restano `in_attesa` (senza `shipment_id`)
- **Discrepanza importi:** Toast warning con differenza file vs sistema
- **Items già in distinta:** Esclusi automaticamente dalla selezione
- **Clienti sconosciuti:** Raggruppati sotto "Cliente sconosciuto"

---

### Flow 6: Preventivatore Commerciale

**Obiettivo:** Generare preventivi PDF brandizzati per nuovi clienti (prospect), gestire il ciclo di negoziazione, e convertire prospect in clienti operativi con listino personalizzato.

**URL:** `/dashboard/reseller/preventivo`

**Ruoli:** Reseller (admin, agent)

**Steps:**

1. **Creazione Preventivo (Tab "Nuovo Preventivo")**
   - Compila dati prospect: azienda, contatto, email, telefono, settore, volume stimato
   - Seleziona corriere (dal listino master workspace)
   - Imposta margine %, validita' giorni, delivery mode
   - Opzionale: processing fee, clausole custom
   - Click "Crea Preventivo"
   - **Backend:**
     1. `createCommercialQuoteAction()` con `getWorkspaceAuth()`
     2. `buildPriceMatrix()` costruisce matrice da listino attivo
     3. Insert `commercial_quotes` con status `draft`
     4. Insert evento `created` in `commercial_quote_events`
     5. Audit log `commercial_quote_created`

2. **Invio al Prospect (Pipeline → "Invia")**
   - Dalla pipeline, click "Invia" su un preventivo draft
   - **Backend:**
     1. `sendCommercialQuoteAction(quoteId)`
     2. Genera PDF con `generateQuotePdf()`
     3. Upload PDF su Supabase Storage
     4. Update status `draft → sent`, set `sent_at` e `expires_at`
     5. Se `prospect_email`: invia email con PDF allegato (non-bloccante)
     6. Insert evento `sent` + audit log

3. **Gestione Pipeline (Tab "I Miei Preventivi")**
   - Filtri: stato, ricerca testo
   - Badge scadenza: "Scade tra Xg" (amber <=7gg), "Scaduto" (rosso <=0)
   - Azioni per stato:
     - **draft**: Visualizza, Invia
     - **sent**: Visualizza, In Trattativa, Accetta, Rifiuta
     - **negotiating**: Visualizza, Nuova Revisione, Accetta, Rifiuta
     - **accepted**: Visualizza, Converti in Cliente
     - **expired**: Visualizza, Rinnova

4. **Cambio Stato con Note**
   - Click "In Trattativa"/"Accetta"/"Rifiuta" → Dialog StatusChange
   - Note obbligatorie per: `negotiating`, `rejected`
   - Note opzionali per: `accepted`
   - **Backend:**
     1. `updateQuoteStatusAction(quoteId, status, notes)`
     2. Validazione transizione ammessa
     3. Insert evento con note + audit log

5. **Dettaglio Preventivo (Dialog)**
   - Dati prospect, matrice prezzi, clausole
   - Indicatore email inviata
   - Timeline revisioni (se multiple)
   - Timeline negoziazione (eventi con date, attori, note)
   - Bottoni azione contestuali allo stato

6. **Nuova Revisione**
   - Da preventivo sent/negotiating → "Nuova Revisione"
   - **Backend:**
     1. `createRevisionAction(quoteId, { margin_percent, clauses })`
     2. Copia dati prospect, crea nuova revisione draft
     3. Se margine diverso: ricalcola matrice
     4. Insert evento `revised` su originale + `created` su nuova

7. **Rinnovo Preventivo Scaduto**
   - Da preventivo expired → "Rinnova"
   - **Backend:**
     1. `renewExpiredQuoteAction({ expired_quote_id, margin_percent?, validity_days? })`
     2. Crea draft con stessi dati (prospect, corriere, clausole)
     3. Insert evento `renewed` su scaduto + `created` su nuova

8. **Conversione Prospect → Cliente**
   - Da preventivo accepted → "Converti in Cliente"
   - Dialog: email, nome, password, conferma
   - **Backend:**
     1. `convertQuoteToClientAction(quoteId, { client_email, client_name, client_password })`
     2. Crea utente Supabase Auth
     3. Insert record `users`
     4. Crea listino personalizzato da matrice preventivo
     5. Update preventivo: `converted_user_id`, evento `converted`
     6. Invia email benvenuto (non-bloccante)

9. **Analytics (Tab "Analisi")**
   - KPI: tasso conversione, margine medio, giorni chiusura, valore convertito
   - Grafici: funnel, margini, performance corriere/settore, timeline settimanale
   - **Backend:** `getQuoteAnalyticsAction()` → `computeAnalytics()`

**Server Actions:**

```typescript
createCommercialQuoteAction(input)     // Crea draft
getCommercialQuotesAction(filters?)    // Lista con filtri
getCommercialQuoteByIdAction(id)       // Dettaglio + revisioni
sendCommercialQuoteAction(id)          // Invia (PDF + email)
updateQuoteStatusAction(id, status)    // Cambia stato
createRevisionAction(id, changes)      // Nuova revisione
convertQuoteToClientAction(id, data)   // Prospect → cliente
getQuoteAnalyticsAction()              // Dati analytics
getQuoteNegotiationTimelineAction(id)  // Timeline eventi
renewExpiredQuoteAction(input)         // Rinnova scaduto
```

**Automazioni:**

- **Cron auto-scadenza** (`/api/cron/expire-quotes`, ogni 4h):
  - Auto-expire preventivi con `expires_at < NOW()`
  - Reminder email 5 giorni prima scadenza (deduplicato)

**Edge Cases:**

- **Prospect senza email:** Preventivo creabile ma email non inviata
- **Listino corriere cambiato:** Matrice e' snapshot immutabile, non si aggiorna
- **Revisione su preventivo inviato:** Crea nuova revisione, originale resta intatto
- **Conversione doppia:** Check `converted_user_id` previene duplicati
- **Email fallita:** Non blocca l'operazione, errore loggato silenziosamente

---

### Flow 7: Anne CRM Intelligence (Read + Write)

**Obiettivo:** Anne funziona come Sales Partner senior con accesso completo alla pipeline CRM: legge dati (S1), aggiorna stati, aggiunge note e registra contatti (S2). Fornisce insight commerciali, alert proattivi e suggerimenti d'azione basati su conoscenza settoriale avanzata.

**Trigger:** Messaggio utente con intent CRM (es. "come va la pipeline?", "cosa devo fare oggi?", "trova prospect ecommerce")

**Ruoli:** Admin (vede leads), Reseller (vede prospects del proprio workspace)

**Architettura:**

```text
Messaggio utente
    │
    ▼
supervisorRouter()
    │
    ├── detectSupportIntent()  → Support Worker (esistente)
    ├── detectCrmIntent()      → CRM Worker (NUOVO)
    ├── detectPricingIntent()  → Pricing Graph (esistente)
    └── fallback              → Legacy Handler
```

**Steps:**

1. **Proactive Context Injection**
   - Al caricamento della chat, `buildContext()` inietta automaticamente un riepilogo pipeline nel system prompt
   - Admin: pipeline lead (totali per stato, score medio, valore, entita' calde, alert)
   - Reseller: pipeline prospect (totali per stato, preventivi in attesa)
   - Anne menziona proattivamente lead caldi o alert senza che l'utente lo chieda

2. **Intent Detection**
   - `detectCrmIntent()` con ~30 keyword CRM e exclude list (evita collisioni con pricing/support)
   - Pattern matching puro, no LLM — stesso approccio di pricing intent
   - Keyword: pipeline, lead, prospect, conversione, score, azioni di oggi, win-back, ecc.
   - Esclusioni: "quanto costa spedire" (pricing), "tracking" (support)

3. **Sub-Intent Classification**
   - Il CRM worker classifica internamente il sub-intent:

   | Sub-intent            | Tipo  | Esempio messaggio                        |
   | --------------------- | ----- | ---------------------------------------- |
   | `pipeline_overview`   | Read  | "come va la pipeline?"                   |
   | `entity_detail`       | Read  | "a che punto e' il lead Farmacia Rossi?" |
   | `today_actions`       | Read  | "cosa devo fare oggi?"                   |
   | `health_check`        | Read  | "ci sono problemi nel CRM?"              |
   | `search`              | Read  | "trova prospect ecommerce"               |
   | `conversion_analysis` | Read  | "qual e' il tasso di conversione?"       |
   | `update_status`       | Write | "segna Farmacia Rossi come contattata"   |
   | `add_note`            | Write | "nota su TechShop: interessati a pallet" |
   | `record_contact`      | Write | "ho chiamato Pizzeria Mario"             |

4. **Data Fetch + Knowledge Enrichment**
   - CRM Worker chiama `crm-data-service` per i dati (pipeline, entities, alerts, search)
   - Arricchisce la risposta con `sales-knowledge.ts` (35 entry di conoscenza senior)
   - Ogni risposta include il PERCHE' di ogni suggerimento, non solo il COSA
   - Insight settoriale specifico per spedizioni (pharma, food, ecommerce, ecc.)

5. **Risposta Intelligente**
   - Formattata in markdown (bold, tabelle, liste)
   - Include: dati pipeline, alert critici, suggerimenti d'azione, knowledge settoriale
   - Se admin e trend in calo: suggerisce strategie correttive
   - Se reseller con preventivi in scadenza: avvisa con priorita'

**5 Tool CRM Read (Sprint S1):**

| Tool                    | Descrizione                            |
| ----------------------- | -------------------------------------- |
| `get_pipeline_summary`  | Panoramica pipeline con KPI            |
| `get_entity_details`    | Dettaglio lead/prospect + timeline     |
| `get_crm_health_alerts` | Alert: stale, hot, win-back, quote     |
| `get_today_actions`     | Lista prioritizzata azioni giornaliere |
| `search_crm_entities`   | Ricerca per nome/email/stato/settore   |

**3 Tool CRM Write (Sprint S2):**

| Tool                 | Descrizione                                               |
| -------------------- | --------------------------------------------------------- |
| `update_crm_status`  | Aggiorna stato lead/prospect (valida transizioni)         |
| `add_crm_note`       | Aggiunge nota con timestamp (sanitizzata)                 |
| `record_crm_contact` | Registra contatto avvenuto (auto-avanza new -> contacted) |

**Knowledge Base (35 entry senior):**

- 8 settori (ecommerce, pharma, food, artigianato, industria, logistica, fashion, generico)
- 10 obiezioni (troppo caro, competitor, pensarci, volume, timing, email, contratto, decisore, disinteresse, qualita')
- 5 timing (giorni/orari, follow-up, ciclo decisionale, stagionalita', urgenza)
- 6 negoziazione (ancoraggio, volume, trial, concessioni, chiusura, multi-corriere)
- 6 persuasione (social proof, loss aversion, urgenza reale, framing, reciprocita', scarsita')

**RLS e Sicurezza:**

- Admin: query su tabella `leads` (no filtro workspace)
- Reseller: query su `reseller_prospects` filtrate per `workspace_id`
- Tutte le query via `supabaseAdmin` con service role key (server-side only)
- Write actions (S2): validazione transizioni, optimistic locking, input sanitizzato, workspace isolation obbligatoria

**Edge Cases:**

- **Pipeline vuota:** Anne informa che non ci sono ancora lead/prospect e suggerisce come iniziare
- **Errore CRM data service:** Fallthrough a legacy handler, nessun crash
- **Workspace non trovato:** Query senza filtro workspace (restera' vuota per sicurezza)
- **Sub-intent non riconosciuto:** Default a pipeline_overview

---

### Flow 8: Outreach Multi-Canale

**Obiettivo:** Anne gestisce sequenze outreach automatiche multi-canale (Email, WhatsApp, Telegram) per lead e prospect. Enrollment, invio, tracking, metriche — tutto via chat.

**Trigger:** Messaggio utente con intent outreach (es. "iscrivi alla sequenza followup", "manda email a TechShop", "metriche outreach")

**Ruoli:** Admin (gestisce lead), Reseller (gestisce prospect del proprio workspace)

**Architettura:**

```text
Messaggio utente
    |
    v
supervisorRouter()
    |
    +-- detectOutreachIntent()  --> Outreach Worker (diretto, no LangGraph)
    |                                |
    |                                +-- 10 sub-intent (vedi sotto)
    |                                +-- Kill switch check (blocca invii, permette letture)
    |
    +-- Cron: /api/cron/outreach-executor (ogni 5 min)
    |     |
    |     +-- processOutreachQueue()
    |           +-- 6 safety checks per enrollment
    |
    +-- Webhooks delivery tracking:
          +-- /api/webhooks/resend-events (email)
          +-- /api/webhooks/whatsapp (status events)
```

**Steps:**

1. **Intent Detection**
   - `detectOutreachIntent()` con 26 keyword + exclude list
   - Rilevato DOPO CRM e PRIMA di pricing nel router
   - Keyword: sequenza, outreach, invia email, manda whatsapp, template, canali, ecc.

2. **Sub-Intent Classification**

   | Sub-intent          | Esempio messaggio                    |
   | ------------------- | ------------------------------------ |
   | `enroll_entity`     | "iscrivi Farmacia Rossi al followup" |
   | `cancel_enrollment` | "cancella sequenza per TechShop"     |
   | `pause_enrollment`  | "metti in pausa sequenza"            |
   | `resume_enrollment` | "riprendi sequenza"                  |
   | `send_message`      | "manda email a Farmacia Rossi"       |
   | `check_status`      | "stato outreach Farmacia Rossi"      |
   | `manage_channels`   | "disabilita whatsapp"                |
   | `list_templates`    | "mostra template email"              |
   | `list_sequences`    | "quali sequenze ho?"                 |
   | `outreach_metrics`  | "metriche outreach"                  |

3. **Sequence Executor (Cron)**
   - Ogni 5 minuti processa enrollment attivi con `next_execution_at <= NOW()`
   - 6 safety checks per ogni invio:
     1. Condizione step (no_reply, no_open, replied, opened, always)
     2. Consenso GDPR (obbligatorio)
     3. Canale abilitato per workspace
     4. Rate limit giornaliero per workspace+canale
     5. Cool-down 24h per entita'+canale
     6. Provider configurato (env vars)
   - Retry policy per provider (email: 2, whatsapp: 3, telegram: 0 — coda propria)
   - Bounce dopo max retries superati

4. **Delivery Tracking**
   - Email: webhook Resend (Svix HMAC) → delivered, opened, bounced
   - WhatsApp: status events → delivered, read, failed
   - Progressione: sent -> delivered -> opened -> replied (no regressione)

5. **Analytics**
   - Metriche aggregate per workspace: totalSent, deliveryRate, openRate, replyRate
   - Breakdown per canale (email, whatsapp, telegram)

**Safety:**

- Consent GDPR obbligatorio (0 invii senza consenso)
- Kill switch globale: `OUTREACH_KILL_SWITCH=true` (env var, no deploy)
- Pilot workspace: `OUTREACH_PILOT_WORKSPACES=ws-1,ws-2`
- Idempotency: UNIQUE(sequence_id, entity_type, entity_id) in DB
- Optimistic locking su enrollment update

**Edge Cases:**

- **Kill switch attivo:** Anne spiega sospensione, permette letture (status, metriche)
- **Consenso mancante:** Skip con audit trail, Anne avvisa
- **Rate limit raggiunto:** Non avanza enrollment, riprova al prossimo ciclo
- **Canale non configurato:** Suggerisce attivazione
- **Template non trovato:** Errore con execution record

---

## Common Issues

| Issue                        | Soluzione                                                |
| ---------------------------- | -------------------------------------------------------- |
| Form non invia dati          | Verifica campi obbligatori marcati con \*                |
| Preventivo non appare        | Verifica dati completi: peso, CAP, provincia, dimensioni |
| Ricarica wallet non funziona | Solo admin/superadmin possono ricaricare                 |
| Listino clone fallito        | Verifica nome univoco e margini validi                   |
| Features non salvate         | Verifica se utente è reseller                            |

## Related Documentation

- [Frontend Architecture](../../2-ARCHITECTURE/FRONTEND.md) - Next.js patterns
- [Backend Architecture](../../2-ARCHITECTURE/BACKEND.md) - API routes e Server Actions
- [API Documentation](../../3-API/OVERVIEW.md) - Endpoints completi
- [UI Components Overview](../../4-UI-COMPONENTS/OVERVIEW.md) - Sistema componenti

## Changelog

| Date       | Version | Changes                                                         | Author   |
| ---------- | ------- | --------------------------------------------------------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version                                                 | AI Agent |
| 2026-02-01 | 1.1.0   | Added Flow 5: COD Management                                    | AI Agent |
| 2026-02-02 | 1.2.0   | Unified Listini UI: 4→1 sidebar entry per role, tab-based pages | AI Agent |
| 2026-02-07 | 1.3.0   | Added Flow 6: Preventivatore Commerciale (full lifecycle)       | AI Agent |
| 2026-02-07 | 1.4.0   | Added Flow 7: Anne CRM Intelligence (read-only Sales Partner)   | AI Agent |
| 2026-02-08 | 1.5.0   | Flow 7: Added CRM write actions (S2) + security hardening       | AI Agent |
| 2026-02-08 | 1.6.0   | Added Flow 8: Outreach Multi-Canale (Sprint S3)                 | AI Agent |

---

_Last Updated: 2026-02-07_
_Status: 🟢 Active_
_Maintainer: Dev Team_
