# 📥 Guida: Importare Variabili Ambiente su Vercel

## 🎯 Problema
Il login non funziona perché le variabili ambiente su Vercel non sono configurate correttamente.

## ✅ Soluzione: Importare da File .env

Ho creato il file `.env.vercel` con tutte le variabili ambiente necessarie. Segui questi passaggi:

---

## 📋 PASSO 1: Cancella Variabili Esistenti su Vercel

1. **Vai su Vercel Dashboard**: https://vercel.com/dashboard
2. **Seleziona il progetto** `spediresicuro` (o il nome del tuo progetto)
3. **Vai su Settings** → **Environment Variables**
4. **Cancella TUTTE le variabili esistenti** (se ci sono):
   - Clicca sulla X accanto a ogni variabile
   - Conferma la cancellazione

---

## 📋 PASSO 2: Crea il File .env per Vercel

### Opzione A: Copia da env.local (Consigliata)

1. **Apri il file** `env.local` nella root del progetto
2. **Copia tutto il contenuto**
3. **Crea un nuovo file** chiamato `.env.vercel` (o `.env.production`)
4. **Incolla il contenuto**
5. **Modifica queste righe** per produzione:
   - Cambia `NODE_ENV=development` in `NODE_ENV=production`
   - Cambia `NEXTAUTH_URL=http://localhost:3000` in `NEXTAUTH_URL=https://tuo-sito.vercel.app`
   - Cambia `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `NEXT_PUBLIC_APP_URL=https://tuo-sito.vercel.app`
6. **Salva il file**

### Opzione B: Usa il Template qui sotto

Crea un file `.env.vercel` e incolla questo contenuto (sostituisci `tuo-sito.vercel.app` con il tuo URL Vercel):

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://tuo-sito.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
NEXTAUTH_URL=https://tuo-sito.vercel.app
NEXTAUTH_SECRET=your-secret-key-here-change-in-production
NEXT_PUBLIC_DEFAULT_MARGIN=15
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CLOUD_CREDENTIALS=your-google-cloud-credentials-json
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
ANTHROPIC_API_KEY=your-anthropic-api-key
```

⚠️ **IMPORTANTE**: 
- Sostituisci `tuo-sito.vercel.app` con l'URL reale del tuo sito Vercel
- Copia i valori reali dal file `env.local` locale (non committare quel file!)

⚠️ **IMPORTANTE**: Sostituisci `tuo-sito.vercel.app` con l'URL reale del tuo sito Vercel!

## 📋 PASSO 3: Importa il File su Vercel

1. **Nella pagina** Vercel → Settings → Environment Variables
2. **Clicca sul pulsante "Import"** o **"Import from .env"** (in alto a destra)
3. **Seleziona il file** `.env.vercel` che hai appena creato
4. **Clicca "Import"** o **"Save"**

Vercel importerà automaticamente tutte le variabili dal file.

---

## 📋 PASSO 3: Modifica NEXTAUTH_URL e NEXT_PUBLIC_APP_URL

⚠️ **IMPORTANTE**: Dopo l'import, devi modificare manualmente queste 2 variabili con l'URL del tuo sito Vercel:

1. **Trova la variabile** `NEXTAUTH_URL` nella lista
2. **Clicca su "Edit"** (icona matita)
3. **Sostituisci il valore** con l'URL completo del tuo sito Vercel:
   - Esempio: `https://spediresicuro.vercel.app`
   - ⚠️ Deve essere HTTPS e senza barra finale
4. **Seleziona gli ambienti**: Production, Preview, Development
5. **Clicca "Save"**

6. **Ripeti per** `NEXT_PUBLIC_APP_URL`:
   - Stesso valore: `https://spediresicuro.vercel.app`
   - Stessi ambienti: Production, Preview, Development

---

## 📋 PASSO 4: Verifica che Tutte le Variabili Siano Presenti

Dopo l'import, dovresti vedere queste variabili nella lista:

✅ **Variabili Obbligatorie:**
- `NODE_ENV` = `production`
- `NEXT_PUBLIC_APP_URL` = `https://tuo-sito.vercel.app` (modificato manualmente)
- `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co` (sostituisci con il tuo URL Supabase)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key-here` (sostituisci con la tua chiave anon)
- `SUPABASE_SERVICE_ROLE_KEY` = `your-service-role-key-here` (sostituisci con la tua service role key)
- `NEXTAUTH_URL` = `https://tuo-sito.vercel.app` (modificato manualmente)
- `NEXTAUTH_SECRET` = `your-secret-key-here` (sostituisci con la tua chiave segreta)

✅ **Variabili OAuth:**
- `GOOGLE_CLIENT_ID` = `your-google-client-id` (sostituisci con il tuo Client ID)
- `GOOGLE_CLIENT_SECRET` = `your-google-client-secret` (sostituisci con il tuo Client Secret)
- `GITHUB_CLIENT_ID` = `your-github-client-id` (sostituisci con il tuo Client ID)
- `GITHUB_CLIENT_SECRET` = `your-github-client-secret` (sostituisci con il tuo Client Secret)

✅ **Variabili Opzionali:**
- `NEXT_PUBLIC_DEFAULT_MARGIN` = `15`
- `GOOGLE_CLOUD_CREDENTIALS` = `your-google-cloud-credentials-json` (sostituisci con le tue credenziali JSON)
- `ANTHROPIC_API_KEY` = `your-anthropic-api-key` (sostituisci con la tua chiave API)

---

## 📋 PASSO 5: Redeploy il Progetto

1. **Vai su Deployments** (menu laterale)
2. **Trova l'ultimo deployment**
3. **Clicca sui 3 puntini** (⋮) → **Redeploy**
4. **Conferma** il redeploy
5. ⏳ **Attendi** che il deploy finisca (2-3 minuti)

---

## 📋 PASSO 6: Verifica che Funzioni

Dopo il redeploy:

1. **Apri il sito**: `https://tuo-sito.vercel.app/login`
2. **Prova il login** con:
   - Email: `admin@spediresicuro.it`
   - Password: `admin123`
3. **Dovrebbe funzionare!** 🎉

---

## 🐛 Se Non Funziona Ancora

### Verifica NEXTAUTH_URL

1. **Vai su Vercel** → Settings → Environment Variables
2. **Controlla** che `NEXTAUTH_URL` sia:
   - ✅ Con `https://` (non `http://`)
   - ✅ Con il dominio corretto del tuo sito Vercel
   - ✅ Senza barra finale (non `/` alla fine)
   - ✅ Esempio corretto: `https://spediresicuro.vercel.app`

### Verifica Google OAuth Callback URL

Se usi Google OAuth, verifica che il callback URL in Google Console sia:
```
https://tuo-sito.vercel.app/api/auth/callback/google
```

### Verifica GitHub OAuth Callback URL

Se usi GitHub OAuth, verifica che il callback URL in GitHub sia:
```
https://tuo-sito.vercel.app/api/auth/callback/github
```

---

## 📝 Note Importanti

- ⚠️ **NON committare** il file `.env.vercel` nel repository Git (è già nel `.gitignore`)
- ⚠️ **NEXTAUTH_URL** deve essere l'URL esatto del tuo sito Vercel
- ⚠️ Dopo ogni modifica alle variabili ambiente, devi fare un **redeploy**
- ⚠️ Le variabili ambiente vengono caricate solo al momento del build, non durante il runtime

---

## ✅ Checklist Finale

- [ ] Variabili ambiente cancellate su Vercel
- [ ] File `.env.vercel` importato su Vercel
- [ ] `NEXTAUTH_URL` modificato con l'URL corretto del sito Vercel
- [ ] `NEXT_PUBLIC_APP_URL` modificato con l'URL corretto del sito Vercel
- [ ] Tutte le variabili presenti nella lista
- [ ] Progetto redeployato
- [ ] Login testato e funzionante

---

## 🎉 Fatto!

Dopo questi passaggi, il login dovrebbe funzionare correttamente su Vercel!

