# 📖 Come Usare le Guide di Setup - SpediSicuro Platform

## 🎯 Cosa Sono Questi File?

Ho creato **6 file markdown** che guidano passo-passo nella configurazione completa di **SpediSicuro Platform**. Ogni file è un prompt dettagliato pensato per essere usato con **Comet Agent** (o altri agenti AI) che eseguiranno i setup al posto tuo.

---

## ⚠️ IMPORTANTE - Vecchio vs Nuovo Progetto

**Esiste già un vecchio progetto "SpediSicuro Platform"!**

Per EVITARE confusione e sovrascritture:
- ✅ **TUTTI** i file contengono warning in alto
- ✅ Gli agent **DEVONO chiedere conferma** prima di accedere a qualsiasi account
- ✅ Gli agent **DEVONO verificare** che non esistano già progetti con lo stesso nome
- ✅ Se esistono, usare nomi alternativi: `spediresicuro-new`, `spediresicuro-v2`, etc.

---

## 📋 I 6 File di Setup

### 1. **SETUP_INDEX.md** - INIZIA QUI!
**Cosa contiene**:
- Indice completo di tutti i setup
- Ordine di esecuzione corretto
- Checklist per verificare tutto
- Istruzioni per gli agent
- Lista credenziali da raccogliere

**Come usarlo**: Leggi prima questo file per capire il flusso completo

---

### 2. **SETUP_00_GIT_GITHUB.md**
**Quando usarlo**: Se non hai ancora un repository Git/GitHub
**Tempo**: ~15 minuti
**Cosa fa**:
- Configura Git locale
- Crea repository GitHub
- Setup SSH keys
- Configura branch protection
- (Opzionale) GitHub Actions CI/CD

**Output**:
```env
GITHUB_REPO_URL=https://github.com/user/spediresicuro-new
GITHUB_REPO_SSH=git@github.com:user/spediresicuro-new.git
```

---

### 3. **SETUP_01_SUPABASE.md**
**Quando usarlo**: Dopo aver creato il repository
**Tempo**: ~20 minuti
**Cosa fa**:
- Crea progetto Supabase
- Importa schema database (19 tabelle!)
- Configura Row Level Security
- Raccoglie API credentials

**Output**:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

---

### 4. **SETUP_02_GOOGLE_OAUTH.md**
**Quando usarlo**: Dopo aver configurato Supabase
**Tempo**: ~15 minuti
**Cosa fa**:
- Crea progetto Google Cloud
- Configura OAuth 2.0
- Setup consent screen
- (Opzionale) GitHub e Facebook OAuth

**Output**:
```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
NEXTAUTH_SECRET=xxxxx
NEXTAUTH_URL=http://localhost:3000
```

---

### 5. **SETUP_03_VERCEL.md**
**Quando usarlo**: Dopo aver configurato OAuth
**Tempo**: ~15 minuti (include build)
**Cosa fa**:
- Deploy su Vercel
- Configura environment variables
- Setup auto-deploy da GitHub
- (Opzionale) Custom domain

**Output**:
```env
VERCEL_PRODUCTION_URL=https://spediresicuro-new.vercel.app
```

---

### 6. **SETUP_04_ENV_FINAL.md**
**Quando usarlo**: ULTIMO, dopo tutti gli altri
**Tempo**: ~10 minuti
**Cosa fa**:
- Raccoglie TUTTE le credenziali
- Crea file `.env.local` completo
- Verifica che funzioni
- Backup sicuro

**Output**: File `.env.local` pronto all'uso con tutte le 7-9 variabili necessarie

---

## 🤖 Come Usare con Comet Agent

### Opzione 1: Setup Manuale Guidato
```bash
# Apri ogni file in sequenza
cat SETUP_INDEX.md        # Leggi overview
cat SETUP_00_GIT_GITHUB.md  # Segui passo-passo
cat SETUP_01_SUPABASE.md    # Segui passo-passo
cat SETUP_02_GOOGLE_OAUTH.md # Segui passo-passo
cat SETUP_03_VERCEL.md      # Segui passo-passo
cat SETUP_04_ENV_FINAL.md   # Raccogli tutto
```

