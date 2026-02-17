---
title: Multi-Tenant Isolation — Stato e Roadmap
scope: security
audience: developers, AI agents
owner: CTO
status: active
source_of_truth: true
updated: 2026-02-17
---

# Multi-Tenant Isolation

## Principio fondamentale

Ogni query su tabella multi-tenant DEVE filtrare per `workspace_id`.
Il bypass di questo principio causa data leak tra workspace.

## Architettura di protezione

### Livello 1: Application Layer (ATTIVO)

- `workspaceQuery()` in `lib/db/workspace-query.ts` — forza filtro workspace_id
- 29 tabelle protette in `WORKSPACE_SCOPED_TABLES`
- Guardian test monitora usi diretti di `supabaseAdmin` (baseline: 57)

### Livello 2: RLS PostgreSQL (PARZIALE)

- Attivo su: `shipments`, `wallet_transactions`, `price_lists`
- Mancante su: `invoices`, `invoice_items`, `cod_files`, `cod_items`, `cod_distinte`, `cod_disputes`

### Livello 3: Middleware (ATTIVO)

- `x-sec-workspace-id` iniettato dal middleware
- `getWorkspaceAuth()` / `requireWorkspaceAuth()` validano membership

## Stato attuale per area (2026-02-17)

| Area         | Endpoint/File                | Filtro workspace              | Colonna workspace_id | Stato               |
| ------------ | ---------------------------- | ----------------------------- | -------------------- | ------------------- |
| Spedizioni   | `shipments`                  | `.eq('workspace_id', wsId)`   | SI                   | OK                  |
| Listini      | `price_lists`                | `.eq('workspace_id', wsId)`   | SI                   | OK                  |
| Wallet       | `wallet_transactions`        | `.eq('workspace_id', wsId)`   | SI                   | OK                  |
| Export CSV   | `/api/export/spediscionline` | `.eq('workspace_id', wsId)`   | via shipments        | OK (fix 2026-02-17) |
| Recipients   | `/api/recipients/search`     | `.eq('workspace_id', wsId)`   | via shipments        | OK (fix 2026-02-17) |
| Fatture      | `actions/invoices.ts`        | `.in('user_id', memberIds)`   | NO (TODO)            | BRIDGE              |
| COD Items    | `/api/cod/items`             | `.in('client_id', memberIds)` | NO (TODO)            | BRIDGE              |
| COD Distinte | `/api/cod/distinte`          | `.in('client_id', memberIds)` | NO (TODO)            | BRIDGE              |
| Contrassegni | `actions/contrassegni.ts`    | `.eq('workspace_id', wsId)`   | via shipments        | OK                  |
| Tracking     | `/track/[trackingId]`        | Pubblico (standard settore)   | N/A                  | OK                  |

### Legenda stati

- **OK**: filtro diretto su colonna workspace_id
- **BRIDGE**: filtro indiretto via workspace_members (tabella manca colonna workspace_id)
- **TODO**: migration necessaria per aggiungere colonna workspace_id

## Pattern "workspace_members bridge"

Per tabelle senza colonna `workspace_id` (invoices, cod\_\*), il filtro è:

```typescript
// 1. Recupera membri del workspace
const { data: members } = await supabaseAdmin
  .from('workspace_members')
  .select('user_id')
  .eq('workspace_id', workspaceId)
  .eq('status', 'active');

const memberIds = members.map((m) => m.user_id);

// 2. Filtra per appartenenza
const { data } = await supabaseAdmin.from('invoices').select('*').in('user_id', memberIds);
```

Questo pattern ha un costo: 1 query extra per richiesta. La soluzione definitiva e' aggiungere `workspace_id` direttamente alla tabella.

## Migration TODO (priorita')

1. **invoices** + **invoice_items**: aggiungere `workspace_id UUID REFERENCES workspaces(id)`, backfill da shipments.workspace_id o workspace_members, aggiungere a WORKSPACE_SCOPED_TABLES
2. **cod_files**, **cod_items**, **cod_distinte**, **cod_disputes**: stesso pattern
3. RLS policies su tutte le tabelle sopra

## Come aggiungere una nuova tabella multi-tenant

1. La tabella DEVE avere colonna `workspace_id UUID NOT NULL REFERENCES workspaces(id)`
2. Aggiungerla a `WORKSPACE_SCOPED_TABLES` in `lib/db/workspace-query.ts`
3. Creare RLS policy
4. Usare `workspaceQuery(workspaceId).from('tabella')` nel codice applicativo
5. Il guardian test verifichera' automaticamente che non ci sono usi diretti

## Test di sicurezza

| Test file                                            | Cosa verifica                                  |
| ---------------------------------------------------- | ---------------------------------------------- |
| `tests/unit/workspace-query-guardian.test.ts`        | Scansione codice per usi diretti supabaseAdmin |
| `tests/unit/export-workspace-isolation.test.ts`      | Export filtra per workspace                    |
| `tests/unit/recipients-workspace-isolation.test.ts`  | Recipients filtra per workspace                |
| `tests/unit/invoices-workspace-isolation.test.ts`    | Fatture filtrate per workspace members         |
| `tests/unit/cod-workspace-isolation.test.ts`         | COD filtrati per workspace members             |
| `tests/unit/listini-workspace-isolation.test.ts`     | Listini filtrati per workspace                 |
| `tests/unit/price-lists-workspace-isolation.test.ts` | Price lists con mock isolation                 |
