# Price Lists System - SpedireSicuro

## Overview

Questo documento descrive il sistema avanzato di listini prezzi di SpedireSicuro, che permette di gestire listini master, clonazione per reseller, assegnazioni multi-tenant, e calcolo prezzi gerarchico con fallback automatico.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Conoscenza base di sistemi di pricing
- Comprensione di gerarchie multi-tenant
- Familiarità con PostgreSQL JSONB

## Quick Reference

| Sezione | Pagina | Link |
|---------|--------|------|
| Price Lists Overview | docs/11-FEATURES/PRICE_LISTS.md | [Overview](#overview) |
| Master Lists | docs/11-FEATURES/PRICE_LISTS.md | [Master Lists](#master-price-lists) |
| Clonazione | docs/11-FEATURES/PRICE_LISTS.md | [Clonazione](#clonazione-listini) |
| Assegnazioni | docs/11-FEATURES/PRICE_LISTS.md | [Assegnazioni](#assegnazioni-multi-tenant) |
| Calcolo Prezzi | docs/11-FEATURES/PRICE_LISTS.md | [Calcolo](#calcolo-prezzi-gerarchico) |

## Content

### Price Lists Overview

**Cos'è un Price List:**
Un price list è un set di regole di pricing per un corriere specifico (GLS, Poste, etc.) che definisce:
- Prezzi base per zona/regione
- Margini configurabili (percentuale o fisso)
- Regole avanzate (JSONB) per calcoli complessi
- Versionamento e validità temporale

**Tipi di Price List:**
- **Master/Global:** Listini template globali gestiti da superadmin
- **Custom/Clone:** Listini personalizzati per reseller/BYOC (clonati da master)
- **Supplier:** Listini fornitori (prezzi base corriere)

**Gerarchia Priorità:**
1. Listino personalizzato utente (assigned_price_list_id)
2. Listino assegnato via `price_list_assignments` (N:N)
3. Listino default provider (is_default = true)
4. Listino globale (is_global = true)

---

### Master Price Lists

#### Concetto

I listini master sono template globali creati e gestiti da superadmin. Possono essere clonati per creare versioni personalizzate per reseller/BYOC.

#### Caratteristiche

- **Gestione:** Solo superadmin può creare/modificare master
- **Tracciabilità:** Listini clonati mantengono riferimento a master (`master_list_id`)
- **Versionamento:** Supporto valid_from/valid_until per versioni temporali
- **Regole Avanzate:** Campo `rules` (JSONB) per calcoli complessi

#### Struttura Database

```sql
CREATE TABLE price_lists (
  id UUID PRIMARY KEY,
  courier_id UUID,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- 'draft' | 'active' | 'archived'
  
  -- Gerarchia
  priority TEXT, -- 'global' | 'partner' | 'client' | 'default'
  is_global BOOLEAN DEFAULT false,
  assigned_to_user_id UUID, -- Legacy: assegnazione singola
  list_type TEXT, -- 'supplier' | 'custom' | 'global'
  
  -- Tracciabilità derivazione
  master_list_id UUID, -- ID listino master da cui deriva (NULL = originale)
  
  -- Versionamento
  valid_from DATE,
  valid_until DATE,
  
  -- Sistema regole avanzato
  rules JSONB, -- Array di regole di calcolo
  default_margin_percent NUMERIC(5,2),
  default_margin_fixed NUMERIC(10,2),
  
  -- Sorgente dati
  source_type TEXT, -- 'csv' | 'excel' | 'pdf' | 'manual' | 'api' | 'ocr'
  source_file_url TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);
```

---

### Clonazione Listini

#### Flow Clonazione

1. **SuperAdmin seleziona listino master** da clonare
2. **SuperAdmin clicca "Clona Listino"**
3. **Sistema crea nuovo listino** con:
   - `master_list_id` = ID listino sorgente (tracciabilità)
   - `name` = Nome personalizzato
   - `assigned_to_user_id` = Utente target (opzionale)
   - Copia di tutti i campi (rules, margins, etc.)
4. **Sistema assegna listino clonato** a reseller/BYOC

#### Funzione SQL

**File:** `supabase/migrations/070_master_price_lists_and_assignments.sql`

```sql
CREATE OR REPLACE FUNCTION clone_price_list(
  p_source_id UUID,
  p_new_name TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_overrides JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_new_id UUID;
  v_caller_id UUID;
  v_source_record RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- Verifica autenticazione
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Non autenticato';
  END IF;
  
  -- Verifica permessi (solo superadmin può clonare)
  SELECT EXISTS(
    SELECT 1 FROM users 
    WHERE id = v_caller_id 
    AND account_type = 'superadmin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Non autorizzato: solo superadmin può clonare listini';
  END IF;
  
  -- Recupera listino sorgente
  SELECT * INTO v_source_record FROM price_lists WHERE id = p_source_id;
  
  IF v_source_record IS NULL THEN
    RAISE EXCEPTION 'Listino sorgente non trovato: %', p_source_id;
  END IF;
  
  -- Genera nuovo UUID e inserisci clone
  v_new_id := uuid_generate_v4();
  
  INSERT INTO price_lists (
    id, courier_id, name, version, status,
    master_list_id, -- ✨ Tracciabilità derivazione
    assigned_to_user_id,
    rules, default_margin_percent, default_margin_fixed,
    -- ... altri campi copiati
  )
  VALUES (
    v_new_id,
    v_source_record.courier_id,
    p_new_name,
    v_source_record.version,
    'draft', -- Clone inizia come draft
    p_source_id, -- ✨ Riferimento a master
    p_target_user_id,
    v_source_record.rules,
    v_source_record.default_margin_percent,
    v_source_record.default_margin_fixed,
    -- ... altri campi
  );
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Server Action

**File:** `actions/price-lists.ts`

```typescript
export async function clonePriceListAction(
  input: ClonePriceListInput
): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  const context = await requireSafeAuth();
  
  // Solo superadmin può clonare
  if (context.actor.account_type !== 'superadmin') {
    return { success: false, error: 'Solo superadmin può clonare listini' };
  }
  
  // Usa funzione DB clone_price_list
  const { data: clonedId, error } = await supabaseAdmin.rpc('clone_price_list', {
    p_source_id: input.source_price_list_id,
    p_new_name: input.name,
    p_target_user_id: input.target_user_id || null,
    p_overrides: input.overrides || {},
  });
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  // Recupera listino clonato
  const clonedPriceList = await getPriceListById(clonedId);
  
  return { success: true, priceList: clonedPriceList };
}
```

---

### Assegnazioni Multi-Tenant

#### Problema

Reseller/BYOC hanno bisogno di listini personalizzati, ma un utente può avere multiple assegnazioni (es. listino GLS + listino Poste).

#### Soluzione

Tabella N:N `price_list_assignments` per assegnazioni multiple con isolamento RLS.

#### Struttura Database

```sql
CREATE TABLE price_list_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id), -- SuperAdmin che ha assegnato
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ, -- NULL = attivo
  notes TEXT,
  
  UNIQUE(price_list_id, user_id) WHERE revoked_at IS NULL
);

-- RLS: Utenti vedono solo proprie assegnazioni
CREATE POLICY "price_list_assignments_select" ON price_list_assignments
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND account_type IN ('admin', 'superadmin')
  )
);
```

#### Flow Assegnazione

1. **SuperAdmin seleziona listino** (master o clone)
2. **SuperAdmin seleziona utente** (reseller/BYOC)
3. **Sistema crea assegnazione** in `price_list_assignments`
4. **Utente vede listino** nelle proprie opzioni pricing

#### Server Action

**File:** `actions/price-lists.ts`

```typescript
export async function assignPriceListAction(
  input: AssignPriceListInput
): Promise<{
  success: boolean;
  assignment?: any;
  error?: string;
}> {
  const context = await requireSafeAuth();
  
  // Solo superadmin può assegnare
  if (context.actor.account_type !== 'superadmin') {
    return { success: false, error: 'Solo superadmin può assegnare listini' };
  }
  
  // Verifica che listino esista
  const priceList = await getPriceListById(input.price_list_id);
  if (!priceList) {
    return { success: false, error: 'Listino non trovato' };
  }
  
  // Verifica che utente esista
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', input.user_id)
    .single();
  
  if (!user) {
    return { success: false, error: 'Utente non trovato' };
  }
  
  // Crea assegnazione
  const { data: assignment, error } = await supabaseAdmin
    .from('price_list_assignments')
    .insert({
      price_list_id: input.price_list_id,
      user_id: input.user_id,
      assigned_by: context.actor.id,
      notes: input.notes,
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, assignment };
}
```

#### Revoca Assegnazione

```typescript
export async function revokePriceListAssignment(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const context = await requireSafeAuth();
  
  // Solo superadmin può revocare
  if (context.actor.account_type !== 'superadmin') {
    return { success: false, error: 'Non autorizzato' };
  }
  
  // Soft delete: imposta revoked_at
  const { error } = await supabaseAdmin
    .from('price_list_assignments')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', assignmentId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}
```

---

### Calcolo Prezzi Gerarchico

#### Problema

Sistema deve determinare quale listino usare per calcolare prezzo, con fallback automatico se listino personalizzato non ha entry per zona.

#### Soluzione

Query gerarchica con fallback a listino master.

#### Flow Calcolo

1. **Sistema verifica listino personalizzato utente:**
   - `assigned_price_list_id` su `users` (legacy)
   - `price_list_assignments` per corriere specifico (nuovo)
2. **Se trovato, cerca entry per zona:**
   - Match su `price_list_entries` per zip/province/region
3. **Se non trovato, fallback a listino master:**
   - Usa `master_list_id` per risalire a master
   - Cerca entry in master per stessa zona
4. **Se ancora non trovato, fallback a default:**
   - Listino globale (`is_global = true`)
   - O listino default provider (`is_default = true`)

#### Funzione Calcolo

**File:** `lib/db/price-lists-advanced.ts`

```typescript
export async function calculateBestPriceForReseller(
  userId: string,
  params: {
    weight: number;
    volume?: number;
    destination: {
      zip?: string;
      province?: string;
      region?: string;
      country?: string;
    };
    carrier: string;
  }
): Promise<{
  price: number;
  priceListId: string;
  source: 'custom' | 'master' | 'default';
}> {
  // 1. Carica listini assegnati all'utente
  const { data: assignments } = await supabaseAdmin
    .from('price_list_assignments')
    .select('price_list_id, price_lists(*)')
    .eq('user_id', userId)
    .is('revoked_at', null);
  
  // 2. Filtra per corriere
  const carrierPriceList = assignments?.find(
    (a: any) => a.price_lists?.courier_id === params.carrier
  );
  
  if (carrierPriceList) {
    // 3. Cerca entry in listino personalizzato
    const entry = await findPriceEntry(
      carrierPriceList.price_list_id,
      params.destination
    );
    
    if (entry) {
      return {
        price: calculatePrice(entry, params.weight, params.volume),
        priceListId: carrierPriceList.price_list_id,
        source: 'custom',
      };
    }
    
    // 4. Fallback a master
    const masterId = carrierPriceList.price_lists?.master_list_id;
    if (masterId) {
      const masterEntry = await findPriceEntry(masterId, params.destination);
      if (masterEntry) {
        return {
          price: calculatePrice(masterEntry, params.weight, params.volume),
          priceListId: masterId,
          source: 'master',
        };
      }
    }
  }
  
  // 5. Fallback a default
  const defaultPriceList = await getDefaultPriceList(params.carrier);
  const defaultEntry = await findPriceEntry(
    defaultPriceList.id,
    params.destination
  );
  
  return {
    price: calculatePrice(defaultEntry, params.weight, params.volume),
    priceListId: defaultPriceList.id,
    source: 'default',
  };
}
```

---

### Regole Avanzate (JSONB)

#### Campo `rules`

Il campo `rules` (JSONB) permette di definire regole di calcolo complesse:

```json
{
  "rules": [
    {
      "condition": {
        "weight_min": 0,
        "weight_max": 1,
        "zone": "A"
      },
      "price": 5.50,
      "margin_percent": 10
    },
    {
      "condition": {
        "weight_min": 1,
        "weight_max": 5,
        "zone": "A"
      },
      "price": 8.00,
      "margin_percent": 15
    }
  ]
}
```

#### Calcolo con Regole

```typescript
function calculatePrice(
  entry: PriceListEntry,
  weight: number,
  volume?: number
): number {
  // 1. Applica regole JSONB se presenti
  if (entry.rules) {
    const matchingRule = entry.rules.find((rule: any) => {
      return (
        weight >= rule.condition.weight_min &&
        weight <= rule.condition.weight_max &&
        (rule.condition.zone ? rule.condition.zone === entry.zone : true)
      );
    });
    
    if (matchingRule) {
      const basePrice = matchingRule.price;
      const margin = basePrice * (matchingRule.margin_percent / 100);
      return basePrice + margin;
    }
  }
  
  // 2. Fallback a default margin
  const basePrice = entry.base_price || 0;
  const margin = entry.default_margin_percent
    ? basePrice * (entry.default_margin_percent / 100)
    : entry.default_margin_fixed || 0;
  
  return basePrice + margin;
}
```

---

## Examples

### Clonare Listino Master

```typescript
// Server Action
import { clonePriceListAction } from '@/actions/price-lists';

const result = await clonePriceListAction({
  source_price_list_id: 'master-list-id',
  name: 'Listino Personalizzato Reseller ABC',
  target_user_id: 'reseller-user-id',
  overrides: {
    default_margin_percent: 20, // Override margine
  },
});

if (result.success) {
  console.log(`Listino clonato: ${result.priceList.id}`);
}
```

### Assegnare Listino a Utente

```typescript
// Server Action
import { assignPriceListAction } from '@/actions/price-lists';

const result = await assignPriceListAction({
  price_list_id: 'cloned-list-id',
  user_id: 'reseller-user-id',
  notes: 'Assegnazione per cliente premium',
});

if (result.success) {
  console.log(`Listino assegnato: ${result.assignment.id}`);
}
```

### Calcolare Prezzo per Spedizione

```typescript
// Durante creazione spedizione
import { calculateBestPriceForReseller } from '@/lib/db/price-lists-advanced';

const { price, priceListId, source } = await calculateBestPriceForReseller(
  context.target.id,
  {
    weight: 2.5,
    destination: {
      zip: '20100',
      province: 'MI',
      region: 'Lombardia',
      country: 'IT',
    },
    carrier: 'GLS',
  }
);

console.log(`Prezzo: €${price} (da ${source} listino)`);
```

---

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| Listino non trovato per utente | Verifica assegnazioni in `price_list_assignments`, controlla RLS |
| Fallback a master non funziona | Verifica che `master_list_id` sia impostato correttamente |
| Prezzo calcolato errato | Verifica regole JSONB, controlla zone matching |
| Clonazione fallisce | Verifica permessi superadmin, controlla che listino sorgente esista |
| Assegnazione duplicata | Verifica constraint UNIQUE su `price_list_assignments` |

---

## Related Documentation

- [Database Architecture](../2-ARCHITECTURE/DATABASE.md) - Struttura tabelle price_lists
- [Architecture Overview](../2-ARCHITECTURE/OVERVIEW.md) - Courier Adapter pattern
- [Reseller Hierarchy](RESELLER_HIERARCHY.md) - Gerarchia reseller e pricing

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version - Master lists, Clonazione, Assegnazioni, Calcolo gerarchico | AI Agent |

---
*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Engineering Team*