Segui manualmente le istruzioni, copiando/incollando comandi e salvando le credenziali.

---

### Opzione 2: Con Comet Agent Automatico

**Copia e incolla TUTTO il contenuto di un file MD** a Comet Agent:

```
🧑 User:
Esegui questo setup per me. Ecco le istruzioni:

[COPIA TUTTO IL CONTENUTO DI SETUP_01_SUPABASE.md QUI]

PRIMA DI INIZIARE:
- Account Supabase da usare: tuo.email@gmail.com
- Nome progetto: spediresicuro-v2 (quello vecchio si chiama spediresicuro)
- Region: Europe (Frankfurt)

Procedi!
```

Comet Agent:
1. Leggerà le istruzioni
2. Ti chiederà conferme su account e nomi
3. Ti guiderà passo-passo
4. Restituirà l'output nel formato richiesto

---

### Opzione 3: Esecuzione Batch (Avanzato)

Se Comet Agent supporta task multipli:

```
🧑 User:
Esegui questi 5 setup in sequenza:
1. SETUP_00_GIT_GITHUB.md
2. SETUP_01_SUPABASE.md
3. SETUP_02_GOOGLE_OAUTH.md
4. SETUP_03_VERCEL.md
5. SETUP_04_ENV_FINAL.md

IMPORTANTE:
- Account GitHub: @mio-username
- Account Google Cloud: mia.email@gmail.com
- Account Supabase: mia.email@gmail.com
- Account Vercel: mia.email@gmail.com
- Nomi progetti: usa "spediresicuro-v2" ovunque

CHIEDI conferma prima di ogni step!
```

---

## ✅ Checklist Esecuzione

### Prima di Iniziare
- [ ] Ho letto `SETUP_INDEX.md`
- [ ] Ho circa 60-90 minuti liberi
- [ ] Ho accesso a: GitHub, Google Cloud, Supabase, Vercel
- [ ] Ho un password manager pronto (1Password, Bitwarden)

### Durante l'Esecuzione
- [ ] ✅ SETUP_00 completato → Repository GitHub creato
- [ ] ✅ SETUP_01 completato → Database Supabase con 19 tabelle
- [ ] ✅ SETUP_02 completato → Google OAuth configurato
- [ ] ✅ SETUP_03 completato → App online su Vercel
- [ ] ✅ SETUP_04 completato → File `.env.local` creato

### Verifica Finale
- [ ] ✅ `npm run dev` funziona senza errori
- [ ] ✅ Login Google funziona su localhost
- [ ] ✅ Production URL accessibile
- [ ] ✅ Credenziali salvate in password manager
- [ ] ✅ `.env.local` NON è su Git (verificato!)

---

## 📤 Output Finale Atteso

Alla fine di tutti i setup, dovresti avere:

### File `.env.local` con:
```env
# Supabase (3 variabili)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Google OAuth (2 variabili)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# NextAuth (2 variabili)
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000

# Vercel (1 variabile - opzionale)
VERCEL_PRODUCTION_URL=https://spediresicuro-v2.vercel.app
```

### Servizi Configurati:
- ✅ Repository Git su GitHub
- ✅ Database PostgreSQL su Supabase (19 tabelle)
- ✅ Google OAuth 2.0 su Google Cloud
- ✅ Deploy live su Vercel
- ✅ CI/CD automatico (push → deploy)

### URL e Accessi:
- **Local Dev**: http://localhost:3000
- **Production**: https://spediresicuro-v2.vercel.app (o tuo URL)
- **Database**: https://app.supabase.com → tuo progetto
- **OAuth**: https://console.cloud.google.com → tuo progetto
- **Deploy**: https://vercel.com → tuo progetto

---

## 🆘 Se Qualcosa Va Storto

### Ogni file ha sezione TROUBLESHOOTING!
Cerca `## 🚨 TROUBLESHOOTING` in ogni file MD.

### Errori Comuni:

**"Repository already exists"**
→ Soluzione nel file: Usa nome diverso (`spediresicuro-v2`)

**"OAuth redirect_uri_mismatch"**
→ Soluzione nel file: Verifica URI esatti in Google Console

