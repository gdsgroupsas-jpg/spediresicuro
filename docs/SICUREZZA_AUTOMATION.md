# 🔒 Sicurezza Automation - Guida Completa

**Data Creazione:** 2025-12-03  
**Versione:** 1.0

---

## 🛡️ SICUREZZA DATI E CODICE

### **✅ Cosa è SICURO nella Repository:**

1. **Codice sorgente** ✅
   - Il codice è pubblico nel repository
   - NON contiene password o API keys hardcoded
   - Tutti i secrets sono in variabili d'ambiente

2. **File .gitignore** ✅
   - `.env.local` - **NON committato** (contiene secrets)
   - `data/database.json` - **NON committato** (contiene dati)
   - `*.key`, `*.pem` - **NON committati** (credenziali)

3. **Variabili d'Ambiente** ✅
   - Password e API keys sono in `.env.local` (locale)
   - Password e API keys sono in Vercel Environment Variables (produzione)
   - **MAI** committate nel repository

### **🔐 Protezione Dati Sensibili:**

#### **1. Database Supabase (RLS - Row Level Security)**

Tutti i dati sensibili sono protetti da **RLS Policies**:

```sql
-- Solo admin possono vedere courier_configs
CREATE POLICY "Only admins can view courier_configs"
ON courier_configs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.account_type IN ('admin', 'superadmin')
  )
);
```

**Cosa significa:**

- ✅ Solo admin/superadmin possono vedere configurazioni
- ✅ Utenti normali **NON** possono vedere API keys
- ✅ RLS funziona anche se qualcuno accede al database

#### **2. Automation Settings nel Database**

Le password di automation sono salvate in `courier_configs.automation_settings`:

**Protezione:**

- ✅ Solo admin possono vedere/modificare
- ✅ RLS policies attive
- ✅ Non esposte al client (solo server-side)

**⚠️ RACCOMANDAZIONE FUTURA:**

- Considera crittografia campo `automation_settings` (futuro miglioramento)
- Per ora, RLS è sufficiente (solo admin possono accedere)

#### **3. Session Cookies**

I cookie di sessione sono salvati in `courier_configs.session_data`:

**Protezione:**

- ✅ Solo admin possono vedere
- ✅ RLS policies attive
- ✅ Scadono automaticamente dopo 24h

---

## 📋 SCRIPT SUPABASE DA ESEGUIRE

### **Ordine di Esecuzione:**

Esegui questi script **IN ORDINE** su Supabase SQL Editor:

#### **1. Migration 010 - Courier Configs System** (Se non già fatto)

```sql
-- File: supabase/migrations/010_courier_configs_system.sql
-- Crea tabella courier_configs per gestire configurazioni dinamiche
```

**Come eseguire:**

1. Vai su Supabase Dashboard → SQL Editor
2. Copia e incolla contenuto di `supabase/migrations/010_courier_configs_system.sql`
3. Clicca "Run"

#### **2. Migration 015 - Estensione Session Data** (NUOVO)

```sql
-- File: supabase/migrations/015_extend_courier_configs_session_data.sql
-- Aggiunge campi per automation: session_data, automation_settings, etc.
```

**Come eseguire:**

1. Vai su Supabase Dashboard → SQL Editor
2. Copia e incolla contenuto di `supabase/migrations/015_extend_courier_configs_session_data.sql`
3. Clicca "Run"

#### **3. Migration 016 - Automation Locks** (NUOVO)

```sql
-- File: supabase/migrations/016_automation_locks.sql
-- Crea sistema di lock per prevenire conflitti
```

**Come eseguire:**

1. Vai su Supabase Dashboard → SQL Editor
2. Copia e incolla contenuto di `supabase/migrations/016_automation_locks.sql`
3. Clicca "Run"

### **Verifica Esecuzione:**

Dopo aver eseguito tutte le migration, verifica:

```sql
-- Verifica tabella courier_configs
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'courier_configs'
ORDER BY ordinal_position;

-- Dovresti vedere:
-- session_data (jsonb)
-- automation_settings (jsonb)
-- automation_enabled (boolean)
-- last_automation_sync (timestamptz)

-- Verifica tabella automation_locks
SELECT COUNT(*) FROM automation_locks;
-- Dovrebbe essere 0 (tabella vuota, ok)

-- Verifica funzioni
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%automation%' OR routine_name LIKE '%lock%';

-- Dovresti vedere:
-- acquire_automation_lock
-- release_automation_lock
-- check_automation_lock
-- extend_automation_lock
```

