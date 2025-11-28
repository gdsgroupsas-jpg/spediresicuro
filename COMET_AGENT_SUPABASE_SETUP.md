# 🤖 PROMPT PER COMET AGENT - Setup Supabase Completo

**Progetto:** SpedireSicuro.it
**Obiettivo:** Configurare database PostgreSQL su Supabase con schema completo per permettere creazione e download spedizioni
**Deadline:** Entro le 18:00 (massima priorità!)

---

## ⚠️ ISTRUZIONI CRITICHE

**PRIMA DI INIZIARE:**
1. ✅ **CHIEDI** conferma all'utente su quale account Supabase usare
2. ✅ **VERIFICA** se esiste già un progetto "spediresicuro"
3. ✅ Se esiste, **NON** sovrascriverlo - usa nome diverso o chiedi conferma
4. ✅ **SALVA** tutte le credenziali generate (URL, keys, password)
5. ✅ **RESTITUISCI** output formattato con TUTTE le credenziali

---

## 🎯 OBIETTIVO FINALE

Al termine di questo setup, l'utente deve poter:
- ✅ **Creare spedizioni** via form web
- ✅ **Scaricare lista spedizioni** in CSV
- ✅ Database PostgreSQL funzionante su Supabase
- ✅ API REST pronte per l'uso
- ✅ File `.env.local` configurato correttamente

---

## 📋 STEP 1: Crea Progetto Supabase

### 1.1 Accedi a Supabase
```
URL: https://supabase.com
Azione: Login con account dell'utente
```

**CHIEDI all'utente:**
- Quale email/account vuoi usare per Supabase?
- Esiste già un progetto "spediresicuro" su questo account?

### 1.2 Crea Nuovo Progetto
- Clicca "New Project"
- **Organization**: (chiedi quale usare)
- **Project Name**: `spediresicuro-prod` (o nome concordato)
- **Database Password**: **GENERA** password sicura (min 20 caratteri)
  - **SALVALA IMMEDIATAMENTE!** Non la vedrai più!
- **Region**: `Europe (Frankfurt) eu-central-1` (più vicino Italia)
- **Pricing Plan**: Free tier (500MB database, 2GB storage, 50k MAU)
- Clicca "Create new project"

⏳ **Attendi 2-3 minuti** per provisioning database

---

## 📋 STEP 2: Importa Schema Database

### 2.1 Vai a SQL Editor
1. Nella sidebar Supabase: **SQL Editor**
2. Clicca "New Query"

### 2.2 Esegui Schema Completo

**COPIA ED ESEGUI** questo SQL (è nel file `supabase/migrations/001_complete_schema.sql` del progetto):

