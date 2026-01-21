# Assegnazione Listini Personalizzati

Documentazione completa del sistema di assegnazione listini personalizzati agli utenti dalla dashboard admin.

## Panoramica

Il sistema permette ai **superadmin** di assegnare listini personalizzati (custom o supplier) agli utenti direttamente dalla dashboard admin, supportando assegnazioni multiple (N:N) tramite la tabella `price_list_assignments`.

## Architettura

### Database

**Tabella principale:** `price_list_assignments` (migration 070)

```sql
CREATE TABLE price_list_assignments (
  id UUID PRIMARY KEY,
  price_list_id UUID REFERENCES price_lists(id),
  user_id UUID REFERENCES users(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,  -- NULL = assegnazione attiva
  revoked_by UUID REFERENCES users(id),
  notes TEXT,
  metadata JSONB
);
```

**Funzioni RPC disponibili:**

- `assign_price_list(p_price_list_id, p_user_id, p_notes)` → UUID (assignment_id)
- `revoke_price_list_assignment(p_assignment_id)` → BOOLEAN

**Vista ottimizzata:**

- `v_active_assignments` - Join con price_lists e users per query rapide

### File Implementati

#### 1. Server Actions

**File:** `actions/price-list-assignments.ts`

**Funzioni:**

```typescript
// Assegna listino a utente
assignPriceListToUser(priceListId: string, userId: string, notes?: string)
  → { success: boolean; assignmentId?: string; error?: string }

// Rimuove assegnazione
revokePriceListAssignment(assignmentId: string)
  → { success: boolean; error?: string }

// Lista assegnazioni utente
listUserPriceListAssignments(userId: string)
  → { success: boolean; assignments?: any[]; error?: string }

// Lista listini assegnabili
listAssignablePriceLists()
  → { success: boolean; priceLists?: any[]; error?: string }
```

**Sicurezza:**

- Tutte le funzioni verificano permessi superadmin
- Chiamano RPC functions per validazioni DB e audit trail
- Gestiscono errori con messaggi user-friendly

#### 2. Dialog React

**File:** `components/admin/manage-price-list-assignments-dialog.tsx`

**Caratteristiche:**

- Mostra listini già assegnati con pulsante rimuovi
- Form per assegnare nuovo listino (dropdown + note opzionali)
- Loading states durante operazioni async
- Toast notifications per feedback immediato
- Filtra listini già assegnati dal dropdown

#### 3. API Overview

**File:** `app/api/admin/overview/route.ts`

**Modifica:**

- Aggiunta query aggregata per conteggio listini assegnati
- Campo `price_lists_count` aggiunto a ogni user object
- Performance: 1 query aggregata invece di N query

#### 4. Dashboard Admin

**File:** `app/dashboard/admin/page.tsx`

**Modifiche:**

- Nuova colonna "Listini Personalizzati" nella tabella utenti
- Badge cliccabile che mostra count listini (blu se > 0, grigio se 0)
- Dialog integrato per gestione assegnazioni
- Filtro automatico: solo reseller e clienti diretti (no sub-utenti)

## Utilizzo

### Come Assegnare un Listino

1. **Accedi come superadmin**
   - Login con credenziali superadmin

2. **Vai alla dashboard admin**
   - Naviga a `/dashboard/admin`

3. **Individua l'utente**
   - Cerca nella tabella utenti
   - Solo reseller e clienti diretti hanno il badge (sub-utenti mostrano "N/A")

4. **Click sul badge listini**
   - Badge mostra "Nessuno" o "N Listini"
   - Si apre il dialog "Gestisci Listini Personalizzati"

5. **Assegna nuovo listino**
   - Seleziona listino dal dropdown (solo custom/supplier attivi)
   - Aggiungi note opzionali (es. "Listino speciale cliente VIP")
   - Click "Assegna Listino"
   - Toast di conferma
   - Badge si aggiorna automaticamente

6. **Rimuovi assegnazione**
   - Riapri dialog
   - Click icona trash rossa accanto al listino
   - Conferma con toast
   - Badge si aggiorna

### Destinatari Ammessi

**SÌ - Possono ricevere assegnazioni:**

