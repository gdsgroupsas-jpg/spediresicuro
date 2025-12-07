# 🔧 Fix: Errore "Configuration" durante login Google

## Problema
Errore durante il login con Google: `Codice errore: Configuration`

## Causa
Manca la variabile d'ambiente `NEXTAUTH_SECRET` su Vercel in produzione.

## ✅ Soluzione Rapida

### 1. Genera NEXTAUTH_SECRET
Su un terminale (Linux/Mac/WSL) o Git Bash:
```bash
openssl rand -base64 32
```

Output esempio: `XjK9mP3nQ7rL2wV8tY5sH1cF6dA4bN0e`

### 2. Configura su Vercel

1. Vai su [Vercel Dashboard](https://vercel.com)
2. Seleziona il progetto **spediresicuro**
3. **Settings** → **Environment Variables**
4. Click **Add New**
5. Configura:
   - **Name**: `NEXTAUTH_SECRET`
   - **Value**: (incolla il valore generato sopra)
   - **Environment**: Seleziona **Production**, **Preview**, **Development**
6. Click **Save**

### 3. Redeploy

Dopo aver salvato, Vercel dovrebbe fare automaticamente redeploy. Se non parte:

1. Vai su **Deployments**
2. Click sui 3 puntini dell'ultimo deployment
3. Click **Redeploy**

## 🔍 Verifica Configurazione

Controlla che su Vercel siano configurate tutte queste variabili:

### Obbligatorie
- ✅ `NEXTAUTH_SECRET` - Secret per NextAuth (quello appena aggiunto)
- ✅ `GOOGLE_CLIENT_ID` - Client ID Google OAuth
- ✅ `GOOGLE_CLIENT_SECRET` - Client Secret Google OAuth
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - URL Supabase
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon Key Supabase
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key Supabase

### Opzionali ma consigliate
- ⚙️ `NEXTAUTH_URL` - URL base produzione (es: `https://spediresicuro.vercel.app`)
- ⚙️ `ANTHROPIC_API_KEY` - Per Anne Assistant

## 📝 Note

- **NEXTAUTH_SECRET** deve essere almeno 32 caratteri
- **Non committare** mai il secret su Git
- Usa valori diversi per produzione e sviluppo
- Il callback URL Google Console deve essere: `https://TUO-DOMINIO.vercel.app/api/auth/callback/google`

## 🔐 File .env.local per sviluppo locale

Crea un file `.env.local` nella root del progetto (non committarlo):

```env
# NextAuth
NEXTAUTH_SECRET="il-tuo-secret-generato-per-sviluppo-locale"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="il-tuo-google-client-id"
GOOGLE_CLIENT_SECRET="il-tuo-google-client-secret"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Anthropic (opzionale)
ANTHROPIC_API_KEY="sk-ant-api03-..."
```

## 🆘 Se il problema persiste

1. Verifica i log di Vercel: **Deployments** → **Functions** → cerca errori
2. Controlla che il callback URL in Google Console sia corretto
3. Prova a cancellare le variabili e ricrearle
4. Verifica che non ci siano spazi prima/dopo i valori delle variabili

## ✅ Dopo il fix

Il login con Google dovrebbe funzionare correttamente e reindirizzare alla dashboard!
