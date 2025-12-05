# 🤖 Anne Superadmin - Accesso Completo Database Spedizioni

## 📋 Descrizione

Script SQL completo che configura l'accesso totale per **Anne AI** in modalità superadmin a **TUTTE le spedizioni** da **TUTTE le fonti**:

✅ Spedizioni create manualmente in piattaforma  
✅ Spedizioni importate da CSV  
✅ Spedizioni importate da Excel/XLS  
✅ Spedizioni importate da PDF (OCR)  
✅ Spedizioni create da screenshot/foto (OCR Vision)  
✅ Spedizioni sincronizzate da e-commerce (Shopify, WooCommerce, etc.)  
✅ Spedizioni importate da altre piattaforme (Spedisci.Online, etc.)  

---

## 🚀 Installazione Rapida

### Metodo 1: Supabase Dashboard (Consigliato)

1. Vai su **Supabase Dashboard** → Il tuo progetto
2. Clicca su **SQL Editor** nel menu laterale
3. Clicca su **New Query**
4. Copia e incolla TUTTO il contenuto di `ANNE_SUPERADMIN_ACCESS.sql`
5. Clicca su **Run** (o premi `Ctrl + Enter`)
6. Verifica che l'output mostri: `✅ TUTTO OK! Anne può accedere a tutte le X spedizioni`

### Metodo 2: Supabase CLI

```bash
# Assicurati di essere nella cartella del progetto
cd d:\spediresicuro-master

# Esegui la migration
supabase db execute --file supabase/migrations/ANNE_SUPERADMIN_ACCESS.sql
```

### Metodo 3: psql (PostgreSQL Client)

```bash
# Connettiti al database Supabase
psql -h [HOST] -U postgres -d postgres -f supabase/migrations/ANNE_SUPERADMIN_ACCESS.sql
```

---

## 🎯 Cosa Fa lo Script

### 1. **Verifica Schema Shipments** ✅
Aggiunge tutti i campi necessari per tracciare la sorgente delle spedizioni:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| `import_source` | TEXT | Sorgente: `csv`, `xls`, `pdf`, `screenshot` |
| `import_platform` | TEXT | Piattaforma: `spedisci.online`, `shopify`, etc. |
| `imported` | BOOLEAN | Flag: spedizione importata (vs creata manualmente) |
| `created_via_ocr` | BOOLEAN | Flag: creata tramite OCR (PDF/foto) |
| `ocr_confidence_score` | DECIMAL | Score confidenza OCR (0.00 - 1.00) |
| `ecommerce_platform` | TEXT | Piattaforma e-commerce: `shopify`, `woocommerce` |
| `ecommerce_order_id` | TEXT | ID ordine e-commerce |
| `ecommerce_order_number` | TEXT | Numero ordine leggibile |
| `created_by_user_email` | TEXT | Email utente che ha creato/importato |
| `verified` | BOOLEAN | Flag: spedizione verificata manualmente |
| `deleted` | BOOLEAN | Soft delete |
| `deleted_at` | TIMESTAMP | Data eliminazione |

### 2. **Crea View Ottimizzata per Anne** 📊
Crea la view `anne_all_shipments_view` con:
- **Tutti i dati** delle spedizioni (mittente, destinatario, corriere, pricing, etc.)
- **Categorizzazione automatica** della sorgente (`source_category`)
- **Join con utenti** per mostrare proprietario
- **Esclusione soft delete** (solo spedizioni attive)

### 3. **Policy RLS per Superadmin** 🔒
Configura Row Level Security:
- **Superadmin**: accesso **completo** a TUTTE le spedizioni
- **Admin**: accesso **completo** a TUTTE le spedizioni  
- **Utenti normali**: accesso solo alle **proprie** spedizioni

### 4. **Funzioni Helper per Anne AI** ⚙️

#### `anne_get_shipments_stats()`
Statistiche complete per sorgente:

```sql
SELECT * FROM anne_get_shipments_stats();
```

**Output:**
```
total_shipments   | 1250
manual_created    | 450
csv_imported      | 320
excel_imported    | 180
pdf_imported      | 95
ocr_created       | 125
ecommerce_synced  | 60
other_platform    | 20
verified_count    | 980
unverified_count  | 270
deleted_count     | 15
```

#### `anne_search_shipments(termine, limit)`
Ricerca full-text ottimizzata:

```sql
-- Cerca "Milano"
SELECT * FROM anne_search_shipments('Milano', 50);

-- Cerca tracking number
SELECT * FROM anne_search_shipments('TRACK123', 10);
```

### 5. **Indici Ottimizzati** 🚀
Crea indici per performance:
- Indice composito per statistiche
- Indice full-text per ricerca italiana
- Indici su campi sorgente

---

## 📖 Come Usare con Anne AI

