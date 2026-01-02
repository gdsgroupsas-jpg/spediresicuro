# 🚀 PROMPT FASE 3: UI - Listini Fornitore

**Copia e incolla questo prompt in una nuova chat Cursor per iniziare la Fase 3**

---

```
Ciao! Sto implementando il sistema Listini Fornitore per Reseller e BYOC.

## 📊 CONTESTO

Sto lavorando sul progetto **SpedireSicuro.it** (Next.js 14, TypeScript, Supabase).
Sto implementando la gestione listini fornitore come descritto in:
- `ANALISI_LISTINI_COMPLETA.md` (analisi completa permessi)
- `IMPLEMENTAZIONE_LISTINI_FORNITORE.md` (piano di implementazione)

## ✅ FASE 1 COMPLETATA

La Fase 1 è stata completata con successo:
- ✅ Migration 056 applicata: campo `list_type` aggiunto a `price_lists`
- ✅ Types TypeScript aggiornati: `list_type` presente in tutte le interfacce
- ✅ Funzione helper `getAvailableCouriersForUser()` creata e testata

## ✅ FASE 2 COMPLETATA

La Fase 2 è stata completata con successo:
- ✅ Migration 056.5 applicata: valore 'byoc' aggiunto all'enum account_type
- ✅ Migration 057 applicata: RLS Policies aggiornate per listini fornitore
- ✅ `createPriceListAction` aggiornata per supportare BYOC
- ✅ `updatePriceListAction` aggiornata con verifica `assigned_to_user_id`
- ✅ `deletePriceListAction` creata per eliminazione listini fornitore
- ✅ `listPriceListsAction` aggiornata per filtrare listini globali
- ✅ Server Actions specifiche create:
  - `createSupplierPriceListAction()`
  - `listSupplierPriceListsAction()`
  - `getSupplierPriceListForCourierAction(courierId)`

## 🎯 OBIETTIVO FASE 3: UI (Interfacce Utente)

**Creare interfacce utente complete per gestione listini fornitore per Reseller e BYOC.**

### Task da completare:

1. ✅ **Creare `/dashboard/reseller/listini-fornitore`** - Pagina per Reseller
2. ✅ **Creare `/dashboard/reseller/listini-personalizzati`** - Pagina per Reseller (listini custom)
3. ✅ **Creare `/dashboard/byoc/listini-fornitore`** - Pagina per BYOC
4. ✅ **Creare componenti riutilizzabili:**
   - `components/listini/supplier-price-list-form.tsx` - Form creazione/modifica listino fornitore
   - `components/listini/supplier-price-list-table.tsx` - Tabella listini fornitore
   - `components/listini/custom-price-list-form.tsx` - Form listini personalizzati (solo Reseller)
5. ✅ **Aggiungere link nel menu dashboard** per Reseller e BYOC
6. ✅ **Testare tutte le funzionalità e validare permessi**

---

## 📝 DETTAGLI IMPLEMENTAZIONE

### 1. Pagina `/dashboard/reseller/listini-fornitore/page.tsx`

**Obiettivo**: Interfaccia per Reseller per gestire i propri listini fornitore

**Funzionalità richieste:**

1. **Lista listini fornitore:**
   - Tabella con tutti i listini fornitore del Reseller
   - Colonne: Nome, Corriere, Versione, Status, Data creazione, Azioni
   - Filtri: per corriere, status
   - Pulsante "Crea nuovo listino fornitore"

2. **Creazione listino fornitore:**
   - Modal/form per creare nuovo listino
   - Campi obbligatori:
     - Nome listino
     - Corriere (select da corrieri disponibili - usa `getAvailableCouriersForUser()`)
     - Versione
     - Status (draft/active)
   - Campi opzionali:
     - Descrizione
     - Note
   - Usa `createSupplierPriceListAction()` per creare

3. **Modifica listino:**
   - Modal/form per modificare listino esistente
   - Usa `updatePriceListAction()` per aggiornare
   - Validazione: solo listini fornitore (`list_type = 'supplier'`)

4. **Eliminazione listino:**
   - Conferma prima di eliminare
   - Usa `deletePriceListAction()` per eliminare

5. **Visualizzazione dettagli:**
   - Link per vedere dettagli listino (redirect a `/dashboard/listini/[id]`)

**Design:**
- Segui lo stile delle altre pagine dashboard (vedi `app/dashboard/fatture/page.tsx` come riferimento)
- Usa Tailwind CSS per styling
- Icone Lucide React (Package, Truck, Plus, Edit, Trash, etc.)
- Loading states e error handling

**Esempio struttura:**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Truck, Plus, Edit, Trash, Search } from 'lucide-react';
import { 
  listSupplierPriceListsAction,
  createSupplierPriceListAction,
  updatePriceListAction,
  deletePriceListAction
} from '@/actions/price-lists';
import { getAvailableCouriersForUser } from '@/lib/db/price-lists';

export default function ResellerListiniFornitorePage() {
  // State management
  // useEffect per caricare listini
  // Funzioni per CRUD operations
  // Render UI
}
```