- ✅ Reseller (is_reseller = true, parent_user_id = null)
- ✅ Clienti diretti (utenti normali, parent_user_id = null)

**NO - Non possono ricevere assegnazioni:**

- ❌ Sub-utenti dei reseller (parent_user_id != null)
- ❌ Utenti di test (filtrati automaticamente)

**Logica filtro:**

```typescript
const canReceiveAssignments = !user.parent_user_id;
```

### Listini Assegnabili

**Criteri:**

- `list_type` IN ('custom', 'supplier')
- `status` = 'active'
- Non già assegnato all'utente (filtrato in UI)

**Esclusi:**

- Listini global (sempre visibili a tutti)
- Listini draft o archived
- Listini già assegnati (per evitare duplicati)

## Sicurezza

### RLS Policies

**Tabella `price_list_assignments`:**

```sql
-- SELECT: superadmin/admin vedono tutto, utenti vedono solo proprie assegnazioni
CREATE POLICY pla_select ON price_list_assignments FOR SELECT
  USING (
    account_type IN ('superadmin', 'admin')
    OR (user_id = auth.uid() AND revoked_at IS NULL)
  );

-- INSERT/UPDATE/DELETE: solo superadmin
CREATE POLICY pla_insert ON price_list_assignments FOR INSERT
  WITH CHECK (account_type = 'superadmin');
```

### Server Actions

Ogni funzione verifica:

1. Autenticazione (session attiva)
2. Permessi superadmin (account_type = 'superadmin')
3. Validazione input (UUID validi, campi obbligatori)

### Audit Trail

Tracciato automaticamente:

- `assigned_by` - ID superadmin che ha creato l'assegnazione
- `assigned_at` - Timestamp assegnazione
- `revoked_by` - ID superadmin che ha revocato (se applicabile)
- `revoked_at` - Timestamp revoca (NULL = attiva)
- `notes` - Note dell'assegnazione

**Query audit:**

```sql
SELECT * FROM v_active_assignments
WHERE user_id = '<user_id>';
```

## Performance

### Query Aggregata

**Prima (N query):**

```typescript
// Per ogni utente
const count = await supabase
  .from('price_list_assignments')
  .select('*', { count: 'exact' })
  .eq('user_id', user.id);
```

**Dopo (1 query aggregata):**

```typescript
// Singola query per tutti gli utenti
const assignmentCounts = await supabase
  .from('price_list_assignments')
  .select('user_id')
  .is('revoked_at', null);

// Aggregazione in-memory
const countsMap = new Map();
assignmentCounts.forEach((a) => {
  countsMap.set(a.user_id, (countsMap.get(a.user_id) || 0) + 1);
});
```

**Benefici:**

- ✅ Riduce carico DB (1 query invece di N)
- ✅ Scalabile con migliaia di utenti
- ✅ Compatibile con paginazione esistente (20 utenti/pagina)

### Indici Database

Ottimizzazioni già implementate (migration 070):

```sql
CREATE INDEX idx_pla_price_list_id ON price_list_assignments(price_list_id);
CREATE INDEX idx_pla_user_id ON price_list_assignments(user_id);
CREATE INDEX idx_pla_active ON price_list_assignments(price_list_id, user_id)
  WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX idx_pla_unique_active
  ON price_list_assignments(price_list_id, user_id)
  WHERE revoked_at IS NULL;
```

## UX e Feedback

### Stati UI

**Badge:**

- Grigio "Nessuno" → nessun listino assegnato
- Blu "N Listini" → uno o più listini assegnati
- Grigio "N/A" → sub-utente (non ammesso)

**Dialog:**

- Loading spinner durante fetch iniziale
- Skeleton durante assegnazione/rimozione
- Pulsanti disabilitati durante operazioni
- Dropdown filtra listini già assegnati

### Toast Notifications

**Success:**

- "Listino assegnato con successo"
- "Assegnazione rimossa con successo"

**Error:**

- "Questo listino è già assegnato a questo utente"
- "Assegnazione non trovata o già rimossa"
- "Solo i superadmin possono gestire le assegnazioni listini"

## Retrocompatibilità

Il sistema supporta **due meccanismi** di assegnazione:

### 1. Legacy (1:1)

**Campo:** `price_lists.assigned_to_user_id`

