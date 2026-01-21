# 📋 Riepilogo Script Supabase - Automation System

**Data Creazione:** 2025-12-03  
**Versione:** 1.0

---

## 🎯 SCRIPT DA ESEGUIRE (IN ORDINE)

### **1. Migration 010 - Courier Configs System**

**File:** `supabase/migrations/010_courier_configs_system.sql`

**Cosa fa:**

- Crea tabella `courier_configs` per gestire configurazioni dinamiche
- Aggiunge campo `assigned_config_id` a `users`
- Crea funzioni helper per recupero configurazioni

**Come eseguire:**

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri file `supabase/migrations/010_courier_configs_system.sql`
3. Copia tutto il contenuto
4. Incolla in SQL Editor
5. Clicca **"Run"**

**Verifica:**

```sql
-- Dovrebbe restituire la tabella
SELECT * FROM courier_configs LIMIT 1;
```

---

### **2. Migration 015 - Estensione Session Data**

**File:** `supabase/migrations/015_extend_courier_configs_session_data.sql`

**Cosa fa:**

- Aggiunge campo `session_data` (JSONB) per cookie e CSRF token
- Aggiunge campo `automation_settings` (JSONB) per impostazioni agent
- Aggiunge campo `last_automation_sync` (TIMESTAMPTZ) per tracking
- Aggiunge campo `automation_enabled` (BOOLEAN) per abilitazione

**Come eseguire:**

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri file `supabase/migrations/015_extend_courier_configs_session_data.sql`
3. Copia tutto il contenuto
4. Incolla in SQL Editor
5. Clicca **"Run"**

**Verifica:**

```sql
-- Dovrebbe mostrare le nuove colonne
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'courier_configs'
AND column_name IN ('session_data', 'automation_settings', 'last_automation_sync', 'automation_enabled');
```

---

### **3. Migration 016 - Automation Locks**

**File:** `supabase/migrations/016_automation_locks.sql`

**Cosa fa:**

- Crea tabella `automation_locks` per prevenire conflitti
- Crea funzioni: `acquire_automation_lock()`, `release_automation_lock()`, `check_automation_lock()`
- Previene loop infiniti tra agent e uso manuale

**Come eseguire:**

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri file `supabase/migrations/016_automation_locks.sql`
3. Copia tutto il contenuto
4. Incolla in SQL Editor
5. Clicca **"Run"**

**Verifica:**

```sql
-- Dovrebbe restituire la tabella (vuota)
SELECT * FROM automation_locks;

-- Dovrebbe mostrare le funzioni
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%automation%lock%';
```

---

### **4. Migration 017 - Criptazione Password** 🔐 (CRITICO!)

**File:** `supabase/migrations/017_encrypt_automation_passwords.sql`

**Cosa fa:**

- Aggiunge colonna `automation_encrypted` per tracciare criptazione
- Le password in `automation_settings` verranno criptate lato applicazione
- **PROTEZIONE CRITICA** per le tue password

**Come eseguire:**

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri file `supabase/migrations/017_encrypt_automation_passwords.sql`
3. Copia tutto il contenuto
4. Incolla in SQL Editor
5. Clicca **"Run"**

**⚠️ IMPORTANTE:**

- Dopo questa migration, configura `ENCRYPTION_KEY` su Vercel
- Le password verranno criptate automaticamente quando le salvi
- **NON** perdere ENCRYPTION_KEY!

**Verifica:**

```sql
-- Dovrebbe mostrare la colonna
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'courier_configs'
AND column_name = 'automation_encrypted';
```

---

## ✅ CHECKLIST COMPLETA

### **Prima di Eseguire:**

- [ ] Backup database Supabase (opzionale ma consigliato)
- [ ] Verifica di essere loggato come admin su Supabase
- [ ] Apri tutti e 3 i file SQL

### **Durante Esecuzione:**

- [ ] Esegui Migration 010 → Verifica OK
- [ ] Esegui Migration 015 → Verifica OK
- [ ] Esegui Migration 016 → Verifica OK
- [ ] Esegui Migration 017 → Verifica OK (CRITICO per sicurezza!)

### **Dopo Esecuzione:**

- [ ] Verifica tabelle create:

  ```sql
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('courier_configs', 'automation_locks');
  ```

- [ ] Verifica colonne aggiunte:

  ```sql
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'courier_configs'
  AND column_name IN ('session_data', 'automation_settings', 'automation_enabled', 'automation_encrypted');
  ```

- [ ] Verifica funzioni create:
  ```sql
  SELECT routine_name
  FROM information_schema.routines
  WHERE routine_schema = 'public'
  AND routine_name LIKE '%automation%';
  ```

---

## 🔄 ROLLBACK (Se Qualcosa Va Male)

### **Opzione 1: Rimuovi Solo Automation (Consigliato)**

```sql
-- Rimuovi tabella automation_locks
DROP TABLE IF EXISTS automation_locks CASCADE;

-- Rimuovi colonne automation da courier_configs
ALTER TABLE courier_configs
DROP COLUMN IF EXISTS session_data,
DROP COLUMN IF EXISTS automation_settings,
DROP COLUMN IF EXISTS last_automation_sync,
DROP COLUMN IF EXISTS automation_enabled,
DROP COLUMN IF EXISTS automation_encrypted;

-- Rimuovi funzioni
DROP FUNCTION IF EXISTS acquire_automation_lock CASCADE;
DROP FUNCTION IF EXISTS release_automation_lock CASCADE;
DROP FUNCTION IF EXISTS check_automation_lock CASCADE;
DROP FUNCTION IF EXISTS extend_automation_lock CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_locks CASCADE;
DROP FUNCTION IF EXISTS is_automation_encrypted CASCADE;
```

### **Opzione 2: Rollback Completo (Solo se Necessario)**

```sql
-- ATTENZIONE: Questo rimuove ANCHE courier_configs!
-- Usa solo se vuoi rimuovere tutto il sistema

DROP TABLE IF EXISTS automation_locks CASCADE;
DROP TABLE IF EXISTS courier_configs CASCADE;
-- Rimuovi anche assigned_config_id da users se necessario
ALTER TABLE users DROP COLUMN IF EXISTS assigned_config_id;
```

---

## 📝 NOTE IMPORTANTI

1. **Ordine di Esecuzione:**
   - ⚠️ Esegui sempre in ordine: 010 → 015 → 016
   - ⚠️ Non saltare migration

2. **Backup:**
   - ✅ Fai backup prima di eseguire migration
   - ✅ Supabase Dashboard → Settings → Database → Backups

3. **Test:**
   - ✅ Dopo ogni migration, verifica che tutto funzioni
   - ✅ Testa funzioni SQL se possibile

4. **Errori:**
   - Se vedi errori, leggi il messaggio
   - Molti errori sono "already exists" (ok, significa già fatto)
   - Se errore grave, fai rollback

---

## 🆘 TROUBLESHOOTING

### **Errore: "relation already exists"**

**Causa:** Migration già eseguita

**Soluzione:**

- ✅ OK, significa che è già fatto
- ✅ Salta questa migration

### **Errore: "permission denied"**

**Causa:** Non hai permessi admin

**Soluzione:**

- Verifica di essere loggato come admin su Supabase
- Contatta admin Supabase se necessario

### **Errore: "syntax error"**

**Causa:** SQL malformato

**Soluzione:**

- Verifica di aver copiato tutto il file
- Controlla che non ci siano caratteri strani
- Prova a eseguire sezione per sezione

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0
