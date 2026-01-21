# 🔧 Fix Login Remoto - Guida Completa

## 🎯 Problemi Risolti

Questa guida risolve i seguenti problemi:

1. ✅ **Login Google reindirizza a localhost:3000** invece dell'URL remoto
2. ✅ **Login demo (admin@spediresicuro.it / admin123) non funziona** in remoto
3. ✅ **Redirect OAuth non funzionano** correttamente su Vercel

---

## 📋 PASSO 1: Configura NEXTAUTH_URL su Vercel

### ⚠️ IMPORTANTE: Questo è il passaggio più importante!

1. **Vai su Vercel Dashboard**
   - Apri: https://vercel.com/dashboard
   - Seleziona il progetto **spediresicuro**

2. **Vai alle Impostazioni**
   - Clicca su **Settings** (Impostazioni)
   - Vai su **Environment Variables** (Variabili d'Ambiente)

3. **Aggiungi o Modifica NEXTAUTH_URL**
   - Cerca la variabile `NEXTAUTH_URL` nella lista
   - Se **NON esiste**, clicca su **Add New** e aggiungi:
     - **Name:** `NEXTAUTH_URL`
     - **Value:** `https://spediresicuro.vercel.apphttps://spediresicuro.vercel.app` (o il tuo dominio Vercel)
     - **Environment:** Seleziona **Production** (e opzionalmente **Preview**)
   - Se **ESISTE già** ma punta a `http://localhost:3000`:
     - Clicca su **Edit**
     - Cambia il valore in: `https://spediresicuro.vercel.app` (o il tuo dominio Vercel)
     - Assicurati che sia selezionato **Production**

4. **Salva e Riavvia**
   - Clicca su **Save**
   - Vai su **Deployments** e fai un nuovo deploy (o aspetta il prossimo push)

### ✅ Verifica

Dopo il deploy, verifica che funzioni:

- Apri la console del browser (F12)
- Cerca i log che iniziano con `🌐 [AUTH]` o `✅ [AUTH]`
- Dovresti vedere l'URL corretto (non localhost)

---

## 📋 PASSO 2: Configura Google Console per Produzione

### ⚠️ IMPORTANTE: Aggiungi l'URL di produzione a Google Console!

1. **Vai su Google Cloud Console**
   - Apri: https://console.cloud.google.com/
   - Seleziona il progetto corretto

2. **Vai alle Credenziali OAuth**
   - Menu laterale → **APIs & Services** → **Credentials**
   - Clicca sul tuo **OAuth 2.0 Client ID**

3. **Aggiungi Authorized JavaScript Origins**
   - Nella sezione **Authorized JavaScript origins**, aggiungi:
     ```
     https://spediresicuro.vercel.app
     ```
   - (Mantieni anche `http://localhost:3000` per sviluppo locale)

4. **Aggiungi Authorized Redirect URIs**
   - Nella sezione **Authorized redirect URIs**, aggiungi:
     ```
     https://spediresicuro.vercel.app/api/auth/callback/google
     ```
   - (Mantieni anche `http://localhost:3000/api/auth/callback/google` per sviluppo locale)

5. **Salva**
   - Clicca su **Save** in basso

---

## 📋 PASSO 3: Verifica Utenti Demo in Supabase

### Se il login demo non funziona, verifica che gli utenti esistano in Supabase:

1. **Vai su Supabase Dashboard**
   - Apri: https://supabase.com/dashboard
   - Seleziona il tuo progetto

2. **Vai alla Tabella Users**
   - Menu laterale → **Table Editor** → **users**
   - Verifica che esistano questi utenti:
     - `admin@spediresicuro.it` (password: `admin123`)
     - `demo@spediresicuro.it` (password: `demo123`)

3. **Se gli utenti NON esistono:**
   - Gli utenti demo vengono creati automaticamente al primo login
   - Se non vengono creati, verifica:
     - Le variabili d'ambiente Supabase sono configurate su Vercel?
     - La tabella `users` esiste in Supabase?
     - La Service Role Key ha i permessi corretti?

4. **Crea Manualmente (se necessario)**
   - Puoi creare gli utenti manualmente dalla tabella `users` in Supabase
   - Oppure usa l'endpoint API: `/api/admin/create-demo-user` (solo una volta)

---

## 📋 PASSO 4: Verifica Variabili d'Ambiente su Vercel

### Assicurati che queste variabili siano configurate:

#### Variabili Obbligatorie:

```
NEXTAUTH_URL=https://spediresicuro.vercel.app
NEXTAUTH_SECRET=la-tua-chiave-segreta
GOOGLE_CLIENT_ID=il-tuo-google-client-id
GOOGLE_CLIENT_SECRET=il-tuo-google-client-secret
```

#### Variabili Supabase (se usi Supabase):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=la-tua-anon-key
SUPABASE_SERVICE_ROLE_KEY=la-tua-service-role-key
```

### ⚠️ IMPORTANTE:

- **NEXTAUTH_URL**: Deve essere l'URL completo con `https://` (NON `http://localhost:3000`)
- **NEXTAUTH_SECRET**: Deve essere una stringa casuale (genera con: `openssl rand -base64 32`)
- **Environment**: Seleziona **Production** per tutte le variabili

---

## 🔍 Debug: Come Verificare che Funzioni

### 1. Controlla i Log del Browser

1. Apri il sito su Vercel
2. Premi **F12** per aprire la console
3. Vai alla tab **Console**
4. Prova il login con Google
5. Cerca questi messaggi:

```
🌐 [AUTH] Rilevato URL Vercel: https://spediresicuro.vercel.app
✅ [AUTH] Usando NEXTAUTH_URL configurato: https://spediresicuro.vercel.app
🔄 [NEXTAUTH] redirect callback chiamato: { url: '/dashboard', baseUrl: 'https://spediresicuro.vercel.app', ... }
```

### 2. Controlla i Log di Vercel

1. Vai su Vercel Dashboard → **Deployments**
2. Clicca sull'ultimo deploy
3. Vai alla tab **Functions** o **Logs**
4. Cerca i log che iniziano con `[AUTH]` o `[NEXTAUTH]`

### 3. Verifica Redirect

Dopo il login con Google, l'URL nel browser dovrebbe essere:

- ✅ **Corretto:** `https://spediresicuro.vercel.app/dashboard`
- ❌ **Sbagliato:** `http://localhost:3000/dashboard`

---

## ❌ Problemi Comuni e Soluzioni

### Problema 1: "redirect_uri_mismatch" in Google OAuth

**Causa:** L'URL di redirect in Google Console non corrisponde.

**Soluzione:**

- Vai su Google Console → Credentials → OAuth Client
- Verifica che **Authorized redirect URIs** contenga:
  ```
  https://spediresicuro.vercel.app/api/auth/callback/google
  ```
- Assicurati che sia esattamente questo URL (con `https://`, senza `/` finale)

### Problema 2: Login demo non funziona

**Causa:** Gli utenti demo non esistono in Supabase o la password è sbagliata.

**Soluzione:**

- Verifica che gli utenti esistano nella tabella `users` in Supabase
- Verifica che le password siano:
  - `admin@spediresicuro.it` → password: `admin123`
  - `demo@spediresicuro.it` → password: `demo123`
- Controlla i log del browser per vedere se ci sono errori

### Problema 3: Redirect a localhost dopo login Google

**Causa:** `NEXTAUTH_URL` non è configurato correttamente su Vercel.

**Soluzione:**

- Vai su Vercel → Settings → Environment Variables
- Verifica che `NEXTAUTH_URL` sia impostato su `https://spediresicuro.vercel.app`
- **NON** deve essere `http://localhost:3000`
- Fai un nuovo deploy dopo aver modificato le variabili

### Problema 4: "NEXTAUTH_SECRET is not set"

**Causa:** La variabile `NEXTAUTH_SECRET` non è configurata su Vercel.

**Soluzione:**

- Genera una nuova chiave segreta:
  ```bash
  openssl rand -base64 32
  ```
- Aggiungi la variabile `NEXTAUTH_SECRET` su Vercel con il valore generato
- Fai un nuovo deploy

---

## ✅ Checklist Finale

Prima di considerare il problema risolto, verifica:

- [ ] `NEXTAUTH_URL` è configurato su Vercel con l'URL corretto (https://)
- [ ] `NEXTAUTH_SECRET` è configurato su Vercel
- [ ] Google Console ha l'URL di produzione nei Redirect URIs
- [ ] Google Console ha l'URL di produzione negli Authorized JavaScript Origins
- [ ] Gli utenti demo esistono in Supabase (se usi Supabase)
- [ ] Le variabili Supabase sono configurate su Vercel (se usi Supabase)
- [ ] Hai fatto un nuovo deploy dopo aver modificato le variabili
- [ ] Il login con Google funziona e reindirizza all'URL corretto
- [ ] Il login demo funziona con admin@spediresicuro.it / admin123

---

## 📞 Supporto

Se dopo aver seguito questa guida il problema persiste:

1. Controlla i log del browser (F12 → Console)
2. Controlla i log di Vercel (Dashboard → Deployments → Logs)
3. Verifica che tutte le variabili d'ambiente siano configurate correttamente
4. Assicurati di aver fatto un nuovo deploy dopo le modifiche

---

**Ultimo aggiornamento:** Questa guida è stata creata per risolvere i problemi di login remoto dopo le modifiche al codice.
