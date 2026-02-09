# FASE 3: Posta Reseller UI

**Commit:** `46652eb` | **Data:** 2026-02-09

## Panoramica

Inbox email Gmail-style workspace-scoped per reseller. Permette ai reseller di
inviare/ricevere email dal proprio dominio custom, gestire bozze, rispondere,
inoltrare, e organizzare le email in cartelle.

## Architettura

### API Routes (3 endpoint workspace-scoped)

| Route                                                        | Metodi             | Scopo                                  |
| ------------------------------------------------------------ | ------------------ | -------------------------------------- |
| `app/api/workspaces/[workspaceId]/emails/route.ts`           | GET, POST          | Lista email + invio/bozza              |
| `app/api/workspaces/[workspaceId]/emails/[emailId]/route.ts` | GET, PATCH, DELETE | Dettaglio, aggiornamento, eliminazione |
| `app/api/workspaces/[workspaceId]/email-addresses/route.ts`  | GET                | Lista indirizzi email workspace        |

### Sicurezza

- **Auth obbligatoria**: Ogni request verifica `getSafeAuth()` + membership workspace
- **Isolamento workspace**: Tutte le query filtrano per `workspace_id` server-side
- **Double filter su singola email**: `.eq('id', emailId).eq('workspace_id', workspaceId)`
- **SuperAdmin bypass**: Accesso diretto senza membership check
- **Rate limiting**: Delegato a `sendWorkspaceEmail()` (FASE 2)
- **Sanitizzazione HTML**: Delegata a `sendWorkspaceEmail()` (FASE 2)

### Pagina UI

**File:** `app/dashboard/posta-workspace/page.tsx`

**Layout 3 pannelli:**

1. **Sidebar cartelle** (desktop) / overlay (mobile): Inbox, Inviati, Bozze, Cestino
2. **Lista email**: Search, paginazione (50/pagina), polling (30s), star toggle
3. **Pannello dettaglio**: Header con azioni, body HTML/text, metadata

**Funzionalità:**

- Compose modal con FROM dinamico da `workspace_email_addresses`
- Autocomplete contatti dal CRM (`/api/contacts/search`)
- Reply / Reply-All / Forward
- Star toggle (ottimistico)
- Trash / Hard delete (se già nel cestino)
- Salva bozza
- Mobile responsive con switch list/detail
- Warning card quando nessun indirizzo email configurato

### Navigation

**File:** `lib/config/navigationConfig.ts`

- Superadmin → `/dashboard/posta` (inbox piattaforma)
- Reseller → `/dashboard/posta-workspace` (inbox workspace)
- Utente normale → nessun accesso Posta

## File Creati

| File                                                         | Righe | Scopo                   |
| ------------------------------------------------------------ | ----- | ----------------------- |
| `app/api/workspaces/[workspaceId]/emails/route.ts`           | ~190  | API lista + invio email |
| `app/api/workspaces/[workspaceId]/emails/[emailId]/route.ts` | ~130  | API singola email       |
| `app/api/workspaces/[workspaceId]/email-addresses/route.ts`  | ~67   | API indirizzi email     |
| `app/dashboard/posta-workspace/page.tsx`                     | ~800  | UI inbox completa       |
| `tests/unit/posta-workspace-api.test.ts`                     | ~500  | 20 test unit            |

## File Modificati

| File                             | Modifica                                     |
| -------------------------------- | -------------------------------------------- |
| `lib/config/navigationConfig.ts` | Aggiunto blocco reseller per Posta + Rubrica |

## Test

**20 test unit** in `tests/unit/posta-workspace-api.test.ts`:

- Auth: 401 senza autenticazione
- Validazione: 400 per UUID non valido
- Membership: 403 per non-membro
- Isolamento: filtro workspace su lista email
- SuperAdmin: bypass membership
- POST: 400 senza fromAddressId, invio con successo, campi obbligatori per non-bozza
- Singola email: 404 se non nel workspace
- PATCH: 400 per update vuoto, 400 per folder non valida
- DELETE: 404 se non trovata
- Email addresses: auth, membership, superadmin
- Navigation: reseller vede posta-workspace, superadmin vede posta, utente normale no comunicazioni

## Dipendenze

- **FASE 2** (workspace-email-service): `sendWorkspaceEmail()`, sanitizzazione, rate limit
- **Tabella `workspace_email_addresses`**: Indirizzi FROM dinamici
- **Tabella `emails`**: Storage email con `workspace_id`
- **Hook `useWorkspace()`**: Contesto workspace corrente
