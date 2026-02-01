---
title: COD Management (Contrassegni)
scope: features
audience: engineering
owner: engineering
status: active
source_of_truth: true
updated: 2026-02-01
---

# COD Management — Gestione Contrassegni

## Overview

Sistema di gestione dei contrassegni (Cash On Delivery) ricevuti dai corrieri. Permette all'admin di caricare file Excel/CSV dal fornitore, matchare automaticamente con le spedizioni, creare distinte di pagamento raggruppate per cliente, e tracciare i rimborsi.

## Database Schema

### `cod_files`

Record di ogni file caricato dal fornitore.

| Colonna          | Tipo          | Descrizione                   |
| ---------------- | ------------- | ----------------------------- |
| id               | UUID PK       |                               |
| filename         | TEXT          | Nome file originale           |
| carrier          | TEXT          | ID parser utilizzato          |
| uploaded_by      | UUID FK→users | Chi ha caricato               |
| total_rows       | INT           | Righe nel file                |
| processed_rows   | INT           | Righe matchate con spedizioni |
| total_cod_file   | NUMERIC(12,2) | Totale contrassegni da file   |
| total_cod_system | NUMERIC(12,2) | Totale da spedizioni matchate |
| total_cod_to_pay | NUMERIC(12,2) | Totale da pagare ai clienti   |
| total_cod_paid   | NUMERIC(12,2) | Totale già pagato             |
| errors           | INT           | Numero errori parsing/insert  |

### `cod_items`

Singola riga contrassegno estratta dal file.

| Colonna      | Tipo                 | Descrizione                              |
| ------------ | -------------------- | ---------------------------------------- |
| id           | UUID PK              |                                          |
| cod_file_id  | UUID FK→cod_files    | File di provenienza                      |
| ldv          | TEXT                 | Lettera di Vettura (tracking)            |
| rif_mittente | TEXT                 | Riferimento mittente                     |
| contrassegno | NUMERIC(12,2)        | Importo contrassegno                     |
| pagato       | NUMERIC(12,2)        | Importo pagato dal corriere              |
| destinatario | TEXT                 | Nome destinatario                        |
| note         | TEXT                 | Note aggiuntive                          |
| data_ldv     | TIMESTAMPTZ          | Data LDV                                 |
| shipment_id  | UUID FK→shipments    | Spedizione matchata (nullable)           |
| client_id    | UUID FK→users        | Cliente proprietario (nullable)          |
| distinta_id  | UUID FK→cod_distinte | Distinta assegnata (nullable)            |
| status       | TEXT                 | `in_attesa` / `assegnato` / `rimborsato` |

### `cod_distinte`

Distinta di pagamento raggruppata per cliente.

| Colonna          | Tipo          | Descrizione                      |
| ---------------- | ------------- | -------------------------------- |
| id               | UUID PK       |                                  |
| number           | SERIAL        | Numero progressivo               |
| client_id        | UUID FK→users | Cliente                          |
| client_name      | TEXT          | Nome cliente (snapshot)          |
| total_initial    | NUMERIC(12,2) | Totale iniziale                  |
| total_reimbursed | NUMERIC(12,2) | Totale rimborsato                |
| payment_method   | TEXT          | assegno/sepa/contanti/compensata |
| status           | TEXT          | `in_lavorazione` / `pagata`      |
| payment_date     | TIMESTAMPTZ   | Data pagamento                   |
| created_by       | UUID FK→users | Admin che ha creato              |

## Parser System

Architettura modulare in `lib/cod/parsers/`:

- **`types.ts`** — Interfacce `CodParser`, `CodParsedRow`, `CodParseResult`
- **`generic.ts`** — Parser generico per formato italiano (colonne: ldv, contrassegno, pagato, etc.)
- **`index.ts`** — Registry con `getParser(id)` e `getAvailableParsers()`

Per aggiungere un nuovo parser carrier-specifico:

1. Crea `lib/cod/parsers/<carrier>.ts` implementando `CodParser`
2. Registralo in `lib/cod/parsers/index.ts`

## API Endpoints

| Method | Path                       | Descrizione                          |
| ------ | -------------------------- | ------------------------------------ |
| POST   | `/api/cod/upload`          | Upload e parsing file                |
| GET    | `/api/cod/items`           | Lista items con filtri e paginazione |
| GET    | `/api/cod/files`           | Lista file caricati                  |
| GET    | `/api/cod/clients`         | Clienti distinti per filtro select   |
| GET    | `/api/cod/parsers`         | Parser disponibili                   |
| POST   | `/api/cod/distinte`        | Crea distinte da selezione items     |
| GET    | `/api/cod/distinte`        | Lista distinte                       |
| PATCH  | `/api/cod/distinte`        | Segna distinta come pagata           |
| DELETE | `/api/cod/distinte`        | Elimina distinta                     |
| GET    | `/api/cod/distinte/export` | Export Excel singola distinta        |
| GET    | `/api/cod/disputes`        | Lista dispute con filtri e stats     |
| POST   | `/api/cod/disputes`        | Crea dispute manuale                 |
| PATCH  | `/api/cod/disputes`        | Risolvi/ignora dispute               |
| GET    | `/api/cod/forecast`        | Previsione rimborsi per cliente      |

