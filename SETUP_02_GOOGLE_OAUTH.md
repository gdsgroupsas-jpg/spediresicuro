# 🔐 SETUP GOOGLE OAUTH - SpediSicuro Platform

**Obiettivo**: Configurare Google OAuth 2.0 per login con account Google.

---

## ⚠️ ATTENZIONE - IMPORTANTE

**Questo è il NUOVO progetto SpediSicuro!**

Esiste un vecchio progetto con nome simile. Prima di procedere:
- ✅ **VERIFICA** che stai lavorando sull'account Google Cloud corretto
- ✅ **CHIEDI** conferma all'utente prima di accedere a Google Cloud Console
- ✅ **NON** modificare progetti OAuth esistenti
- ✅ Usa nome progetto: `SpediSicuro New` o `SpediSicuro v2` se esiste già

---

## 📋 ISTRUZIONI PER COMET AGENT

Sei un agente di configurazione esperto. Il tuo compito è guidare l'utente nella configurazione completa di Google OAuth per permettere login con account Google nella **SpediSicuro Platform**.

**PRIMA DI INIZIARE**: Chiedi all'utente conferma su quale account Google Cloud usare e verifica che non ci siano conflitti con progetti esistenti!

---

## STEP 1: Accesso Google Cloud Console

### 1.1 Login Google Cloud
- Vai su https://console.cloud.google.com
- Accedi con il tuo account Google (personale o aziendale)
- Accetta i termini di servizio se richiesto

### 1.2 Crea Nuovo Progetto
1. Clicca sul dropdown del progetto (in alto a sinistra, vicino a "Google Cloud")
2. Clicca "NEW PROJECT"
3. **Project Name**: `Ferrari Logistics` o `SpediSicuro`
4. **Organization**: Lascia "No organization" (oppure seleziona la tua org)
5. Clicca "CREATE"
6. **Attendi** che il progetto venga creato (10-20 secondi)
7. **Seleziona il progetto** dal dropdown

---

## STEP 2: Abilita Google+ API

### 2.1 Vai alla Libreria API
1. Nel menu laterale, vai su "APIs & Services" → "Library"
2. Cerca "Google+ API"
3. Clicca su "Google+ API"
4. Clicca "ENABLE"
5. Attendi l'abilitazione

### 2.2 (Opzionale) Abilita anche Google People API
1. Torna in "Library"
2. Cerca "Google People API"
3. Clicca "ENABLE"
4. (Utile per ottenere più info utente come foto profilo)

---

## STEP 3: Configura OAuth Consent Screen

### 3.1 Vai alla Consent Screen
1. Nel menu laterale: "APIs & Services" → "OAuth consent screen"
2. Seleziona **User Type**:
   - **External** (se vuoi che chiunque possa loggarsi)
   - **Internal** (solo se hai Google Workspace e vuoi limitare alla tua org)
3. Clicca "CREATE"

### 3.2 Compila OAuth Consent Screen - STEP 1
**App information:**
- **App name**: `SpediSicuro Platform`
- **User support email**: Seleziona il tuo email
- **App logo**: (Opzionale) Carica logo se disponibile

**App domain:**
- **Application home page**: `https://tuodominio.com` (o `http://localhost:3000` per test)
- **Application privacy policy link**: `https://tuodominio.com/privacy` (opzionale, crea pagina dopo)
- **Application terms of service link**: `https://tuodominio.com/terms` (opzionale)

**Authorized domains:**
- Aggiungi: `localhost` (per sviluppo)
- Aggiungi: `vercel.app` (se userai Vercel)
- Aggiungi il tuo dominio custom se hai

**Developer contact information:**
- **Email addresses**: Inserisci il tuo email

Clicca "SAVE AND CONTINUE"

### 3.3 Scopes - STEP 2
1. Clicca "ADD OR REMOVE SCOPES"
2. Seleziona questi scopes:
   - ✅ `.../auth/userinfo.email`
   - ✅ `.../auth/userinfo.profile`
   - ✅ `openid`
