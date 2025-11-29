# 📋 Copia e Incolla .env.local

**Copia tutto il contenuto qui sotto e incollalo nel file `.env.local`**

---

## ⚠️ IMPORTANTE PRIMA DI COPIARE

1. **Sostituisci i placeholder Supabase** con valori reali:
   - `NEXT_PUBLIC_SUPABASE_URL` → URL reale da Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Chiave anonima reale
   - `SUPABASE_SERVICE_ROLE_KEY` → Service role key reale

2. **Ottieni le credenziali Supabase:**
   - Vai su https://app.supabase.com
   - Settings → API
   - Copia Project URL, anon public key, service_role key

---

## 📝 CONTENUTO DA COPIARE

```env
# ============================================
# CONFIGURAZIONE AMBIENTE - SpedireSicuro.it
# ============================================
# 
# ISTRUZIONI:
# 1. Sostituisci i placeholder Supabase con valori reali
# 2. NON committare mai il file .env.local nel repository Git!
#
# ============================================

# ============================================
# AMBIENTE
# ============================================
NODE_ENV=development

# ============================================
# URL APPLICAZIONE
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================
# SUPABASE (Database PostgreSQL)
# ============================================
# ⚠️ SOSTITUISCI QUESTI PLACEHOLDER CON VALORI REALI!
# Ottieni da: Settings → API nel dashboard Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ============================================
# CONFIGURAZIONE MARGINI
# ============================================
NEXT_PUBLIC_DEFAULT_MARGIN=15

# ============================================
# SICUREZZA - NEXTAUTH
# ============================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=YTc2M2MyYWEtYWI4MS00YTJjLTg5YWQtNTYxZGI3YzRlMDA5NzEzYmM1ZGYtYTEzNS00NmQzLTkwZTUtOTYyNDNmMzJmZGQ0

# ============================================
# GOOGLE OAUTH
# ============================================
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## ✅ DOPO AVER COPIATO

1. **Sostituisci i 3 placeholder Supabase** con valori reali
2. **Salva il file**
3. **Riavvia il server:**
   ```bash
   npm run dev
   ```

---

**Il file completo è anche in `ENV_LOCAL_COMPLETO.txt`** 📄

