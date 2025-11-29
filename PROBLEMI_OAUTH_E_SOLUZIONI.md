# 🔧 Problemi OAuth e Soluzioni - SpedireSicuro.it

## ❌ PROBLEMA #1: Google OAuth - Credenziali Non Configurate

### 🔍 Evidenza
**Errore visualizzato:**
```
Accesso bloccato: errore di autorizzazione
The OAuth client was not found
Errore 401: invalid_client
```

### 🔎 Causa
Il file `.env.local` contiene ancora il **valore placeholder**:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### ✅ Soluzione

**❌ ATTUALE (SBAGLIATO):**
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**✅ DOVREBBE ESSERE:**
```env
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789
```

---

## ❌ PROBLEMA #2: GitHub OAuth - Credenziali Non Configurate

### 🔍 Evidenza
**Errore visualizzato:**
- 404 Page not found
- URL richiesta contiene: `client_id=your-github-client-id`

### 🔎 Causa
Il file `.env.local` contiene ancora il **valore placeholder**:
```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### ✅ Soluzione

**❌ ATTUALE (SBAGLIATO):**
```env
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

**✅ DOVREBBE ESSERE:**
```env
GITHUB_CLIENT_ID=Iv1.abc123def456ghi789
GITHUB_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678
```

---

## 📋 CHECKLIST DI CONFIGURAZIONE

### ✅ Passo 1: Aggiorna il file .env.local

1. **Apri** il file `.env.local` nella root del progetto
2. **Trova** queste righe (intorno alla riga 70-80):
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   ```
3. **Sostituisci** i placeholder con i valori REALI (vedi passi 2 e 3)
4. **Salva** il file

---

### ✅ Passo 2: Ottieni Credenziali da Google Cloud Console

#### 2.1 Accedi a Google Cloud Console
1. Vai su: **https://console.cloud.google.com/**
2. **Accedi** con il tuo account Google
3. **Seleziona** il progetto "SpedireSicuro" (o creane uno nuovo)

#### 2.2 Vai alle Credenziali
1. Nel menu laterale, vai su **"APIs & Services"** → **"Credentials"**
2. Se non hai ancora creato un OAuth Client ID, segui `GUIDA_CONFIGURAZIONE_OAUTH.md` (sezione Google OAuth)

#### 2.3 Copia le Credenziali
1. **Clicca** sul tuo OAuth 2.0 Client ID (tipo "Web application")
2. **Copia** questi valori:
   - **Client ID** → Usa per `GOOGLE_CLIENT_ID`
   - **Client Secret** → Usa per `GOOGLE_CLIENT_SECRET`

#### 2.4 Verifica Callback URL
Assicurati che il callback URL sia configurato:
- **Sviluppo:** `http://localhost:3001/api/auth/callback/google` (o 3000 se usi quella porta)
- **Produzione:** `https://tuodominio.com/api/auth/callback/google`

---

### ✅ Passo 3: Ottieni Credenziali da GitHub

#### 3.1 Accedi a GitHub Developer Settings
1. Vai su: **https://github.com/settings/developers**
2. **Accedi** con il tuo account GitHub
3. **Clicca** su **"OAuth Apps"** nel menu laterale

#### 3.2 Seleziona o Crea OAuth App
1. Se hai già creato l'app "SpedireSicuro", **clicca** su di essa
2. Se non l'hai ancora creata, segui `GUIDA_CONFIGURAZIONE_OAUTH.md` (sezione GitHub OAuth)

#### 3.3 Copia le Credenziali
1. **Client ID** → Copia e usa per `GITHUB_CLIENT_ID`
2. **Client Secret** → 
   - Se non lo vedi, clicca **"Generate a new client secret"**
   - **Copia** il valore generato e usa per `GITHUB_CLIENT_SECRET`
   - ⚠️ **IMPORTANTE:** Copialo subito, non potrai più vederlo!

#### 3.4 Verifica Callback URL
Assicurati che il callback URL sia configurato:
- **Sviluppo:** `http://localhost:3001/api/auth/callback/github` (o 3000 se usi quella porta)
- **Produzione:** `https://tuodominio.com/api/auth/callback/github`

---

### ✅ Passo 4: Aggiorna .env.local

1. **Apri** `.env.local`
2. **Sostituisci** i placeholder con i valori reali:

```env
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789

# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.abc123def456ghi789
GITHUB_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678
```

3. **Verifica** che:
   - Non ci siano spazi prima o dopo il `=`
   - Non ci siano virgolette intorno ai valori
   - Ogni valore sia su una riga separata

4. **Salva** il file

---

### ✅ Passo 5: Riavvia il Server

1. **Ferma** il server (Ctrl+C nel terminale)
2. **Riavvia:**
   ```bash
   npm run dev
   ```

---

### ✅ Passo 6: Testa

1. Vai su `http://localhost:3001/login` (o 3000 se usi quella porta)
2. **Clicca** su "Continua con Google" o "Continua con GitHub"
3. **Dovresti vedere** la schermata di autorizzazione (non l'errore)
4. **Dopo l'autorizzazione**, verrai reindirizzato al dashboard

---

## ⚠️ Problemi Comuni e Soluzioni

### Problema: "redirect_uri_mismatch"

**Causa:** Il callback URL nel provider non corrisponde

**Soluzione:**
1. Verifica la porta del server (3000 o 3001)
2. Aggiorna il callback URL nel provider:
   - Google: `http://localhost:3001/api/auth/callback/google`
   - GitHub: `http://localhost:3001/api/auth/callback/github`

### Problema: Credenziali corrette ma errore persiste

**Soluzione:**
1. Verifica che non ci siano **spazi** nelle credenziali
2. Verifica che le credenziali siano su **righe separate**
3. **Riavvia** il server dopo aver modificato `.env.local`
4. Verifica che il Client ID esista ancora nel provider

### Problema: "OAuth client was not found"

**Causa:** Il Client ID non esiste o è stato eliminato

**Soluzione:**
1. Vai su Google Cloud Console
2. Verifica che il Client ID esista ancora
3. Se è stato eliminato, creane uno nuovo
4. Aggiorna `.env.local` con il nuovo Client ID

---

## 📝 Template .env.local Corretto

```env
# ============================================
# OAUTH PROVIDERS
# ============================================

# Google OAuth
GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789

# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.abc123def456ghi789
GITHUB_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678
```

---

## ✅ Checklist Finale

Prima di testare, verifica:

- [ ] `GOOGLE_CLIENT_ID` non contiene `your-google-client-id`
- [ ] `GOOGLE_CLIENT_SECRET` non contiene `your-google-client-secret`
- [ ] `GITHUB_CLIENT_ID` non contiene `your-github-client-id`
- [ ] `GITHUB_CLIENT_SECRET` non contiene `your-github-client-secret`
- [ ] Nessun valore ha spazi extra o caratteri strani
- [ ] I callback URL nei provider corrispondono alla porta del server
- [ ] Il server è stato riavviato dopo le modifiche

---

## 💡 Nota Importante

**Le credenziali OAuth sono opzionali!**

Se non vuoi configurarle ora, puoi comunque:
- ✅ Usare login/registrazione con email e password
- ✅ Usare le credenziali demo: `admin@spediresicuro.it` / `admin123`

I pulsanti OAuth funzioneranno solo dopo aver configurato le credenziali.

---

**Ultimo aggiornamento:** Guida completa problemi OAuth e soluzioni ✅



