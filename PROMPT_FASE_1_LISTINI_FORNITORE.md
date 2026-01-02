# 🚀 PROMPT FASE 1: Database & Types - Listini Fornitore

**Copia e incolla questo prompt in una nuova chat Cursor per iniziare la Fase 1**

---

```
Ciao! Sto implementando il sistema Listini Fornitore per Reseller e BYOC.

## 📊 CONTESTO

Sto lavorando sul progetto **SpedireSicuro.it** (Next.js 14, TypeScript, Supabase).
Sto implementando la gestione listini fornitore come descritto in:
- `ANALISI_LISTINI_COMPLETA.md` (analisi completa permessi)
- `IMPLEMENTAZIONE_LISTINI_FORNITORE.md` (piano di implementazione)

## 🎯 OBIETTIVO FASE 1: Database & Types

**Preparare struttura database e types TypeScript per supportare listini fornitore.**

### Task da completare:

1. ✅ **Creare migration SQL** per aggiungere campo `list_type` a `price_lists`
2. ✅ **Aggiornare TypeScript types** in `types/listini.ts`
3. ✅ **Creare funzione helper** `getAvailableCouriersForUser()` in `lib/db/price-lists.ts`

---

## 📝 DETTAGLI IMPLEMENTAZIONE

### 1. Migration SQL: `supabase/migrations/056_add_list_type.sql`

**Obiettivo**: Aggiungere campo `list_type` alla tabella `price_lists`

**Requisiti:**
- Campo `list_type` (TEXT) con CHECK constraint: `'supplier' | 'custom' | 'global'`
- Campo nullable per retrocompatibilità (listini esistenti)
- Default: `NULL` (listini esistenti rimangono NULL)
- Indice per performance: `idx_price_lists_list_type`
- Commento: "Tipo listino: supplier (fornitore), custom (personalizzato), global (globale)"

**Valori:**
- `'supplier'`: Listino fornitore (Reseller/BYOC) - prezzi base corriere senza margine
- `'custom'`: Listino personalizzato (Reseller per sub-users) - prezzi con margine
- `'global'`: Listino globale (Super Admin) - prezzi base standard sistema

**Esempio struttura:**
```sql
-- Aggiungi campo list_type
ALTER TABLE price_lists 
ADD COLUMN IF NOT EXISTS list_type TEXT 
CHECK (list_type IN ('supplier', 'custom', 'global'));

-- Indice per performance
CREATE INDEX IF NOT EXISTS idx_price_lists_list_type 
ON price_lists(list_type) 
WHERE list_type IS NOT NULL;

-- Commento
COMMENT ON COLUMN price_lists.list_type IS 
'Tipo listino: supplier (fornitore Reseller/BYOC), custom (personalizzato Reseller), global (globale Super Admin)';
```

**Note:**
- Usa `IF NOT EXISTS` per idempotenza
- Campo nullable per non rompere listini esistenti
- Migration deve essere idempotente (eseguibile più volte)

---

### 2. Aggiornare TypeScript Types: `types/listini.ts`

**Obiettivo**: Aggiungere `list_type` ai types TypeScript

**File da modificare:** `types/listini.ts`

**Modifiche:**
- Aggiungere `list_type?: 'supplier' | 'custom' | 'global'` a:
  - `PriceList` interface
  - `CreatePriceListInput` interface
  - `UpdatePriceListInput` interface

**Esempio:**
```typescript
export interface PriceList {
  // ... campi esistenti ...
  list_type?: 'supplier' | 'custom' | 'global'; // Nuovo campo
  // ... altri campi ...
}

export interface CreatePriceListInput {
  // ... campi esistenti ...
  list_type?: 'supplier' | 'custom' | 'global'; // Nuovo campo
  // ... altri campi ...
}
```

**Note:**
- Campo opzionale (`?`) per retrocompatibilità
- Type union string literal per type safety

---

### 3. Funzione Helper: `getAvailableCouriersForUser()`

**Obiettivo**: Creare funzione per recuperare corrieri disponibili per un utente

**File da modificare:** `lib/db/price-lists.ts`

**Funzione da creare:**
```typescript
/**
 * Recupera corrieri disponibili per un utente
 * 
 * Basato su:
 * 1. Configurazioni API (courier_configs) con owner_user_id = userId
 * 2. contract_mapping JSONB per estrarre corrieri (GLS, BRT, SDA, ecc.)
 * 
 * @param userId - ID utente
 * @returns Array di oggetti { courierId: string, courierName: string, providerId: string }
 */
