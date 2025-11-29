-- ============================================
-- MIGLIORAMENTI TABELLA geo_locations
-- SpedireSicuro.it - Ottimizzazioni Performance
-- ============================================
-- 
-- Questo script aggiunge indici e trigger per ottimizzare le performance
-- Eseguire DOPO che la tabella base è stata creata
--

-- Estensione per ricerca fuzzy (se non già presente)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- INDICI PER PERFORMANCE
-- ============================================

-- 1. GIN index su search_vector per full-text search ultra-veloce
-- Questo è il più importante per le ricerche!
CREATE INDEX IF NOT EXISTS idx_geo_locations_search_vector 
  ON geo_locations USING GIN (search_vector);

-- 2. B-tree index su name per ricerche esatte
CREATE INDEX IF NOT EXISTS idx_geo_locations_name 
  ON geo_locations USING BTREE (name);

-- 3. B-tree index su province per filtri rapidi
CREATE INDEX IF NOT EXISTS idx_geo_locations_province 
  ON geo_locations USING BTREE (province);

-- 4. GIN index su caps array per ricerca CAP
CREATE INDEX IF NOT EXISTS idx_geo_locations_caps 
  ON geo_locations USING GIN (caps);

-- 5. GIN index trigram su name per ricerca fuzzy (typo-tolerance)
-- Permette di trovare "Roma" anche cercando "Rmoa" (con piccoli errori)
CREATE INDEX IF NOT EXISTS idx_geo_locations_name_trgm 
  ON geo_locations USING GIN (name gin_trgm_ops);

-- ============================================
-- TRIGGER PER updated_at
-- ============================================

-- Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_geo_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare updated_at su ogni UPDATE
DROP TRIGGER IF EXISTS trigger_update_geo_locations_updated_at ON geo_locations;
CREATE TRIGGER trigger_update_geo_locations_updated_at
  BEFORE UPDATE ON geo_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_locations_updated_at();

-- ============================================
-- COMMENTI PER DOCUMENTAZIONE
-- ============================================

COMMENT ON INDEX idx_geo_locations_search_vector IS 'Indice GIN per full-text search veloce (<50ms)';
COMMENT ON INDEX idx_geo_locations_name IS 'Indice B-tree per ricerche esatte su nome comune';
COMMENT ON INDEX idx_geo_locations_province IS 'Indice B-tree per filtri rapidi su provincia';
COMMENT ON INDEX idx_geo_locations_caps IS 'Indice GIN per ricerca su array CAP';
COMMENT ON INDEX idx_geo_locations_name_trgm IS 'Indice trigram per ricerca fuzzy (tolleranza errori di battitura)';

-- ============================================
-- VERIFICA
-- ============================================

-- Query di test per verificare che tutto funzioni:
-- SELECT name, province, caps 
-- FROM geo_locations 
-- WHERE search_vector @@ to_tsquery('italian', 'Roma | 00100')
-- LIMIT 20;

-- Verifica indici creati:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'geo_locations';