- Assegnazione diretta 1:1
- Ancora funzionante
- Non gestito da questa UI

### 2. Nuovo (N:N)

**Tabella:** `price_list_assignments`

- Assegnazioni multiple
- Gestito da questa UI
- Audit trail completo

**RLS Policy supporta entrambi:**

```sql
-- Utente vede listino se:
assigned_to_user_id = auth.uid()  -- Legacy
OR
EXISTS (
  SELECT 1 FROM price_list_assignments
  WHERE price_list_id = price_lists.id
  AND user_id = auth.uid()
  AND revoked_at IS NULL
)  -- Nuovo
```

## Testing

### Test Manuali

1. **Verifica permessi:**
   - Login come utente normale → colonna non accessibile
   - Login come superadmin → colonna visibile

2. **Verifica filtri:**
   - Sub-utenti mostrano "N/A"
   - Reseller/clienti diretti mostrano badge

3. **Verifica assegnazioni:**
   - Assegna listino → count aumenta
   - Rimuovi listino → count diminuisce
   - Assegna stesso listino → errore duplicato

4. **Verifica UX:**
   - Loading states funzionanti
   - Toast notifications visibili
   - Dialog si chiude correttamente

### Query Verifica DB

```sql
-- Verifica assegnazioni attive
SELECT
  u.email,
  pl.name AS listino,
  pla.assigned_at,
  pla.notes
FROM price_list_assignments pla
JOIN users u ON u.id = pla.user_id
JOIN price_lists pl ON pl.id = pla.price_list_id
WHERE pla.revoked_at IS NULL
ORDER BY pla.assigned_at DESC;

-- Conteggio per utente
SELECT
  u.email,
  COUNT(*) AS listini_count
FROM price_list_assignments pla
JOIN users u ON u.id = pla.user_id
WHERE pla.revoked_at IS NULL
GROUP BY u.id, u.email
ORDER BY listini_count DESC;

-- Audit trail completo
SELECT * FROM v_active_assignments;
```

## Troubleshooting

### Problema: Badge mostra count errato

**Causa:** Cache non aggiornata dopo assegnazione/rimozione

**Soluzione:**

```typescript
// In onSuccess callback del dialog
fetch('/api/admin/overview')
  .then((res) => res.json())
  .then((data) => {
    if (data.success) setUsers(data.users || []);
  });
```

### Problema: Errore "Assegnazione già esistente"

**Causa:** Unique constraint `idx_pla_unique_active` previene duplicati

**Soluzione:** Verificare in dialog prima di assegnare (filtro dropdown)

### Problema: Utente non vede listino assegnato

**Causa possibile:**

1. RLS policy non aggiornata
2. Assegnazione revocata (`revoked_at` != null)
3. Listino non attivo (`status` != 'active')

**Verifica:**

```sql
-- Controlla assegnazione
SELECT * FROM price_list_assignments
WHERE user_id = '<user_id>' AND price_list_id = '<list_id>';

-- Controlla listino
SELECT id, name, status FROM price_lists WHERE id = '<list_id>';
```

## Prossimi Sviluppi

**Possibili miglioramenti:**

1. **Bulk assignment**
   - Assegnare stesso listino a più utenti contemporaneamente
   - UI con multi-select utenti

2. **Scadenza assegnazioni**
   - Campo `expires_at` in price_list_assignments
   - Auto-revoca alla scadenza

3. **Notifiche**
   - Email all'utente quando riceve nuovo listino
   - Notifica quando listino viene revocato

4. **Dashboard reseller**
   - Reseller può vedere quali listini sono assegnati ai propri sub-utenti
   - Gestione autonoma assegnazioni (se abilitato)

## Riferimenti

- Migration 070: `supabase/migrations/070_master_price_lists_and_assignments.sql`
- Server Actions: `actions/price-list-assignments.ts`
- Dialog UI: `components/admin/manage-price-list-assignments-dialog.tsx`
- Admin Page: `app/dashboard/admin/page.tsx`
- API Overview: `app/api/admin/overview/route.ts`

---

**Data creazione:** 2026-01-17
**Ultima modifica:** 2026-01-17
**Versione:** 1.0
**Autore:** Claude Sonnet 4.5