export async function getAvailableCouriersForUser(
  userId: string
): Promise<Array<{ courierId: string; courierName: string; providerId: string }>>
```

**Logica:**
1. Recuperare configurazioni API con `owner_user_id = userId` da `courier_configs`
2. Per ogni configurazione:
   - Estrarre `contract_mapping` (JSONB)
   - Le chiavi del mapping sono i corrieri (es: `{"GLS": "CODE123", "BRT": "CODE456"}`)
   - Per Spedisci.Online, i corrieri sono le chiavi del `contract_mapping`
3. Restituire array unico di corrieri con:
   - `courierId`: ID corriere (da tabella `couriers` se esiste, altrimenti nome)
   - `courierName`: Nome corriere (es: "GLS", "BRT", "SDA")
   - `providerId`: ID provider (es: "spedisci_online")

**Esempio implementazione:**
```typescript
export async function getAvailableCouriersForUser(
  userId: string
): Promise<Array<{ courierId: string; courierName: string; providerId: string }>> {
  try {
    // 1. Recupera configurazioni API dell'utente
    const { data: configs, error } = await supabaseAdmin
      .from('courier_configs')
      .select('id, provider_id, contract_mapping')
      .eq('owner_user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Errore recupero configurazioni:', error);
      return [];
    }

    if (!configs || configs.length === 0) {
      return [];
    }

    // 2. Estrai corrieri da contract_mapping
    const couriersMap = new Map<string, { courierName: string; providerId: string }>();

    for (const config of configs) {
      const contractMapping = config.contract_mapping as Record<string, string> || {};
      const providerId = config.provider_id;

      // Le chiavi del mapping sono i corrieri
      for (const [courierName, contractCode] of Object.entries(contractMapping)) {
        if (!couriersMap.has(courierName)) {
          couriersMap.set(courierName, {
            courierName,
            providerId,
          });
        }
      }
    }

    // 3. Converti in array e prova a recuperare courier_id da tabella couriers
    const result = [];
    for (const [courierName, data] of couriersMap.entries()) {
      // Prova a trovare courier_id nella tabella couriers
      const { data: courier } = await supabaseAdmin
        .from('couriers')
        .select('id, name')
        .ilike('name', `%${courierName}%`)
        .limit(1)
        .maybeSingle();

      result.push({
        courierId: courier?.id || courierName, // Fallback a nome se non trovato
        courierName,
        providerId: data.providerId,
      });
    }

    return result;
  } catch (error: any) {
    console.error('Errore getAvailableCouriersForUser:', error);
    return [];
  }
}
```

**Note:**
- Usa `supabaseAdmin` per bypassare RLS
- Gestisci errori gracefully (ritorna array vuoto)
- Supporta multi-provider (non solo Spedisci.Online)
- Prova a matchare con tabella `couriers` per ottenere UUID

---

## ✅ VALIDAZIONE

Dopo aver completato i task, verifica:

1. **Migration SQL:**
   - ✅ Migration eseguita correttamente (nessun errore)
   - ✅ Campo `list_type` presente in `price_lists`
   - ✅ CHECK constraint funziona (prova inserire valore non valido → errore)
   - ✅ Indice creato correttamente

2. **TypeScript Types:**
   - ✅ Types compilano senza errori (`npm run build` o `tsc --noEmit`)
   - ✅ Campo `list_type` disponibile in `PriceList`, `CreatePriceListInput`, `UpdatePriceListInput`
   - ✅ Type safety: solo valori `'supplier' | 'custom' | 'global'` accettati

3. **Funzione Helper:**
   - ✅ Funzione esportata correttamente
   - ✅ Test manuale: chiamare con userId valido
   - ✅ Restituisce array di corrieri corretti
   - ✅ Gestisce errori gracefully (array vuoto se errore)

---

## 📚 DOCUMENTAZIONE

Dopo aver completato, aggiorna:

1. **`IMPLEMENTAZIONE_LISTINI_FORNITORE.md`**
   - Spunta task completati nella sezione FASE 1
   - Aggiungi note tecniche se necessario

2. **TODO List**
   - Spunta i TODO completati:
     - `phase1-db` ✅
     - `phase1-types` ✅
     - `phase1-helper` ✅

---

## 🚀 FINALIZZAZIONE

**Al termine della Fase 1:**

1. ✅ Verifica che tutto compili (`npm run build`)
2. ✅ Testa manualmente la funzione helper
3. ✅ Aggiorna documentazione (`IMPLEMENTAZIONE_LISTINI_FORNITORE.md`)
4. ✅ Spunta TODO completati
5. ✅ **Commit e push:**
   ```bash
   git add .
   git commit -m "feat: Fase 1 - Database & Types per Listini Fornitore

   - Aggiunto campo list_type a price_lists (migration 056)
   - Aggiornati TypeScript types per list_type
   - Creata funzione helper getAvailableCouriersForUser()

   Preparazione struttura per sistema listini fornitore isolati
   per Reseller e BYOC."
   git push origin master
   ```

---

## ❓ DOMANDE/CHIARIMENTI

Se qualcosa non è chiaro o hai bisogno di chiarimenti, chiedi pure!

**Riferimenti:**
- `ANALISI_LISTINI_COMPLETA.md` - Analisi completa permessi
- `IMPLEMENTAZIONE_LISTINI_FORNITORE.md` - Piano completo implementazione
- `supabase/migrations/020_advanced_price_lists_system.sql` - Migration esistente listini

---

**Inizia con la migration SQL, poi types, poi funzione helper. Buon lavoro! 🚀**
```

---

**Prompt creato e pronto per essere incollato in una nuova chat Cursor!**