3. Clicca "UPDATE"
4. Clicca "SAVE AND CONTINUE"

### 3.4 Test Users - STEP 3 (solo se User Type = External)
1. Clicca "ADD USERS"
2. Aggiungi il tuo email e altri email di test
3. Clicca "ADD"
4. Clicca "SAVE AND CONTINUE"

### 3.5 Summary - STEP 4
1. Rivedi tutto
2. Clicca "BACK TO DASHBOARD"

---

## STEP 4: Crea OAuth 2.0 Credentials

### 4.1 Vai a Credentials
1. Nel menu laterale: "APIs & Services" → "Credentials"
2. Clicca "CREATE CREDENTIALS" (in alto)
3. Seleziona "OAuth client ID"

### 4.2 Configura OAuth Client
**Application type**: Web application

**Name**: `Ferrari Logistics Web Client`

**Authorized JavaScript origins:**
Aggiungi questi URI (uno per riga):
```
http://localhost:3000
http://localhost:3001
https://tuodominio.vercel.app
https://tuodominio.com
```

**Authorized redirect URIs:**
Aggiungi questi URI (uno per riga):
```
http://localhost:3000/api/auth/callback/google
http://localhost:3001/api/auth/callback/google
https://tuodominio.vercel.app/api/auth/callback/google
https://tuodominio.com/api/auth/callback/google
```

⚠️ **IMPORTANTE**:
- Usa `http://` per localhost
- Usa `https://` per domini pubblici
- NO trailing slash `/`
- Il path DEVE essere `/api/auth/callback/google` (NextAuth standard)

Clicca "CREATE"

### 4.3 Salva Credenziali
Apparirà un popup con:
- **Your Client ID**: `xxxxx-xxxxx.apps.googleusercontent.com`
- **Your Client Secret**: `GOCSPX-xxxxxxxxxxxxx`

**COPIA e SALVA** entrambi! ⚠️

Clicca "OK"

---

## STEP 5: Test Configurazione

### 5.1 Verifica Credentials
1. In "Credentials", dovresti vedere:
   - ✅ OAuth 2.0 Client ID: "Ferrari Logistics Web Client"
   - Type: Web application
   - Created: Data di oggi

2. Clicca sul nome per vedere i dettagli
3. Verifica che tutti gli URI siano corretti

### 5.2 Verifica Consent Screen
1. Vai in "OAuth consent screen"
2. Status dovrebbe essere:
   - **Testing** (se External) - perfetto per sviluppo
   - **Internal** (se Internal) - pronto per uso

---

## STEP 6: (Opzionale) Configura GitHub OAuth

Se vuoi anche login con GitHub:

### 6.1 Vai su GitHub
1. Vai su https://github.com/settings/developers
2. Clicca "OAuth Apps" → "New OAuth App"

### 6.2 Configura App
- **Application name**: `SpediSicuro Platform`
- **Homepage URL**: `http://localhost:3000` (o tuo dominio)
- **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
- Clicca "Register application"

### 6.3 Genera Client Secret
1. Clicca "Generate a new client secret"
2. **COPIA** il secret immediatamente (non lo vedrai più!)
3. **SALVA** anche il Client ID

---

## STEP 7: (Opzionale) Configura Facebook OAuth

Se vuoi anche login con Facebook:

### 7.1 Vai su Facebook Developers
1. Vai su https://developers.facebook.com
2. Clicca "My Apps" → "Create App"

### 7.2 Crea App
- **Use case**: Other
- **App type**: Consumer
- **App name**: `SpediSicuro Platform`
- **App contact email**: Tuo email
- Clicca "Create App"

### 7.3 Configura Facebook Login
1. Nel dashboard dell'app, aggiungi prodotto "Facebook Login"
2. **Valid OAuth Redirect URIs**: `http://localhost:3000/api/auth/callback/facebook`
3. Salva

