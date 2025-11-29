# 🌐 Variabili d'Ambiente su Vercel - Guida Completa

## 🤔 Domanda: Come Funziona in Produzione?

**Risposta breve:** Su Vercel non usi `.env.local`! Configuri le variabili direttamente nel dashboard di Vercel.

---

## 📋 Differenza tra Locale e Produzione

### 🏠 Sviluppo Locale (sul tuo PC)

- **File:** `.env.local` (sul tuo computer)
- **Dove:** Nella cartella del progetto
- **Uso:** Solo per te, durante lo sviluppo
- **Git:** ❌ **NON va committato** (è nel `.gitignore`)

### 🌐 Produzione (su Vercel)

- **File:** Variabili d'ambiente configurate nel dashboard Vercel
- **Dove:** Nel pannello di controllo di Vercel
- **Uso:** Per l'app pubblica online
- **Sicurezza:** ✅ Protette e criptate da Vercel

---

## 🔧 Come Configurare su Vercel

### Passo 1: Accedi a Vercel

1. Vai su: **https://vercel.com/**
2. Accedi al tuo account
3. Seleziona il progetto **"spediresicuro"** (o il nome del tuo progetto)

### Passo 2: Aggiungi Variabili d'Ambiente

1. Vai su: **Settings** → **Environment Variables**
2. Clicca **"Add New"**
3. Aggiungi ogni variabile una per una:

#### Variabili Obbligatorie:

```
NEXTAUTH_SECRET
Valore: [la stessa chiave che hai in .env.local]
Environment: Production, Preview, Development (seleziona tutte)

NEXTAUTH_URL
Valore: https://tuodominio.vercel.app
Environment: Production, Preview, Development

NEXT_PUBLIC_APP_URL
Valore: https://tuodominio.vercel.app
Environment: Production, Preview, Development
```

#### Variabili OAuth (se usi Google/GitHub):

```
GOOGLE_CLIENT_ID
Valore: your-google-client-id.apps.googleusercontent.com
Environment: Production, Preview, Development

GOOGLE_CLIENT_SECRET
Valore: your-google-client-secret
Environment: Production, Preview, Development

GITHUB_CLIENT_ID
Valore: [il tuo GitHub Client ID]
Environment: Production, Preview, Development

GITHUB_CLIENT_SECRET
Valore: [il tuo GitHub Client Secret]
Environment: Production, Preview, Development
```

### Passo 3: Salva e Riavvia

1. Clicca **"Save"** per ogni variabile
2. Vai su **Deployments**
3. Clicca sui **3 puntini** del deployment più recente
4. Clicca **"Redeploy"**
5. ✅ L'app userà le nuove variabili!

---

## ⚠️ IMPORTANTE: Callback URL per Produzione

Quando configuri OAuth su Google Cloud Console, devi aggiungere **ANCHE** il callback URL di produzione:

### Google Cloud Console:

1. Vai su: **APIs & Services** → **Credentials**
2. Clicca sul tuo **OAuth 2.0 Client ID**
3. In **"Authorized redirect URIs"**, aggiungi:
   ```
   http://localhost:3000/api/auth/callback/google  (sviluppo)
   https://tuodominio.vercel.app/api/auth/callback/google  (produzione)
   ```
4. Salva

### GitHub OAuth:

1. Vai su: **GitHub Settings** → **Developer settings** → **OAuth Apps**
2. Clicca sulla tua app
3. In **"Authorization callback URL"**, aggiungi:
   ```
   https://tuodominio.vercel.app/api/auth/callback/github
   ```
4. Salva

---

## 🔐 Sicurezza

### ✅ Cosa è Sicuro:

- **Variabili su Vercel:** Criptate e protette
- **`.env.local` locale:** Non committato (nel `.gitignore`)
- **Client Secret:** Mai visibile nel codice

### ❌ Cosa NON Fare:

- ❌ **NON committare** `.env.local` su Git
- ❌ **NON condividere** le chiavi segrete
- ❌ **NON mettere** le variabili nel codice sorgente

---

## 📝 Checklist Deploy

Prima di fare deploy su Vercel:

- [ ] Variabili d'ambiente configurate nel dashboard Vercel
- [ ] `NEXTAUTH_URL` impostato all'URL di produzione
- [ ] Callback URL OAuth aggiornati per produzione
- [ ] `.env.local` nel `.gitignore` (già fatto)
- [ ] Test locale funzionante

---

## 🆘 Troubleshooting

### Problema: "Invalid client" in produzione

**Causa:** Callback URL non configurato per produzione

**Soluzione:**
1. Aggiungi callback URL di produzione in Google Cloud Console
2. Aggiorna `NEXTAUTH_URL` su Vercel con URL di produzione
3. Riavvia il deployment

### Problema: Variabili non funzionano

**Causa:** Variabili non configurate o deployment non riavviato

**Soluzione:**
1. Verifica variabili nel dashboard Vercel
2. Riavvia il deployment
3. Controlla i log del deployment

---

## 💡 Riassunto

1. **Locale:** Usi `.env.local` (non committato)
2. **Produzione:** Configuri variabili nel dashboard Vercel
3. **OAuth:** Aggiungi callback URL sia per locale che produzione
4. **Sicurezza:** Mai committare chiavi segrete

---

**Ultimo aggiornamento:** Guida variabili ambiente Vercel ✅



