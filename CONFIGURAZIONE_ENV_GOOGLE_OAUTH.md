# 🔐 Configurazione Variabili d'Ambiente - Google OAuth

**Guida completa passo-passo per configurare l'autenticazione Google**

---

## 📋 VARIABILI RICHIESTE

Per l'autenticazione Google OAuth, servono queste **3 variabili** nel file `.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=chiave-segreta-lunga
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
```

---

## ✅ STATO ATTUALE

Ho verificato il tuo `.env.local` e ho trovato:

### ✅ Esempio Configurazione Corretta (placeholders):
- `NEXTAUTH_URL` → `http://localhost:3000` ✅
- `NEXTAUTH_SECRET` → `your-long-random-secret` ✅
- `GOOGLE_CLIENT_ID` → `YOUR_GOOGLE_CLIENT_ID` ✅
- `GOOGLE_CLIENT_SECRET` → `YOUR_GOOGLE_CLIENT_SECRET` ✅

---

## 🔧 PROCEDURA COMPLETA

### STEP 1: Verifica/Ottieni Credenziali da Google Cloud Console

#### 1.1 Accedi a Google Cloud Console

1. **Vai su:** https://console.cloud.google.com/
2. **Accedi** con il tuo account Google
3. **Seleziona progetto:** "spedire-sicuro-geocoding" (o il tuo progetto)

#### 1.2 Vai alle Credenziali

1. **Menu laterale** → **APIs & Services** → **Credentials**
2. **Individua** il tuo OAuth 2.0 Client ID nella lista delle credenziali.
3. **Clicca** sul Client ID per aprirlo

#### 1.3 Copia Client Secret

1. **Scorri** fino a **"Client secret"**
2. **Se è nascosto:**
   - Clicca sull'icona dell'occhio 👁️ per mostrarlo
   - Oppure clicca **"RESET SECRET"** per generarne uno nuovo
3. **Copia** il Client Secret completo

**⚠️ IMPORTANTE:**
- Il Client Secret deve essere **lungo** (40-60 caratteri dopo `GOCSPX-`)
- Formato: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Copia **TUTTO**, non solo una parte

#### 1.4 Verifica Callback URL

1. Nella stessa pagina, scorri fino a **"Authorized redirect URIs"**
2. **Verifica** che ci sia:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
3. **Se manca**, aggiungilo:
   - Clicca **"+ ADD URI"**
   - Incolla: `http://localhost:3000/api/auth/callback/google`
   - Clicca **"SAVE"**

---

### STEP 2: Aggiorna .env.local

#### 2.1 Apri il File

1. **Apri** il file `.env.local` nella cartella:
   ```
   D:\spediresicuro-master\.env.local
   ```

#### 2.2 Trova le Variabili Google OAuth

Cerca questa sezione (circa alla fine del file):

```env
# GOOGLE OAUTH
# Ottieni le credenziali da: https://console.cloud.google.com/apis/credentials  
# Callback URL: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

#### 2.3 Aggiorna GOOGLE_CLIENT_SECRET

1. **Trova** la riga:
   ```env
   GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
   ```

2. **Sostituisci** con il valore completo che hai copiato da Google Cloud Console:
   ```env
   GOOGLE_CLIENT_SECRET=GOCSPX-[incolla-qui-il-valore-completo]
   ```

3. **Esempio** di come dovrebbe essere (con valore completo):
   ```env
   GOOGLE_CLIENT_SECRET=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xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

4. **Salva** il file (Ctrl+S)

---

### STEP 3: Verifica Formato

Il Client Secret dovrebbe:
- ✅ Iniziare con `GOCSPX-`
- ✅ Essere lungo almeno **40-60 caratteri** dopo `GOCSPX-`
- ✅ Non avere spazi
- ✅ Essere tutto su una riga

