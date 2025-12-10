# 🔒 Sicurezza: geo_locations vs shipments

## ✅ RISPOSTA BREVE

**NO, rendere pubblica `geo_locations` NON espone le spedizioni!**

Le due tabelle sono **completamente separate** e `shipments` ha già RLS policies che proteggono i dati.

---

## 📊 STRUTTURA TABELLE

### Tabella `geo_locations` (DATI PUBBLICI)

Contiene **SOLO** dati geografici pubblici:
- `name` - Nome comune (es. "Roma", "Milano")
- `province` - Codice provincia (es. "RM", "MI")
- `region` - Nome regione (es. "Lazio", "Lombardia")
- `caps` - Array di CAP (es. ["00100", "00118"])

**NON contiene:**
- ❌ Dati di spedizioni
- ❌ Informazioni personali
- ❌ Dati sensibili

**È come un elenco telefonico pubblico** - tutti possono vedere i nomi delle città!

### Tabella `shipments` (DATI PRIVATI)

Contiene **tutti i dati delle spedizioni**:
- Dati mittente/destinatario
- Tracking numbers
- Prezzi
- Note private
- ecc.

**È PROTETTA da RLS (Row Level Security)**

---

## 🔗 RELAZIONE TRA LE TABELLE

**NON c'è una relazione diretta!**

- `shipments` ha campi testo come `recipient_city`, `recipient_zip`
- Questi sono **solo stringhe**, NON foreign key verso `geo_locations`
- Le due tabelle sono **completamente indipendenti**

Esempio:
```sql
-- shipments.recipient_city è solo una stringa
recipient_city TEXT  -- Es. "Roma"

-- NON è una foreign key!
-- NON c'è: FOREIGN KEY (recipient_city) REFERENCES geo_locations(name)
```

---

## 🛡️ PROTEZIONE RLS SU shipments

Le spedizioni sono **già protette** da RLS policies:

```sql
-- Policy esistente (da migrations/002_anne_setup.sql)
CREATE POLICY "Users can view own shipments"
  ON shipments FOR SELECT
  USING (auth.uid() = user_id);
```

Questo significa:
- ✅ Ogni utente vede **SOLO** le proprie spedizioni
- ✅ Gli admin vedono tutte le spedizioni (se hanno policy admin)
- ✅ Utenti non autenticati **NON vedono NESSUNA spedizione**

---

## 🔍 COME FUNZIONA LA RICERCA CITTÀ

L'API `/api/geo/search` fa una query **SOLO** su `geo_locations`:

```typescript
// app/api/geo/search/route.ts
const { data } = await supabase
  .from('geo_locations')  // ← SOLO questa tabella!
  .select('name, province, region, caps')
  .textSearch('search_vector', searchTerms)
  .limit(20);
```

**NON tocca mai la tabella `shipments`!**

---

## ✅ VERIFICA SICUREZZA

### 1. Verifica che RLS sia abilitato su shipments

Esegui su Supabase SQL Editor:

```sql
-- Verifica RLS su shipments
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'shipments';
```

Deve restituire: `rowsecurity = true`

### 2. Verifica le policy RLS su shipments

```sql
-- Lista tutte le policy su shipments
SELECT 
  policyname,
  cmd,  -- SELECT, INSERT, UPDATE, DELETE
  qual,  -- Condizione USING
  with_check  -- Condizione WITH CHECK
FROM pg_policies 
WHERE tablename = 'shipments';
```

Dovresti vedere policy come:
- `"Users can view own shipments"` - SELECT con `auth.uid() = user_id`
- `"Users can insert own shipments"` - INSERT con `auth.uid() = user_id`
- `"Admins can view all shipments"` - SELECT per admin

### 3. Test di sicurezza

Prova a fare una query su `shipments` con la chiave anon (pubblica):

```sql
-- Questo DEVE fallire (nessun risultato) se RLS funziona
SELECT * FROM shipments;
-- Con chiave anon, dovrebbe restituire 0 righe
```

---

## 🎯 COSA FARE

### Abilita RLS su geo_locations (PUBBLICO)

```sql
-- Abilita RLS
ALTER TABLE geo_locations ENABLE ROW LEVEL SECURITY;

-- Crea policy per lettura pubblica
CREATE POLICY "geo_locations_select_public" 
  ON geo_locations 
  FOR SELECT 
  USING (true);  -- Tutti possono leggere
```

### Verifica che shipments sia protetto

```sql
-- Verifica RLS su shipments (deve essere già abilitato)
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Verifica che le policy esistano
SELECT policyname FROM pg_policies WHERE tablename = 'shipments';
```

---

## 📋 RIEPILOGO

| Tabella | Contenuto | RLS | Accesso |
|---------|-----------|-----|---------|
| `geo_locations` | Dati pubblici (città, CAP) | ✅ Abilitato | 🌍 Pubblico (tutti possono leggere) |
| `shipments` | Dati privati (spedizioni) | ✅ Abilitato | 🔒 Privato (solo utente proprietario) |

**Le due tabelle sono separate e indipendenti!**

---

## ⚠️ ATTENZIONE

Se per qualche motivo vedi che le spedizioni sono accessibili pubblicamente:

1. **Verifica immediatamente le RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'shipments';
   ```

2. **Verifica che RLS sia abilitato:**
   ```sql
   SELECT rowsecurity FROM pg_tables WHERE tablename = 'shipments';
   ```

3. **Se RLS non è abilitato, abilitalo:**
   ```sql
   ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
   ```

4. **Se mancano le policy, creale:**
   ```sql
   CREATE POLICY "Users can view own shipments"
     ON shipments FOR SELECT
     USING (auth.uid() = user_id);
   ```

---

## ✅ CONCLUSIONE

**Puoi rendere `geo_locations` pubblica senza problemi!**

Le spedizioni rimangono protette perché:
- ✅ Sono in una tabella separata
- ✅ Hanno RLS abilitato
- ✅ Hanno policy che limitano l'accesso solo al proprietario

**È come rendere pubblica una lista di città: non espone i dati delle spedizioni!**