### Query Base: Tutte le Spedizioni

```sql
-- Ottieni tutte le spedizioni visibili da Anne
SELECT * FROM anne_all_shipments_view
ORDER BY created_at DESC
LIMIT 100;
```

### Filtra per Sorgente

```sql
-- Solo spedizioni importate da CSV
SELECT * FROM anne_all_shipments_view
WHERE source_category = 'Import CSV';

-- Solo spedizioni create via OCR
SELECT * FROM anne_all_shipments_view
WHERE source_category = 'OCR (PDF/Screenshot)';

-- Solo spedizioni da e-commerce
SELECT * FROM anne_all_shipments_view
WHERE source_category LIKE 'E-commerce%';

-- Solo spedizioni create manualmente
SELECT * FROM anne_all_shipments_view
WHERE source_category = 'Creata Manualmente';
```

### Statistiche per Data

```sql
-- Spedizioni create oggi per sorgente
SELECT 
  source_category,
  COUNT(*) as total,
  SUM(final_price) as revenue
FROM anne_all_shipments_view
WHERE created_at >= CURRENT_DATE
GROUP BY source_category
ORDER BY total DESC;
```

### Spedizioni Non Verificate

```sql
-- Spedizioni importate da verificare
SELECT 
  tracking_number,
  recipient_name,
  source_category,
  created_at
FROM anne_all_shipments_view
WHERE verified = false
  AND imported = true
ORDER BY created_at DESC;
```

### Spedizioni con Errori OCR

```sql
-- Spedizioni OCR con bassa confidenza (< 0.80)
SELECT 
  tracking_number,
  recipient_name,
  ocr_confidence_score,
  created_at
FROM anne_all_shipments_view
WHERE created_via_ocr = true
  AND ocr_confidence_score < 0.80
ORDER BY ocr_confidence_score ASC;
```

---

## 🔍 Query Avanzate per Anne

### Top 10 Clienti per Volume

```sql
SELECT 
  owner_email,
  owner_name,
  COUNT(*) as total_shipments,
  SUM(final_price) as total_revenue,
  COUNT(*) FILTER (WHERE imported = true) as imported_shipments,
  COUNT(*) FILTER (WHERE created_via_ocr = true) as ocr_shipments
FROM anne_all_shipments_view
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY owner_email, owner_name
ORDER BY total_shipments DESC
LIMIT 10;
```

### Analisi per Corriere e Sorgente

```sql
SELECT 
  courier_display_name,
  source_category,
  COUNT(*) as shipments,
  AVG(final_price) as avg_price,
  SUM(final_price) as total_revenue
FROM anne_all_shipments_view
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY courier_display_name, source_category
ORDER BY shipments DESC;
```

### Spedizioni Importate per Piattaforma

```sql
SELECT 
  COALESCE(import_platform, ecommerce_platform, 'N/A') as platform,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE verified = true) as verified,
  COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
  AVG(ocr_confidence_score) as avg_ocr_score
FROM anne_all_shipments_view
WHERE imported = true OR ecommerce_platform IS NOT NULL
GROUP BY platform
ORDER BY total DESC;
```

### Timeline Creazione Spedizioni

```sql
SELECT 
  DATE(created_at) as date,
  source_category,
  COUNT(*) as shipments
FROM anne_all_shipments_view
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), source_category
ORDER BY date DESC, shipments DESC;
```

---

## 🛠️ Manutenzione e Troubleshooting

### Verifica Configurazione

```sql
-- Test: Conta spedizioni totali
SELECT COUNT(*) as total FROM shipments WHERE deleted = false;

-- Test: Conta record nella view Anne
SELECT COUNT(*) as total FROM anne_all_shipments_view;

-- Test: Verifica policy RLS
SELECT * FROM pg_policies 
WHERE tablename = 'shipments' 
  AND policyname LIKE '%anne%';

-- Test: Verifica indici
SELECT indexname FROM pg_indexes 
WHERE tablename = 'shipments' 
  AND indexname LIKE '%anne%';
```

### Rigenera Statistiche

```sql
-- Rigenera statistiche per Anne
SELECT * FROM anne_get_shipments_stats();
```

### Ricrea Indici (se lenti)

```sql
-- Ricrea indice full-text
DROP INDEX IF EXISTS idx_shipments_anne_fulltext;
CREATE INDEX idx_shipments_anne_fulltext 
ON shipments USING GIN(
  to_tsvector('italian', 
    COALESCE(tracking_number, '') || ' ' ||
    COALESCE(recipient_name, '') || ' ' ||
    COALESCE(recipient_city, '') || ' ' ||
    COALESCE(recipient_address, '') || ' ' ||
    COALESCE(sender_name, '')
  )
);

-- Analizza tabella per ottimizzare query planner
ANALYZE shipments;
```

