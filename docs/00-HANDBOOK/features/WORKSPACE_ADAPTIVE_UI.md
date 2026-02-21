---
title: Workspace Adaptive UI & Team Management
scope: feature
audience: engineering, product
owner: engineering
status: active
source_of_truth: true
created: 2026-02-05
updated: 2026-02-10
---

# Workspace Adaptive UI & Team Management

## Overview

Il sistema adatta automaticamente l'interfaccia utente in base al tipo di workspace (platform/reseller/client) seguendo il pattern usato da Stripe Connect e Shopify Partner Dashboard.

**Principio:** Stessa codebase, UI che si adatta al contesto.

---

## Gerarchia Workspace

```
Platform (depth 0)     → SpedireSicuro
    ↓
Reseller (depth 1)     → Logistica Milano, Transport Roma, etc.
    ↓
Client (depth 2)       → Cliente finale
```

---

## Adaptive UI: Cosa cambia per tipo workspace

### Platform (depth 0) - SpedireSicuro

| Elemento            | Visibile | Note                       |
| ------------------- | -------- | -------------------------- |
| Colonna Workspace   | ✅       | Vede spedizioni di tutti   |
| Filtro Workspace    | ✅       | Puo filtrare per workspace |
| Menu Listini        | ✅       | Gestisce listini per tutti |
| Menu Team           | ✅       | Gestisce sub-admin         |
| Dashboard Admin     | ✅       | Accesso completo           |
| Statistiche Globali | ✅       | Vede tutto il sistema      |

### Reseller (depth 1) - Rivenditore

| Elemento          | Visibile | Note                               |
| ----------------- | -------- | ---------------------------------- |
| Colonna Workspace | ✅       | Vede spedizioni proprie + figli    |
| Filtro Workspace  | ✅       | Filtra tra i propri client         |
| Menu Listini      | ✅       | Gestisce listini per i suoi client |
| Menu Team         | ✅       | Gestisce il proprio team           |
| Dashboard Admin   | ⚠️       | Solo per il proprio workspace      |
| Statistiche       | ⚠️       | Solo propri dati + figli           |

### Client (depth 2) - Cliente Finale

| Elemento          | Visibile | Note                            |
| ----------------- | -------- | ------------------------------- |
| Colonna Workspace | ❌       | Vede solo le proprie spedizioni |
| Filtro Workspace  | ❌       | Non ha figli                    |
| Menu Listini      | ❌       | Non gestisce listini            |
| Menu Team         | ⚠️       | Solo se ha operatori            |
| Dashboard Admin   | ❌       | Non visibile                    |
| Statistiche       | ⚠️       | Solo proprie                    |

---

## Implementazione Tecnica

### Hook: useWorkspaceUI

File: `hooks/useWorkspaceUI.ts`

```typescript
import { useWorkspaceUI } from '@/hooks/useWorkspaceUI';

function MyComponent() {
  const {
    showWorkspaceColumn,    // Mostra colonna workspace in tabelle
    showWorkspaceFilter,    // Mostra filtro workspace
    showPriceListMenu,      // Mostra menu listini
    showTeamMenu,           // Mostra menu team
    showAdminDashboard,     // Mostra dashboard admin
    canCreateSubWorkspace,  // Puo creare sotto-workspace
    isPlatform,             // E' workspace platform
    isReseller,             // E' workspace reseller
    isClient,               // E' workspace client
  } = useWorkspaceUI();

  return (
    <div>
      {showWorkspaceColumn && <WorkspaceColumn />}
      {showPriceListMenu && <PriceListMenu />}
    </div>
  );
}
```

### Logica di Visibilita

```typescript
// Platform e Reseller vedono gerarchia
const canSeeHierarchy = isPlatform || isReseller;

// Solo Platform e Reseller gestiscono listini
const showPriceListMenu = isPlatform || isReseller;

// Client non vede menu business
const showBusinessMenu = !isClient;
```

---

## Ordinamento Workspace per Superadmin

Il superadmin vede tutti i workspace ordinati per:

1. **Depth** (platform prima, poi reseller, poi client)
2. **Nome** (alfabetico all'interno dello stesso depth)

Questo garantisce che al primo login il superadmin parta dal workspace **platform** (depth 0).

File: `app/api/workspaces/my/route.ts`

```typescript
const sortedData = [...data].sort((a, b) => {
  // Prima per depth (platform = 0 prima)
  if (a.depth !== b.depth) {
    return a.depth - b.depth;
  }
  // Poi per nome
  return a.name.localeCompare(b.name);
});
```

---

## Gestione Team (Sub-Admin)

### Funzionalita

| Azione            | Admin     | Superadmin |
| ----------------- | --------- | ---------- |
| Visualizza team   | ✅ Propri | ✅ Tutti   |
| Crea sub-admin    | ✅ Propri | ✅ Tutti   |
| Elimina sub-admin | ✅ Propri | ✅ Tutti   |
| Modifica ruoli    | ✅ Propri | ✅ Tutti   |

### Eliminazione Sub-Admin

L'eliminazione e' **soft delete**: `account_type = 'deleted'`

File: `actions/admin.ts` → `deleteSubAdmin()`

```typescript
// Permessi:
// - Superadmin: puo eliminare chiunque
// - Admin: puo eliminare solo sub-admin che ha creato (parent_admin_id = user.id)

const result = await deleteSubAdmin(subAdminId);
// { success: true, message: 'Sub-admin eliminato con successo' }
```

### UI Gestione Team

File: `app/dashboard/team/page.tsx`

- Tabella con lista sub-admin
- Bottone "Visualizza" (icona occhio)
- Bottone "Elimina" (icona cestino, rosso)
- Conferma eliminazione con dialog

---

## Test Coverage

| File Test                                                  | Descrizione            | N. Test |
| ---------------------------------------------------------- | ---------------------- | ------- |
| `tests/unit/workspace-ui.test.ts`                          | Hook useWorkspaceUI    | 20      |
| `tests/unit/workspace-switcher-enterprise.test.ts`         | Switcher enterprise    | 33      |
| `tests/unit/workspace-safety-banner.test.ts`               | Safety banner logica   | 12      |
| `tests/unit/workspace-superadmin-ordering.test.ts`         | Ordinamento workspace  | 5       |
| `tests/unit/delete-subadmin.test.ts`                       | Eliminazione sub-admin | 5       |
| `tests/integration/workspace-hierarchy-visibility.test.ts` | Visibilita gerarchica  | 13      |

**Totale:** 88 test dedicati

---

## File Modificati

### Core

- `hooks/useWorkspaceUI.ts` - Hook per adaptive UI
- `hooks/useWorkspace.ts` - Hook gestione workspace
- `lib/database.ts` - Query con workspace join
- `app/api/workspaces/my/route.ts` - Ordinamento workspace

### UI Components

- `components/workspace-switcher.tsx` - Workspace switcher dropdown
- `app/dashboard/spedizioni/page.tsx` - Colonna e filtro workspace
- `app/dashboard/team/page.tsx` - Bottone elimina
- `components/dashboard-sidebar.tsx` - Menu nascosti per client + switcher integration

### Actions

- `actions/admin.ts` - `deleteSubAdmin()` function

---

## Workspace Switcher

### Overview

Componente dropdown ispirato a Slack/Linear per switchare tra workspace. Il reseller puo navigare nei workspace dei propri clienti per operare per loro conto.

**File:** `components/workspace-switcher.tsx`

### Funzionalita (Enterprise-Level Redesign v2.0)

| Funzione         | Descrizione                                           |
| ---------------- | ----------------------------------------------------- |
| Switch workspace | Dropdown enterprise con lista workspace accessibili   |
| Raggruppamento   | "Il mio workspace" vs "Workspace clienti"             |
| Avatar iniziali  | Violet (platform), blue (reseller), emerald (client)  |
| Badge tipo       | Con ring-1, colore per tipo e admin override          |
| Ricerca          | Search bar con 5+ workspace (SEARCH_THRESHOLD = 5)    |
| Keyboard nav     | ArrowDown/Up wrap-around, Enter, Escape               |
| Contesto         | "Workspace cliente" + bottone "Torna a mio workspace" |
| Saldo wallet     | Footer dropdown + trigger mostrano saldo corrente     |
| Loading skeleton | Skeleton animato durante caricamento                  |

### Architettura UX: Posizione Unica per Switch

**Principio:** Un solo punto di switch, nessuna duplicazione.

| Componente                    | Ruolo                                          |
| ----------------------------- | ---------------------------------------------- |
| Dashboard Context Bar         | Posizione autorevole per switch + saldo wallet |
| Sidebar (indicatore compatto) | Solo visualizzazione passiva (avatar + nome)   |

La context bar nel dashboard (`app/dashboard/page.tsx`) contiene:

- **Sinistra:** `<WorkspaceSwitcher />` interattivo
- **Destra:** Saldo wallet del workspace corrente

La sidebar (`components/dashboard-sidebar.tsx`) mostra solo un indicatore compatto statico (non cliccabile) con avatar colorato, nome workspace e organizzazione.

### Sicurezza

- Lo switch avviene via API server-side (verifica membership)
- Cookie httpOnly impostato dal server
- Il client mostra solo workspace a cui l'utente ha accesso

### UX Reseller → Client

Quando un reseller entra in un workspace client:

1. Testo subtitle cambia in "Workspace cliente"
2. Appare bottone "Torna a [nome workspace reseller]"
3. Safety indicators si attivano (vedi sezione dedicata)
4. Tutta la dashboard mostra i dati del workspace client

### Safety Indicators (Workspace Altrui)

Quando superadmin o reseller opera in un workspace non proprio, il sistema attiva **3 indicatori visivi impossibili da ignorare** per evitare operazioni accidentali:

| Indicatore              | Posizione                    | Descrizione                                                              |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| Banner amber sticky     | Sopra i breadcrumbs (navbar) | "Stai operando nel workspace: [nome]" + bottone "Torna al mio workspace" |
| Bordo sidebar 4px amber | Bordo destro sidebar         | Da `border-r border-gray-200` a `border-r-4 border-amber-400`            |
| Header sidebar amber    | Intestazione sidebar (logo)  | Sfondo amber + testo "WS: [nome workspace]" al posto di "Super Admin"    |

**Logica di rilevamento** (usata in `dashboard-nav.tsx` e `dashboard-sidebar.tsx`):

```typescript
const isInForeignWorkspace = workspace?.role !== 'owner' && workspace?.workspace_type !== undefined;
```

**File:** `components/dashboard-nav.tsx`, `components/dashboard-sidebar.tsx`
**Test:** `tests/unit/workspace-safety-banner.test.ts` (12 test)

### Integrazione Dashboard

**Context Bar:** `app/dashboard/page.tsx` — Workspace switcher interattivo + saldo wallet

**Sidebar:** `components/dashboard-sidebar.tsx` — Indicatore compatto statico (avatar + nome + org, non interattivo). La sidebar adatta i menu in base al workspace corrente tramite `useWorkspaceUI()`.

---

## Team Invite System

### Overview

Il sistema di invito membri permette a owner/admin di invitare nuovi utenti nel workspace via email. L'invito crea un token crittografico con scadenza 7 giorni.

**Pagina:** `/dashboard/workspace/team`
**API:** `app/api/workspaces/[workspaceId]/invite/route.ts`
**Wizard:** `components/team-setup-wizard.tsx`

### Flusso Invito

1. Owner/admin apre pagina Team → wizard appare automaticamente se e' solo nel workspace
2. Compila email + ruolo (operator/admin/viewer) → submit
3. API crea record in `workspace_invitations` con token crypto-random
4. Email inviata via Resend con link di accettazione
5. Wizard mostra risultato: "Invito Inviato!" o "Invito Creato!" (se email fallisce)
6. Destinatario clicca link → accettazione via `/api/invite/[token]`
7. Invitante riceve email di conferma accettazione

### Wizard Dual Mode

| Modalita | Trigger                             | Step iniziale             | Back button |
| -------- | ----------------------------------- | ------------------------- | ----------- |
| Welcome  | Auto (owner solo, 0 inviti pending) | welcome → invite → result | Visibile    |
| Invite   | Click bottone "Invita Membro"       | invite → result           | Nascosto    |

### Email Template Invito

**File:** `lib/email/resend.ts` → `sendWorkspaceInvitationEmail()`

Design email-safe (no CSS gradient, no box-shadow):

- Header bianco con logo `logo-email.jpg` (7KB, ottimizzato da 5.5MB)
- Preheader text per anteprima inbox Gmail/Outlook
- Card dettagli: organizzazione, workspace, ruolo (chip style)
- CTA button table-based (bulletproof per Outlook): "ACCETTA INVITO"
- Alert scadenza con border-left accent
- MSO conditional comments per Outlook desktop

**Logo email:** `public/brand/logo/logo-email.jpg` — 440x115px, 7KB

### Feedback Email Fallita

Se Resend non riesce a inviare l'email (es. rate limit), il wizard mostra:

- Titolo "Invito Creato!" (invece di "Invito Inviato!")
- Warning amber con istruzioni per condivisione link manuale
- Link copiabile sempre presente

**Logica parsing:** `const emailSent = data.email_sent !== false;`

### Test

| File                                   | Descrizione            | N. Test |
| -------------------------------------- | ---------------------- | ------- |
| `tests/unit/team-setup-wizard.test.ts` | Wizard logica completa | 42      |

---

## Pattern di Riferimento

Questa implementazione segue i pattern di:

1. **Stripe Connect Dashboard** - UI differenziata per platform/connected accounts
2. **Shopify Partner Dashboard** - Gestione multi-store con viste adattive
3. **HubSpot Partner Portal** - Gerarchia agency/client con permessi granulari
4. **Slack/Linear** - Workspace switcher UX

---

## Changelog

| Data       | Versione | Descrizione                                                       |
| ---------- | -------- | ----------------------------------------------------------------- |
| 2026-02-21 | 3.0.0    | Team invite system: wizard, email template, audit fix             |
| 2026-02-10 | 2.0.0    | Enterprise switcher: avatar, search, keyboard nav, context bar    |
| 2026-02-10 | 2.0.1    | Cleanup: rimozione duplicazioni, Doctor AI fake, metriche inutili |
| 2026-02-10 | 1.2.0    | Safety indicators: banner, bordo sidebar, header amber            |
| 2026-02-09 | 1.1.0    | Workspace Switcher + reseller child workspace nav                 |
| 2026-02-05 | 1.0.0    | Adaptive UI + Delete sub-admin + Ordering                         |