Tutti gli endpoint richiedono ruolo `admin` o `superadmin`, rate limiting, e generano audit log.

## Audit Actions

| Action                 | Resource Type  | Trigger               |
| ---------------------- | -------------- | --------------------- |
| `cod_file_uploaded`    | `cod_file`     | Upload file           |
| `cod_distinta_created` | `cod_distinta` | Creazione distinta    |
| `cod_distinta_paid`    | `cod_distinta` | Pagamento distinta    |
| `cod_distinta_deleted` | `cod_distinta` | Eliminazione distinta |

## UI

Pagina `/dashboard/contrassegni` — role-aware:

- **Admin/SuperAdmin**: `AdminContrassegni` con 3 tab (Lista + Distinte + Dispute Center)
  - **Forecast Banner**: nella tab Lista, banner collassabile con previsione rimborsi per cliente (totale globale, data stimata, breakdown per cliente)
- **Utenti normali**: `ContrassegniUI` (vista cliente, usa `cod_status` da DB)

## Dispute Center

### Database: `cod_disputes`

| Colonna         | Tipo              | Descrizione                                               |
| --------------- | ----------------- | --------------------------------------------------------- |
| id              | UUID PK           |                                                           |
| cod_item_id     | UUID FK→cod_items | Item associato (nullable)                                 |
| cod_file_id     | UUID FK→cod_files | File di provenienza (nullable)                            |
| type            | TEXT              | `importo_diverso` / `non_trovato` / `duplicato` / `altro` |
| status          | TEXT              | `aperta` / `risolta` / `ignorata`                         |
| expected_amount | NUMERIC(12,2)     | Importo atteso (sistema)                                  |
| actual_amount   | NUMERIC(12,2)     | Importo reale (file)                                      |
| difference      | NUMERIC(12,2)     | Differenza calcolata                                      |
| ldv             | TEXT              | LDV associata                                             |
| description     | TEXT              | Descrizione discrepanza                                   |
| resolution_note | TEXT              | Note risoluzione                                          |
| resolved_by     | UUID FK→users     | Admin che ha risolto                                      |
| resolved_at     | TIMESTAMPTZ       | Data risoluzione                                          |

### Auto-creazione dispute

Durante l'upload (`POST /api/cod/upload`), vengono create automaticamente:

- **`non_trovato`**: LDV non matchata con nessuna spedizione
- **`importo_diverso`**: importo file ≠ importo sistema (tolleranza €0.01)

### API

| Method | Path                | Descrizione                                                   |
| ------ | ------------------- | ------------------------------------------------------------- |
| GET    | `/api/cod/disputes` | Lista con filtri (status, type), paginazione, stats aggregate |
| POST   | `/api/cod/disputes` | Crea dispute manuale                                          |
| PATCH  | `/api/cod/disputes` | Risolvi/ignora dispute con nota                               |

### UI

Tab "Dispute Center" in AdminContrassegni:

- 4 stat cards (aperte, risolte, ignorate, differenza totale)
- Filtro per stato
- Tabella con tipo, LDV, importi, differenza, descrizione
- Dialog per risolvere/ignorare con nota

## Financial Forecast

### API: `GET /api/cod/forecast`

Calcola previsione rimborsi basata su:

1. Media storica tempi di pagamento (da `cod_distinte` pagate: `created_at` → `payment_date`)
2. Items/distinte pending raggruppati per cliente
3. Data stimata di pagamento per ogni cliente

Response: `avgPaymentDays`, `globalTotal`, `nearestPaymentDate`, breakdown per cliente.

## DB Trigger: cod_items → shipments

Trigger `trg_cod_item_sync_shipment` sincronizza automaticamente `cod_items.status` verso `shipments.cod_status`:

- `rimborsato` → `paid`
- altri stati → `collected`

Aggiorna anche `shipments.contrassegno_amount` con il valore `pagato`.

## RLS

- **Admin**: FOR ALL su tutte le tabelle COD
- **Service role**: bypass completo (per API routes con `supabaseAdmin`)
- **Utenti**: SELECT su `cod_items` e `cod_distinte` dove `client_id = auth.uid()`

## Tests

- `tests/unit/cod-parser-generic.test.ts` — 7 test: parsing valido, TOTALE skip, ldv vuoto, file vuoto, numeri italiani, colonna mancante

## Changelog

| Date       | Changes                                                       |
| ---------- | ------------------------------------------------------------- |
| 2026-02-01 | Initial implementation: parser, API, UI, audit, notifications |
| 2026-02-01 | Dispute Center: auto-creation, CRUD API, admin UI tab         |
| 2026-02-01 | Financial Forecast: prediction API, collapsible banner UI     |
| 2026-02-01 | DB trigger sync cod_items→shipments.cod_status                |
| 2026-02-01 | RLS: client SELECT policies on cod_items/cod_distinte         |