---

## 🎯 Integrazione con Anne AI (TypeScript)

### Esempio: Query da Anne AI

```typescript
// File: lib/ai/tools/shipments.ts
import { supabaseAdmin } from '@/lib/db/client';

export async function getAllShipmentsForAnne(userId: string, userRole: string) {
  // Anne in modalità superadmin può leggere TUTTE le spedizioni
  const isSuperadmin = userRole === 'admin' || userRole === 'superadmin';
  
  const { data, error } = await supabaseAdmin
    .from('anne_all_shipments_view')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) {
    console.error('Errore lettura spedizioni per Anne:', error);
    return [];
  }
  
  return data;
}

export async function getShipmentStats() {
  const { data, error } = await supabaseAdmin
    .rpc('anne_get_shipments_stats');
  
  if (error) {
    console.error('Errore statistiche Anne:', error);
    return null;
  }
  
  return data[0];
}

export async function searchShipments(searchTerm: string, limit = 50) {
  const { data, error } = await supabaseAdmin
    .rpc('anne_search_shipments', {
      p_search_term: searchTerm,
      p_limit: limit
    });
  
  if (error) {
    console.error('Errore ricerca Anne:', error);
    return [];
  }
  
  return data;
}
```

---

## 📊 Dashboard Anne: KPI Principali

```sql
-- KPI Dashboard per Anne
WITH stats AS (
  SELECT * FROM anne_get_shipments_stats()
)
SELECT 
  'Spedizioni Totali' as metric, 
  total_shipments::TEXT as value 
FROM stats
UNION ALL
SELECT 
  'Tasso Importazione', 
  ROUND((csv_imported + excel_imported + pdf_imported)::NUMERIC / NULLIF(total_shipments, 0) * 100, 2)::TEXT || '%'
FROM stats
UNION ALL
SELECT 
  'Tasso OCR', 
  ROUND(ocr_created::NUMERIC / NULLIF(total_shipments, 0) * 100, 2)::TEXT || '%'
FROM stats
UNION ALL
SELECT 
  'Tasso Verifica', 
  ROUND(verified_count::NUMERIC / NULLIF(total_shipments, 0) * 100, 2)::TEXT || '%'
FROM stats;
```

---

## ⚡ Performance Tips

1. **Usa LIMIT** nelle query per evitare timeout:
   ```sql
   SELECT * FROM anne_all_shipments_view LIMIT 1000;
   ```

2. **Filtra per data** per query veloci:
   ```sql
   WHERE created_at >= NOW() - INTERVAL '30 days'
   ```

3. **Usa gli indici** ottimizzati:
   ```sql
   WHERE deleted = false  -- Usa idx_shipments_deleted
   WHERE imported = true  -- Usa idx_shipments_imported
   WHERE source_category = 'Import CSV'  -- Usa idx_shipments_import_source
   ```

4. **Ricerca full-text** per query rapide:
   ```sql
   SELECT * FROM anne_search_shipments('Milano');  -- Più veloce di LIKE
   ```

---

## ✅ Checklist Post-Installazione

- [ ] Script eseguito senza errori
- [ ] Output mostra: `✅ TUTTO OK! Anne può accedere a tutte le X spedizioni`
- [ ] View `anne_all_shipments_view` creata
- [ ] Funzioni `anne_get_shipments_stats()` e `anne_search_shipments()` funzionanti
- [ ] Policy RLS `anne_superadmin_read_all_shipments` attiva
- [ ] Indici ottimizzati creati
- [ ] Test query eseguiti con successo

---

## 🆘 Supporto

Se hai problemi:

1. **Verifica log Supabase**: Dashboard → Logs
2. **Controlla policy RLS**: Potrebbero bloccare l'accesso
3. **Testa connessione**: `SELECT * FROM anne_all_shipments_view LIMIT 1;`
4. **Rigenera indici**: Se le query sono lente

---

## 📝 Note Tecniche

- **Compatibilità**: PostgreSQL 13+, Supabase
- **Lingua ricerca**: Italiano (configurabile)
- **Soft delete**: Le spedizioni eliminate (`deleted = true`) sono escluse dalla view
- **Performance**: Ottimizzato per database con fino a 1M spedizioni
- **RLS**: Policy compatible con autenticazione Supabase + NextAuth

---

## 🎉 Conclusione

Dopo aver eseguito questo script, **Anne AI in modalità superadmin** avrà:

✅ Accesso **completo** a TUTTE le spedizioni  
✅ View **ottimizzata** per lettura rapida  
✅ Funzioni **helper** per statistiche e ricerca  
✅ Indici **performanti** per query veloci  
✅ Policy RLS **sicure** per multi-tenancy  

**Anne è pronta per analizzare, gestire e migliorare il tuo sistema di spedizioni! 🚀**
