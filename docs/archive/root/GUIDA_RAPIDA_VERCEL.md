# ⚡ Guida Rapida - Variabili Vercel

## 🎯 Dove Configurare

1. Vai su **Vercel Dashboard**: https://vercel.com/dashboard
2. Seleziona il progetto **"spediresicuro"** (o il nome del tuo progetto)
3. Vai su **Settings** (⚙️) > **Environment Variables**

## 📋 Variabili da Aggiungere

Clicca **"Add New"** e aggiungi queste variabili **UNA PER UNA**:

### ✅ 1. NEXT_PUBLIC_SUPABASE_URL

- **Name:** `NEXT_PUBLIC_SUPABASE_URL`
- **Value:** `https://pxd2.supabase.co` (o il tuo URL Supabase)
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### ✅ 2. NEXT_PUBLIC_SUPABASE_ANON_KEY

- **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dDI...` (la tua anon key completa)
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### ✅ 3. SUPABASE_SERVICE_ROLE_KEY

- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
- **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dDI...` (la tua service role key completa)
- **Environment:** ✅ Production, ✅ Preview, ✅ Development
- **⚠️ IMPORTANTE:** Questa chiave è SECRETA - non condividerla mai!

### ✅ 4. NEXTAUTH_URL

- **Name:** `NEXTAUTH_URL`
- **Value:** `https://spediresicuro.vercel.app` (o il tuo dominio Vercel)
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### ✅ 5. NEXTAUTH_SECRET

- **Name:** `NEXTAUTH_SECRET`
- **Value:** Genera una chiave casuale (almeno 32 caratteri)
  - **PowerShell:** `-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 40 | ForEach-Object {[char]$_})`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### ✅ 6. DIAGNOSTICS_TOKEN

- **Name:** `DIAGNOSTICS_TOKEN`
- **Value:** `d4t1_d14gn0st1c1_s3gr3t1_2025_x9z` (o genera uno nuovo)
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### ✅ 7. AUTOMATION_SERVICE_TOKEN

- **Name:** `AUTOMATION_SERVICE_TOKEN`
- **Value:** Genera un token casuale sicuro
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### ✅ 8. ENCRYPTION_KEY

- **Name:** `ENCRYPTION_KEY`
- **Value:** 64 caratteri esadecimali
  - **PowerShell:** `[Convert]::ToHexString((1..32 | ForEach-Object {Get-Random -Minimum 0 -Maximum 256}))`
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### ⚠️ 9. GOOGLE_CLIENT_ID (Opzionale - se usi OAuth Google)

- **Name:** `GOOGLE_CLIENT_ID`
- **Value:** Il tuo Google Client ID
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

### ⚠️ 10. GOOGLE_CLIENT_SECRET (Opzionale - se usi OAuth Google)

- **Name:** `GOOGLE_CLIENT_SECRET`
- **Value:** Il tuo Google Client Secret
- **Environment:** ✅ Production, ✅ Preview, ✅ Development

---

## 🔄 Dopo Aver Aggiunto le Variabili

1. **Salva** tutte le variabili
2. Vai su **Deployments**
3. Clicca sui **3 puntini** (⋯) dell'ultimo deployment
4. Seleziona **"Redeploy"**
5. Oppure fai un nuovo commit e push per triggerare un nuovo deploy

---

## ✅ Verifica

Dopo il deploy, verifica che:

- ✅ Il sito si carica correttamente
- ✅ Il login funziona
- ✅ Non ci sono errori nei log Vercel

---

## 🆘 Problemi Comuni

### ❌ "Supabase URL o Anon Key non configurati"

- Verifica che `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` siano configurate
- Assicurati che siano marcate per **Production**

### ❌ "NEXTAUTH_SECRET non configurato"

- Verifica che `NEXTAUTH_SECRET` sia presente
- Deve essere almeno 32 caratteri

### ❌ "Error: Configuration"

- Verifica che `NEXTAUTH_URL` sia l'URL corretto di Vercel (NON localhost!)
- Deve essere: `https://spediresicuro.vercel.app` (o il tuo dominio)

---

## 📝 Note

- **Production** = quando il sito è live
- **Preview** = quando fai deploy di un branch
- **Development** = quando fai deploy da locale (raro)

**Consiglio:** Configura tutte e tre le environment per evitare problemi!
