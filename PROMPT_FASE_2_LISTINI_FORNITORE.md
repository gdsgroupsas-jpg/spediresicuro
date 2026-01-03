# 🚀 PROMPT FASE 2: Backend Logic - Listini Fornitore

**Copia e incolla questo prompt in una nuova chat Cursor per iniziare la Fase 2**

---

````
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

## 🎯 OBIETTIVO FASE 2: Backend Logic (Server Actions & RLS)

**Aggiornare logica backend per supportare listini fornitore isolati per Reseller e BYOC.**

### Task da completare:

1. ✅ **Aggiornare `createPriceListAction`** per permettere BYOC di creare listini fornitore
2. ✅ **Aggiornare `updatePriceListAction`** per verificare `assigned_to_user_id` e supportare listini fornitore
3. ✅ **Aggiornare `deletePriceListAction`** per permettere eliminazione listini fornitore
4. ✅ **Aggiornare `listPriceListsAction`** per filtrare listini globali (Reseller/BYOC vedono solo i propri)
5. ✅ **Creare migration SQL** per aggiornare RLS Policies per isolare listini fornitore
6. ✅ **Creare Server Actions specifiche** per listini fornitore:
   - `createSupplierPriceListAction()`
   - `listSupplierPriceListsAction()`
   - `getSupplierPriceListForCourierAction(courierId)`

---

## 📝 DETTAGLI IMPLEMENTAZIONE

### 1. Aggiornare `createPriceListAction` in `actions/price-lists.ts`

**Obiettivo**: Permettere BYOC di creare listini fornitore (`list_type = 'supplier'`)

**Modifiche necessarie:**

1. **Aggiungere verifica account_type BYOC:**
   ```typescript
   const isBYOC = user.account_type === 'byoc'
````

2. **Permettere BYOC di creare listini fornitore:**

   ```typescript
   // Prima: Solo admin e reseller
   if (!isAdmin && !isReseller) {
     return {
       success: false,
       error: "Solo admin e reseller possono creare listini",
     };
   }

   // Dopo: Admin, reseller E BYOC
   if (!isAdmin && !isReseller && !isBYOC) {
     return {
       success: false,
       error: "Solo admin, reseller e BYOC possono creare listini",
     };
   }
   ```

3. **Validare list_type per BYOC:**

   - BYOC può creare SOLO listini fornitore (`list_type = 'supplier'`)
   - BYOC NON può creare listini personalizzati (`list_type = 'custom'`)
   - BYOC NON può creare listini globali (`list_type = 'global'`)

4. **Impostare automaticamente `list_type` se non specificato:**
   - Se `list_type` non è specificato e utente è Reseller/BYOC → `list_type = 'supplier'`
   - Se `list_type` non è specificato e utente è Admin → `list_type = 'global'` (se `is_global = true`)

**Esempio logica:**

```typescript
// Se list_type non specificato, imposta default basato su utente
if (!data.list_type) {
  if (isAdmin && data.is_global) {
    data.list_type = "global";
  } else if (isReseller || isBYOC) {
    data.list_type = "supplier";
  }
}

