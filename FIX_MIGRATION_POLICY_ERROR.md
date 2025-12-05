# 🔧 Fix Errore Migration: Policy Già Esistente

**Data Creazione:** 2025-12-03  
**Versione:** 1.0

---

## ❌ ERRORE

```
ERROR: 42710: policy "Admin può vedere tutte le configurazioni" 
for table "courier_configs" already exists
```

---

## ✅ SOLUZIONE

Ho aggiornato la migration `010_courier_configs_system.sql` per gestire policy esistenti.

**Cosa ho fatto:**
- Aggiunto `DROP POLICY IF EXISTS` prima di ogni `CREATE POLICY`
- Ora la migration può essere eseguita anche se le policy esistono già

---

## 🔄 COSA FARE ORA

### **Opzione 1: Esegui Migration Aggiornata** (Consigliato)

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri file `supabase/migrations/010_courier_configs_system.sql`
3. Copia tutto il contenuto (ora include DROP POLICY IF EXISTS)
4. Incolla in SQL Editor
5. Clicca **"Run"**

**Ora funzionerà anche se le policy esistono già!**

### **Opzione 2: Rimuovi Policy Manualmente** (Alternativa)

Se preferisci, puoi rimuovere le policy manualmente prima:

```sql
-- Rimuovi policy esistenti
DROP POLICY IF EXISTS "Admin può vedere tutte le configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può inserire configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può aggiornare configurazioni" ON public.courier_configs;
DROP POLICY IF EXISTS "Admin può eliminare configurazioni" ON public.courier_configs;
```

Poi esegui la migration normalmente.

---

## ✅ VERIFICA

Dopo aver eseguito la migration, verifica:

```sql
-- Verifica che le policy esistano
SELECT policyname, tablename 
FROM pg_policies 
WHERE tablename = 'courier_configs';

-- Dovresti vedere 4 policy:
-- 1. Admin può vedere tutte le configurazioni
-- 2. Admin può inserire configurazioni
-- 3. Admin può aggiornare configurazioni
-- 4. Admin può eliminare configurazioni
```

---

## 📝 NOTE

**Perché è successo:**
- La migration è stata eseguita parzialmente prima
- Le policy sono state create
- Riexecutando la migration, PostgreSQL trova le policy esistenti

**Soluzione permanente:**
- Ho aggiunto `DROP POLICY IF EXISTS` prima di ogni `CREATE POLICY`
- Ora la migration è **idempotente** (può essere eseguita più volte)

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0