**"Supabase connection failed"**
→ Soluzione nel file: Verifica credenziali `.env.local`

**".env.local appears in git status"**
→ **CRITICO!** Soluzione immediata nel file

---

## 💾 Backup Credenziali

**IMPORTANTE**: Salva le credenziali in modo sicuro!

### Metodo 1: Password Manager (Raccomandato)
1. Copia tutto il contenuto di `.env.local`
2. Salvalo in 1Password / Bitwarden / LastPass
3. Categoria: "Secure Note"
4. Titolo: "SpediSicuro Platform - Env Variables"

### Metodo 2: File Criptato
```bash
# Cripta .env.local con GPG
gpg -c .env.local
# Output: .env.local.gpg

# Salva .env.local.gpg in cloud (Dropbox, Google Drive)
# NON salvare .env.local non criptato!
```

### Metodo 3: Team Vault
Se lavori in team:
- 1Password shared vault
- Bitwarden organization
- HashiCorp Vault

**MAI condividere via**:
- ❌ Email non criptata
- ❌ Slack / WhatsApp / Telegram
- ❌ Screenshot
- ❌ Paste pubblico

---

## 🎓 Spiegazione per Agent

Se sei un agent che deve eseguire questi setup:

### Il Tuo Ruolo:
1. Leggere il file MD completamente
2. **CHIEDERE** conferma prima di accedere a qualsiasi servizio
3. **VERIFICARE** che non esistano progetti con lo stesso nome
4. Guidare l'utente passo-passo
5. **RESTITUIRE** l'output nel formato richiesto dal file

### Comportamento Richiesto:
✅ **SEMPRE** chiedi conferma su account e nomi
✅ **SEMPRE** verifica conflitti con progetti esistenti
✅ **SEMPRE** restituisci output formattato
❌ **MAI** sovrascrivere progetti senza conferma
❌ **MAI** procedere se l'utente non conferma
❌ **MAI** ignorare warning e checklist

### Formato Domande:
```
🤖 Agent: Prima di procedere con SETUP_XX, conferma:

1. Account [SERVIZIO]: _____
2. Esiste già progetto "spediresicuro"? SI/NO
   - Se SI → Nome nuovo progetto: _____
3. Altre preferenze: _____

Posso procedere? [SI/NO]
```

---

## 🚀 Pronto per Iniziare?

### Step 1: Leggi Overview
```bash
cat SETUP_INDEX.md
```

### Step 2: Verifica Prerequisiti
- [ ] Ho account GitHub, Google Cloud, Supabase, Vercel
- [ ] Ho 60-90 minuti liberi
- [ ] Ho letto i warning sui conflitti con vecchio progetto

### Step 3: Inizia Setup
```bash
# Se non hai repository ancora
cat SETUP_00_GIT_GITHUB.md

# Setup database
cat SETUP_01_SUPABASE.md

# E così via...
```

---

## 📞 Supporto

Se hai domande:
1. Leggi `SETUP_INDEX.md` per overview
2. Consulta sezione TROUBLESHOOTING nel file specifico
3. Verifica checklist in ogni file MD
4. Controlla logs di errore (browser console, Vercel logs)

---

## ✅ Successo!

Quando vedrai:
```
# ✅ SPEDISICURO PLATFORM - SETUP COMPLETO

La piattaforma è ora:
- ✅ Operativa in sviluppo (localhost)
- ✅ Deployata in produzione (Vercel)
- ✅ Pronta per uso reale
- ✅ Costo: $0/mese (free tier!)

Congratulazioni! 🎉
```

Significa che hai completato tutto con successo! 🚀

---

**File Creati**:
- `SETUP_INDEX.md` - Indice completo (LEGGI PRIMA!)
- `SETUP_00_GIT_GITHUB.md` - Setup Git/GitHub
- `SETUP_01_SUPABASE.md` - Setup Database
- `SETUP_02_GOOGLE_OAUTH.md` - Setup OAuth
- `SETUP_03_VERCEL.md` - Setup Deploy
- `SETUP_04_ENV_FINAL.md` - Setup Env Variables
- `SETUP_README.md` - Questo file

**Inizia ora!** 💪