---

### 2. Pagina `/dashboard/byoc/listini-fornitore/page.tsx`

**Obiettivo**: Interfaccia per BYOC per gestire i propri listini fornitore

**Funzionalità richieste:**

- **Stessa struttura della pagina Reseller** ma semplificata:
  - BYOC può creare SOLO listini fornitore (non listini personalizzati)
  - Non mostra opzioni per listini personalizzati
  - Validazione: BYOC non può cambiare `list_type`

**Differenze rispetto a Reseller:**
- Menu più semplice (solo "Listini Fornitore")
- Nessuna sezione per listini personalizzati
- Messaggi di errore specifici per BYOC

---

### 3. Pagina `/dashboard/reseller/listini-personalizzati/page.tsx`

**Obiettivo**: Interfaccia per Reseller per gestire listini personalizzati per sub-users

**Funzionalità richieste:**

1. **Lista listini personalizzati:**
   - Tabella con listini personalizzati creati dal Reseller
   - Colonne: Nome, Utente assegnato, Versione, Status, Data creazione, Azioni
   - Filtri: per utente assegnato, status

2. **Creazione listino personalizzato:**
   - Modal/form per creare nuovo listino personalizzato
   - Campi obbligatori:
     - Nome listino
     - Utente assegnato (select da sub-users del Reseller)
     - Versione
     - Status
   - Usa `createPriceListAction()` con `list_type = 'custom'`

3. **Modifica/Eliminazione:**
   - Stessa logica della pagina listini fornitore

**Note:**
- Solo Reseller può accedere a questa pagina
- BYOC non ha accesso (non ha sub-users)

---

### 4. Componente `components/listini/supplier-price-list-form.tsx`

**Obiettivo**: Form riutilizzabile per creazione/modifica listino fornitore

**Props:**

```typescript
interface SupplierPriceListFormProps {
  priceList?: PriceList; // Se presente, modalità modifica
  onSuccess: () => void;
  onCancel: () => void;
  availableCouriers: Array<{ courierId: string; courierName: string }>;
}
```

**Funzionalità:**
- Form con validazione
- Select corriere (da `availableCouriers`)
- Campi: nome, versione, status, descrizione, note
- Submit: usa `createSupplierPriceListAction()` o `updatePriceListAction()`
- Error handling e loading states

---

### 5. Componente `components/listini/supplier-price-list-table.tsx`

**Obiettivo**: Tabella riutilizzabile per visualizzare listini fornitore

**Props:**

```typescript
interface SupplierPriceListTableProps {
  priceLists: PriceList[];
  onEdit: (priceList: PriceList) => void;
  onDelete: (priceListId: string) => void;
  onViewDetails: (priceListId: string) => void;
  isLoading?: boolean;
}
```

**Funzionalità:**
- Tabella responsive con colonne: Nome, Corriere, Versione, Status, Data, Azioni
- Badge per status (draft/active/archived)
- Pulsanti azioni: Modifica, Elimina, Dettagli
- Empty state quando non ci sono listini
- Loading skeleton

---

### 6. Componente `components/listini/custom-price-list-form.tsx`

**Obiettivo**: Form per listini personalizzati (solo Reseller)

**Props:**

```typescript
interface CustomPriceListFormProps {
  priceList?: PriceList;
  onSuccess: () => void;
  onCancel: () => void;
  subUsers: Array<{ id: string; email: string; name?: string }>;
}
```

**Funzionalità:**
- Form simile a `supplier-price-list-form` ma con:
  - Select utente assegnato (da `subUsers`)
  - `list_type = 'custom'` automatico
  - Validazione: solo utenti sub-users del Reseller

---

### 7. Aggiungere link nel menu dashboard

**File da modificare:** `components/dashboard-nav.tsx` o equivalente

