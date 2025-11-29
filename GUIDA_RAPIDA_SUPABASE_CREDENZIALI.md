# 🚀 Guida Rapida - Ottieni Credenziali Supabase

**Per risolvere l'autocomplete città, ti servono le credenziali Supabase!**

---

## 📍 Step 1: Vai a Settings → API

Dalla dashboard Supabase che hai aperto:

1. **Clicca sull'icona ⚙️ "Settings"** nella sidebar sinistra
2. **Clicca su "API"** nel menu Settings
3. Qui troverai tutte le credenziali!

---

## 📋 Step 2: Copia le Credenziali

Nella pagina API vedrai:

### Project URL
```
https://xxxxx.supabase.co
```
**Copia questo** → Va in `NEXT_PUBLIC_SUPABASE_URL`

### API Keys

#### anon public
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Copia questa** → Va in `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### service_role (opzionale ma utile)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
**Copia questa** → Va in `SUPABASE_SERVICE_ROLE_KEY`

---

## 📝 Step 3: Aggiorna .env.local

Apri `.env.local` e sostituisci:

**PRIMA:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**DOPO (con valori reali):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🗄️ Step 4: Crea Tabella geo_locations

Dopo aver configurato le credenziali, devi creare la tabella:

1. **Vai su "SQL Editor"** nella sidebar (icona database o cerca "SQL")
2. **Clicca "New Query"**
3. **Copia e incolla** il contenuto di `supabase/schema.sql`
4. **Clicca "Run"** (o premi Ctrl+Enter)

---

## ✅ Step 5: Riavvia Server

```bash
npm run dev
```

---

**Vai su Settings → API per ottenere le credenziali!** 🔑

