---
title: WMS MVP — Warehouse Management System
scope: feature
audience: engineering, product
owner: engineering
status: active
source_of_truth: true
created: 2026-02-13
updated: 2026-02-13
---

# WMS MVP — Warehouse Management System

## Overview

Sistema di gestione magazzino multi-tenant integrato in SpedireSicuro. Modello dati ispirato al gestionale "PER TE" del pilot. Ogni entita e' isolata per `workspace_id`.

**Principio:** Multi-tenant by default, zero contaminazione cross-workspace.

---

## Modello Dati (8 tabelle)

```
suppliers (Fornitori)
    ↓
product_suppliers (Listino fornitore + sconti cascata)
    ↓
products (Anagrafica prodotti)
    ↓
inventory (Giacenze per magazzino)
    ↓
warehouse_movements (Movimenti stock)
    ↓
warehouses (Depositi)
    ↓
purchase_orders (Ordini fornitore)
    ↓
purchase_order_items (Righe ordine)
```

### Tabelle e Campi Chiave

| Tabella                | Descrizione                     | Campi chiave                                           |
| ---------------------- | ------------------------------- | ------------------------------------------------------ |
| `suppliers`            | Anagrafica fornitori            | code, name, vat_number, payment_terms, min_order       |
| `products`             | Anagrafica prodotti             | sku (unique per ws), barcode, type, weight, dimensioni |
| `product_suppliers`    | Listino fornitore con sconti    | list_price, discount_1..5, net_cost (calcolato)        |
| `warehouses`           | Magazzini/depositi              | code (unique per ws), type (standard/transit/returns)  |
| `inventory`            | Giacenze per prodotto+magazzino | quantity_available, reserved, on_order, reorder_point  |
| `warehouse_movements`  | Log movimenti stock             | type (inbound/outbound/transfer/adjustment), quantity  |
| `purchase_orders`      | Testata ordini fornitore        | order_number, status, totali calcolati                 |
| `purchase_order_items` | Righe ordine con sconti cascata | quantity_ordered/received, sconti, line_total          |

### Tipi Prodotto

| Tipo           | Descrizione                    |
| -------------- | ------------------------------ |
| `physical`     | Prodotto fisico (default)      |
| `digital`      | Prodotto digitale              |
| `service`      | Servizio                       |
| `dropshipping` | Prodotto spedito dal fornitore |

### Tipi Magazzino

| Tipo       | Descrizione                       |
| ---------- | --------------------------------- |
| `standard` | Deposito principale (default)     |
| `transit`  | Magazzino di transito             |
| `returns`  | Magazzino resi                    |
| `dropship` | Magazzino virtuale (dropshipping) |

### Tipi Movimento

| Tipo          | Descrizione                    |
| ------------- | ------------------------------ |
| `inbound`     | Carico merce (da fornitore)    |
| `outbound`    | Scarico merce (per spedizione) |
| `transfer`    | Trasferimento tra magazzini    |
| `adjustment`  | Rettifica inventario           |
| `reservation` | Prenotazione stock             |
| `release`     | Rilascio prenotazione          |

### Stati Ordine Fornitore

| Stato       | Descrizione             |
| ----------- | ----------------------- |
| `draft`     | Bozza (default)         |
| `confirmed` | Confermato al fornitore |
| `shipped`   | Spedito dal fornitore   |
| `partial`   | Ricevuto parzialmente   |
| `received`  | Ricevuto completamente  |
| `cancelled` | Annullato               |

---

## Sconti a Cascata

Formula identica al gestionale "PER TE":

```
net_cost = list_price × (1 - sc1/100) × (1 - sc2/100) × (1 - sc3/100) × (1 - sc4/100) × (1 - sc5/100) + RAEE + eco_contribution
```

Esempio: list_price=100, sconti 20, 5, 13, 15:

```
100 × 0.80 × 0.95 × 0.87 × 0.85 = 56.24 + RAEE + eco
```

Calcolato automaticamente da trigger PostgreSQL su `product_suppliers` e `purchase_order_items`.

---

## Sicurezza Multi-Tenant

### Row Level Security (RLS)

Ogni tabella ha 2 policy:

- **SELECT** per tutti i membri attivi del workspace
- **ALL** (CRUD) solo per owner/admin del workspace

### Cross-Workspace Guards (Trigger)

Migration: `20260213200000_wms_cross_workspace_guards.sql`

Trigger BEFORE INSERT/UPDATE su tutte le tabelle con FK cross-entita:

| Tabella                | Verifica                                            |
| ---------------------- | --------------------------------------------------- |
| `product_suppliers`    | product_id e supplier_id stesso workspace           |
| `inventory`            | product_id e warehouse_id stesso workspace          |
| `warehouse_movements`  | product_id, warehouse_id, to_warehouse_id stesso ws |
| `purchase_order_items` | purchase_order_id e product_id stesso workspace     |

Se violazione: `RAISE EXCEPTION 'cross-tenant violation'`.

### Stock Atomico

Funzione `wms_update_stock()` con upsert + increment atomico:

- Evita race condition read-then-write
- CHECK constraint `quantity_available >= 0`
- Ritorna -1 se stock insufficiente

### Permessi API (verifyWmsAccess)

File: `lib/wms/verify-access.ts`