---

## 🔄 ROLLBACK (Tornare Indietro)

### **Se Qualcosa Non Funziona:**

#### **Opzione 1: Rollback Git (Consigliato)**

**Prima di fare rollback, salva stato attuale:**

```bash
# 1. Crea branch di backup
git checkout -b backup-before-automation-$(date +%Y%m%d)

# 2. Commit tutto (se ci sono modifiche non committate)
git add .
git commit -m "backup: stato prima di rollback"

# 3. Torna al commit precedente
git checkout master
git log --oneline -10  # Vedi ultimi 10 commit

# 4. Torna a commit funzionante (esempio: commit abc123)
git reset --hard abc123

# 5. Force push (ATTENZIONE: solo se sei sicuro!)
git push origin master --force
```

**⚠️ ATTENZIONE:**

- `git reset --hard` **cancella** tutte le modifiche non committate
- `--force` push sovrascrive la storia Git
- Usa solo se sei sicuro!

#### **Opzione 2: Rollback Database (Supabase)**

**Se le migration hanno creato problemi:**

```sql
-- 1. Rimuovi tabella automation_locks (se creata)
DROP TABLE IF EXISTS automation_locks CASCADE;

-- 2. Rimuovi colonne aggiunte a courier_configs (se necessario)
ALTER TABLE courier_configs
DROP COLUMN IF EXISTS session_data,
DROP COLUMN IF EXISTS automation_settings,
DROP COLUMN IF EXISTS last_automation_sync,
DROP COLUMN IF EXISTS automation_enabled;

-- 3. Rimuovi funzioni (se create)
DROP FUNCTION IF EXISTS acquire_automation_lock CASCADE;
DROP FUNCTION IF EXISTS release_automation_lock CASCADE;
DROP FUNCTION IF EXISTS check_automation_lock CASCADE;
DROP FUNCTION IF EXISTS extend_automation_lock CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_locks CASCADE;
```

**⚠️ ATTENZIONE:**

- Questo **cancella** tutti i dati di automation
- Fai backup prima se hai dati importanti!

#### **Opzione 3: Disabilita Automation (Sicuro)**

**Se vuoi solo disabilitare automation senza cancellare:**

1. **Dashboard Automation:**
   - Vai su `/dashboard/admin/automation`
   - Disabilita automation per tutte le configurazioni
   - L'agent non farà più sync

2. **Database:**

   ```sql
   -- Disabilita automation per tutte le config
   UPDATE courier_configs
   SET automation_enabled = false;
   ```

3. **Cron Job:**
   - Rimuovi o commenta cron job in `vercel.json`
   - L'agent non farà più sync automatico

---

## 📝 CHECKLIST SICUREZZA

### **Prima di Fare Push:**

- [ ] Verifica che `.env.local` NON sia tracciato da Git
- [ ] Verifica che non ci siano password hardcoded nel codice
- [ ] Verifica che `data/database.json` NON sia tracciato
- [ ] Esegui `bash SCAN_SICUREZZA.sh` (se disponibile)

### **Dopo Deploy:**

- [ ] Verifica che variabili d'ambiente siano configurate su Vercel
- [ ] Verifica che RLS policies siano attive su Supabase
- [ ] Testa che solo admin possano vedere automation settings

### **Monitoraggio:**

- [ ] Controlla logs Vercel per errori
- [ ] Controlla Supabase logs per accessi sospetti
- [ ] Verifica che automation funzioni correttamente

---

## 🔐 BEST PRACTICES

1. **Mai committare secrets:**
   - ✅ Usa sempre variabili d'ambiente
   - ✅ Verifica `.gitignore` prima di commit
   - ✅ Usa `env.example.txt` come template

2. **RLS sempre attivo:**
   - ✅ Verifica che RLS policies siano attive
   - ✅ Testa che utenti normali non possano vedere dati admin

3. **Backup regolari:**
   - ✅ Fai backup database prima di migration importanti
   - ✅ Crea branch Git prima di modifiche grandi

4. **Monitoraggio:**
   - ✅ Controlla logs regolarmente
   - ✅ Verifica accessi sospetti

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0
