# 🚀 Guida Rapida - Fix Problemi Locali

**Problemi:** Autocomplete città e OAuth Google non funzionano

---

## ⚡ Soluzione in 3 Minuti

### 1️⃣ Verifica File .env.local

Apri il file `.env.local` nella root del progetto e verifica che contenga:

```env
# OBBLIGATORIO - Supabase (per autocomplete città)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# OBBLIGATORIO - NextAuth (per autenticazione)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=chiave-segreta-32-caratteri

# OBBLIGATORIO - Google OAuth (per login Google)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

---

### 2️⃣ Se Manca .env.local

Copia il template:

```bash
cp env.example.txt .env.local
```

Poi compila le variabili sopra.

---

### 3️⃣ Ottieni Credenziali

#### Supabase (per autocomplete):
1. Vai su https://app.supabase.com
2. Progetto → Settings → API
3. Copia URL e chiavi

#### Google OAuth (per login):
1. Vai su https://console.cloud.google.com/apis/credentials
2. Crea OAuth Client ID
3. Callback: `http://localhost:3000/api/auth/callback/google`
4. Copia Client ID e Secret

#### NextAuth Secret:
Genera con:
```bash
openssl rand -base64 32
```

---

### 4️⃣ Riavvia Server

```bash
# Ferma (Ctrl+C) e riavvia
npm run dev
```

---

## ✅ Verifica

1. **Autocomplete:** Digita "Roma" → dovrebbe mostrare risultati
2. **Google Login:** Clicca "Accedi con Google" → dovrebbe funzionare

---

## 📋 Checklist

- [ ] `.env.local` esiste
- [ ] Tutte le variabili sono configurate (no "your-xxx" o "xxxxx")
- [ ] Server riavviato
- [ ] Autocomplete funziona
- [ ] Google login funziona

---

**Se ancora non funziona, vedi `FIX_CONFIGURAZIONE_LOCALE.md` per troubleshooting dettagliato!**

