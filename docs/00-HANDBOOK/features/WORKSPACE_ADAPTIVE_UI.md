---
title: Workspace Adaptive UI & Team Management
scope: feature
audience: engineering, product
owner: engineering
status: active
source_of_truth: true
created: 2026-02-05
updated: 2026-02-09
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
| `tests/unit/delete-subadmin.test.ts`                       | Eliminazione sub-admin | 5       |
| `tests/unit/workspace-superadmin-ordering.test.ts`         | Ordinamento workspace  | 5       |
| `tests/integration/workspace-hierarchy-visibility.test.ts` | Visibilita gerarchica  | 13      |

**Totale:** 43 test dedicati

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

### Funzionalita

| Funzione            | Descrizione                                                     |
| ------------------- | --------------------------------------------------------------- |
| Switch workspace    | Dropdown con lista workspace accessibili                        |
| Raggruppamento      | "Il mio workspace" vs "Workspace clienti"                       |
| Badge tipo          | Platform (viola), Reseller (blu), Client (verde), Admin (rosso) |
| Indicatore contesto | Bordo verde + "Operando come cliente" quando in child workspace |
| Torna indietro      | Bottone rapido "Torna a [mio workspace]" quando in child        |
| Saldo wallet        | Footer dropdown mostra saldo wallet del workspace corrente      |
| Compact mode        | Prop `compact` per mostrare solo icona (sidebar collassata)     |
| Keyboard            | Chiudi con Escape, click outside                                |

### Sicurezza

- Lo switch avviene via API server-side (verifica membership)
- Cookie httpOnly impostato dal server
- Il client mostra solo workspace a cui l'utente ha accesso

### UX Reseller → Client

Quando un reseller entra in un workspace client:

1. Icona switcher diventa verde (da arancione)
2. Subtitle cambia in "Operando come cliente"
3. Appare bottone "Torna a [nome workspace reseller]"
4. Bordo verde intorno allo switcher
5. Tutta la dashboard mostra i dati del workspace client

### Integrazione Sidebar

**File:** `components/dashboard-sidebar.tsx`

Lo switcher e posizionato in cima alla sidebar, sopra la navigazione. La sidebar adatta i menu in base al workspace corrente tramite `useWorkspaceUI()`.

---

## Pattern di Riferimento

Questa implementazione segue i pattern di:

1. **Stripe Connect Dashboard** - UI differenziata per platform/connected accounts
2. **Shopify Partner Dashboard** - Gestione multi-store con viste adattive
3. **HubSpot Partner Portal** - Gerarchia agency/client con permessi granulari
4. **Slack/Linear** - Workspace switcher UX

---

## Changelog

| Data       | Versione | Descrizione                                       |
| ---------- | -------- | ------------------------------------------------- |
| 2026-02-09 | 1.1.0    | Workspace Switcher + reseller child workspace nav |
| 2026-02-05 | 1.0.0    | Adaptive UI + Delete sub-admin + Ordering         |