```sql
-- ============================================
-- SPEDIRESICURO.IT - SCHEMA COMPLETO
-- ============================================

-- Estensioni
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'user', 'merchant');
CREATE TYPE auth_provider AS ENUM ('credentials', 'google', 'github', 'facebook');
CREATE TYPE shipment_status AS ENUM (
  'draft', 'pending', 'processing', 'shipped', 'in_transit',
  'out_for_delivery', 'delivered', 'failed', 'cancelled', 'returned'
);
CREATE TYPE courier_service_type AS ENUM ('standard', 'express', 'economy', 'same_day', 'next_day');
CREATE TYPE recipient_type AS ENUM ('B2C', 'B2B');

-- TABELLA: users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  provider auth_provider DEFAULT 'credentials',
  provider_id TEXT,
  image TEXT,
  company_name TEXT,
  vat_number TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: couriers (corrieri)
CREATE TABLE IF NOT EXISTS couriers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  api_type TEXT,
  api_base_url TEXT,
  api_key TEXT,
  api_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  rating DECIMAL(2,1) DEFAULT 0.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: shipments (spedizioni) - CRITICA PER LE 18:00!
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tracking_number TEXT UNIQUE NOT NULL,
  external_tracking_number TEXT,
  status shipment_status DEFAULT 'draft',

  -- Mittente
  sender_name TEXT NOT NULL,
  sender_address TEXT,
  sender_city TEXT,
  sender_zip TEXT,
  sender_province TEXT,
  sender_country TEXT DEFAULT 'IT',
  sender_phone TEXT,
  sender_email TEXT,

  -- Destinatario
  recipient_name TEXT NOT NULL,
  recipient_type recipient_type DEFAULT 'B2C',
  recipient_address TEXT NOT NULL,
  recipient_address_number TEXT,
  recipient_city TEXT NOT NULL,
  recipient_zip TEXT NOT NULL,
  recipient_province TEXT NOT NULL,
  recipient_country TEXT DEFAULT 'IT',
  recipient_phone TEXT NOT NULL,
  recipient_email TEXT,
  recipient_notes TEXT,

  -- Pacco
  weight DECIMAL(10,2) NOT NULL,
  length DECIMAL(10,2),
  width DECIMAL(10,2),
  height DECIMAL(10,2),
  volumetric_weight DECIMAL(10,2),

  -- Valore
  declared_value DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',

  -- Servizio
  courier_id UUID REFERENCES couriers(id),
  service_type courier_service_type DEFAULT 'standard',
  cash_on_delivery BOOLEAN DEFAULT false,
  cash_on_delivery_amount DECIMAL(10,2),
  insurance BOOLEAN DEFAULT false,

  -- Pricing
  base_price DECIMAL(10,2),
  surcharges DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2),
  margin_percent DECIMAL(5,2),
  final_price DECIMAL(10,2),

  -- Geo-analytics
  geo_zone TEXT,
  courier_quality_score DECIMAL(3,2),

  -- E-commerce
  ecommerce_platform TEXT,
  ecommerce_order_id TEXT,
  ecommerce_order_number TEXT,

  -- OCR
  created_via_ocr BOOLEAN DEFAULT false,
  ocr_confidence_score DECIMAL(3,2),

  -- Note
  notes TEXT,
  internal_notes TEXT,

  -- Timestamps
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABELLA: geo_locations (comuni italiani)
CREATE TABLE IF NOT EXISTS geo_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  region TEXT,
  caps TEXT[] NOT NULL DEFAULT '{}',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
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

-- INDICI per performance
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_geo_locations_search_vector ON geo_locations USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_geo_locations_name ON geo_locations USING BTREE (name);

-- TRIGGER per updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Policy: users possono vedere solo i propri dati
CREATE POLICY users_select_own ON users
  FOR SELECT USING (auth.uid()::TEXT = id::TEXT);

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (auth.uid()::TEXT = id::TEXT);

-- Policy: users possono vedere solo le proprie spedizioni
CREATE POLICY shipments_select_own ON shipments
  FOR SELECT USING (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY shipments_insert_own ON shipments
  FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY shipments_update_own ON shipments
  FOR UPDATE USING (auth.uid()::TEXT = user_id::TEXT);

CREATE POLICY shipments_delete_own ON shipments
  FOR DELETE USING (auth.uid()::TEXT = user_id::TEXT);
```

**Clicca "Run" in basso a destra**

✅ **Verifica**: Dovresti vedere "Success. No rows returned"

---

## 📋 STEP 3: Verifica Tabelle Create

### 3.1 Vai a Table Editor
Nella sidebar Supabase: **Table Editor**

### 3.2 Verifica Tabelle Esistenti
Dovresti vedere queste tabelle:
- ✅ `users` - Utenti
- ✅ `couriers` - Corrieri
- ✅ `shipments` - **CRITICA!** Spedizioni
- ✅ `geo_locations` - Comuni italiani

**Se manca qualche tabella**: Torna a STEP 2 e riesegui lo script SQL.

### 3.3 Test Tabella Shipments
1. Clicca su tabella `shipments`
2. Dovresti vedere le colonne:
   - id, user_id, tracking_number
   - sender_name, recipient_name
   - weight, courier_id
   - base_price, final_price
   - created_at, updated_at

✅ **Se vedi tutto**: Tabella pronta!

---

## 📋 STEP 4: Inserisci Dati di Test

### 4.1 Crea Utente Admin
Vai in SQL Editor ed esegui:

```sql
-- Inserisci utente admin (password: admin123)
INSERT INTO users (email, password, name, role)
VALUES (
  'admin@spediresicuro.it',
  '$2a$10$rKvVF5xH8kF.YwN0kW8hKOqF1r9xN9zF8xH8kF.YwN0kW8hKOqF1r9',
  'Admin SpedireSicuro',
  'admin'
) ON CONFLICT (email) DO NOTHING;
```

### 4.2 Crea Corrieri Mock
```sql
-- Inserisci corrieri di test
INSERT INTO couriers (name, code, api_type, api_base_url, is_active, rating)
VALUES
  ('DHL Express', 'DHL', 'rest', 'https://api.dhl.com', true, 4.5),
  ('UPS', 'UPS', 'rest', 'https://api.ups.com', true, 4.3),
  ('FedEx', 'FEDEX', 'rest', 'https://api.fedex.com', true, 4.4),
  ('BRT', 'BRT', 'soap', 'https://api.brt.it', true, 3.8),
  ('GLS', 'GLS', 'rest', 'https://api.gls.it', true, 4.0)
ON CONFLICT (code) DO NOTHING;
```