// Validazione per BYOC
if (isBYOC && data.list_type !== "supplier") {
  return {
    success: false,
    error: "BYOC può creare solo listini fornitore (list_type = supplier)",
  };
}
```

---

### 2. Aggiornare `updatePriceListAction` in `actions/price-lists.ts`

**Obiettivo**: Permettere modifica listini fornitore e verificare `assigned_to_user_id`

**Modifiche necessarie:**

1. **Aggiungere verifica `assigned_to_user_id`:**

   ```typescript
   // Recupera listino esistente
   const existingPriceList = await getPriceListById(id);
   if (!existingPriceList) {
     return { success: false, error: "Listino non trovato" };
   }

   // Verifica permessi: admin, creatore, O proprietario (assigned_to_user_id)
   const isAdmin =
     user.account_type === "admin" || user.account_type === "superadmin";
   const isOwner = existingPriceList.created_by === user.id;
   const isAssignedOwner = existingPriceList.assigned_to_user_id === user.id;

   if (!isAdmin && !isOwner && !isAssignedOwner) {
     return {
       success: false,
       error: "Non hai i permessi per modificare questo listino",
     };
   }
   ```

2. **Validare che BYOC non possa cambiare `list_type`:**

   ```typescript
   const isBYOC = user.account_type === "byoc";
   if (isBYOC && data.list_type && data.list_type !== "supplier") {
     return {
       success: false,
       error: "BYOC può modificare solo listini fornitore",
     };
   }
   ```

3. **Validare che Reseller non possa cambiare `list_type` a 'global':**
   ```typescript
   const isReseller = user.is_reseller === true;
   if (isReseller && data.list_type === "global") {
     return {
       success: false,
       error: "Reseller non può creare listini globali",
     };
   }
   ```

---

### 3. Aggiornare `deletePriceListAction` in `actions/price-lists.ts`

**Obiettivo**: Permettere eliminazione listini fornitore

**Modifiche necessarie:**

1. **Aggiungere verifica `assigned_to_user_id`:**

   ```typescript
   // Recupera listino esistente
   const existingPriceList = await getPriceListById(id);
   if (!existingPriceList) {
     return { success: false, error: "Listino non trovato" };
   }

   // Verifica permessi: admin, creatore, O proprietario (assigned_to_user_id)
   const isAdmin =
     user.account_type === "admin" || user.account_type === "superadmin";
   const isOwner = existingPriceList.created_by === user.id;
   const isAssignedOwner = existingPriceList.assigned_to_user_id === user.id;

   if (!isAdmin && !isOwner && !isAssignedOwner) {
     return {
       success: false,
       error: "Non hai i permessi per eliminare questo listino",
     };
   }
   ```

2. **Validare che BYOC possa eliminare solo listini fornitore:**
   ```typescript
   const isBYOC = user.account_type === "byoc";
   if (isBYOC && existingPriceList.list_type !== "supplier") {
     return {
       success: false,
       error: "BYOC può eliminare solo listini fornitore",
     };
   }
   ```

---

### 4. Aggiornare `listPriceListsAction` in `actions/price-lists.ts`

**Obiettivo**: Reseller/BYOC NON vedono listini globali, vedono solo i propri listini fornitore

**Modifiche necessarie:**

1. **Filtrare listini globali per Reseller/BYOC:**

   ```typescript
   const isAdmin =
     user.account_type === "admin" || user.account_type === "superadmin";
   const isReseller = user.is_reseller === true;
   const isBYOC = user.account_type === "byoc";

   if (!isAdmin) {
     // Reseller e BYOC vedono SOLO i propri listini fornitore e personalizzati
     // NON vedono listini globali
     query = query.or(`
       and(list_type.eq.supplier,created_by.eq.${user.id}),
       and(list_type.eq.custom,created_by.eq.${user.id}),
       and(list_type.eq.custom,assigned_to_user_id.eq.${user.id})
     `);
   }
   ```

2. **Admin vede tutto (comportamento invariato)**

**Logica:**

- **Super Admin/Admin**: Vede tutti i listini (nessun filtro)
- **Reseller**: Vede solo:
  - Listini fornitore creati da lui (`list_type = 'supplier' AND created_by = userId`)
  - Listini personalizzati creati da lui (`list_type = 'custom' AND created_by = userId`)
  - Listini personalizzati assegnati a lui (`list_type = 'custom' AND assigned_to_user_id = userId`)
- **BYOC**: Vede solo:
  - Listini fornitore creati da lui (`list_type = 'supplier' AND created_by = userId`)

---

### 5. Creare Migration SQL: `supabase/migrations/057_update_rls_listini_fornitore.sql`

**Obiettivo**: Aggiornare RLS Policies per isolare listini fornitore

**Modifiche necessarie:**

1. **Aggiornare SELECT Policy:**

   ```sql
   -- Elimina policy esistente
   DROP POLICY IF EXISTS price_lists_select ON price_lists;

   -- Crea nuova policy con supporto list_type
   CREATE POLICY price_lists_select ON price_lists
     FOR SELECT USING (
       -- Super Admin vede tutto
       EXISTS (
         SELECT 1 FROM users
         WHERE users.id = auth.uid()::text::uuid
         AND users.account_type = 'superadmin'
       )
       OR
       -- Listini globali visibili a tutti (ma Reseller/BYOC li filtrano nella Server Action)
       (is_global = true AND list_type = 'global')
       OR
       -- Listini fornitore creati dall'utente
       (list_type = 'supplier' AND created_by = auth.uid()::text::uuid)
       OR
       -- Listini personalizzati creati dall'utente
       (list_type = 'custom' AND created_by = auth.uid()::text::uuid)
       OR
       -- Listini personalizzati assegnati all'utente
       (list_type = 'custom' AND assigned_to_user_id = auth.uid()::text::uuid)
       OR
       -- Listini assegnati all'utente (retrocompatibilità)
       (assigned_to_user_id = auth.uid()::text::uuid)
       OR
       -- Listini creati dall'utente (retrocompatibilità)
       (created_by = auth.uid()::text::uuid)
       OR
       -- Listini di default (retrocompatibilità)
       (priority = 'default')
     );
   ```

2. **Aggiornare INSERT Policy:**

   ```sql
   -- Elimina policy esistente
   DROP POLICY IF EXISTS price_lists_insert ON price_lists;

   -- Crea nuova policy con supporto BYOC
   CREATE POLICY price_lists_insert ON price_lists
     FOR INSERT WITH CHECK (
       -- Admin/Super Admin
       EXISTS (
         SELECT 1 FROM users
         WHERE users.id = auth.uid()::text::uuid
         AND users.account_type IN ('admin', 'superadmin')
       )
       OR
       -- Reseller
       EXISTS (
         SELECT 1 FROM users
         WHERE users.id = auth.uid()::text::uuid
         AND users.is_reseller = true
       )
       OR
       -- BYOC (può creare solo listini fornitore)
       (
         EXISTS (
           SELECT 1 FROM users
           WHERE users.id = auth.uid()::text::uuid
           AND users.account_type = 'byoc'
         )
         AND list_type = 'supplier'
         AND is_global = false
       )
       OR
       -- Utente può creare listino per se stesso
       (assigned_to_user_id = auth.uid()::text::uuid AND is_global = false)
     );
   ```

3. **Aggiornare UPDATE Policy:**

   ```sql
   -- Elimina policy esistente
   DROP POLICY IF EXISTS price_lists_update ON price_lists;

   -- Crea nuova policy con supporto assigned_to_user_id
   CREATE POLICY price_lists_update ON price_lists
     FOR UPDATE USING (
       -- Admin/Super Admin
       EXISTS (
         SELECT 1 FROM users
         WHERE users.id = auth.uid()::text::uuid
         AND users.account_type IN ('admin', 'superadmin')
       )
       OR
       -- Creatore
       created_by = auth.uid()::text::uuid
       OR
       -- Proprietario (assigned_to_user_id)
       assigned_to_user_id = auth.uid()::text::uuid
     );
   ```

4. **Aggiornare DELETE Policy:**

   ```sql
   -- Elimina policy esistente
   DROP POLICY IF EXISTS price_lists_delete ON price_lists;

   -- Crea nuova policy con supporto assigned_to_user_id
   CREATE POLICY price_lists_delete ON price_lists
     FOR DELETE USING (
       -- Admin/Super Admin
       EXISTS (
         SELECT 1 FROM users
         WHERE users.id = auth.uid()::text::uuid
         AND users.account_type IN ('admin', 'superadmin')
       )
       OR
       -- Creatore
       created_by = auth.uid()::text::uuid
       OR
       -- Proprietario (assigned_to_user_id)
       assigned_to_user_id = auth.uid()::text::uuid
     );
   ```

**Note:**

- Migration deve essere idempotente (usa `DROP POLICY IF EXISTS`)
- Mantieni retrocompatibilità con listini esistenti (senza `list_type`)

---

### 6. Creare Server Actions Specifiche in `actions/price-lists.ts`

**Obiettivo**: Creare funzioni dedicate per gestione listini fornitore

#### 6.1. `createSupplierPriceListAction()`

```typescript
/**
 * Crea listino fornitore per Reseller/BYOC
 *
 * @param data - Dati listino (courier_id obbligatorio per listini fornitore)
 * @returns Listino creato
 */
