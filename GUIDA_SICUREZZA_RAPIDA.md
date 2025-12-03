# 🛡️ Guida Sicurezza Rapida - Protezione Dati

**Data Creazione:** 2025-12-03  
**Versione:** 1.0

---

## ⚠️ COSA DEVI FARE SUBITO

### **1. Configura ENCRYPTION_KEY** (OBBLIGATORIO!)

**Genera chiave sicura:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Copia la chiave generata (64 caratteri)**

**Configura su Vercel:**

1. Vai su **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Aggiungi:
   - **Name:** `ENCRYPTION_KEY`
   - **Value:** La chiave generata
   - **Environment:** ✅ Production
3. **Riavvia deployment**

**⚠️ IMPORTANTE:**
- ✅ **NON** condividere questa chiave
- ✅ **NON** committare nel repository
- ✅ **NON** perdere questa chiave

---

## 🔐 COME FUNZIONA LA PROTEZIONE

### **Le Tue Password Sono:**

1. ✅ **Criptate** nel database (AES-256-GCM)
2. ✅ **Visibili solo a te** (RLS policies)
3. ✅ **Decriptate solo nel server** (mai nel browser)
4. ✅ **Tracciate** (audit logging)

### **Cosa Vede un Attaccante:**

**Se accede al database:**
- ❌ Password criptate (inutilizzabili)
- ❌ RLS blocca accesso
- ✅ Solo dati non sensibili

**Se accede al codice:**
- ✅ Codice sorgente
- ❌ **NON** vede password (sono nel database criptate)
- ❌ **NON** vede ENCRYPTION_KEY (è in variabile d'ambiente)

**Se accede a Vercel:**
- ⚠️ Può vedere ENCRYPTION_KEY
- ⚠️ **PROTEZIONE:** Usa 2FA su Vercel!

---

## ✅ CHECKLIST SICUREZZA

### **OBBLIGATORIO:**

- [ ] ENCRYPTION_KEY configurata su Vercel
- [ ] 2FA attivo su Vercel
- [ ] 2FA attivo su Supabase
- [ ] RLS policies attive (verifica con SQL)

### **CONSIGLIATO:**

- [ ] Limita account admin (solo necessari)
- [ ] Monitora audit logs settimanalmente
- [ ] Backup ENCRYPTION_KEY (in luogo sicuro)
- [ ] Password forte su tutti gli account

---

## 🚨 SE QUALCOSA VA MALE

### **Password Compromesse:**

1. Cambia password su Spedisci.Online **IMMEDIATAMENTE**
2. Cambia ENCRYPTION_KEY su Vercel
3. Re-cripta password nel database
4. Controlla audit logs

### **Accesso Non Autorizzato:**

1. Revoca accessi **IMMEDIATAMENTE**
2. Cambia password account compromessi
3. Controlla audit logs
4. Notifica utenti se necessario

---

## 📚 DOCUMENTAZIONE COMPLETA

- **`docs/COME_PROTEGGO_I_MIEI_DATI.md`** - Guida semplice
- **`docs/SICUREZZA_CRITICA_PASSWORD.md`** - Dettagli tecnici
- **`docs/SICUREZZA_AUTOMATION.md`** - Sicurezza automation

---

**⚠️ RICORDA:**
- Le password sono **criptate** ma non **irrecuperabili**
- Se perdi ENCRYPTION_KEY, devi re-inserire password manualmente
- **NON** perdere ENCRYPTION_KEY!

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0