**Aggiungere:**
- Per Reseller: Link "Listini Fornitore" e "Listini Personalizzati"
- Per BYOC: Link "Listini Fornitore"

**Esempio:**

```typescript
// In dashboard-nav.tsx
{user.is_reseller && (
  <>
    <NavLink href="/dashboard/reseller/listini-fornitore">
      <Package className="w-5 h-5" />
      Listini Fornitore
    </NavLink>
    <NavLink href="/dashboard/reseller/listini-personalizzati">
      <FileText className="w-5 h-5" />
      Listini Personalizzati
    </NavLink>
  </>
)}

{user.account_type === 'byoc' && (
  <NavLink href="/dashboard/byoc/listini-fornitore">
    <Package className="w-5 h-5" />
    Listini Fornitore
  </NavLink>
)}
```

---

## ✅ VALIDAZIONE

Dopo aver completato i task, verifica:

1. **UI Accessibilità:**
   - ✅ Reseller può accedere a `/dashboard/reseller/listini-fornitore`
   - ✅ Reseller può accedere a `/dashboard/reseller/listini-personalizzati`
   - ✅ BYOC può accedere a `/dashboard/byoc/listini-fornitore`
   - ✅ Altri utenti NON possono accedere a queste pagine

2. **Funzionalità:**
   - ✅ Creazione listino fornitore funziona
   - ✅ Modifica listino funziona
   - ✅ Eliminazione listino funziona
   - ✅ Lista listini mostra solo i propri listini
   - ✅ Listini globali NON sono visibili

3. **Permessi:**
   - ✅ BYOC può creare solo listini fornitore
   - ✅ Reseller può creare listini fornitore e personalizzati
   - ✅ Modifica/eliminazione solo per listini propri

4. **UX:**
   - ✅ Loading states presenti
   - ✅ Error handling presente
   - ✅ Messaggi di successo/errore chiari
   - ✅ Design coerente con resto dashboard

---

## 📚 DOCUMENTAZIONE

Dopo aver completato, aggiorna:

1. **`IMPLEMENTAZIONE_LISTINI_FORNITORE.md`**
   - Spunta task completati nella sezione FASE 3
   - Aggiungi note tecniche se necessario

2. **TODO List**
   - Spunta i TODO completati:
     - `phase3-reseller-listini-fornitore` ✅
     - `phase3-reseller-listini-personalizzati` ✅
     - `phase3-byoc-listini-fornitore` ✅
     - `phase3-components` ✅
     - `phase3-menu-links` ✅
     - `phase3-tests` ✅

---

## 🚀 FINALIZZAZIONE

**Al termine della Fase 3:**

1. ✅ Verifica che tutto compili (`npm run build`)
2. ✅ Testa manualmente tutte le pagine
3. ✅ Verifica permessi e isolamento listini
4. ✅ Aggiorna documentazione (`IMPLEMENTAZIONE_LISTINI_FORNITORE.md`)
5. ✅ Spunta TODO completati
6. ✅ **Commit e push:**
   ```bash
   git add .
   git commit -m "feat: Fase 3 - UI per Listini Fornitore

   - Creata pagina /dashboard/reseller/listini-fornitore
   - Creata pagina /dashboard/reseller/listini-personalizzati
   - Creata pagina /dashboard/byoc/listini-fornitore
   - Creati componenti riutilizzabili per form e tabelle
   - Aggiunti link nel menu dashboard
   - Validati permessi e isolamento listini

   Reseller e BYOC ora hanno interfacce complete per gestire i propri listini."
   git push origin master
   ```

---

## ❓ DOMANDE/CHIARIMENTI

Se qualcosa non è chiaro o hai bisogno di chiarimenti, chiedi pure!

**Riferimenti:**
- `ANALISI_LISTINI_COMPLETA.md` - Analisi completa permessi
- `IMPLEMENTAZIONE_LISTINI_FORNITORE.md` - Piano completo implementazione
- `actions/price-lists.ts` - Server Actions disponibili
- `app/dashboard/fatture/page.tsx` - Esempio pagina dashboard
- `app/dashboard/spedizioni/nuova/page.tsx` - Esempio form complesso

---

**Inizia con la pagina Reseller listini fornitore, poi BYOC, poi listini personalizzati. Buon lavoro! 🚀**
```

---

**Prompt creato e pronto per essere incollato in una nuova chat Cursor!**

