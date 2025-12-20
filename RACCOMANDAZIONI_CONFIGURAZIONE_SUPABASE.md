# ⚙️ RACCOMANDAZIONI CONFIGURAZIONE SUPABASE

## 🔴 PROBLEMA IDENTIFICATO

**Site URL** in Supabase è configurato come:
```
https://spediresicuro.vercel.app/auth/callback
```

**Ma dovrebbe essere**:
```
https://spediresicuro.vercel.app
```

**Motivazione**:
- Site URL è il dominio base dell'applicazione, non un path specifico
- Il path `/auth/callback` va solo nelle Redirect URLs
- Se Site URL include un path, Supabase potrebbe usarlo come fallback e causare redirect errati

---

## ✅ CONFIGURAZIONE CORRETTA

### 1. Site URL (da correggere in Supabase Dashboard)

**Prima**:
```
Site URL: https://spediresicuro.vercel.app/auth/callback
```

**Dopo**:
```
Site URL: https://spediresicuro.vercel.app
```

### 2. Redirect URLs (verificare e correggere)

**Configurazione corretta**:
```
https://spediresicuro.vercel.app/auth/callback
https://spediresicuro.vercel.app/auth/callback/**
https://spediresicuro-gdsgroupsas-6132s-projects.vercel.app/auth/callback
https://spediresicuro-gdsgroupsas-6132s-projects.vercel.app/auth/callback/**
https://spediresicuro-*-gdsgroupsas-6132s-projects.vercel.app/auth/callback
https://spediresicuro-*-gdsgroupsas-6132s-projects.vercel.app/auth/callback/**
```

**Nota**: Le Redirect URLs per preview Vercel dovrebbero includere `/auth/callback` per essere coerenti con la produzione.

**URL da rimuovere/correggere**:
- ❌ `https://spediresicuro-gdsgroupsas-6132s-projects.vercel.app/` → Rimuovere o cambiare in `/auth/callback`
- ❌ `https://spediresicuro-gdsgroupsas-6132s-projects.vercel.app/**` → Cambiare in `/auth/callback/**`

---

## 🔧 VERIFICA VARIABILE AMBIENTE

### File: `app/api/auth/register/route.ts` (linee 72-74)

**Codice attuale**:
```typescript
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const callbackUrl = `${baseUrl}/auth/callback`;
```

**Verifica necessaria**:
- Assicurarsi che `NEXT_PUBLIC_APP_URL` sia configurato in Vercel:
  ```
  NEXT_PUBLIC_APP_URL=https://spediresicuro.vercel.app
  ```

**Se non configurato**:
- In produzione, potrebbe usare `localhost:3000` come fallback
- Causa redirect errati

---

## 📝 AZIONI RICHIESTE

### 1. Correggere Site URL in Supabase Dashboard

1. Vai a Supabase Dashboard → Authentication → URL Configuration
2. Cambia **Site URL** da:
   ```
   https://spediresicuro.vercel.app/auth/callback
   ```
   a:
   ```
   https://spediresicuro.vercel.app
   ```
3. Salva le modifiche

### 2. Verificare Redirect URLs

1. Verifica che tutte le Redirect URLs includano `/auth/callback`
2. Rimuovi o correggi URL che puntano a `/` invece di `/auth/callback`
3. Assicurati che le preview Vercel includano `/auth/callback`

### 3. Verificare Variabile Ambiente in Vercel

1. Vai a Vercel Dashboard → Settings → Environment Variables
2. Verifica che `NEXT_PUBLIC_APP_URL` sia configurato:
   ```
   NEXT_PUBLIC_APP_URL=https://spediresicuro.vercel.app
   ```
3. Se non presente, aggiungilo e fai redeploy

---

## ✅ RISULTATO ATTESO

Dopo le correzioni:
- Supabase reindirizzerà sempre a `/auth/callback` (non a `/`)
- Il codice userà l'URL corretto per `emailRedirectTo`
- Nessun redirect a home per utenti autenticati

---

## ⚠️ NOTA IMPORTANTE

Anche con Site URL errato, il codice dovrebbe funzionare correttamente perché:
1. Il middleware blocca accesso a `/` per utenti autenticati senza onboarding
2. Il client usa `redirectTo` ricevuto dal server
3. Le Redirect URLs includono `/auth/callback`

**Ma** correggere Site URL è una best practice e previene problemi futuri.

