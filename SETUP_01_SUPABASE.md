# 🗄️ SETUP SUPABASE - SpediSicuro Platform

**Obiettivo**: Configurare Supabase come database PostgreSQL con autenticazione e API completa.

---

## ⚠️ ATTENZIONE - IMPORTANTE

**Questo è il NUOVO progetto SpediSicuro!**

Esiste un vecchio progetto con nome simile. Prima di procedere:
- ✅ **VERIFICA** che stai lavorando sull'account Supabase corretto
- ✅ **CHIEDI** conferma all'utente prima di accedere a Supabase
- ✅ **NON** sovrascrivere progetti esistenti
- ✅ Usa nome progetto: `spediresicuro-new` o `spediresicuro-v2` se esiste già

---

## 📋 ISTRUZIONI PER COMET AGENT

Sei un agente di configurazione esperto. Il tuo compito è guidare l'utente nella configurazione completa di Supabase per la **SpediSicuro Platform** e raccogliere TUTTE le credenziali necessarie.

**PRIMA DI INIZIARE**: Chiedi all'utente conferma su quale account Supabase usare e il nome esatto del progetto!

---

## STEP 1: Creazione Progetto Supabase

### 1.1 Accedi a Supabase
- Vai su https://supabase.com
- Clicca "Start your project"
- Accedi con GitHub o Email

