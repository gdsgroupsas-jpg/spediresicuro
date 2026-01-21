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

| Sezione              | Pagina                            | Link                                             |
| -------------------- | --------------------------------- | ------------------------------------------------ |
| Creazione Spedizione | docs/4-UI-COMPONENTS/WORKFLOWS.md | [Nuova Spedizione](#flow-1-creazione-spedizione) |
| Gestione Wallet      | docs/4-UI-COMPONENTS/WORKFLOWS.md | [Wallet](#flow-2-gestione-wallet)                |
| Gestione Listini     | docs/4-UI-COMPONENTS/WORKFLOWS.md | [Listini](#flow-3-gestione-listini)              |
| Admin Dashboard      | docs/4-UI-COMPONENTS/WORKFLOWS.md | [Admin](#flow-4-admin-dashboard)                 |

## Content

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

**URL:** `/dashboard/reseller/listini-fornitore`

**Steps:**

1. **Visualizzazione Listini Master**
   - Tabella con tutti i listini fornitori
   - Colonne: Nome, Fornitore, Aggiornato al, Voci, Azioni
   - Filtri: Fornitore, Data aggiornamento

2. **Clona Listino**
   - Click su "Clona" su listino master
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

## Common Issues

| Issue                        | Soluzione                                                |
| ---------------------------- | -------------------------------------------------------- |
| Form non invia dati          | Verifica campi obbligatori marcati con \*                |
| Preventivo non appare        | Verifica dati completi: peso, CAP, provincia, dimensioni |
| Ricarica wallet non funziona | Solo admin/superadmin possono ricaricare                 |
| Listino clone fallito        | Verifica nome univoco e margini validi                   |
| Features non salvate         | Verifica se utente è reseller                            |

## Related Documentation

- [Frontend Architecture](../2-ARCHITECTURE/FRONTEND.md) - Next.js patterns
- [Backend Architecture](../2-ARCHITECTURE/BACKEND.md) - API routes e Server Actions
- [API Documentation](../3-API/OVERVIEW.md) - Endpoints completi
- [UI Components Overview](OVERVIEW.md) - Sistema componenti

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | AI Agent |

---

_Last Updated: 2026-01-12_
_Status: 🟢 Active_
_Maintainer: Dev Team_
