# Assegnazione Listini Personalizzati

Documentazione completa del sistema di assegnazione listini N:N con operazioni atomiche.

## Panoramica

Il sistema permette a **superadmin** e **reseller** di assegnare listini personalizzati (custom o supplier) ai propri utenti, supportando assegnazioni multiple (N:N) tramite la tabella `price_list_assignments`.

**Funzionalità chiave:**

- Assegnazione multi-listino per utente (N:N)
- Operazione atomica (singola transazione DB)
- Audit log su ogni assign/revoke
- Rate limiting (30 req/min per utente)
- Validazione margine negativo per reseller
- Validazione UUID su tutti gli input

## Architettura

### Database

**Tabella principale:** `price_list_assignments`

```sql
CREATE TABLE price_list_assignments (
  id UUID PRIMARY KEY,
  price_list_id UUID REFERENCES price_lists(id),
  user_id UUID REFERENCES users(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,  -- NULL = assegnazione attiva (soft-delete)
  revoked_by UUID REFERENCES users(id),
  notes TEXT,
  metadata JSONB
);
```

**Indici parziali (performance):**

```sql
CREATE INDEX idx_pla_user_active ON price_list_assignments(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_pla_pricelist_active ON price_list_assignments(price_list_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_pla_user_pricelist_active ON price_list_assignments(user_id, price_list_id) WHERE revoked_at IS NULL;
```

**Funzioni RPC:**

| Funzione                                                                | Descrizione                                        | Sicurezza        |
| ----------------------------------------------------------------------- | -------------------------------------------------- | ---------------- |
| `bulk_update_user_listini(p_caller_id, p_user_id, p_selected_ids[])`    | Aggiorna atomicamente tutti i listini di un utente | SECURITY DEFINER |
| `assign_listino_to_user_multi(p_caller_id, p_user_id, p_price_list_id)` | Assegna singolo listino (legacy)                   | SECURITY DEFINER |
| `revoke_listino_from_user(p_caller_id, p_user_id, p_price_list_id)`     | Revoca singolo listino (legacy)                    | SECURITY DEFINER |
| `can_user_access_price_list(p_user_id, p_price_list_id)`                | Verifica accesso a un listino                      | SECURITY DEFINER |

### Server Actions

**File:** `actions/price-lists.ts`

```typescript
// Operazione atomica: aggiorna tutti i listini in una transazione
bulkUpdateUserListiniAction(userId: string, selectedListinoIds: string[])
  → { success: boolean; added: number; removed: number; error?: string }

// Assegna singolo listino (con UUID validation, rate limit, audit)
assignPriceListToUserAction(userId: string, priceListId: string)
  → { success: boolean; error?: string }

// Revoca singolo listino (soft-delete)
revokePriceListFromUserAction(userId: string, priceListId: string)
  → { success: boolean; error?: string }
```

**Sicurezza su ogni action:**

1. Validazione UUID input
2. Autenticazione (session attiva)
3. Verifica permessi (admin/superadmin/reseller)
4. Rate limiting (30 req/min)
5. Validazione margine non-negativo (solo reseller)
6. RPC SECURITY DEFINER con ownership check
7. Audit log su successo

### UI: Dialog Multi-Select

**File:** `app/dashboard/reseller/clienti/_components/assign-listino-dialog.tsx`

- Selezione multipla con toggle (checkbox visuale)
- Mostra listini già assegnati come "checked"
- Operazione bulk atomica (1 sola chiamata server)
- Toast con conteggio: "N aggiunti, M rimossi"

### UI: Card Cliente

**File:** `app/dashboard/reseller/clienti/_components/client-card-with-listino.tsx`

- Mostra fino a 2 badge listino + "+N" overflow
- Badge verde per listini attivi con nome e margine %
- Badge ambra "Nessun listino" se vuoto
- Click sui badge apre il dialog di gestione

## Flusso Operazione Bulk

```
1. Utente seleziona listini nel dialog
2. Click "Salva Listini"
3. Client → bulkUpdateUserListiniAction(userId, selectedIds[])
4. Server: UUID validation → Auth → Rate limit → Margin check
5. Server → RPC bulk_update_user_listini (singola transazione):
   a. Verifica caller + parentela
   b. Verifica accesso a tutti i listini (can_user_access_price_list)
   c. REVOKE: soft-delete listini non più selezionati
   d. ASSIGN: inserisce nuovi (evita duplicati)
   e. Backward compat: aggiorna users.assigned_price_list_id
6. Server: Audit log
7. Client: Toast feedback + refresh
```

## Sicurezza

### Ownership Check

- **Superadmin/Admin**: accesso a listini globali + propri
- **Reseller**: accesso SOLO a listini creati da loro (`created_by = reseller_id`)
- **Nessuno** può cross-assegnare tra reseller diversi

### Parentela Check

- Reseller può assegnare SOLO ai propri sub-user (`parent_id = reseller_id`)
- Superadmin può assegnare a qualsiasi utente

### Margine Negativo

- Solo reseller: blocco assegnazione listini con `default_margin_percent < 0`
- Superadmin può forzare margini negativi (promozioni, test)

### Audit Trail

Ogni operazione è loggata in `audit_logs`:

- `action`: `price_list_assigned` o `price_list_revoked`
- `resource_type`: `price_list_assignment`
- `metadata`: `{ targetUserId, priceListId }` o `{ targetUserId, selectedListinoIds, added, removed }`
- Traccia actor (chi ha fatto l'operazione) e target (utente impattato)

## Retrocompatibilità

Il sistema legge da **3 fonti** con dedup automatica:

1. `price_list_assignments` (N:N, `revoked_at IS NULL`)
2. `price_lists.assigned_to_user_id` (legacy 1:1)
3. `users.assigned_price_list_id` (legacy singolo)

`bulk_update_user_listini` mantiene aggiornato `users.assigned_price_list_id` per backward compat.

## Modello di Pricing a Cascata

```
Corriere (GLS) → €3.50 (costo reale)
    ↓
SuperAdmin crea listino custom → €4.50 (margine piattaforma +€1.00)
    ↓ assegna a reseller (diventa "supplier")
Reseller crea listino custom derivato → €8.20 (margine reseller +€3.70)
    ↓ assegna ai sub-user
Sub-user paga €8.20 per spedizione
```

---

**Data creazione:** 2026-01-17
**Ultima modifica:** 2026-02-02
**Versione:** 2.0