**Esempio corretto:**
```env
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

**Esempio sbagliato (troppo corto):**
```env
GOOGLE_CLIENT_SECRET=short
```

---

### STEP 4: Riavvia il Server

1. **Ferma** il server se è in esecuzione (Ctrl+C nel terminale)
2. **Riavvia:**
   ```bash
   npm run dev
   ```

3. **Verifica** nei log che vedi:
   ```
   🔍 OAuth Config Check: {
     google: '✅ Configurato',
     nextAuthUrl: 'http://localhost:3000'
   }
   ```

---

### STEP 5: Test Login Google

1. **Vai su:** http://localhost:3000/login
2. **Clicca** "Continua con Google"
3. **Dovrebbe:**
   - ✅ Aprire la schermata di autorizzazione Google
   - ✅ Non mostrare errori "invalid_client"
   - ✅ Permettere il login con il tuo account Google

---

## 🆘 SE IL CLIENT SECRET NON ESISTE O È STATO ELIMINATO

### Opzione 1: Rigenera il Client Secret

1. **Vai su:** Google Cloud Console → APIs & Services → Credentials
2. **Clicca** sul tuo OAuth 2.0 Client ID
3. **Scorri** fino a "Client secret"
4. **Clicca** "RESET SECRET" o "GENERATE NEW SECRET"
5. **Copia** il nuovo secret generato
6. **Aggiorna** `.env.local` con il nuovo valore

### Opzione 2: Crea Nuovo Client OAuth

Se non riesci a rigenerare, crea un nuovo Client OAuth:

1. **Vai su:** Google Cloud Console → APIs & Services → Credentials
2. **Clicca** "+ CREATE CREDENTIALS" → "OAuth client ID"
3. **Tipo applicazione:** Web application
4. **Nome:** SpedireSicuro (o quello che preferisci)
5. **Authorized redirect URIs:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```
6. **Clicca** "CREATE"
7. **Copia** Client ID e Client Secret
8. **Aggiorna** `.env.local` con i nuovi valori

---

## 📝 TEMPLATE FINALE .env.local

Dopo la configurazione, la sezione OAuth dovrebbe essere così:

```env
# ============================================
# SICUREZZA - NEXTAUTH
# ============================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=YTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5NzEzYmM1ZGYtYTEzNS00NmQzLTkwZTUtOTYyNDNmMzJmZGQ0

# ============================================
# GOOGLE OAUTH
# ============================================
# Ottieni le credenziali da: https://console.cloud.google.com/apis/credentials
# Callback URL: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=GOCSPX-[valore-completo-da-google-cloud-console]
```

---

## ✅ CHECKLIST VERIFICA FINALE

Dopo aver configurato, verifica:

- [ ] `NEXTAUTH_URL` è `http://localhost:3000`
- [ ] `NEXTAUTH_SECRET` è una stringa lunga (100+ caratteri)
- [ ] `GOOGLE_CLIENT_ID` termina con `.apps.googleusercontent.com`
- [ ] `GOOGLE_CLIENT_SECRET` inizia con `GOCSPX-` ed è lungo (40-60 caratteri dopo)
- [ ] Callback URL configurato in Google Cloud Console
- [ ] Server riavviato dopo modifiche
- [ ] Login Google funziona senza errori

---

## 🚨 ERRORI COMUNI

### Errore: "invalid_client"

**Causa:** Client ID o Secret non corrispondono

**Soluzione:**
1. Verifica che Client ID e Secret in `.env.local` corrispondano a quelli in Google Cloud Console
2. Verifica che non ci siano spazi o caratteri extra
3. Riavvia il server

### Errore: "redirect_uri_mismatch"

**Causa:** Callback URL non corrisponde

**Soluzione:**
1. Verifica che il callback URL in Google Cloud Console sia ESATTAMENTE:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
2. Nessuno spazio, nessun carattere extra
3. Porta corretta (3000, non 3001)

### Errore: "Access denied"

**Causa:** Email non è nella lista Test users

**Soluzione:**
1. Vai su Google Cloud Console → OAuth Consent Screen
2. Scorri fino a "Test users"
3. Clicca "+ ADD USERS"
4. Aggiungi la tua email Google
5. Clicca "ADD"

---

## 📊 RIEPILOGO VARIABILI

### Variabili OBBLIGATORIE per Google OAuth:

| Variabile | Valore Esempio | Formato |
|-----------|----------------|---------|
| `NEXTAUTH_URL` | `http://localhost:3000` | URL completo |
| `NEXTAUTH_SECRET` | `YTc2M2MyYWEt...` | Stringa lunga (100+ caratteri) |
| `GOOGLE_CLIENT_ID` | `YOUR_GOOGLE_CLIENT_ID` | Fornito da Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `YOUR_GOOGLE_CLIENT_SECRET` | Fornito da Google Cloud Console |

---

## 🎯 PROSSIMI PASSI

Dopo aver configurato:

1. ✅ **Testa login Google** su http://localhost:3000/login
2. ✅ **Verifica** che funzioni senza errori
3. ✅ **Per produzione:** Configura le stesse variabili su Vercel con URL produzione

---

**Dopo aver completato questi step, l'autenticazione Google dovrebbe funzionare!** ✅

**Hai bisogno di aiuto per qualche step specifico?** 🚀


