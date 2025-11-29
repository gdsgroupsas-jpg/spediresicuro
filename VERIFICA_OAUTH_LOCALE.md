# 🔍 Verifica OAuth in Locale - Problemi e Soluzioni

## ⚠️ PROBLEMA CRITICO: Utenti di Prova

Dallo screenshot di Google Cloud Console vedo questo avviso:

> **"L'accesso OAuth è limitato agli utenti di prova elencati nella tua schermata di consenso OAuth"**

### 🔴 Questo è il Problema Principale!

Se l'app OAuth è in modalità **"Testing"** (non pubblicata), **SOLO gli utenti di prova** possono accedere.

### ✅ Soluzione: Aggiungi Utenti di Prova

1. **Vai su Google Cloud Console:**
   - https://console.cloud.google.com/
   - Seleziona progetto "spedire-sicuro-geocoding"

2. **Vai su OAuth Consent Screen:**
   - Menu laterale → **APIs & Services** → **OAuth consent screen**

3. **Aggiungi Utenti di Prova:**
   - Scorri fino a **"Test users"**
   - Clicca **"+ ADD USERS"**
   - Inserisci il tuo indirizzo email Google: `gdsgroupsas@gmail.com`
   - Clicca **"ADD"**

4. **Oppure Pubblica l'App (per produzione):**
   - Nella stessa schermata, clicca **"PUBLISH APP"**
   - ⚠️ Richiede verifica Google (processo più lungo)

---

## ✅ Verifica Configurazione Attuale

### Credenziali Google OAuth
- ✅ **Client ID:** `your-google-client-id.apps.googleusercontent.com`
- ✅ **Client Secret:** `your-google-client-secret`
- ✅ Configurate correttamente in `.env.local`

### Configurazione NextAuth
- ✅ **NEXTAUTH_SECRET:** Configurato
- ✅ **NEXTAUTH_URL:** `http://localhost:3001`
- ✅ **NEXT_PUBLIC_APP_URL:** `http://localhost:3001`

---

## 🔧 Verifica Callback URL in Google Cloud Console

**IMPORTANTE:** Verifica che il callback URL sia configurato correttamente:

1. Vai su: **APIs & Services** → **Credentials**
2. Clicca sul tuo OAuth 2.0 Client ID
3. Verifica **"Authorized redirect URIs"**:
   ```
   http://localhost:3001/api/auth/callback/google
   ```
4. Se non c'è, **aggiungilo** e salva

---

## 🧪 Test Completo

### 1. Verifica File .env.local

Esegui:
```bash
Get-Content .env.local | Select-String -Pattern "GOOGLE_CLIENT"
```

Dovresti vedere:
```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Riavvia il Server

```bash
npm run dev
```

### 3. Testa OAuth

1. Vai su: `http://localhost:3001/login`
2. Clicca "Continua con Google"
3. **Se vedi errore "Access denied":**
   - → Aggiungi il tuo email come utente di prova (vedi sopra)
4. **Se vedi schermata Google:**
   - → Seleziona account e autorizza
   - → Dovresti essere reindirizzato al dashboard

---

## 🐛 Problemi Comuni

### Errore: "Access blocked: This app's request is invalid"

**Causa:** Callback URL non configurato o errato

**Soluzione:**
1. Verifica callback URL in Google Cloud Console
2. Deve essere esattamente: `http://localhost:3001/api/auth/callback/google`
3. Nessuno spazio, nessun carattere extra

### Errore: "Access denied"

**Causa:** Email non è nella lista utenti di prova

**Soluzione:**
1. Aggiungi il tuo email in OAuth Consent Screen → Test users
2. Oppure pubblica l'app

### Errore: "redirect_uri_mismatch"

**Causa:** Callback URL non corrisponde

**Soluzione:**
1. Verifica porta del server (3000 o 3001)
2. Aggiorna callback URL nel provider
3. Aggiorna `NEXTAUTH_URL` in `.env.local`

---

## ✅ Checklist Finale

Prima di testare, verifica:

- [ ] Client ID corretto in `.env.local` (dallo screenshot)
- [ ] Client Secret corretto in `.env.local` (dallo screenshot)
- [ ] Callback URL configurato in Google Cloud Console: `http://localhost:3001/api/auth/callback/google`
- [ ] Email aggiunta come utente di prova in OAuth Consent Screen
- [ ] `NEXTAUTH_URL=http://localhost:3001` in `.env.local`
- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3001` in `.env.local`
- [ ] Server riavviato dopo modifiche

---

**Ultimo aggiornamento:** Verifica completa OAuth locale ✅



