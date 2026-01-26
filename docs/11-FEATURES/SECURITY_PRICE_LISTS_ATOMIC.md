# Sicurezza Listini e Configurazioni API: Privacy e Atomicità

## Panoramica

Questo documento descrive le misure di sicurezza implementate per garantire **privacy totale** e **atomicità** nella gestione dei listini prezzi e delle configurazioni API (courier_configs).

## Problemi Risolti

### 1. Privacy Violata (CRITICO)

**Prima:** Un superadmin poteva vedere/assegnare listini o configurazioni di proprietà di altri reseller. Questo permetteva di prendere un listino del Reseller A e assegnarlo al Reseller B, violando la privacy commerciale (margini, prezzi, contratti).

**Dopo:**

- **Superadmin/Admin**: possono accedere SOLO a risorse **globali** + risorse **create da loro stessi**
- **Reseller**: vede e può assegnare **SOLO** le risorse che ha creato lui stesso
- **NESSUNO** può cross-assegnare risorse tra reseller diversi

### 2. Mancanza di Atomicità

**Prima:** La creazione cliente e l'assegnazione listino erano operazioni separate. Se una falliva, l'altra poteva comunque avvenire, lasciando il sistema in uno stato inconsistente.

**Dopo:** Creazione cliente + assegnazione listino avvengono in una **singola transazione atomica**. O entrambe riescono, o nessuna delle due.

## Funzioni RPC Implementate

### `can_user_access_price_list(p_user_id, p_price_list_id)`

Verifica se un utente può accedere a un listino specifico.

**Regole (AGGIORNATE):**

- **Superadmin/Admin**: listini globali (`is_global = true`) + propri (`created_by = user_id`)
- **Reseller**: **SOLO** listini creati da lui (`created_by = user_id`)
- **Utente normale**: solo listini assegnati a lui

⚠️ **IMPORTANTE**: Superadmin e Admin NON hanno più accesso a TUTTI i listini. Non possono più vedere/assegnare listini di altri reseller.

```sql
-- Esempio
SELECT can_user_access_price_list('superadmin-uuid', 'listino-reseller-B-uuid');
-- Ritorna FALSE! Superadmin non può accedere a listini di altri reseller
```

### `get_user_owned_price_lists(p_user_id, p_list_type, p_status)`

Restituisce i listini che un utente può assegnare ad altri.

**Comportamento (AGGIORNATO):**

- **Superadmin/Admin**: listini globali + propri (NON tutti!)
- **Reseller**: **SOLO** i listini con `created_by = user_id`
- **Utente normale**: nessun listino (non può assegnare)

### `create_client_with_listino(...)` - ATOMICA

Crea un cliente E assegna un listino in una singola transazione.

**Parametri:**

```sql
p_reseller_id UUID,           -- ID del reseller
p_email TEXT,                  -- Email cliente
p_password_hash TEXT,          -- Password già hashata
p_name TEXT,                   -- Nome completo
p_dati_cliente JSONB,          -- Dati cliente (codiceFiscale, indirizzo, etc.)
p_price_list_id UUID DEFAULT NULL,  -- Listino opzionale
p_company_name TEXT DEFAULT NULL,   -- Nome azienda (opzionale)
p_phone TEXT DEFAULT NULL           -- Telefono
```

**Garanzie:**

1. Verifica che il reseller sia autorizzato
2. Verifica unicità email
3. **Verifica ownership del listino** (se specificato)
4. Verifica che il listino sia attivo
5. Crea utente con listino assegnato atomicamente

**Errori:**

- `UNAUTHORIZED`: il chiamante non è un reseller/admin
- `EMAIL_EXISTS`: email già registrata
- `LISTINO_NOT_OWNED`: il reseller non possiede il listino
- `LISTINO_NOT_ACTIVE`: il listino non è attivo

### `assign_listino_to_user_secure(p_caller_id, p_user_id, p_price_list_id)`

Assegna un listino a un utente esistente con verifica ownership.

**Controlli:**

1. Verifica che il caller possa accedere al listino
2. Verifica che l'utente target esista
3. Verifica che il caller sia superadmin O parent dell'utente

## API Endpoints Aggiornati

### POST `/api/reseller/clients`

Ora accetta un parametro opzionale `priceListId` per assegnazione atomica:

```typescript
{
  email: "cliente@email.com",
  nome: "Mario",
  cognome: "Rossi",
  // ... altri dati cliente
  priceListId: "uuid-del-listino"  // ✨ NUOVO: opzionale
}
```

Se `priceListId` è specificato:

- Verifica ownership (il reseller deve aver creato il listino)
- Assegna atomicamente insieme alla creazione utente
- In caso di errore, nessuna operazione viene eseguita

### Server Action: `assignPriceListToUserAction`

Aggiornata per usare la RPC sicura con ownership check:

```typescript
// Prima: nessun controllo ownership
// Dopo: verifica che il caller possieda il listino
const result = await assignPriceListToUserAction(userId, priceListId);
```

### Server Action: `getAssignablePriceListsAction`

Nuova action per ottenere i listini che un reseller può assegnare:

```typescript
const { priceLists } = await getAssignablePriceListsAction({ status: 'active' });
// Ritorna SOLO i listini di proprietà del reseller
```

## Wizard Onboarding Aggiornato

### Nuovo Step "Listino"

Aggiunto step opzionale per selezionare un listino durante la creazione cliente:

- Visibile solo in modalità `admin` e `reseller`
- Mostra solo listini di proprietà del reseller
- Caricamento on-demand tramite `onLoadPriceLists`
- Opzione "Nessun listino" sempre disponibile

### Props Aggiornate

```typescript
interface OnboardingWizardProps {
  mode: 'self' | 'admin' | 'reseller';
  availablePriceLists?: AssignablePriceList[];
  onLoadPriceLists?: () => Promise<AssignablePriceList[]>;
  onComplete?: (
    data: OnboardingFormData & {
      clientId?: string;
      generatedPassword?: string;
      priceListId?: string; // ✨ NUOVO
    }
  ) => void;
}
```

## Indici Database

Aggiunti indici per ottimizzare le query di ownership:

```sql
-- Ricerca listini per proprietario
CREATE INDEX idx_price_lists_created_by ON price_lists(created_by);

-- Gerarchia reseller-clienti
CREATE INDEX idx_users_parent_id ON users(parent_id) WHERE parent_id IS NOT NULL;

-- Listino assegnato
CREATE INDEX idx_users_assigned_price_list_id ON users(assigned_price_list_id)
  WHERE assigned_price_list_id IS NOT NULL;
```

## Test di Sicurezza

### Caso 1: Reseller A tenta di usare listino di Reseller B

```
Risultato atteso: ERRORE "LISTINO_NOT_OWNED"
```

### Caso 2: Creazione cliente con listino non attivo

```
Risultato atteso: ERRORE "LISTINO_NOT_ACTIVE"
```

### Caso 3: Creazione cliente fallisce dopo validazione listino

```
Risultato atteso: ROLLBACK completo, nessun cliente creato
```

### Caso 4: Reseller vede lista listini

```
Risultato atteso: Solo listini con created_by = reseller_id
```

## Migrazione

File: `supabase/migrations/20260126100000_atomic_client_creation_with_listino.sql`

Applica con:

```bash
npx supabase migration up
```

## Sicurezza Configurazioni API (courier_configs)

Le stesse regole di sicurezza si applicano anche alle configurazioni API dei corrieri.

### `can_user_access_courier_config(p_user_id, p_config_id)`

Verifica se un utente può accedere a una configurazione API.

**Regole:**

- **Superadmin/Admin**: config globali (`owner_user_id IS NULL`) + proprie
- **Reseller**: **SOLO** config proprie (`owner_user_id = user_id` o `created_by = email`)
- **Utente normale**: solo config assegnate a lui

### `get_user_owned_courier_configs(p_user_id, p_provider_id, p_is_active)`

Restituisce le configurazioni che un utente può assegnare.

### `assign_config_to_user_secure(p_caller_id, p_user_id, p_config_id)`

Assegna una configurazione a un utente con verifica ownership.

**Errori:**

- `UNAUTHORIZED`: non hai accesso a questa configurazione
- `USER_NOT_FOUND`: utente non trovato
- `FORBIDDEN`: puoi assegnare configurazioni solo ai tuoi clienti
- `CONFIG_NOT_ACTIVE`: la configurazione non è attiva

## Test di Sicurezza Aggiuntivi

### Caso 5: Superadmin tenta di assegnare listino Reseller A a Reseller B

```
Risultato atteso: ERRORE "Non puoi assegnare questo listino"
```

### Caso 6: Superadmin tenta di assegnare config Reseller A a Reseller B

```
Risultato atteso: ERRORE "Non hai accesso a questa configurazione"
```

### Caso 7: Admin vede lista configurazioni

```
Risultato atteso: Solo config globali + proprie (NON di altri reseller)
```

## Migrazioni

1. `supabase/migrations/20260126100000_atomic_client_creation_with_listino.sql` - Funzioni base
2. `supabase/migrations/20260126120000_restrict_superadmin_cross_assignment.sql` - Restrizioni cross-assignment

Applica con:

```bash
npx supabase migration up
```

## Note Tecniche

- Tutte le funzioni usano `SECURITY DEFINER` per bypassare RLS
- `SET search_path = public, pg_temp` previene SQL injection via schema
- I log di audit sono best-effort (non bloccano l'operazione se falliscono)
- Le transazioni PostgreSQL garantiscono atomicità automatica
- **Privacy commerciale**: i margini, prezzi e contratti di ogni reseller sono completamente isolati
