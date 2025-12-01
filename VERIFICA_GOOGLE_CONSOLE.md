# ✅ Verifica Configurazione Google Console - Guida Passo-Passo

## 🎯 Obiettivo

Verificare che Google Console sia configurato correttamente per permettere il login OAuth sia in locale che su Vercel.

---

## 📋 PASSO 1: Accedi a Google Cloud Console

1. **Apri Google Cloud Console**
   - Vai su: https://console.cloud.google.com/
   - Accedi con il tuo account Google

2. **Seleziona il Progetto**
   - Clicca sul menu a tendina in alto (accanto al logo Google Cloud)
   - Seleziona il progetto dove hai creato le credenziali OAuth
   - Se non sei sicuro, cerca il progetto che contiene il Client ID: `345930037956-k7ugi2g20v56rkk93lo2hcde3fhe1pjd`

---

## 📋 PASSO 2: Vai alle Credenziali OAuth

1. **Menu Laterale**
   - Clicca su **APIs & Services** (o **API e servizi** in italiano)
   - Poi clicca su **Credentials** (o **Credenziali**)

2. **Trova il Client OAuth**
   - Cerca il **OAuth 2.0 Client ID** con questo Client ID:
     ```
     345930037956-k7ugi2g20v56rkk93lo2hcde3fhe1pjd.apps.googleusercontent.com
     ```
   - Clicca sul nome del Client ID per aprirlo

---

## 📋 PASSO 3: Verifica Authorized JavaScript Origins

Nella sezione **Authorized JavaScript origins**, devono essere presenti questi URL:

### ✅ URL da Verificare:

1. **Locale (sviluppo):**
   ```
   http://localhost:3000
   ```

2. **Produzione (Vercel):**
   ```
   https://spediresicuro.vercel.app
   ```

### ⚠️ IMPORTANTE:

- **Locale**: Deve essere con `http://` (non `https://`)
- **Produzione**: Deve essere con `https://` (non `http://`)
- **Solo il dominio**: Senza percorsi aggiuntivi (es. NON `/dashboard` o `/api`)

### 🔍 Come Verificare:

1. Controlla che entrambi gli URL siano presenti nella lista
2. Se manca uno, clicca su **+ ADD URI** e aggiungilo
3. Controlla che non ci siano spazi o caratteri strani
4. Clicca **SAVE** in basso per salvare

---

## 📋 PASSO 4: Verifica Authorized Redirect URIs

Nella sezione **Authorized redirect URIs**, devono essere presenti questi URL:

### ✅ URL da Verificare:

1. **Locale (sviluppo):**
   ```
   http://localhost:3000/api/auth/callback/google
   ```

2. **Produzione (Vercel):**
   ```
   https://spediresicuro.vercel.app/api/auth/callback/google
   ```

### ⚠️ IMPORTANTE:

- **Locale**: Deve essere con `http://` (non `https://`)
- **Produzione**: Deve essere con `https://` (non `http://`)
- **Percorso completo**: Deve includere `/api/auth/callback/google` alla fine
- **Esattamente così**: Deve corrispondere ESATTAMENTE, carattere per carattere

### 🔍 Come Verificare:

1. Controlla che entrambi gli URL siano presenti nella lista
2. Se manca uno, clicca su **+ ADD URI** e aggiungilo
3. **Copia e incolla** ESATTAMENTE gli URL sopra (non scriverli a mano!)
4. Controlla che non ci siano spazi prima o dopo
5. Clicca **SAVE** in basso per salvare

---

## 📋 PASSO 5: Verifica Client ID e Secret

Nella pagina delle credenziali, verifica che:

### ✅ Client ID:
```
tuo-client-id.apps.googleusercontent.com
```

Deve corrispondere esattamente a quello nel file `env.local`:
```
GOOGLE_CLIENT_ID=tuo-client-id.apps.googleusercontent.com
```

⚠️ **NOTA**: Sostituisci `tuo-client-id` con il tuo Client ID reale dalla Google Console.

### ✅ Client Secret:

Il Client Secret in Google Console deve corrispondere a quello nel file `env.local`:
```
GOOGLE_CLIENT_SECRET=GOCSPX-tuo-client-secret
```

⚠️ **NOTA**: Sostituisci `tuo-client-secret` con il tuo Client Secret reale dalla Google Console.

⚠️ **NOTA**: Il Client Secret è nascosto in Google Console (mostra solo i primi caratteri). Se non corrisponde, devi:
1. Cliccare su **RESET SECRET** (se necessario)
2. Copiare il nuovo secret
3. Aggiornarlo sia in `env.local` che su Vercel

---

## 📋 PASSO 6: Salva e Attendi

1. **Dopo aver verificato tutto**, clicca **SAVE** in basso alla pagina
2. **Attendi 5-10 minuti**: Le modifiche in Google Console possono richiedere tempo per essere attive
3. **Non chiudere la pagina** finché non vedi il messaggio di conferma

---

## ✅ Checklist Finale

Prima di dire che è tutto configurato, verifica:

- [ ] **JavaScript Origins** contiene: `http://localhost:3000`
- [ ] **JavaScript Origins** contiene: `https://spediresicuro.vercel.app`
- [ ] **Redirect URIs** contiene: `http://localhost:3000/api/auth/callback/google`
- [ ] **Redirect URIs** contiene: `https://spediresicuro.vercel.app/api/auth/callback/google`
- [ ] **Client ID** corrisponde a quello in `env.local`
- [ ] **Client Secret** corrisponde a quello in `env.local` (o è stato resettato e aggiornato)
- [ ] Modifiche **salvate** in Google Console
- [ ] Atteso **5-10 minuti** dopo le modifiche

---

## 🐛 Problemi Comuni

### Errore: "redirect_uri_mismatch"

**Causa**: L'URI in Google Console non corrisponde esattamente.

**Soluzione**:
1. Copia e incolla ESATTAMENTE gli URL dalla guida sopra
2. Controlla che non ci siano spazi prima o dopo
3. Verifica che sia `https://` per produzione e `http://` per locale
4. Salva e aspetta 5-10 minuti

### Errore: "invalid_client"

**Causa**: Client ID o Secret non corrispondono.

**Soluzione**:
1. Verifica che il Client ID in Google Console sia identico a quello in `env.local`
2. Se il Secret non corrisponde, resettalo in Google Console e aggiornalo ovunque
3. Verifica che su Vercel le variabili ambiente siano identiche

### Login funziona in locale ma non su Vercel

**Causa**: Redirect URI per produzione non configurato.

**Soluzione**:
1. Aggiungi `https://spediresicuro.vercel.app/api/auth/callback/google` in Google Console
2. Aggiungi `https://spediresicuro.vercel.app` in JavaScript Origins
3. Salva e aspetta 5-10 minuti

---

## 🔗 Link Utili

- **Google Cloud Console**: https://console.cloud.google.com/
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Documentazione Google OAuth**: https://developers.google.com/identity/protocols/oauth2

---

## 📞 Supporto

Se dopo aver verificato tutto seguendo questa guida il problema persiste:

1. Controlla i log Vercel per errori specifici
2. Controlla la console del browser (F12) per errori JavaScript
3. Verifica che tutte le variabili ambiente siano configurate su Vercel
4. Assicurati di aver atteso almeno 10 minuti dopo le modifiche Google Console

---

**Ultimo aggiornamento**: Dicembre 2024

