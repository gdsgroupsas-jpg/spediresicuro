# 🔍 Debug Login Google - Guida Diagnostica

## 🎯 Cosa Fare Quando C'è un Errore

Ho aggiunto logging dettagliato per capire esattamente dove si verifica l'errore durante il login con Google.

---

## 📋 PASSO 1: Apri la Console del Browser

1. **Apri il sito** (locale o Vercel)
2. **Apri la Console del Browser**:
   - **Chrome/Edge**: Premi `F12` o `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - **Firefox**: Premi `F12` o `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
3. **Vai alla tab "Console"**

---

## 📋 PASSO 2: Prova il Login con Google

1. **Clicca sul pulsante "Continua con Google"**
2. **Guarda i messaggi nella console** mentre procede il login

---

## 📋 PASSO 3: Cerca i Messaggi di Log

Dovresti vedere questi messaggi nella console (in ordine):

### ✅ Messaggi Normali (Login Funzionante):

```
🔐 [LOGIN] Tentativo login Google OAuth...
✅ [LOGIN] signIn Google chiamato, risultato: ...
🔐 [NEXTAUTH] signIn callback chiamato: { provider: 'google', email: '...', ... }
📝 [NEXTAUTH] Creazione/aggiornamento utente OAuth per: ...
👤 [NEXTAUTH] Utente esistente trovato: true/false
✅ [NEXTAUTH] signIn callback completato con successo
🔄 [NEXTAUTH] redirect callback chiamato: { url: '/dashboard', baseUrl: '...' }
✅ [NEXTAUTH] Redirect a dashboard: ...
✅ [LOGIN] Utente autenticato, verifica dati cliente...
📋 [LOGIN] Chiamata API per verificare dati cliente...
🔄 [LOGIN] Reindirizzamento a /dashboard
```

### ❌ Messaggi di Errore (Cosa Cercare):

#### Errore 1: "redirect_uri_mismatch"
```
❌ [LOGIN] Errore OAuth rilevato: { error: 'redirect_uri_mismatch', ... }
```
**Causa**: L'URI in Google Console non corrisponde esattamente.

**Soluzione**: 
- Vai su Google Console → Credentials
- Verifica che il Redirect URI sia ESATTAMENTE: `http://localhost:3000/api/auth/callback/google` (locale) o `https://spediresicuro.vercel.app/api/auth/callback/google` (produzione)

#### Errore 2: "invalid_client"
```
❌ [LOGIN] Errore OAuth rilevato: { error: 'invalid_client', ... }
```
**Causa**: Client ID o Secret non configurati correttamente.

**Soluzione**:
- Verifica che `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` siano configurati in `env.local` (locale) o su Vercel (produzione)
- Verifica che corrispondano esattamente a quelli in Google Console

#### Errore 3: Errore durante signIn callback
```
❌ [NEXTAUTH] Errore gestione utente OAuth: ...
```
**Causa**: Errore durante la creazione/aggiornamento utente nel database.

**Soluzione**:
- Controlla i dettagli dell'errore nella console
- Verifica che il database JSON sia accessibile
- Controlla i permessi del file `data/database.json`

#### Errore 4: Errore durante redirect
```
⚠️ [NEXTAUTH] Errore parsing URL: ...
```
**Causa**: Problema con l'URL di redirect.

**Soluzione**:
- Verifica che `NEXTAUTH_URL` sia configurato correttamente
- In locale: `http://localhost:3000`
- In produzione: `https://spediresicuro.vercel.app`

---

## 📋 PASSO 4: Controlla i Log del Server (Vercel)

Se il problema è su Vercel:

1. **Vai su Vercel Dashboard** → **Deployments**
2. **Clicca sull'ultimo deploy**
3. **Vai su "Functions"** o **"Logs"**
4. **Cerca i messaggi che iniziano con**:
   - `🔍 OAuth Config Check`
   - `🔐 [NEXTAUTH]`
   - `❌ [NEXTAUTH]`

---

## 📋 PASSO 5: Verifica la Configurazione

### Checklist Locale:

- [ ] `env.local` contiene `GOOGLE_CLIENT_ID`
- [ ] `env.local` contiene `GOOGLE_CLIENT_SECRET`
- [ ] `env.local` contiene `NEXTAUTH_URL=http://localhost:3000`
- [ ] Google Console ha `http://localhost:3000` in JavaScript Origins
- [ ] Google Console ha `http://localhost:3000/api/auth/callback/google` in Redirect URIs

### Checklist Produzione (Vercel):

- [ ] Vercel ha `GOOGLE_CLIENT_ID` configurato
- [ ] Vercel ha `GOOGLE_CLIENT_SECRET` configurato
- [ ] Vercel ha `NEXTAUTH_URL=https://spediresicuro.vercel.app`
- [ ] Google Console ha `https://spediresicuro.vercel.app` in JavaScript Origins
- [ ] Google Console ha `https://spediresicuro.vercel.app/api/auth/callback/google` in Redirect URIs

---

## 🐛 Problemi Comuni e Soluzioni

### Problema: "L'utente rimane sulla pagina di login"

**Possibili cause**:
1. Il callback redirect non funziona
2. La sessione non viene creata correttamente
3. C'è un errore JavaScript che blocca il redirect

**Cosa fare**:
1. Controlla la console del browser per errori JavaScript
2. Verifica che vedi i messaggi `✅ [LOGIN] Utente autenticato`
3. Se non vedi questi messaggi, il problema è nella creazione della sessione

### Problema: "Errore durante il login con Google"

**Possibili cause**:
1. Configurazione Google Console errata
2. Variabili ambiente non configurate
3. Client ID/Secret non corrispondono

**Cosa fare**:
1. Segui la guida `VERIFICA_GOOGLE_CONSOLE.md`
2. Verifica tutte le variabili ambiente
3. Controlla i log nella console per l'errore specifico

### Problema: "Redirect a pagina sbagliata"

**Possibili cause**:
1. Callback redirect non configurato correttamente
2. `callbackUrl` non viene rispettato

**Cosa fare**:
1. Controlla i log `🔄 [NEXTAUTH] redirect callback chiamato`
2. Verifica che l'URL di redirect sia corretto
3. Controlla che il callback `redirect` in `lib/auth-config.ts` funzioni

---

## 📞 Cosa Fare Se Non Funziona

1. **Copia tutti i messaggi di errore** dalla console del browser
2. **Copia i log del server** (se su Vercel)
3. **Verifica la configurazione** seguendo le checklist sopra
4. **Riprova dopo 5-10 minuti** (le modifiche Google Console possono richiedere tempo)

---

## 💡 Nota Importante

Tutti i messaggi di log iniziano con un emoji e `[LOGIN]` o `[NEXTAUTH]` per essere facilmente identificabili nella console.

Se vedi molti messaggi `✅`, significa che il processo sta funzionando correttamente fino a quel punto. L'errore sarà dopo l'ultimo messaggio `✅`.

---

**Ultimo aggiornamento**: Dicembre 2024