### 4.3 Crea Geo-Locations (Comuni Italiani Top)
```sql
-- Inserisci principali città italiane
INSERT INTO geo_locations (name, province, region, caps, latitude, longitude)
VALUES
  ('Roma', 'RM', 'Lazio', ARRAY['00100', '00118', '00144', '00154'], 41.9028, 12.4964),
  ('Milano', 'MI', 'Lombardia', ARRAY['20100', '20121', '20122', '20123'], 45.4642, 9.1900),
  ('Napoli', 'NA', 'Campania', ARRAY['80100', '80121', '80122', '80133'], 40.8518, 14.2681),
  ('Torino', 'TO', 'Piemonte', ARRAY['10100', '10121', '10122', '10123'], 45.0703, 7.6869),
  ('Palermo', 'PA', 'Sicilia', ARRAY['90100', '90121', '90122', '90123'], 38.1157, 13.3615),
  ('Genova', 'GE', 'Liguria', ARRAY['16100', '16121', '16122', '16123'], 44.4056, 8.9463),
  ('Bologna', 'BO', 'Emilia-Romagna', ARRAY['40100', '40121', '40122', '40123'], 44.4949, 11.3426),
  ('Firenze', 'FI', 'Toscana', ARRAY['50100', '50121', '50122', '50123'], 43.7696, 11.2558)
ON CONFLICT DO NOTHING;
```

---

## 📋 STEP 5: Configura API Settings (Importante!)

### 5.1 Disabilita Email Confirmation (Per Sviluppo)
1. Vai in **Authentication** → **Providers** → **Email**
2. **Confirm email**: Toggle OFF (disabilita)
3. Clicca "Save"

⚠️ **Perché**: Così puoi testare subito senza verificare email

### 5.2 Configura URL Redirect
1. Vai in **Authentication** → **URL Configuration**
2. **Site URL**: `http://localhost:3000`
3. **Redirect URLs**: Aggiungi:
   ```
   http://localhost:3000
   http://localhost:3000/dashboard
   https://www.spediresicuro.it
   https://www.spediresicuro.it/dashboard
   ```
4. Clicca "Save"

---

## 📋 STEP 6: Raccogli Credenziali (CRITICO!)

### 6.1 Vai in Settings → API
Nella sidebar: **Settings** (icona ingranaggio) → **API**

### 6.2 Copia TUTTE Queste Informazioni

**📍 Project URL**
```
URL completo tipo: https://xxxxxxxxxxxxx.supabase.co
```

**🔑 Project API Keys**

**anon public** (chiave pubblica - safe per client):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpuenp6enp6enp6enp6enp6IiwKInJvbGUiOiJhbm9uIiwiaWF0IjoxNjg1MDAwMDAwLCJleHAiOjIwMDA1NzYwMDB9....
```

**service_role** (chiave privata - SOLO server-side):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpuenp6enp6enp6enp6enp6IiwKInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2ODUwMDAwMDAsImV4cCI6MjAwMDU3NjAwMH0....
```

**💾 Database Password** (salvata in STEP 1.2)

---

## 📋 STEP 7: Crea File .env.local (IMPORTANTISSIMO!)

### 7.1 Naviga alla Root del Progetto
```bash
cd /home/user/spediresicuro
```

### 7.2 Crea File .env.local
Esegui questo comando sostituendo i valori:

```bash
cat > .env.local << 'EOF'
# ============================================
# SpedireSicuro.it - Environment Variables
# ============================================
# GENERATO DA COMET AGENT - Setup Supabase
# Data: [INSERISCI DATA E ORA]
#
# ⚠️ IMPORTANTE: NON committare questo file su Git!
#

# ============================================
# 🗄️ SUPABASE - Database PostgreSQL
# ============================================
# Dashboard: https://app.supabase.com

# Project URL
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Anon Key (public, safe per client-side)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Service Role Key (PRIVATE! Solo server-side!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Database Password (opzionale, per connessioni dirette psql)
SUPABASE_DB_PASSWORD=la_tua_password_generata

# ============================================
# 🔑 NEXTAUTH - Autenticazione
# ============================================
NEXTAUTH_SECRET=genera_con_openssl_rand_base64_32
NEXTAUTH_URL=http://localhost:3000

# ============================================
# 🚀 APP CONFIG
# ============================================
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=SpedireSicuro.it
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_MARGIN=15

# ============================================
# 🔐 OAUTH (se già configurati)
# ============================================
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GITHUB_CLIENT_ID=REDACTED_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=REDACTED_GITHUB_CLIENT_SECRET

EOF
```

### 7.3 Genera NEXTAUTH_SECRET
```bash
# Genera secret sicuro
openssl rand -base64 32
```

**COPIA** l'output e **SOSTITUISCI** nel file `.env.local` alla riga `NEXTAUTH_SECRET=`

---

## 📋 STEP 8: Verifica Setup Completo

### 8.1 Test Connessione Database
Vai in Supabase → SQL Editor ed esegui:

```sql
-- Test query di verifica
SELECT
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM couriers) as couriers_count,
  (SELECT COUNT(*) FROM shipments) as shipments_count,
  (SELECT COUNT(*) FROM geo_locations) as geolocations_count;
```

**Output atteso**:
- users_count: 1 (l'admin)
- couriers_count: 5 (i corrieri mock)
- shipments_count: 0 (nessuna ancora)
- geolocations_count: 8 (le città italiane)

✅ **Se vedi questi numeri**: Database pronto!

### 8.2 Test API REST
1. Vai in **API Docs** nella sidebar
2. Seleziona tabella `shipments`
3. Copia esempio cURL per "Read rows"
4. Dovresti vedere array vuoto `[]` (normale, nessuna spedizione ancora)

---

## ✅ CHECKLIST FINALE

Prima di restituire l'output, verifica:

- [ ] ✅ Progetto Supabase creato
- [ ] ✅ Schema database importato (4 tabelle minimo)
- [ ] ✅ Dati di test inseriti (user admin, 5 corrieri, 8 città)
- [ ] ✅ API settings configurate (email confirm OFF)
- [ ] ✅ Credenziali API copiate (URL + 2 keys)
- [ ] ✅ File `.env.local` creato nella root del progetto
- [ ] ✅ Test connessione database eseguito con successo

---

## 📤 OUTPUT RICHIESTO

**Comet Agent, DEVI restituire questo output formattato:**

```markdown
# ✅ SETUP SUPABASE COMPLETATO - SpedireSicuro.it

**Data completamento:** [INSERISCI DATA E ORA]
**Progetto Supabase:** [NOME PROGETTO]
**Region:** Europe (Frankfurt)

## 📊 Credenziali Supabase

```env
# Supabase Project URL
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Supabase Anon Key (public)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Supabase Service Role Key (PRIVATE!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Database Password
SUPABASE_DB_PASSWORD=la_password_generata
```

## 📊 Database Status

- ✅ Tabelle create: 4 (users, couriers, shipments, geo_locations)
- ✅ Utenti: 1 (admin@spediresicuro.it)
- ✅ Corrieri: 5 (DHL, UPS, FedEx, BRT, GLS)
- ✅ Città: 8 (principali città italiane)
- ✅ Spedizioni: 0 (pronto per creare!)

## 📊 File Configurati

- ✅ `.env.local` creato in `/home/user/spediresicuro/.env.local`
- ✅ Variabili configurate: [NUMERO]
- ✅ NEXTAUTH_SECRET generato: [SI/NO]

## 🔗 Link Utili

- **Dashboard Supabase:** https://app.supabase.com/project/[PROJECT_ID]
- **Table Editor:** https://app.supabase.com/project/[PROJECT_ID]/editor
- **SQL Editor:** https://app.supabase.com/project/[PROJECT_ID]/sql
- **API Docs:** https://app.supabase.com/project/[PROJECT_ID]/api

## 🧪 Test Prossimi Passi

1. **Avvia server locale:**
   ```bash
   cd /home/user/spediresicuro
   npm run dev
   ```

2. **Testa creazione spedizione:**
   - Vai su http://localhost:3000/dashboard/spedizioni/nuova
   - Compila form
   - Clicca "Crea Spedizione"
   - Verifica in Supabase Table Editor che appaia in tabella `shipments`

3. **Testa download CSV:**
   - Vai su http://localhost:3000/dashboard/spedizioni
   - Clicca "Esporta CSV"
   - Verifica download file

## ✅ Setup Completato!

Il database Supabase è pronto per:
- ✅ Creare spedizioni
- ✅ Scaricare CSV
- ✅ Sincronizzazione real-time
- ✅ API REST pronte

**Deadline rispettata:** Pronto per le 18:00! 🚀
```

---

## 🚨 TROUBLESHOOTING

### Errore: "permission denied for schema public"
```sql
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
```

### Errore: "function uuid_generate_v4() does not exist"
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Errore: "relation shipments already exists"
Schema già importato! Vai a STEP 3 per verificare.

### Errore: ".env.local not found"
Verifica di essere nella root del progetto:
```bash
pwd  # Deve essere: /home/user/spediresicuro
ls -la .env.local  # Deve esistere
```

---

## ⏰ TEMPO STIMATO

- STEP 1-2: 5 minuti (creazione progetto + schema)
- STEP 3-4: 3 minuti (verifica + dati test)
- STEP 5-6: 2 minuti (configurazione + credenziali)
- STEP 7: 2 minuti (file .env.local)
- STEP 8: 2 minuti (test finali)

**TOTALE: ~15 minuti** ✅

---

**INIZIA ORA! Il tempo stringe per la deadline delle 18:00!** ⏰🚀