export async function createSupplierPriceListAction(
  data: Omit<CreatePriceListInput, "list_type" | "is_global"> & {
    courier_id: string;
  }
): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: "Solo Reseller e BYOC possono creare listini fornitore",
      };
    }

    // Imposta automaticamente list_type = 'supplier'
    const priceListData: CreatePriceListInput = {
      ...data,
      list_type: "supplier",
      is_global: false,
    };

    const priceList = await createPriceList(priceListData, user.id);

    return { success: true, priceList };
  } catch (error: any) {
    console.error("Errore creazione listino fornitore:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}
```

#### 6.2. `listSupplierPriceListsAction()`

```typescript
/**
 * Lista listini fornitore dell'utente corrente
 *
 * @returns Array di listini fornitore
 */
export async function listSupplierPriceListsAction(): Promise<{
  success: boolean;
  priceLists?: any[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: "Solo Reseller e BYOC possono vedere listini fornitore",
      };
    }

    // Recupera solo listini fornitore dell'utente
    const { data: priceLists, error } = await supabaseAdmin
      .from("price_lists")
      .select("*, courier:couriers(*)")
      .eq("list_type", "supplier")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Errore recupero listini fornitore:", error);
      return { success: false, error: error.message };
    }

    return { success: true, priceLists: priceLists || [] };
  } catch (error: any) {
    console.error("Errore listino fornitore:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}
```

#### 6.3. `getSupplierPriceListForCourierAction(courierId)`

```typescript
/**
 * Recupera listino fornitore per un corriere specifico
 *
 * @param courierId - ID corriere
 * @returns Listino fornitore o null
 */
export async function getSupplierPriceListForCourierAction(
  courierId: string
): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: "Solo Reseller e BYOC possono vedere listini fornitore",
      };
    }

    // Recupera listino fornitore per corriere
    const { data: priceList, error } = await supabaseAdmin
      .from("price_lists")
      .select("*, courier:couriers(*)")
      .eq("list_type", "supplier")
      .eq("courier_id", courierId)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Errore recupero listino fornitore:", error);
      return { success: false, error: error.message };
    }

    return { success: true, priceList: priceList || null };
  } catch (error: any) {
    console.error("Errore listino fornitore:", error);
    return { success: false, error: error.message || "Errore sconosciuto" };
  }
}
```

---

## ✅ VALIDAZIONE

Dopo aver completato i task, verifica:

1. **Server Actions:**

   - ✅ BYOC può creare listini fornitore (`createPriceListAction`)
   - ✅ Reseller può creare listini fornitore e personalizzati
   - ✅ Reseller/BYOC NON vedono listini globali (`listPriceListsAction`)
   - ✅ Funzioni specifiche funzionano correttamente

2. **RLS Policies:**

   - ✅ Migration 057 eseguita correttamente
   - ✅ BYOC può inserire solo listini fornitore
   - ✅ Reseller/BYOC vedono solo i propri listini fornitore
   - ✅ Admin vede tutto

3. **Test Manuali:**
   - ✅ Test creazione listino fornitore (BYOC)
   - ✅ Test creazione listino fornitore (Reseller)
   - ✅ Test modifica listino fornitore
   - ✅ Test eliminazione listino fornitore
   - ✅ Test lista listini (verifica che non ci siano listini globali)

---

## 📚 DOCUMENTAZIONE

Dopo aver completato, aggiorna:

1. **`IMPLEMENTAZIONE_LISTINI_FORNITORE.md`**

   - Spunta task completati nella sezione FASE 2
   - Aggiungi note tecniche se necessario

2. **TODO List**
   - Spunta i TODO completati:
     - `phase2-create-action` ✅
     - `phase2-update-action` ✅
     - `phase2-delete-action` ✅
     - `phase2-list-action` ✅
     - `phase2-rls-migration` ✅
     - `phase2-specific-actions` ✅

---

## 🚀 FINALIZZAZIONE

**Al termine della Fase 2:**

1. ✅ Verifica che tutto compili (`npm run build`)
2. ✅ Testa manualmente tutte le Server Actions
3. ✅ Verifica RLS Policies funzionano correttamente
4. ✅ Aggiorna documentazione (`IMPLEMENTAZIONE_LISTINI_FORNITORE.md`)
5. ✅ Spunta TODO completati
6. ✅ **Commit e push:**

   ```bash
   git add .
   git commit -m "feat: Fase 2 - Backend Logic per Listini Fornitore

   - Aggiornata createPriceListAction per supportare BYOC
   - Aggiornata updatePriceListAction con verifica assigned_to_user_id
   - Aggiornata deletePriceListAction per listini fornitore
   - Aggiornata listPriceListsAction per filtrare listini globali
   - Creata migration 057 per aggiornare RLS Policies
   - Create Server Actions specifiche per listini fornitore

   Reseller e BYOC ora possono gestire i propri listini fornitore isolati."
   git push origin master
   ```

---

## ❓ DOMANDE/CHIARIMENTI

Se qualcosa non è chiaro o hai bisogno di chiarimenti, chiedi pure!

**Riferimenti:**

- `ANALISI_LISTINI_COMPLETA.md` - Analisi completa permessi
- `IMPLEMENTAZIONE_LISTINI_FORNITORE.md` - Piano completo implementazione
- `actions/price-lists.ts` - Server Actions esistenti
- `supabase/migrations/020_advanced_price_lists_system.sql` - RLS Policies esistenti
- `supabase/migrations/056_add_list_type.sql` - Migration Fase 1

---

**Inizia con le modifiche alle Server Actions, poi la migration RLS, poi le funzioni specifiche. Buon lavoro! 🚀**

```

---

**Prompt creato e pronto per essere incollato in una nuova chat Cursor!**

```

