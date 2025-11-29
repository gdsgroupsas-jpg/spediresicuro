# 🔐 Guida Completa: Configurazione OAuth per SpedireSicuro.it

## 📋 Indice
1. [Configurazione Google OAuth](#google-oauth)
2. [Configurazione GitHub OAuth](#github-oauth)
3. [Test e Verifica](#test-e-verifica)

---

## 🔵 Google OAuth

### Passo 1: Crea un Progetto su Google Cloud Console

1. **Vai su:** https://console.cloud.google.com/
2. **Accedi** con il tuo account Google
3. **Clicca** sul menu a tendina in alto (dove c'è il nome del progetto)
4. **Clicca** su "**New Project**" (Nuovo Progetto)
5. **Inserisci:**
   - **Project name:** `SpedireSicuro` (o un nome a tua scelta)
6. **Clicca** "**Create**" (Crea)
7. **Attendi** qualche secondo che il progetto venga creato
8. **Seleziona** il progetto appena creato dal menu a tendina in alto

### Passo 2: Abilita Google+ API

1. Nel menu laterale sinistro, vai su **"APIs & Services"** → **"Library"**
2. Cerca **"Google+ API"** nella barra di ricerca
3. **Clicca** su "**Google+ API**"
4. **Clicca** il pulsante "**Enable**" (Abilita)

### Passo 3: Configura Schermata di Consenso OAuth

1. Vai su **"APIs & Services"** → **"OAuth consent screen"**
2. **User Type:** Seleziona **"External"** (Esterno)
3. **Clicca** "**Create**"
4. **Compila il form:**
   - **App name:** `SpedireSicuro`
   - **User support email:** La tua email
   - **Developer contact information:** La tua email
5. **Clicca** "**Save and Continue**"
6. **Scopes:** Non modificare nulla, clicca "**Save and Continue**"
7. **Test users:** Non necessario per ora, clicca "**Save and Continue**"
8. **Summary:** Clicca "**Back to Dashboard**"

### Passo 4: Crea OAuth 2.0 Client ID

1. Vai su **"APIs & Services"** → **"Credentials"**
2. **Clicca** su "**Create Credentials**" (in alto)
3. **Seleziona** "**OAuth client ID**"
4. **Application type:** Seleziona **"Web application"**
5. **Name:** `SpedireSicuro Web Client` (o un nome a tua scelta)
6. **Authorized JavaScript origins:**
   - Clicca "**+ ADD URI**"
   - Inserisci: `http://localhost:3000`
   - (Per produzione aggiungi anche: `https://tuodominio.com`)
7. **Authorized redirect URIs:**
   - Clicca "**+ ADD URI**"
   - Inserisci: `http://localhost:3000/api/auth/callback/google`
   - (Per produzione aggiungi anche: `https://tuodominio.com/api/auth/callback/google`)
8. **Clicca** "**Create**"
9. **IMPORTANTE:** Ti apparirà una finestra con:
   - **Your Client ID:** (es. `123456789-abc123def456.apps.googleusercontent.com`)
   - **Your Client Secret:** (es. `GOCSPX-abc123def456ghi789`)
10. **COPIA ENTRAMBI** questi valori e salvali da qualche parte (li userai dopo)

### Passo 5: Aggiungi Credenziali a .env.local

1. **Apri** il file `.env.local` nel progetto
2. **Trova** le righe:
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```
3. **Sostituisci** con i tuoi valori:
   ```env
   GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789
   ```
4. **Salva** il file

### Passo 6: Riavvia il Server

1. **Ferma** il server di sviluppo (premi `Ctrl+C` nel terminale)
2. **Riavvia** con:
   ```bash
   npm run dev
   ```

### ✅ Google OAuth Configurato!

Ora puoi testare:
1. Vai su `http://localhost:3000/login`
2. Clicca su "**Continua con Google**"
3. Dovresti vedere la schermata di login Google
4. Dopo il login, verrai reindirizzato al dashboard

---

## 🐙 GitHub OAuth

### Passo 1: Crea OAuth App su GitHub

1. **Vai su:** https://github.com/settings/developers
2. **Accedi** con il tuo account GitHub
3. **Clicca** su "**OAuth Apps**" nel menu laterale sinistro
4. **Clicca** sul pulsante "**New OAuth App**" (in alto a destra)

### Passo 2: Compila il Form OAuth App

1. **Application name:** `SpedireSicuro` (o un nome a tua scelta)
2. **Homepage URL:**
   - Per sviluppo: `http://localhost:3000`
   - (Per produzione: `https://tuodominio.com`)
3. **Application description:** (opzionale) `SpedireSicuro - Gestione Spedizioni`
4. **Authorization callback URL:**
   - Per sviluppo: `http://localhost:3000/api/auth/callback/github`
   - (Per produzione: `https://tuodominio.com/api/auth/callback/github`)
5. **Clicca** "**Register application**"

### Passo 3: Ottieni Client ID e Client Secret

1. Dopo aver creato l'app, verrai reindirizzato alla pagina dell'app
2. **IMPORTANTE:** Ti appariranno:
   - **Client ID:** (es. `Iv1.abc123def456ghi789`)
   - **Client Secret:** (clicca "**Generate a new client secret**" se non lo vedi)
3. **COPIA ENTRAMBI** questi valori e salvali da qualche parte

### Passo 4: Aggiungi Credenziali a .env.local

1. **Apri** il file `.env.local` nel progetto
2. **Trova** le righe:
   ```env
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   ```
3. **Sostituisci** con i tuoi valori:
   ```env
   GITHUB_CLIENT_ID=Iv1.abc123def456ghi789
   GITHUB_CLIENT_SECRET=abc123def456ghi789jkl012mno345pqr678
   ```
4. **Salva** il file

### Passo 5: Riavvia il Server

1. **Ferma** il server di sviluppo (premi `Ctrl+C` nel terminale)
2. **Riavvia** con:
   ```bash
   npm run dev
   ```

### ✅ GitHub OAuth Configurato!

Ora puoi testare:
1. Vai su `http://localhost:3000/login`
2. Clicca su "**Continua con GitHub**"
3. Dovresti vedere la schermata di autorizzazione GitHub
4. Clicca "**Authorize**" (Autorizza)
5. Dopo l'autorizzazione, verrai reindirizzato al dashboard

---

## 🧪 Test e Verifica

### Verifica che le Credenziali Siano Configurate

1. **Apri** `.env.local`
2. **Verifica** che ci siano:
   ```env
   GOOGLE_CLIENT_ID=tuo-client-id-qui
   GOOGLE_CLIENT_SECRET=tuo-client-secret-qui
   GITHUB_CLIENT_ID=tuo-client-id-qui
   GITHUB_CLIENT_SECRET=tuo-client-secret-qui
   ```
3. **Assicurati** che non ci siano spazi extra o caratteri strani

### Test dei Provider OAuth

1. **Avvia** il server: `npm run dev`
2. **Vai** su `http://localhost:3000/login`
3. **Dovresti vedere** i pulsanti:
   - "Continua con Google"
   - "Continua con GitHub"
4. **Clicca** su uno dei pulsanti
5. **Dovresti essere reindirizzato** al provider per l'autorizzazione
6. **Dopo l'autorizzazione**, verrai reindirizzato al dashboard

### Problemi Comuni

#### "Invalid redirect URI"
- **Causa:** Il callback URL nel provider non corrisponde a quello nel codice
- **Soluzione:** Verifica che i callback URL siano esattamente:
  - Google: `http://localhost:3000/api/auth/callback/google`
  - GitHub: `http://localhost:3000/api/auth/callback/github`

#### "OAuth account not linked"
- **Causa:** Normale per nuovi utenti
- **Soluzione:** Il sistema crea automaticamente l'account, è normale

#### Pulsanti OAuth non visibili
- **Causa:** Le credenziali non sono configurate o il server non è stato riavviato
- **Soluzione:** 
  1. Verifica `.env.local`
  2. Riavvia il server

#### "Error 400: redirect_uri_mismatch"
- **Causa:** Il callback URL non è autorizzato nel provider
- **Soluzione:** Aggiungi esattamente `http://localhost:3000/api/auth/callback/google` (o `/github`) nei provider

---

## 📝 Note Importanti

1. **Non committare mai** `.env.local` nel repository Git
2. **Le credenziali OAuth sono opzionali** - l'app funziona anche senza (puoi usare login/registrazione normale)
3. **Per produzione**, usa URL di produzione nei callback:
   - `https://tuodominio.com/api/auth/callback/google`
   - `https://tuodominio.com/api/auth/callback/github`
4. **Mantieni le credenziali segrete** - non condividerle pubblicamente

---

## ✅ Checklist Completa

### Google OAuth
- [ ] Progetto creato su Google Cloud Console
- [ ] Google+ API abilitata
- [ ] Schermata di consenso OAuth configurata
- [ ] OAuth 2.0 Client ID creato
- [ ] Client ID e Client Secret copiati
- [ ] Credenziali aggiunte a `.env.local`
- [ ] Server riavviato
- [ ] Test effettuato con successo

### GitHub OAuth
- [ ] OAuth App creata su GitHub
- [ ] Client ID e Client Secret copiati
- [ ] Credenziali aggiunte a `.env.local`
- [ ] Server riavviato
- [ ] Test effettuato con successo

---

**Ultimo aggiornamento:** Guida completa per configurazione Google e GitHub OAuth ✅