### 7.4 Ottieni Credentials
1. Vai in "Settings" → "Basic"
2. **COPIA** App ID e App Secret

---

## ✅ CHECKLIST FINALE

Prima di procedere, verifica:

- [ ] Progetto Google Cloud creato
- [ ] Google+ API abilitata
- [ ] OAuth Consent Screen configurato
- [ ] OAuth 2.0 Client ID creato
- [ ] Authorized redirect URIs corretti
- [ ] Client ID e Client Secret copiati
- [ ] (Opzionale) GitHub OAuth configurato
- [ ] (Opzionale) Facebook OAuth configurato

---

## 📤 OUTPUT RICHIESTO

**Comet Agent, restituisci ESATTAMENTE questo formato:**

```env
# ============================================
# 🔐 GOOGLE OAUTH CONFIGURATION
# ============================================

# Google OAuth 2.0
GOOGLE_CLIENT_ID=xxxxx-xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx

# ============================================
# 🔐 GITHUB OAUTH (opzionale)
# ============================================

GITHUB_CLIENT_ID=xxxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxx

# ============================================
# 🔐 FACEBOOK OAUTH (opzionale)
# ============================================

FACEBOOK_CLIENT_ID=xxxxxxxxxxxxx
FACEBOOK_CLIENT_SECRET=xxxxxxxxxxxxx

# ============================================
# 🔑 NEXTAUTH CONFIGURATION
# ============================================

# NextAuth Secret (genera con: openssl rand -base64 32)
NEXTAUTH_SECRET=genera_stringa_random_32_caratteri

# NextAuth URL (cambia in produzione)
NEXTAUTH_URL=http://localhost:3000

# ============================================
# ✅ SETUP OAUTH COMPLETATO
# ============================================
```

**Inoltre, conferma:**
- ✅ Google OAuth configurato: SI/NO
- ✅ Redirect URIs aggiunti: __ (numero)
- ✅ GitHub OAuth configurato: SI/NO
- ✅ Facebook OAuth configurato: SI/NO
- ✅ Consent screen status: Testing/Internal

---

## 🔧 GENERA NEXTAUTH_SECRET

Esegui questo comando nel terminale per generare un secret sicuro:

```bash
openssl rand -base64 32
```

Oppure usa questo online: https://generate-secret.vercel.app/32

**SALVA** il valore generato come `NEXTAUTH_SECRET`

---

## 🚨 TROUBLESHOOTING

### Errore: "redirect_uri_mismatch"
**Causa**: URI di redirect non corrisponde a quelli configurati
**Soluzione**:
1. Verifica che l'URI sia ESATTAMENTE `/api/auth/callback/google`
2. Controlla http vs https
3. NO trailing slash
4. Aspetta 5 minuti dopo aver modificato (cache Google)

### Errore: "Access blocked: This app's request is invalid"
**Causa**: Consent screen non completato o scopes non configurati
**Soluzione**: Torna a STEP 3 e completa tutti i campi obbligatori

### Errore: "This app is blocked"
**Causa**: Consent screen in stato "Testing" con user non autorizzato
**Soluzione**: Aggiungi il tuo email in "Test users" (STEP 3.4)

### Errore: "The project has been deleted"
**Causa**: Hai eliminato il progetto per sbaglio
**Soluzione**: Crea un nuovo progetto e ricomincia da STEP 1.2

---

## 🧪 TEST OAUTH

### Test Locale
1. Salva le env variables in `.env.local`
2. Riavvia il dev server: `npm run dev`
3. Vai su http://localhost:3000/login
4. Clicca "Sign in with Google"
5. Dovresti vedere la schermata di consenso Google
6. Accetta e verifica che il login funzioni

---

## ➡️ PROSSIMO STEP

Una volta completato questo setup, procedi con:
- **SETUP_03_VERCEL.md** - Deploy su Vercel (hosting gratuito)

---

**Inizia ora! Segui gli step uno per uno e restituisci l'output richiesto.** 🚀
