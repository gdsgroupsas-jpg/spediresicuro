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
- 34 tabelle protette in `WORKSPACE_SCOPED_TABLES`
- Guardian test monitora usi diretti di `supabaseAdmin` (baseline: 57)

### Livello 2: RLS PostgreSQL (ATTIVO)

- Attivo su: `shipments`, `wallet_transactions`, `price_lists`, `invoices`, `invoice_items`, `cod_files`, `cod_items`, `cod_distinte`
- Policies: superadmin full access, utente vede solo proprio workspace, service role full access

### Livello 3: Middleware (ATTIVO)

- `x-sec-workspace-id` iniettato dal middleware
- `getWorkspaceAuth()` / `requireWorkspaceAuth()` validano membership

## Stato attuale per area (2026-02-17)

| Area         | Endpoint/File                | Filtro workspace            | Colonna workspace_id | Stato               |
| ------------ | ---------------------------- | --------------------------- | -------------------- | ------------------- |
| Spedizioni   | `shipments`                  | `.eq('workspace_id', wsId)` | SI                   | OK                  |
| Listini      | `price_lists`                | `.eq('workspace_id', wsId)` | SI                   | OK                  |
| Wallet       | `wallet_transactions`        | `.eq('workspace_id', wsId)` | SI                   | OK                  |
| Export CSV   | `/api/export/spediscionline` | `.eq('workspace_id', wsId)` | via shipments        | OK (fix 2026-02-17) |
| Recipients   | `/api/recipients/search`     | `.eq('workspace_id', wsId)` | via shipments        | OK (fix 2026-02-17) |
| Fatture      | `actions/invoices.ts`        | `.eq('workspace_id', wsId)` | SI                   | OK (fix 2026-02-17) |
| COD Items    | `/api/cod/items`             | `.eq('workspace_id', wsId)` | SI                   | OK (fix 2026-02-17) |
| COD Distinte | `/api/cod/distinte`          | `.eq('workspace_id', wsId)` | SI                   | OK (fix 2026-02-17) |
| Contrassegni | `actions/contrassegni.ts`    | `.eq('workspace_id', wsId)` | via shipments        | OK                  |
| Tracking     | `/track/[trackingId]`        | Pubblico (standard settore) | N/A                  | OK                  |

### Legenda stati

- **OK**: filtro diretto su colonna workspace_id (o colonna ereditata da tabella parent)

## Migration applicata (2026-02-17)

File: `supabase/migrations/20260217100000_add_workspace_id_to_invoices_cod.sql`

**Step 1**: ADD COLUMN workspace_id + INDEX + FK su:

- `invoices`, `invoice_items`, `cod_files`, `cod_items`, `cod_distinte`

**Step 2**: Backfill workspace_id da user_id/client_id -> users.primary_workspace_id

**Step 3**: RLS policies (superadmin, utente, service role)

Risultato backfill: 0 residui NULL (1 fattura migrata con successo, tabelle COD vuote).

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
| `tests/unit/invoices-workspace-isolation.test.ts`    | Fatture filtrate per workspace diretto         |
| `tests/unit/cod-workspace-isolation.test.ts`         | COD filtrati per workspace diretto             |
| `tests/unit/listini-workspace-isolation.test.ts`     | Listini filtrati per workspace                 |
| `tests/unit/price-lists-workspace-isolation.test.ts` | Price lists con mock isolation                 |