| Permesso              | Azione                             |
| --------------------- | ---------------------------------- |
| `warehouse:view`      | Leggere prodotti, giacenze, ordini |
| `warehouse:manage`    | Creare/modificare/eliminare        |
| `warehouse:inventory` | Movimenti stock (carico/scarico)   |

Logica:

1. SuperAdmin → accesso totale
2. Membership diretta → check permesso specifico
3. Fallback reseller parent → child (solo `warehouse:view`)

---

## API Routes

Base path: `/api/workspaces/[workspaceId]/`

| Metodo | Route                       | Permesso              | Descrizione           |
| ------ | --------------------------- | --------------------- | --------------------- |
| GET    | `warehouses`                | `warehouse:view`      | Lista magazzini       |
| POST   | `warehouses`                | `warehouse:manage`    | Crea magazzino        |
| GET    | `products`                  | `warehouse:view`      | Lista prodotti        |
| POST   | `products`                  | `warehouse:manage`    | Crea prodotto         |
| GET    | `products/[productId]`      | `warehouse:view`      | Dettaglio prodotto    |
| PUT    | `products/[productId]`      | `warehouse:manage`    | Aggiorna prodotto     |
| DELETE | `products/[productId]`      | `warehouse:manage`    | Elimina prodotto      |
| GET    | `inventory`                 | `warehouse:view`      | Lista giacenze        |
| POST   | `inventory`                 | `warehouse:inventory` | Movimento stock       |
| GET    | `purchase-orders`           | `warehouse:view`      | Lista ordini          |
| POST   | `purchase-orders`           | `warehouse:manage`    | Crea ordine           |
| GET    | `purchase-orders/[orderId]` | `warehouse:view`      | Dettaglio ordine      |
| PUT    | `purchase-orders/[orderId]` | `warehouse:manage`    | Aggiorna stato ordine |
| GET    | `suppliers`                 | `warehouse:view`      | Lista fornitori       |
| POST   | `suppliers`                 | `warehouse:manage`    | Crea fornitore        |

Tutte le route includono:

- Auth obbligatoria (401)
- UUID validation (400)
- Rate limiting (429)
- Workspace membership + permessi (403)

---

## Pagine Dashboard

| Pagina                                        | Funzionalita                                     |
| --------------------------------------------- | ------------------------------------------------ |
| `app/dashboard/wms/page.tsx`                  | Panoramica: stock value, sotto-scorta, movimenti |
| `app/dashboard/wms/prodotti/page.tsx`         | CRUD prodotti con filtri e ricerca               |
| `app/dashboard/wms/magazzini/page.tsx`        | CRUD magazzini + giacenze per magazzino          |
| `app/dashboard/wms/ordini-fornitore/page.tsx` | Lista ordini + creazione + ricezione             |

Navigazione: sezione "Magazzino" nella sidebar (visibile solo con permesso `warehouse:view`).

---

## Migration Files

| File                                            | Contenuto                               |
| ----------------------------------------------- | --------------------------------------- |
| `20260213100000_wms_mvp.sql`                    | 8 tabelle, RLS, trigger, funzione stock |
| `20260213200000_wms_cross_workspace_guards.sql` | Trigger anti cross-tenant su FK         |

---

## Test Coverage

| File Test                            | Descrizione                              | N. Test |
| ------------------------------------ | ---------------------------------------- | ------- |
| `tests/unit/wms-api.test.ts`         | API CRUD, auth, permessi, validazione    | 39      |
| `tests/unit/wms-audit-fixes.test.ts` | Cross-tenant, stock atomico, paginazione | 14      |

**Totale:** 53 test dedicati

---

## File Principali

### Backend

- `lib/wms/verify-access.ts` — Helper permessi WMS
- `lib/db/products.ts` — Service layer prodotti (CRUD + sconti)
- `lib/db/warehouses.ts` — Service layer magazzini + inventory + movimenti
- `lib/config/navigationConfig.ts` — Sezione "Magazzino" nella nav

### API Routes

- `app/api/workspaces/[workspaceId]/products/route.ts`
- `app/api/workspaces/[workspaceId]/products/[productId]/route.ts`
- `app/api/workspaces/[workspaceId]/warehouses/route.ts`
- `app/api/workspaces/[workspaceId]/inventory/route.ts`
- `app/api/workspaces/[workspaceId]/purchase-orders/route.ts`
- `app/api/workspaces/[workspaceId]/purchase-orders/[orderId]/route.ts`
- `app/api/workspaces/[workspaceId]/suppliers/route.ts`

### UI Pages

- `app/dashboard/wms/page.tsx` — Dashboard panoramica
- `app/dashboard/wms/prodotti/page.tsx` — Gestione prodotti
- `app/dashboard/wms/magazzini/page.tsx` — Gestione magazzini
- `app/dashboard/wms/ordini-fornitore/page.tsx` — Ordini fornitore

### Types

- `types/products.ts` — Tipi prodotti + product_suppliers
- `types/warehouse.ts` — Tipi magazzini + inventory + movimenti

---

## Changelog

| Data       | Versione | Descrizione                                               |
| ---------- | -------- | --------------------------------------------------------- |
| 2026-02-13 | 1.2.0    | Hardening: trigger idempotenti, paginazione stabile, test |
| 2026-02-13 | 1.1.0    | Cross-workspace guards, atomic stock, UUID validation     |
| 2026-02-13 | 1.0.0    | MVP: prodotti, fornitori, magazzini, giacenze, ordini     |