### 1.2 Crea Nuovo Progetto
- Clicca "New Project"
- **Organization**: Seleziona o crea "SpediSicuro" (o nome desiderato)
- **Project Name**: `spediresicuro-new` o `spediresicuro-v2` (se esiste già `spediresicuro`)
- **Database Password**: Genera password sicura (SALVALA!)
- **Region**: Seleziona `Europe (Frankfurt) eu-central-1` (più vicino all'Italia)
- **Pricing Plan**: Free tier (25,000 MAU, 500MB database - perfetto per iniziare)
- Clicca "Create new project"

⏳ **Attendi 2-3 minuti** per il provisioning del database.

---

## STEP 2: Configurazione Database

### 2.1 Importa Schema Database
1. Clicca su "SQL Editor" nella sidebar
2. Clicca "New Query"
3. Copia TUTTO il contenuto del file `supabase/migrations/001_complete_schema.sql`
4. Incolla nell'editor SQL
5. Clicca "Run" (in basso a destra)
6. **Verifica**: Dovresti vedere "Success. No rows returned"

### 2.2 Verifica Tabelle Create
1. Clicca su "Table Editor" nella sidebar
2. Dovresti vedere queste tabelle:
   - ✅ users
   - ✅ couriers
   - ✅ shipments
   - ✅ shipment_events
   - ✅ price_lists
   - ✅ price_list_entries
   - ✅ products
   - ✅ warehouses
   - ✅ warehouse_stock
   - ✅ ecommerce_integrations
   - ✅ ecommerce_orders
   - ✅ geo_locations
   - ✅ geo_zones
   - ✅ courier_reliability_scores
   - ✅ fulfillment_decisions
   - ✅ social_trends
   - ✅ product_categories
   - ✅ accounts (NextAuth)
   - ✅ sessions (NextAuth)

**Se manca qualche tabella**, torna allo STEP 2.1 e riesegui lo script.

---

## STEP 3: Configurazione Autenticazione

### 3.1 Abilita Email Authentication
1. Clicca "Authentication" → "Providers"
2. **Email**: Già abilitato di default ✅
3. **Confirm email**: Disabilita per testing (puoi riabilitare in produzione)
4. Clicca "Save"

### 3.2 Configurazione URL Redirect (per dopo Google OAuth)
1. Clicca "Authentication" → "URL Configuration"
2. **Site URL**: `http://localhost:3000` (per ora)
3. **Redirect URLs**: Aggiungi:
   ```
   http://localhost:3000
   http://localhost:3000/auth/callback
   https://tuodominio.vercel.app (aggiungerai dopo deploy)
   ```
4. Clicca "Save"

---

## STEP 4: Raccolta Credenziali (IMPORTANTE!)

### 4.1 Project API Keys
1. Clicca "Settings" (icona ingranaggio) → "API"
2. **Copia e SALVA** questi valori:

```env
# 📍 PROJECT URL
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# 🔑 ANON PUBLIC KEY (pubblica, safe per client-side)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 🔐 SERVICE ROLE KEY (PRIVATA! Solo server-side)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4.2 Database Password (opzionale, per connessioni dirette)
```env
# 💾 DATABASE PASSWORD (salvata in STEP 1.2)
SUPABASE_DB_PASSWORD=la_password_che_hai_generato
```

---

## STEP 5: Test Connessione

### 5.1 Test SQL Query
1. Vai in "SQL Editor"
2. Esegui questa query di test:
```sql
-- Test connessione e dati
SELECT
  (SELECT COUNT(*) FROM users) as users_count,
  (SELECT COUNT(*) FROM couriers) as couriers_count,
  (SELECT COUNT(*) FROM shipments) as shipments_count;
```
3. Dovresti vedere una riga con `0, 0, 0` (tabelle vuote ma funzionanti)

### 5.2 Test API REST
1. Clicca "API Docs" nella sidebar
2. Seleziona la tabella `users`
3. Copia l'esempio cURL "Read rows"
4. Esegui nel terminale (dovresti vedere array vuoto `[]`)

---

## STEP 6: Configurazione Row Level Security (RLS)

### 6.1 Verifica RLS Policies
1. Vai in "Authentication" → "Policies"
2. Verifica che ci siano policies per:
   - ✅ users (3 policies)
   - ✅ shipments (4 policies)
   - ✅ products (2 policies)
   - ✅ warehouses (2 policies)

Se non ci sono, lo schema SQL le ha già create! ✅

---

## STEP 7: (OPZIONALE) Dati di Test

### 7.1 Inserisci Corriere Mock
```sql
INSERT INTO couriers (name, code, api_type, api_base_url, is_active, rating)
VALUES
  ('DHL Express', 'DHL', 'rest', 'https://api.dhl.com', true, 4.5),
  ('UPS', 'UPS', 'rest', 'https://api.ups.com', true, 4.3),
  ('FedEx', 'FEDEX', 'rest', 'https://api.fedex.com', true, 4.4),
  ('BRT', 'BRT', 'soap', 'https://api.brt.it', true, 3.8),
  ('GLS', 'GLS', 'rest', 'https://api.gls.it', true, 4.0);
```

### 7.2 Inserisci Geo-Location Mock (Roma)
```sql
INSERT INTO geo_locations (name, province, region, caps, latitude, longitude)
VALUES
  ('Roma', 'RM', 'Lazio', ARRAY['00100', '00118', '00144', '00154'], 41.9028, 12.4964),
  ('Milano', 'MI', 'Lombardia', ARRAY['20100', '20121', '20122'], 45.4642, 9.1900),
  ('Napoli', 'NA', 'Campania', ARRAY['80100', '80121', '80122'], 40.8518, 14.2681);
```

---

## ✅ CHECKLIST FINALE

Prima di procedere, verifica:

- [ ] Progetto Supabase creato e attivo
- [ ] Schema database importato (19 tabelle visibili)
- [ ] Email authentication abilitata
- [ ] Credenziali API copiate (URL + 2 keys)
- [ ] Database password salvata
- [ ] Test SQL query eseguito con successo
- [ ] RLS policies attive e configurate
- [ ] (Opzionale) Dati di test inseriti

---

## 📤 OUTPUT RICHIESTO

**Comet Agent, restituisci ESATTAMENTE questo formato:**

```env
# ============================================
# 🗄️ SUPABASE CONFIGURATION
# ============================================

# Project URL
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co

# Anon Key (public, safe for client-side)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx...

# Service Role Key (PRIVATE! Server-side only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx...

# Database Password (optional, for direct connections)
SUPABASE_DB_PASSWORD=your_generated_password

# ============================================
# ✅ SETUP SUPABASE COMPLETATO
# ============================================
```

**Inoltre, conferma:**
- ✅ Numero di tabelle create: __
- ✅ Region selezionata: __
- ✅ Piano: Free tier
- ✅ Test query eseguito: SI/NO
- ✅ RLS policies attive: SI/NO

---

## 🚨 TROUBLESHOOTING

### Errore: "permission denied for schema public"
**Soluzione**: Vai in SQL Editor ed esegui:
```sql
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
```

### Errore: "function uuid_generate_v4() does not exist"
**Soluzione**: Esegui:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Errore: "relation already exists"
**Soluzione**: Lo schema è già stato importato! Vai a STEP 2.2 per verificare.

---

## ➡️ PROSSIMO STEP

Una volta completato questo setup, procedi con:
- **SETUP_02_GOOGLE_OAUTH.md** - Configurazione autenticazione Google

---

**Inizia ora! Segui gli step uno per uno e restituisci l'output richiesto.** 🚀
