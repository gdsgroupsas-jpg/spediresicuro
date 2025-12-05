-- ============================================
-- QUERY DI VERIFICA MIGRATION COMPLETATE
-- ============================================
-- Esegui queste query in Supabase SQL Editor per verificare
-- che tutte le migration siano state applicate correttamente
-- ============================================

-- ============================================
-- VERIFICA 1: Campi Resi (Migration 010)
-- ============================================
SELECT 
  'VERIFICA CAMPI RESI' as verifica,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'shipments' 
AND column_name IN ('is_return', 'original_shipment_id', 'return_reason', 'return_status')
ORDER BY column_name;

-- Dovresti vedere 4 righe con i campi resi

-- ============================================
-- VERIFICA 2: Realtime Abilitato (Migration 012)
-- ============================================
SELECT 
  'VERIFICA REALTIME' as verifica,
  pubname as publication_name,
  tablename as table_name
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'shipments';

-- Dovresti vedere 1 riga con shipments nella publication

-- ============================================
-- VERIFICA 3: Killer Feature Scanner (Migration 011)
-- ============================================
SELECT 
  'VERIFICA KILLER FEATURE' as verifica,
  code,
  name,
  description,
  category,
  is_free,
  is_available,
  price_monthly_cents,
  price_yearly_cents,
  display_order
FROM killer_features
WHERE code = 'ldv_scanner_import';

-- Dovresti vedere 1 riga con:
-- - code: 'ldv_scanner_import'
-- - is_free: false (a pagamento)
-- - is_available: true

-- ============================================
-- VERIFICA 4: Indici Campi Resi (Performance)
-- ============================================
SELECT 
  'VERIFICA INDICI RESI' as verifica,
  indexname,
  tablename
FROM pg_indexes
WHERE tablename = 'shipments'
AND indexname LIKE '%return%'
ORDER BY indexname;

-- Dovresti vedere almeno 2-3 indici per i campi resi

-- ============================================
-- VERIFICA 5: RLS Abilitato
-- ============================================
SELECT 
  'VERIFICA RLS' as verifica,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'shipments';

-- Dovresti vedere rowsecurity = true

-- ============================================
-- RISULTATO
-- ============================================
-- Se tutte le verifiche mostrano i risultati attesi,
-- le migration sono state applicate correttamente! ✅


