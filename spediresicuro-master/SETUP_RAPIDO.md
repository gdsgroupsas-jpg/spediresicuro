# ⚡ SETUP RAPIDO SUPABASE - 5 Minuti

## 🎯 Cosa Devi Fare (in ordine)

### 1️⃣ Crea Account/Progetto Supabase (2 min)

**Vai su:** https://app.supabase.com

- Se non hai account: **Sign Up** (gratuito, puoi usare GitHub)
- Clicca **"New Project"**
- Nome: `spediresicuro` (o quello che preferisci)
- Password database: **SALVALA DA QUALCHE PARTE!** ⚠️
- Region: `West Europe` (o più vicina)
- Pricing: **Free**
- Clicca **"Create new project"**
- ⏳ Attendi 2-3 minuti

### 2️⃣ Ottieni le Credenziali (1 min)

Nel dashboard del progetto:

1. Vai su **Settings** (icona ingranaggio ⚙️ in basso a sinistra)
2. Clicca **API** nel menu
3. Troverai 3 valori importanti:

   ```
   Project URL: https://xxxxxxxxxxxxx.supabase.co
   anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **COPIA QUESTI 3 VALORI** 📋

### 3️⃣ Configura .env.local (1 min)

Apri il file `.env.local` nel progetto e sostituisci:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANTE:** Sostituisci con i TUOI valori!

### 4️⃣ Esegui Schema SQL (1 min)

Nel dashboard Supabase:

1. Vai su **SQL Editor** (menu laterale)
2. Clicca **"New query"**
3. Apri il file `supabase/schema.sql` nel tuo editor
4. **Copia tutto** il contenuto
5. **Incolla** nel SQL Editor
6. Clicca **"Run"** (o `Ctrl+Enter`)
7. ✅ Dovresti vedere: **"Success"**

### 5️⃣ Popola Database (1 min)

Torna nel terminale e esegui:

```bash
npm run seed:geo
```

⏳ Attendi 1-2 minuti (scarica 8000+ comuni)

### 6️⃣ Verifica (30 sec)

```bash
npm run verify:supabase
```

✅ Se vedi "Configurazione completa" → **FATTO!** 🎉

---

## 🚀 Dopo il Setup

Avvia l'app:

```bash
npm run dev
```

Vai su: **http://localhost:3000/dashboard/spedizioni/nuova**

Prova a digitare "Roma" nel campo città → Dovrebbe autocompletare! ✨

---

## ❓ Problemi?

### "Variabili ambiente mancanti"
→ Controlla che `.env.local` esista e abbia i valori corretti

### "Tabella non trovata"
→ Esegui lo schema SQL in Supabase SQL Editor

### "Errore connessione"
→ Verifica che URL e chiavi siano corrette (no spazi, no virgolette)

### "Nessun risultato ricerca"
→ Esegui `npm run seed:geo` per popolare il database

---

## 📞 Link Utili

- **Supabase Dashboard:** https://app.supabase.com
- **Guida Completa:** `docs/SUPABASE_SETUP_GUIDE.md`
- **Documentazione Tecnica:** `docs/GEO_AUTOCOMPLETE_SETUP.md`

---

**Tempo totale: ~5 minuti** ⏱️

