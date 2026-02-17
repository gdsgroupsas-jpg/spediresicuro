---
title: Multi-Tenant Wallet v2 — Workspace Source of Truth
scope: feature
audience: developers, AI agents
owner: CTO
status: active
source_of_truth: true
created: 2026-02-18
updated: 2026-02-18
---

# Multi-Tenant Wallet v2

## Problema

Fino al 2026-02-17, il saldo wallet era su `users.wallet_balance`. Se un utente apparteneva a 2 workspace, condividevano lo stesso saldo. Questo violava l'isolamento multi-tenant.

## Soluzione

La **source of truth** è ora `workspaces.wallet_balance`. Ogni workspace ha il proprio saldo indipendente. Le 5 RPC v2 lockano su `workspaces` anziché `users`.

## Architettura

```
workspaces.wallet_balance  ← SOURCE OF TRUTH (lockato da RPC v2)
        │
        ▼ (trigger: sync_wallet_to_users)
users.wallet_balance       ← MIRROR (backward compat, read-only)
```

### RPC v2

| RPC                             | Parametri obbligatori                           | Uso principale                    |
| ------------------------------- | ----------------------------------------------- | --------------------------------- |
| `add_wallet_credit_v2`          | p_workspace_id, p_user_id, p_amount             | Ricarica wallet (admin, Stripe)   |
| `add_wallet_credit_with_vat_v2` | p_workspace_id, p_user_id, p_amount, p_vat_rate | Ricarica con IVA (Stripe webhook) |
| `deduct_wallet_credit_v2`       | p_workspace_id, p_user_id, p_amount, p_type     | Addebito spedizione               |
| `refund_wallet_balance_v2`      | p_workspace_id, p_user_id, p_amount             | Rimborso (Anne AI, support)       |
| `reseller_transfer_credit_v2`   | p_reseller_ws_id, p_sub_user_ws_id, p_amount    | Transfer reseller → sub-user      |

Tutte le RPC hanno:

- `SECURITY DEFINER` + `SET search_path = public, pg_temp`
- `FOR UPDATE NOWAIT` su workspaces (lock pessimistico)
- Parametro `p_idempotency_key` per protezione double-click
- GRANT solo a `service_role` (mai `authenticated`)

### Lock deterministico (reseller_transfer_credit_v2)

Per evitare deadlock quando 2 reseller trasferiscono contemporaneamente:

```sql
-- Locka prima il workspace con UUID minore
IF p_reseller_workspace_id < p_sub_user_workspace_id THEN
  SELECT wallet_balance INTO v_reseller_balance
  FROM workspaces WHERE id = p_reseller_workspace_id FOR UPDATE NOWAIT;
  SELECT wallet_balance INTO v_sub_user_balance
  FROM workspaces WHERE id = p_sub_user_workspace_id FOR UPDATE NOWAIT;
ELSE
  -- ordine inverso
  ...
END IF;
```

### Trigger inverso (workspaces → users)

```sql
CREATE FUNCTION sync_wallet_to_users() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    UPDATE users SET wallet_balance = NEW.wallet_balance
    WHERE primary_workspace_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;
```

- `IS DISTINCT FROM` previene loop infiniti
- Solo per backward compat (codice non ancora migrato)

## Caller TypeScript migrati

| File                                        | Funzione                               | RPC v2 usata                                           |
| ------------------------------------------- | -------------------------------------- | ------------------------------------------------------ |
| `lib/shipments/create-shipment-core.ts`     | createShipmentCore                     | `deduct_wallet_credit_v2` + `refund_wallet_balance_v2` |
| `app/actions/wallet.ts`                     | rechargeMyWallet / adjustWalletBalance | `add_wallet_credit_v2`                                 |
| `app/api/stripe/webhook/route.ts`           | handleCheckoutCompleted                | `add_wallet_credit_with_vat_v2`                        |
| `actions/admin-reseller.ts`                 | manageSubUserWallet                    | `reseller_transfer_credit_v2`                          |
| `lib/services/giacenze/giacenze-service.ts` | confirmHoldAction                      | `deduct_wallet_credit_v2` + `add_wallet_credit_v2`     |
| `lib/ai/tools/support-tools.ts`             | refundShipment                         | `refund_wallet_balance_v2`                             |

## Lettura saldo

| File                         | Legge da                    | Metodo                                     |
| ---------------------------- | --------------------------- | ------------------------------------------ |
| `lib/wallet/credit-check.ts` | `workspaces.wallet_balance` | Via workspaceId parametro (fallback users) |
| `app/api/user/info/route.ts` | `workspaces.wallet_balance` | Via `primary_workspace_id` JOIN            |
| `lib/workspace-auth.ts`      | `workspaces.wallet_balance` | Già da workspaces (nessun cambio)          |

## Security

### GRANT hardening (migration 20260218130000)

- Tutte le 5 RPC v2: `REVOKE ALL FROM authenticated`, `GRANT EXECUTE TO service_role`
- `get_admin_overview_stats()`: ristretto a service_role
- `delete_user_complete()`: ristretto a service_role
- 5 funzioni: aggiunto `pg_temp` a search_path

### Perché service_role only?

Le RPC wallet v2 sono chiamate SOLO dal backend (server actions, API routes). Se fossero callable da `authenticated`, un utente malevolo potrebbe chiamare direttamente via PostgREST bypassando i controlli applicativi (rate limiting, ownership check, validazione input).

## Migration

| File                                                | Contenuto                                         |
| --------------------------------------------------- | ------------------------------------------------- |
| `20260218100000_wallet_rpc_v2_workspace_source.sql` | 5 RPC v2 + trigger inverso + drop trigger vecchio |
| `20260218110000_wallet_rpc_v2_additional.sql`       | RPC aggiuntive (se presenti)                      |
| `20260218130000_fix_rpc_grants_and_search_path.sql` | GRANT security hardening                          |

## Test

| Test file                                            | Cosa verifica                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `tests/unit/wallet-rpc-v2.test.ts`                   | Struttura SQL corretta (SECURITY DEFINER, lock workspaces, workspace_id obbligatorio) |
| `tests/unit/wallet-source-of-truth.test.ts`          | Nessun caller usa RPC v1 per operazioni wallet                                        |
| `tests/unit/dashboard-wallet-balance-source.test.ts` | Dashboard legge saldo da workspace                                                    |
| `tests/unit/reseller-transfer-credit.test.ts`        | Transfer atomico con idempotency                                                      |

## Regole per nuovo codice

1. **USARE** sempre RPC v2 (con suffisso `_v2`)
2. **MAI** usare RPC v1 (`add_wallet_credit`, `decrement_wallet_balance`, ecc.)
3. **MAI** fare UPDATE diretti su `wallet_balance` (né users né workspaces)
4. **SEMPRE** passare `workspace_id` come parametro obbligatorio
5. **LEGGERE** il saldo da `workspaces.wallet_balance`, non da `users.wallet_balance`

## Changelog

| Data       | Cambiamento                                                             |
| ---------- | ----------------------------------------------------------------------- |
| 2026-02-18 | Creazione: 5 RPC v2, trigger inverso, GRANT hardening, 6 caller migrati |
