# 🎯 Istruzioni Supabase - Passo Passo

**Dalla dashboard Supabase che hai aperto, segui questi passi:**

---

## 📍 Step 1: Ottieni Credenziali (Settings → API)

1. **Clicca sull'icona ⚙️ "Settings"** nella sidebar sinistra (in basso)
2. **Clicca su "API"** nel menu Settings
3. **Copia questi valori:**
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon public** key → `eyJhbGc...`
   - **service_role** key → `eyJhbGc...`

4. **Aggiorna `.env.local`** con questi valori (sostituisci i placeholder)

---

## 📍 Step 2: Crea Tabella (SQL Editor)

1. **Clicca sull'icona 📊 "SQL Editor"** nella sidebar (o cerca "SQL" nel menu)
2. **Clicca "New Query"** (o "New" → "New Query")
3. **Copia tutto il codice SQL qui sotto** e incollalo nell'editor
4. **Clicca "Run"** (o premi `Ctrl+Enter`)

---

## 📋 Codice SQL da Copiare

```sql
-- ============================================
-- SCHEMA DATABASE GEO-LOCATIONS
-- SpedireSicuro.it - Sistema Autocompletamento Comuni Italiani
-- ============================================

-- Estensione per full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabella geo_locations
CREATE TABLE IF NOT EXISTS geo_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  region TEXT,
  caps TEXT[] NOT NULL DEFAULT '{}',
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('italian', 
      COALESCE(name, '') || ' ' || 
      COALESCE(province, '') || ' ' || 
      COALESCE(region, '') || ' ' || 
      array_to_string(caps, ' ')
    )
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_geo_locations_search_vector 
  ON geo_locations USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_geo_locations_name 
  ON geo_locations USING BTREE (name);
CREATE INDEX IF NOT EXISTS idx_geo_locations_province 
  ON geo_locations USING BTREE (province);
CREATE INDEX IF NOT EXISTS idx_geo_locations_caps 
  ON geo_locations USING GIN (caps);

-- RLS (Row Level Security)
ALTER TABLE geo_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_locations_select_public" 
  ON geo_locations FOR SELECT USING (true);
```

**Copia tutto questo codice e incollalo nell'SQL Editor, poi clicca "Run"!**

---

## 📍 Step 3: Popola Database (Opzionale ma Consigliato)

Dopo aver creato la tabella, puoi popolarla con alcuni comuni di test:

1. **Resta nell'SQL Editor**
2. **Clicca "New Query"**
3. **Copia e incolla questo:**

```sql
-- Inserisci alcuni comuni di test
INSERT INTO geo_locations (name, province, region, caps) VALUES
  ('Roma', 'RM', 'Lazio', ARRAY['00100', '00118', '00119']),
  ('Milano', 'MI', 'Lombardia', ARRAY['20100', '20121', '20122']),
  ('Napoli', 'NA', 'Campania', ARRAY['80100', '80121', '80122']),
  ('Torino', 'TO', 'Piemonte', ARRAY['10100', '10121', '10122']),
  ('Firenze', 'FI', 'Toscana', ARRAY['50100', '50121', '50122']);
```

4. **Clicca "Run"**

---

## ✅ Step 4: Verifica

1. **Riavvia il server locale:**
   ```bash
   npm run dev
   ```

2. **Testa autocomplete:**
   - Vai su http://localhost:3000/dashboard/spedizioni/nuova
   - Digita "Roma" nel campo città
   - Dovrebbe mostrare risultati!

---

## 🆘 Se Non Funziona

1. Verifica che le credenziali in `.env.local` siano corrette
2. Verifica che la tabella sia stata creata (vai su Database → Tables)
3. Controlla console browser per errori
4. Controlla console server per errori

---

**Inizia da Step 1: Settings → API per le credenziali!** 🔑

