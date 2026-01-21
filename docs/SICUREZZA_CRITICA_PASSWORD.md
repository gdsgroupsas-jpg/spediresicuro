# 🔐 Sicurezza Critica - Protezione Password

**Data Creazione:** 2025-12-03  
**Versione:** 1.0  
**Status:** ⚠️ CRITICO - Leggi attentamente

---

## 🛡️ COME SONO PROTETTE LE TUE PASSWORD

### **1. Criptazione AES-256-GCM** ✅

**Tutte le password sono criptate prima di essere salvate nel database:**

- ✅ Password Spedisci.Online → **Criptata**
- ✅ Password IMAP → **Criptata**
- ✅ Session cookies → **Non criptati** (scadono dopo 24h)

**Algoritmo:** AES-256-GCM (stesso usato da banche e servizi critici)

**Chiave di criptazione:**

- Salvata in `ENCRYPTION_KEY` (variabile d'ambiente)
- **NON** nel database
- **NON** nel codice
- **NON** nella repository

### **2. Row Level Security (RLS)** ✅

**Solo TU (admin) puoi vedere le configurazioni:**

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

- ✅ Utenti normali **NON** possono vedere nulla
- ✅ Solo admin/superadmin possono vedere configurazioni
- ✅ Anche se qualcuno accede al database, RLS blocca l'accesso

### **3. Server-Side Only** ✅

**Le password sono decriptate SOLO server-side:**

- ✅ Password **MAI** inviate al client (browser)
- ✅ Decriptazione **SOLO** nel server (Next.js API)
- ✅ Client vede solo dati non sensibili

### **4. Audit Logging** ✅

**Tutti gli accessi sono tracciati:**

- ✅ Chi ha visto configurazioni
- ✅ Chi ha modificato password
- ✅ Quando è stato fatto
- ✅ Da quale IP

---

## 🔒 COSA DEVI FARE PER SICUREZZA MASSIMA

### **1. Configura ENCRYPTION_KEY** (OBBLIGATORIO)

**Genera chiave sicura:**

```bash
# Genera chiave casuale (64 caratteri esadecimali)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Configura su Vercel:**

1. Vai su **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Aggiungi:
   - **Name:** `ENCRYPTION_KEY`
   - **Value:** La chiave generata (64 caratteri)
   - **Environment:** ✅ Production, ✅ Preview
3. **Riavvia deployment**

**⚠️ IMPORTANTE:**

- ✅ **NON** condividere questa chiave
- ✅ **NON** committare nel repository
- ✅ **NON** perdere questa chiave (altrimenti password irrecuperabili)

### **2. Verifica RLS Policies** (OBBLIGATORIO)

**Verifica che RLS sia attivo:**

```sql
-- Verifica che RLS sia abilitato
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'courier_configs';

-- Dovrebbe essere: rowsecurity = true
```

**Se non attivo, abilitalo:**

```sql
ALTER TABLE courier_configs ENABLE ROW LEVEL SECURITY;
```

### **3. Limita Accesso Admin** (CONSIGLIATO)

**Solo account superadmin dovrebbero avere accesso:**

```sql
-- Verifica chi è admin
SELECT email, account_type
FROM users
WHERE account_type IN ('admin', 'superadmin');

-- Rimuovi admin non necessari
DELETE FROM users WHERE account_type = 'admin' AND email = 'email-sospetta@example.com';
```

### **4. Monitora Accessi** (CONSIGLIATO)

**Controlla audit logs regolarmente:**

```sql
-- Ultimi accessi a configurazioni
SELECT
  action,
  user_email,
  resource_id,
  ip_address,
  created_at
FROM audit_logs
WHERE resource_type = 'courier_config'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 🚨 SCENARI DI ATTACCO E PROTEZIONI

### **Scenario 1: Qualcuno Accede al Database**

**Cosa vede:**

- ❌ Password criptate (inutilizzabili senza ENCRYPTION_KEY)
- ❌ RLS blocca accesso (se non è admin)
- ✅ Solo dati non sensibili

**Protezione:**

- ✅ Password criptate con AES-256-GCM
- ✅ RLS policies attive
- ✅ ENCRYPTION_KEY non nel database

### **Scenario 2: Qualcuno Accede al Codice Repository**

**Cosa vede:**

- ✅ Codice sorgente (pubblico)
- ❌ **NON** vede password (sono nel database criptate)
- ❌ **NON** vede ENCRYPTION_KEY (è in variabile d'ambiente)

**Protezione:**

- ✅ Password nel database (criptate)
- ✅ ENCRYPTION_KEY in variabile d'ambiente (non nel codice)
- ✅ Decriptazione solo server-side

### **Scenario 3: Qualcuno Accede a Vercel Environment Variables**

**Cosa può fare:**

- ⚠️ Può vedere ENCRYPTION_KEY
- ⚠️ Può decriptare password
- ⚠️ **RISCHIO ALTO**

**Protezione:**

- ✅ Limita accesso a Vercel (solo tu)
- ✅ Usa 2FA su Vercel
- ✅ Monitora accessi Vercel

### **Scenario 4: Qualcuno Accede al Tuo Account Admin**

**Cosa può fare:**

- ⚠️ Può vedere configurazioni (ma password sono criptate)
- ⚠️ Può modificare configurazioni
- ⚠️ **RISCHIO MEDIO**

**Protezione:**

- ✅ Password criptate (serve ENCRYPTION_KEY per usarle)
- ✅ Audit logging (vedi chi ha fatto cosa)
- ✅ Limita account admin

---

## ✅ CHECKLIST SICUREZZA

### **Prima di Usare Automation:**

- [ ] ENCRYPTION_KEY configurata su Vercel
- [ ] ENCRYPTION_KEY **NON** nel repository
- [ ] RLS policies attive su Supabase
- [ ] Solo account necessari sono admin
- [ ] 2FA attivo su Vercel
- [ ] 2FA attivo su Supabase

### **Monitoraggio Continuo:**

- [ ] Controlla audit logs settimanalmente
- [ ] Verifica accessi sospetti
- [ ] Controlla che RLS sia sempre attivo
- [ ] Verifica che ENCRYPTION_KEY sia sicura

### **In Caso di Breach:**

1. **Cambia ENCRYPTION_KEY** immediatamente
2. **Re-cripta tutte le password** con nuova chiave
3. **Revoca accessi** sospetti
4. **Cambia password** Spedisci.Online
5. **Controlla audit logs** per vedere cosa è stato fatto

---

## 🔐 BEST PRACTICES

1. **ENCRYPTION_KEY Forte:**
   - ✅ Usa almeno 64 caratteri esadecimali
   - ✅ Genera con `crypto.randomBytes(32).toString('hex')`
   - ✅ **NON** usare password semplici

2. **Accesso Limitato:**
   - ✅ Solo account necessari sono admin
   - ✅ Rimuovi admin non più necessari
   - ✅ Usa 2FA su tutti gli account

3. **Monitoraggio:**
   - ✅ Controlla audit logs regolarmente
   - ✅ Verifica accessi sospetti
   - ✅ Monitora modifiche configurazioni

4. **Backup:**
   - ✅ Fai backup ENCRYPTION_KEY (in luogo sicuro)
   - ✅ Fai backup database regolarmente
   - ✅ Testa restore procedure

---

## 📊 LIVELLI DI SICUREZZA

### **Livello 1: Base** (Attuale)

- ✅ Password criptate nel database
- ✅ RLS policies attive
- ✅ Server-side only

### **Livello 2: Medio** (Consigliato)

- ✅ + ENCRYPTION_KEY configurata
- ✅ + Audit logging attivo
- ✅ + 2FA su Vercel/Supabase

### **Livello 3: Alto** (Massima Sicurezza)

- ✅ + Limita accesso admin
- ✅ + Monitoraggio continuo
- ✅ + Backup ENCRYPTION_KEY sicuro
- ✅ + Rotazione chiavi periodica

---

## 🆘 SE QUALCOSA VA MALE

### **Password Compromesse:**

1. **Cambia password** su Spedisci.Online immediatamente
2. **Cambia ENCRYPTION_KEY** su Vercel
3. **Re-cripta password** nel database
4. **Controlla audit logs** per vedere cosa è successo

### **ENCRYPTION_KEY Persa:**

1. **Genera nuova chiave**
2. **Re-inserisci password** manualmente (non recuperabili)
3. **Re-cripta** con nuova chiave

### **Accesso Non Autorizzato:**

1. **Revoca accessi** immediatamente
2. **Cambia password** account compromessi
3. **Controlla audit logs**
4. **Notifica** utenti se necessario

---

**⚠️ IMPORTANTE:**

- Le password sono **criptate** ma non **irrecuperabili**
- Se perdi ENCRYPTION_KEY, devi re-inserire password manualmente
- **NON** perdere ENCRYPTION_KEY!

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0  
**Status:** 🔴 CRITICO - Configura ENCRYPTION_KEY prima di usare!
