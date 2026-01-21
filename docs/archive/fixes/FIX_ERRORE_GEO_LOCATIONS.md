# 🔧 Fix Errore Database geo_locations

## 🚨 Problema

Dopo aver creato la policy RLS su `geo_locations`, la ricerca città ancora non funziona e dà errore di database.

## 🔍 Diagnostica

### Step 1: Esegui Script di Diagnostica

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Copia e incolla il contenuto di `supabase/DIAGNOSTICA_GEO_LOCATIONS.sql`
3. Esegui lo script
4. Leggi il report finale

Lo script verificherà:

- ✅ Se la tabella esiste
- ✅ Se RLS è abilitato
- ✅ Se ci sono policy
- ✅ Se la query funziona con ruolo anonimo
- ✅ Se le colonne necessarie esistono

### Step 2: Verifica Manuale

Esegui queste query su Supabase SQL Editor:

#### Verifica RLS abilitato:

```sql
SELECT rowsecurity
FROM pg_tables
WHERE tablename = 'geo_locations';
```

**Deve restituire:** `true`

#### Verifica policy esistenti:

```sql
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'geo_locations';
```

**Deve restituire:** almeno una policy con `cmd = 'SELECT'`

#### Test query con chiave anonima:

```sql
-- Simula query con ruolo anonimo
SET ROLE anon;
SELECT COUNT(*) FROM geo_locations LIMIT 1;
RESET ROLE;
```

**Deve restituire:** un numero (non errore)

---

## ✅ Soluzioni Comuni

### Problema 1: RLS non abilitato

**Sintomi:** Errore "permission denied" o "row-level security"

**Soluzione:**

```sql
ALTER TABLE geo_locations ENABLE ROW LEVEL SECURITY;
```

### Problema 2: Nessuna policy SELECT

**Sintomi:** Query restituisce 0 righe anche se la tabella ha dati

**Soluzione:**

```sql
-- Rimuovi policy esistenti (se ci sono)
DROP POLICY IF EXISTS "geo_locations_select_public" ON geo_locations;
DROP POLICY IF EXISTS "Enable read access to everyone" ON geo_locations;

-- Crea policy pubblica
CREATE POLICY "geo_locations_select_public"
  ON geo_locations FOR SELECT
  USING (true);
```

### Problema 3: Policy con condizioni errate

**Sintomi:** Policy esiste ma query non funziona

**Soluzione:**

```sql
-- Rimuovi policy esistenti
DROP POLICY IF EXISTS "geo_locations_select_public" ON geo_locations;

-- Crea policy corretta (senza condizioni)
CREATE POLICY "geo_locations_select_public"
  ON geo_locations FOR SELECT
  USING (true);
```

### Problema 4: Policy per ruolo sbagliato

**Sintomi:** Policy esiste ma solo per `authenticated`, non per `anon`

**Soluzione:**

```sql
-- Crea policy per ruolo anonimo (pubblico)
CREATE POLICY "geo_locations_select_public"
  ON geo_locations FOR SELECT
  TO anon, authenticated
  USING (true);
```

---

## 🧪 Test Completo

Dopo aver applicato le fix, testa così:

### Test 1: Query diretta su Supabase

```sql
-- Con chiave ANON (pubblica) - deve funzionare
SELECT name, province, region, caps
FROM geo_locations
WHERE name ILIKE 'Roma%'
LIMIT 5;
```

### Test 2: Test API locale

Apri il browser e vai su:

```
http://localhost:3000/api/geo/search?q=Roma
```

**Risposta attesa:**

```json
{
  "results": [
    {
      "city": "Roma",
      "province": "RM",
      "region": "Lazio",
      "caps": ["00100", "00118", ...],
      "displayText": "Roma (RM)"
    }
  ],
  "count": 1,
  "query": "Roma"
}
```

### Test 3: Test nel form

1. Apri il form di creazione spedizione
2. Clicca sul campo "Città destinatario"
3. Digita "Roma"
4. **Dovresti vedere** suggerimenti con "Roma (RM)"

---

## 🔍 Debug Avanzato

### Controlla i log dell'applicazione

Se l'errore persiste, controlla i log:

1. **Log Next.js (locale):**

   ```bash
   npm run dev
   # Guarda la console per errori
   ```

2. **Log Supabase:**
   - Vai su **Supabase Dashboard** → **Logs** → **Postgres Logs**
   - Cerca errori relativi a `geo_locations`

### Verifica variabili ambiente

Assicurati che `.env.local` contenga:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### Test con curl

```bash
curl "http://localhost:3000/api/geo/search?q=Roma"
```

Se vedi un errore, copia l'errore completo e controlla:

- Codice errore (es. `PGRST116`)
- Messaggio errore
- Stack trace

---

## 📋 Checklist Finale

Prima di dire che è risolto, verifica:

- [ ] RLS è abilitato su `geo_locations`
- [ ] Esiste una policy SELECT con `USING (true)`
- [ ] La policy è per ruolo `anon` o `public`
- [ ] Query diretta su Supabase funziona
- [ ] API `/api/geo/search?q=Roma` restituisce risultati
- [ ] Autocompletamento nel form funziona

---

## 🆘 Se Nulla Funziona

Se dopo tutti questi passi ancora non funziona:

1. **Copia l'errore esatto** che vedi (dalla console browser o log)
2. **Esegui lo script di diagnostica** e copia tutto l'output
3. **Verifica** che la tabella `geo_locations` abbia dati (dovresti vedere ~15.000 righe)

Poi possiamo investigare più a fondo!
