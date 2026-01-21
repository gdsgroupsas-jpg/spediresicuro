# 🔒 Guida Sicurezza - Protezione Dati Sensibili nei Commit

## ⚠️ IMPORTANTE

Questo documento spiega come proteggere i dati sensibili e cosa controllare prima di fare commit.

---

## ✅ COSA È GIÀ PROTETTO

I seguenti file sono **automaticamente esclusi** da Git grazie a `.gitignore`:

- ✅ `.env.local` (Next.js - contiene tutte le variabili sensibili)
- ✅ `.env` (file env generici)
- ✅ `automation-service/.env` (Automation Service)
- ✅ `automation-service/.env.local`
- ✅ `*.log` (log che potrebbero contenere dati sensibili)
- ✅ `*.key`, `*.pem` (chiavi private)

**Questi file NON verranno mai committati per errore!**

---

## 🔍 VERIFICA PRIMA DI COMMITTARE

### Comando Automatico

Esegui questo comando prima di ogni commit:

```bash
npm run verify:security
```

Questo script controlla:

- ✅ Se ci sono dati sensibili nei file tracciati
- ✅ Se `.gitignore` protegge correttamente i file `.env`
- ✅ Se ci sono password, token o chiavi API hardcoded

### Verifica Manuale

Prima di fare `git add` e `git commit`, controlla:

1. **Non hai aggiunto file `.env` per errore:**

   ```bash
   git status
   ```

   Se vedi `.env.local` o `automation-service/.env` nella lista, **NON committarli!**

2. **Non hai hardcoded credenziali nel codice:**
   - ❌ NON fare: `const API_KEY = "eyJhbGc...";`
   - ✅ Fai: `const API_KEY = process.env.API_KEY;`

3. **File di esempio sono OK:**
   - ✅ `ESEMPIO_ENV_LOCALE.txt` - contiene solo placeholder
   - ✅ `automation-service/ESEMPIO_ENV.txt` - contiene solo placeholder
   - ⚠️ Questi file possono essere committati (sono solo esempi)

---

## 🚨 COSA FARE SE HAI COMMITTATO DATI SENSIBILI

### Se hai appena committato (ma non ancora pushato):

1. **Rimuovi il file dal commit:**

   ```bash
   git reset HEAD~1
   # Oppure
   git reset --soft HEAD~1
   ```

2. **Aggiungi il file a .gitignore** (se non c'è già)

3. **Rigenera le chiavi compromesse:**
   - Se hai committato `SUPABASE_SERVICE_ROLE_KEY` → rigenera su Supabase
   - Se hai committato `NEXTAUTH_SECRET` → genera un nuovo secret
   - Se hai committato `ENCRYPTION_KEY` → genera una nuova chiave
   - Se hai committato `AUTOMATION_SERVICE_TOKEN` → genera un nuovo token

4. **Rifai il commit senza il file sensibile**

### Se hai già pushato su GitHub/GitLab:

⚠️ **URGENTE**: I dati sono esposti pubblicamente!

1. **Rigenera IMMEDIATAMENTE tutte le chiavi compromesse**
2. **Rimuovi il file dalla cronologia Git** (richiede force push):

   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env.local" \
     --prune-empty --tag-name-filter cat -- --all
   ```

   ⚠️ **ATTENZIONE**: Questo riscrive la cronologia Git!

3. **Notifica il team** se lavori in gruppo

---

## 📋 CHECKLIST PRE-COMMIT

Prima di ogni commit, verifica:

- [ ] Ho eseguito `npm run verify:security`?
- [ ] Non ci sono file `.env*` in `git status`?
- [ ] Non ho hardcoded credenziali nel codice?
- [ ] Ho usato `process.env.VARIABILE` invece di valori hardcoded?
- [ ] I file di esempio contengono solo placeholder?

---

## 🔐 VARIABILI DA NON COMMITTARE MAI

Queste variabili **NON devono mai** essere nel codice o nei file tracciati:

- ❌ `SUPABASE_SERVICE_ROLE_KEY` (chiave segreta Supabase)
- ❌ `NEXTAUTH_SECRET` (secret NextAuth)
- ❌ `ENCRYPTION_KEY` (chiave di criptazione)
- ❌ `AUTOMATION_SERVICE_TOKEN` (token automation)
- ❌ `GOOGLE_CLIENT_SECRET` (secret OAuth Google)
- ❌ `GITHUB_CLIENT_SECRET` (secret OAuth GitHub)
- ❌ `DIAGNOSTICS_TOKEN` (token diagnostica)
- ❌ Password di database
- ❌ API keys private

**Dove metterle:**

- ✅ File `.env.local` (locale, non tracciato)
- ✅ Variabili d'ambiente su Vercel (produzione)
- ✅ Variabili d'ambiente su Railway (automation-service)

---

## 🛡️ BEST PRACTICES

1. **Usa sempre variabili d'ambiente:**

   ```typescript
   // ❌ SBAGLIATO
   const apiKey = 'eyJhbGc...';

   // ✅ CORRETTO
   const apiKey = process.env.API_KEY;
   ```

2. **Non loggare mai credenziali:**

   ```typescript
   // ❌ SBAGLIATO
   console.log('API Key:', process.env.API_KEY);

   // ✅ CORRETTO
   console.log('API Key configured:', !!process.env.API_KEY);
   ```

3. **Usa placeholder nei file di esempio:**

   ```env
   # ✅ CORRETTO (file ESEMPIO_ENV_LOCALE.txt)
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...placeholder

   # ❌ SBAGLIATO
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dDI...
   ```

4. **Verifica regolarmente:**
   ```bash
   # Esegui prima di ogni commit importante
   npm run verify:security
   ```

---

## 📞 SUPPORTO

Se hai dubbi o hai committato dati sensibili per errore:

1. **Esegui `npm run verify:security`** per vedere cosa è esposto
2. **Rigenera le chiavi compromesse** immediatamente
3. **Rimuovi i file dalla cronologia Git** se necessario

---

## ✅ RIEPILOGO

- ✅ I file `.env.local` e `automation-service/.env` sono protetti da `.gitignore`
- ✅ Lo script `verify:security` controlla automaticamente i dati sensibili
- ✅ Usa sempre `process.env` invece di valori hardcoded
- ✅ Rigenera le chiavi se le hai committate per errore

**Mantieni i tuoi dati al sicuro! 🔒**
