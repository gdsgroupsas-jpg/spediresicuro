# FASE 4: Bacheca Broadcast

**Commit:** `954d171` | **Data:** 2026-02-09

## Panoramica

Board annunci workspace-scoped per reseller. Permette ai reseller (owner/admin) di
creare annunci broadcast destinati al team interno, ai clienti, o a tutti. I clienti
del reseller vedono gli annunci a loro destinati tramite parent_workspace_id.

## Architettura

### API Routes (2 endpoint workspace-scoped)

| Route                                                                      | Metodi             | Scopo                                  |
| -------------------------------------------------------------------------- | ------------------ | -------------------------------------- |
| `app/api/workspaces/[workspaceId]/announcements/route.ts`                  | GET, POST          | Lista annunci + creazione              |
| `app/api/workspaces/[workspaceId]/announcements/[announcementId]/route.ts` | GET, PATCH, DELETE | Dettaglio, aggiornamento, eliminazione |

### Sicurezza

- **Auth obbligatoria**: Ogni request verifica `getSafeAuth()` + membership workspace
- **Isolamento workspace**: Tutte le query filtrano per `workspace_id` server-side
- **Double filter su singolo annuncio**: `.eq('id', announcementId).eq('workspace_id', workspaceId)`
- **SuperAdmin bypass**: Accesso diretto senza membership check
- **Role-based write**: Solo owner/admin possono creare, modificare, eliminare
- **Accesso clienti**: Clienti del reseller accedono via `parent_workspace_id` (solo annunci `all`/`clients`)
- **Sanitizzazione HTML**: Via `sanitizeEmailHtml()` dalla FASE 2

### Modello dati

**Tabella:** `workspace_announcements` (creata in FASE 2 migration)

| Campo        | Tipo        | Descrizione                                 |
| ------------ | ----------- | ------------------------------------------- |
| id           | UUID        | PK                                          |
| workspace_id | UUID        | FK workspaces, isolamento                   |
| author_id    | UUID        | FK auth.users, chi ha creato                |
| title        | TEXT        | Titolo annuncio                             |
| body_html    | TEXT        | Corpo HTML sanitizzato                      |
| body_text    | TEXT        | Corpo plain text (opzionale)                |
| target       | TEXT        | `all`, `team`, `clients`                    |
| priority     | TEXT        | `low`, `normal`, `high`, `urgent`           |
| pinned       | BOOLEAN     | Se fissato in cima                          |
| channels     | TEXT[]      | Canali di distribuzione (`in_app`, `email`) |
| read_by      | UUID[]      | Array di user_id che hanno letto            |
| created_at   | TIMESTAMPTZ | Data creazione                              |
| updated_at   | TIMESTAMPTZ | Data ultimo aggiornamento                   |

### Pagina UI

**File:** `app/dashboard/bacheca/page.tsx`

**Layout:**

1. **Header** con titolo, conteggio annunci, bottone "Nuovo annuncio" (solo owner/admin)
2. **Filtri tab**: Tutti / Broadcast / Team / Clienti
3. **Lista annunci**: Card con titolo, preview body, target badge, priority badge, pin icon, read count, tempo relativo
4. **Dettaglio dialog**: Body completo, metadata, azioni (edit/pin/delete per owner/admin)
5. **Composer dialog**: Titolo, body textarea, target selector (3 card con icone), priority buttons, pin toggle

**Funzionalita:**

- Composer con target selector visuale (Tutti/Team/Clienti con icone)
- Priority selector (Normale/Alta/Urgente)
- Pin toggle per fissare annunci importanti
- Auto mark-read quando si apre il dettaglio
- Read count ("Letto da X persone")
- Filtri per target
- Delete con conferma dialog
- Indicatore visivo priorita (icone colorate)
- canManage flag basato su ruolo (owner/admin)

### Navigation

**File:** `lib/config/navigationConfig.ts`

- Superadmin → `/dashboard/bacheca` (sezione Comunicazioni)
- Reseller → `/dashboard/bacheca` (sezione Comunicazioni)
- Utente normale → nessun accesso Bacheca

## File Creati

| File                                                                       | Righe | Scopo                 |
| -------------------------------------------------------------------------- | ----- | --------------------- |
| `app/api/workspaces/[workspaceId]/announcements/route.ts`                  | ~250  | API lista + creazione |
| `app/api/workspaces/[workspaceId]/announcements/[announcementId]/route.ts` | ~200  | API singolo annuncio  |
| `app/dashboard/bacheca/page.tsx`                                           | ~650  | UI bacheca completa   |
| `tests/unit/announcements-api.test.ts`                                     | ~550  | 23 test unit          |

## File Modificati

| File                             | Modifica                                         |
| -------------------------------- | ------------------------------------------------ |
| `lib/config/navigationConfig.ts` | Aggiunto Bacheca a superadmin e reseller sidebar |

## Test

**23 test unit** in `tests/unit/announcements-api.test.ts`:

- **GET lista**: auth (401), UUID validation (400), non-member (403), returns announcements, superadmin bypass
- **POST creazione**: auth (401), missing title (400), missing body (400), invalid target (400), viewer forbidden (403), owner creates (201), HTML sanitization
- **PATCH update**: empty update (400), invalid target (400), viewer forbidden (403)
- **DELETE**: auth (401), not found (404), viewer forbidden (403)
- **GET singolo**: not found (404), auto mark-read returns is_read=true
- **Navigation**: reseller vede bacheca, superadmin vede bacheca, utente normale no comunicazioni

## Dipendenze

- **FASE 2** (migration): Tabella `workspace_announcements` con RLS
- **FASE 2** (service): `sanitizeEmailHtml()` per sanitizzazione HTML body
- **Hook `useWorkspace()`**: Contesto workspace corrente
- **`getSafeAuth()`**: Autenticazione e ruolo utente
