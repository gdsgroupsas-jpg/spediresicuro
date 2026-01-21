# 🔍 Debug Redirect a Login dopo OAuth

## 🎯 Problema

Dopo il login con Google, l'utente viene reindirizzato alla pagina di login invece che al dashboard.

## 🔧 Modifiche Applicate

Ho aggiunto:

1. ✅ **Logging dettagliato** nel layout del dashboard per vedere se la sessione viene trovata
2. ✅ **Logging dettagliato** nel callback JWT per vedere se il token viene creato correttamente
3. ✅ **Logging dettagliato** nel callback session per vedere se la sessione viene creata correttamente
4. ✅ **Verifica esplicita** nel redirect callback per evitare redirect a `/login` dopo OAuth

## 📋 Come Debuggare

### 1. Apri la Console del Browser

1. Vai su `https://spediresicuro.vercel.app/login`
2. Premi **F12** per aprire la console
3. Vai alla tab **Console**

### 2. Prova il Login con Google

1. Clicca su **"Continua con Google"**
2. Completa il login con Google
3. **Guarda attentamente i log** nella console

### 3. Cerca Questi Messaggi

Dovresti vedere questi messaggi in ordine:

#### ✅ Messaggi Normali (Login Funzionante):

```
🔐 [LOGIN] Tentativo login Google OAuth...
✅ [LOGIN] signIn Google chiamato, redirect in corso...
🔐 [NEXTAUTH] signIn callback chiamato: { provider: 'google', email: '...', ... }
📝 [NEXTAUTH] Creazione/aggiornamento utente OAuth per: ...
👤 [NEXTAUTH] Utente esistente trovato: true/false
✅ [NEXTAUTH] signIn callback completato con successo
🔐 [NEXTAUTH] jwt callback - creazione token per utente: { email: '...', role: '...', provider: 'google' }
🔄 [NEXTAUTH] redirect callback chiamato: { url: '/dashboard', baseUrl: 'https://spediresicuro.vercel.app', ... }
✅ [NEXTAUTH] Redirect a dashboard: https://spediresicuro.vercel.app/dashboard
🔐 [NEXTAUTH] session callback chiamato: { hasSession: true, hasUser: true, tokenEmail: '...', ... }
✅ [NEXTAUTH] Session aggiornata: { email: '...', role: '...', provider: 'google' }
🔍 [DASHBOARD LAYOUT] Verifica sessione: { hasSession: true, hasUser: true, email: '...', ... }
```

#### ❌ Messaggi di Errore (Cosa Cercare):

### Errore 1: Sessione non trovata nel layout

```
🔍 [DASHBOARD LAYOUT] Verifica sessione: { hasSession: false, hasUser: false, ... }
❌ [DASHBOARD LAYOUT] Nessuna sessione trovata, redirect a /login
```

**Causa:** La sessione non viene creata correttamente dopo il callback OAuth.

**Possibili Soluzioni:**

1. Verifica che `NEXTAUTH_SECRET` sia configurato correttamente su Vercel
2. Verifica che i cookie vengano salvati correttamente (controlla le impostazioni del browser)
3. Verifica che l'URL di callback in Google Console sia corretto

### Errore 2: Token non creato

```
🔐 [NEXTAUTH] jwt callback - creazione token per utente: ...
```

Se questo messaggio **NON appare**, significa che il token non viene creato.

**Possibili Soluzioni:**

1. Verifica che il callback `signIn` ritorni `true`
2. Verifica che non ci siano errori nella creazione dell'utente nel database

### Errore 3: Redirect a /login invece che a /dashboard

```
🔄 [NEXTAUTH] redirect callback chiamato: { url: '/login', baseUrl: '...', ... }
⚠️ [NEXTAUTH] URL è /login, reindirizzo a dashboard: https://spediresicuro.vercel.app/dashboard
```

Se vedi questo messaggio, significa che NextAuth stava per reindirizzare a `/login`, ma ora viene corretto automaticamente.

### Errore 4: Session callback non chiamato

Se il messaggio `🔐 [NEXTAUTH] session callback chiamato` **NON appare**, significa che la sessione non viene creata.

**Possibili Soluzioni:**

1. Verifica che `NEXTAUTH_SECRET` sia configurato correttamente
2. Verifica che i cookie vengano salvati correttamente

## 🔍 Verifica Configurazione

### 1. Verifica NEXTAUTH_SECRET

1. Vai su Vercel Dashboard → Settings → Environment Variables
2. Verifica che `NEXTAUTH_SECRET` sia configurato
3. Deve essere una stringa casuale (genera con: `openssl rand -base64 32`)

### 2. Verifica NEXTAUTH_URL

1. Vai su Vercel Dashboard → Settings → Environment Variables
2. Verifica che `NEXTAUTH_URL` sia configurato su `https://spediresicuro.vercel.app`
3. **NON** deve essere `http://localhost:3000`

### 3. Verifica Google Console

1. Vai su Google Cloud Console → Credentials → OAuth Client
2. Verifica che **Authorized redirect URIs** contenga:
   ```
   https://spediresicuro.vercel.app/api/auth/callback/google
   ```
3. Verifica che **Authorized JavaScript origins** contenga:
   ```
   https://spediresicuro.vercel.app
   ```

### 4. Verifica Cookie del Browser

1. Apri la console del browser (F12)
2. Vai alla tab **Application** (Chrome) o **Storage** (Firefox)
3. Vai su **Cookies** → `https://spediresicuro.vercel.app`
4. Cerca i cookie che iniziano con `next-auth.`
5. Se non ci sono cookie, potrebbe essere un problema di configurazione

## 📞 Cosa Fare Se Il Problema Persiste

1. **Copia tutti i log** dalla console del browser
2. **Copia i log** da Vercel (Dashboard → Deployments → Logs)
3. **Verifica** che tutte le variabili d'ambiente siano configurate correttamente
4. **Prova** a fare un nuovo deploy dopo aver modificato le variabili

## ✅ Checklist

Prima di considerare il problema risolto, verifica:

- [ ] I log mostrano che la sessione viene creata correttamente
- [ ] Il layout del dashboard trova la sessione
- [ ] Il redirect callback reindirizza a `/dashboard` e non a `/login`
- [ ] I cookie vengono salvati correttamente nel browser
- [ ] `NEXTAUTH_SECRET` è configurato su Vercel
- [ ] `NEXTAUTH_URL` è configurato correttamente su Vercel
- [ ] Google Console ha l'URL di produzione configurato

---

**Ultimo aggiornamento:** Questa guida è stata creata per risolvere il problema di redirect a login dopo OAuth.
