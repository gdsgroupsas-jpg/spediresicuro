# 🔍 Verifica Chiavi API e Configurazione

## 📋 Checklist Completa

### ✅ Chiavi Obbligatorie

#### 1. NEXTAUTH_SECRET
- **Stato:** ✅ Configurato automaticamente
- **Verifica:** Dovrebbe essere una stringa base64 lunga
- **Esempio valido:** `YTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5...`

#### 2. NEXT_PUBLIC_APP_URL
- **Stato:** ✅ Configurato (default: http://localhost:3000)
- **Nota:** Se il server è su porta 3001, aggiorna a `http://localhost:3001`

---

### 🔐 Chiavi OAuth (Opzionali)

#### Google OAuth
- **GOOGLE_CLIENT_ID**
  - ❌ **Non configurato** se vedi: `your-google-client-id`
  - ✅ **Configurato** se vedi: `123456789-abc123def456.apps.googleusercontent.com`
  
- **GOOGLE_CLIENT_SECRET**
  - ❌ **Non configurato** se vedi: `your-google-client-secret`
  - ✅ **Configurato** se vedi: `GOCSPX-abc123def456ghi789`

#### GitHub OAuth
- **GITHUB_CLIENT_ID**
  - ❌ **Non configurato** se vedi: `your-github-client-id`
  - ✅ **Configurato** se vedi: `Iv1.abc123def456ghi789`
  
- **GITHUB_CLIENT_SECRET**
  - ❌ **Non configurato** se vedi: `your-github-client-secret`
  - ✅ **Configurato** se vedi: `abc123def456ghi789jkl012mno345pqr678`

---

### 🗄️ Chiavi Database (Opzionali)

#### Supabase
- **NEXT_PUBLIC_SUPABASE_URL**
  - ❌ **Non configurato** se vedi: `https://your-project.supabase.co`
  - ✅ **Configurato** se vedi: `https://xxxxxxxxxxxxx.supabase.co`
  
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**
  - ❌ **Non configurato** se vedi: `your-anon-key-here`
  - ✅ **Configurato** se vedi: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  
- **SUPABASE_SERVICE_ROLE_KEY**
  - ❌ **Non configurato** se vedi: `your-service-role-key-here`
  - ✅ **Configurato** se vedi: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### 🔑 Chiavi API Esterne (Opzionali - per futuro)

#### API Corrieri
- **API_KEY_CORRIERE_1**
- **API_KEY_CORRIERE_2**

**Nota:** Queste sono per integrazioni future con API di corrieri esterni.

---

## 🧪 Come Verificare

### Metodo 1: Script Automatico
```bash
npm run verify:setup
```

### Metodo 2: Verifica Manuale
1. Apri `.env.local`
2. Cerca ogni chiave nella lista sopra
3. Verifica che non ci siano valori placeholder

### Metodo 3: Verifica con PowerShell
```powershell
Get-Content .env.local | Select-String -Pattern "(GOOGLE|GITHUB|API_KEY|NEXTAUTH)"
```

---

## ⚠️ Problemi Comuni

### Valori Placeholder Ancora Presenti
**Sintomo:** Vedi `your-google-client-id` invece di un valore reale

**Soluzione:**
1. Segui `GUIDA_CONFIGURAZIONE_OAUTH.md` per configurare OAuth
2. Oppure rimuovi/commenta le righe se non vuoi usare OAuth

### Spazi o Caratteri Extra
**Sintomo:** Le chiavi non funzionano anche se sembrano corrette

**Soluzione:**
- Verifica che non ci siano spazi prima o dopo il `=`
- Verifica che non ci siano virgolette intorno ai valori
- Esempio corretto: `GOOGLE_CLIENT_ID=abc123`
- Esempio sbagliato: `GOOGLE_CLIENT_ID = "abc123"`

### Porta Sbagliata
**Sintomo:** OAuth funziona ma da errore redirect_uri_mismatch

**Soluzione:**
- Se il server è su porta 3001, usa `http://localhost:3001` nei callback URL
- Aggiorna `NEXT_PUBLIC_APP_URL=http://localhost:3001` in `.env.local`

---

## 📝 Template .env.local Corretto

```env
# ============================================
# OBBLIGATORIE
# ============================================
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXTAUTH_SECRET=YTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5...

# ============================================
# OAUTH (Opzionali)
# ============================================
# Se non configurate, commenta o lascia i placeholder
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789

GITHUB_CLIENT_ID=Iv1.abc123def456ghi789
GITHUB_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678

# ============================================
# SUPABASE (Opzionale)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ✅ Checklist Finale

Prima di avviare il server, verifica:

- [ ] `NEXTAUTH_SECRET` è configurato (non è `your-secret-key-here`)
- [ ] `NEXT_PUBLIC_APP_URL` corrisponde alla porta del server (3000 o 3001)
- [ ] Se usi OAuth: `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` sono configurati
- [ ] Se usi OAuth: `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET` sono configurati
- [ ] Se usi Supabase: tutte le chiavi Supabase sono configurate
- [ ] Nessun valore ha spazi extra o caratteri strani
- [ ] Il server è stato riavviato dopo le modifiche a `.env.local`

---

**Ultimo aggiornamento:** Guida verifica completa chiavi API ✅




