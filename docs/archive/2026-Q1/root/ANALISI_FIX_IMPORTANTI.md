# 🔍 Analisi Fix Importanti - File Pre-Esistenti

## ⚠️ FIX CRITICI TROVATI

### 1. **app/actions/fiscal.ts** - Fix Regressione NextAuth

**Priorità:** 🔴 CRITICA  
**Problema:** Usava Supabase Auth invece di NextAuth  
**Fix:**

- Usa `auth()` da NextAuth invece di `supabase.auth.getUser()`
- Usa `getSupabaseUserIdFromEmail()` per mappare email NextAuth → userId Supabase
- Gestisce fallback per ruolo

**Impatto:** Se non committato, autenticazione dashboard finanza non funziona!

---

### 2. **lib/agent/fiscal-data.ts** - Fix Migrazione 105

**Priorità:** 🔴 CRITICA  
**Problema:** Usa colonne vecchie (`deleted_at`) invece di nuove (`deleted`, `total_price`, `courier_cost`, `margin`, `cod_status`)  
**Fix:**

- Cambia da `.is("deleted_at", null)` a `.eq("deleted", false)`
- Aggiunge mapping per colonne fiscali dopo migrazione 105
- Usa `cash_on_delivery_amount` invece di `cash_on_delivery` (boolean → number)
- Parsa correttamente valori numerici

**Impatto:** Se non committato, query fiscali falliscono dopo migrazione 105!

---

### 3. **app/dashboard/finanza/page.tsx** - Fix Hydration Error

**Priorità:** 🟡 ALTA  
**Problema:** Hydration mismatch per formattazione date  
**Fix:**

- Usa `useMemo` per calcolare stats
- Formatta date solo lato client (`typeof window !== 'undefined'`)
- Fallback formato ISO per SSR

**Impatto:** Warning hydration in console, possibile layout shift

---

### 4. **app/dashboard/finanza/\_components/revenue-chart.tsx** - Fix Hydration Error

**Priorità:** 🟡 ALTA  
**Problema:** Hydration mismatch per `Math.random()`  
**Fix:**

- Aggiunge `isMounted` state per renderizzare solo dopo mount
- Usa valori deterministici invece di `Math.random()`
- Aggiunge loading state durante mount

**Impatto:** Warning hydration, grafico potrebbe non renderizzare correttamente

---

### 5. **app/api/couriers/available/route.ts** - Refactoring/Formatting

**Priorità:** 🟢 MEDIA  
**Problema:** Formattazione codice, possibili fix minori  
**Fix:**

- Formattazione codice (quotes, spacing)
- Possibili fix minori non visibili nel diff

**Impatto:** Migliora leggibilità, possibili fix bug minori

---

### 6. **package.json** - Aggiunta Dipendenza `pg`

**Priorità:** 🟡 ALTA  
**Problema:** Dipendenza mancante per PostgreSQL  
**Fix:**

- Aggiunge `pg: ^8.16.3`

**Impatto:** Se non committato, codice che usa `pg` direttamente fallisce

---

## 📊 Riepilogo Priorità

| File                                                  | Priorità   | Tipo            | Deve Essere Committato |
| ----------------------------------------------------- | ---------- | --------------- | ---------------------- |
| `app/actions/fiscal.ts`                               | 🔴 CRITICA | Fix Regressione | ✅ SÌ                  |
| `lib/agent/fiscal-data.ts`                            | 🔴 CRITICA | Fix Migrazione  | ✅ SÌ                  |
| `app/dashboard/finanza/page.tsx`                      | 🟡 ALTA    | Fix Hydration   | ✅ SÌ                  |
| `app/dashboard/finanza/_components/revenue-chart.tsx` | 🟡 ALTA    | Fix Hydration   | ✅ SÌ                  |
| `package.json`                                        | 🟡 ALTA    | Dipendenza      | ✅ SÌ                  |
| `app/api/couriers/available/route.ts`                 | 🟢 MEDIA   | Refactoring     | ⚠️ DA VALUTARE         |

## 🎯 Raccomandazione

**COMMITTARE TUTTI I FIX CRITICI E ALTA PRIORITÀ**

Questi fix sono necessari per:

1. Funzionamento autenticazione (NextAuth)
2. Compatibilità con migrazione 105
3. Eliminazione errori hydration
4. Dipendenze corrette
