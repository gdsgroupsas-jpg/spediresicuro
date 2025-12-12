-- ============================================
-- MIGRATION: 020_geo_locations_table.sql
-- ============================================
-- 
-- Crea la tabella geo_locations per il sistema di autocompletamento
-- comuni italiani con supporto full-text search
--
-- Versione: FIXED (usa trigger invece di GENERATED ALWAYS AS)
-- Data: 2025-01-XX
-- ============================================

-- Estensione per full-text search e trigram (se non già presente)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabella geo_locations
CREATE TABLE IF NOT EXISTS geo_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dati geografici
  name TEXT NOT NULL,                    -- Nome comune (es. "Roma", "Milano")
  province TEXT NOT NULL,                 -- Codice provincia 2 lettere (es. "RM", "MI")
  region TEXT,                            -- Nome regione (es. "Lazio", "Lombardia")
  
  -- CAP multipli (array)
  caps TEXT[] NOT NULL DEFAULT '{}',     -- Array di CAP (es. ["00100", "00118", ...])
  
  -- Full-text search vector (colonna regolare, aggiornata via trigger)
  search_vector tsvector,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- UNIQUE CONSTRAINT: Evita duplicati per nome e provincia
  UNIQUE(name, province)
);

-- Indici per performance ottimale
-- GIN index su search_vector per full-text search ultra-veloce
CREATE INDEX IF NOT EXISTS idx_geo_locations_search_vector 
  ON geo_locations USING GIN (search_vector);

-- Indice B-tree su name per ricerche esatte
CREATE INDEX IF NOT EXISTS idx_geo_locations_name 
  ON geo_locations USING BTREE (name);

-- Indice B-tree su province per filtri rapidi
CREATE INDEX IF NOT EXISTS idx_geo_locations_province 
  ON geo_locations USING BTREE (province);

-- Indice GIN su caps array per ricerca CAP
CREATE INDEX IF NOT EXISTS idx_geo_locations_caps 
  ON geo_locations USING GIN (caps);

-- Indice trigram su name per ricerca fuzzy (opzionale, per typo-tolerance)
CREATE INDEX IF NOT EXISTS idx_geo_locations_name_trgm 
  ON geo_locations USING GIN (name gin_trgm_ops);

-- Funzione per aggiornare search_vector e updated_at
CREATE OR REPLACE FUNCTION update_geo_locations_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('italian', 
    COALESCE(NEW.name, '') || ' ' || 
    COALESCE(NEW.province, '') || ' ' || 
    COALESCE(NEW.region, '') || ' ' || 
    array_to_string(NEW.caps, ' ')
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per INSERT
DROP TRIGGER IF EXISTS trigger_insert_geo_locations ON geo_locations;
CREATE TRIGGER trigger_insert_geo_locations
  BEFORE INSERT ON geo_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_locations_search_vector();

-- Trigger per UPDATE
DROP TRIGGER IF EXISTS trigger_update_geo_locations ON geo_locations;
CREATE TRIGGER trigger_update_geo_locations
  BEFORE UPDATE ON geo_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_locations_search_vector();

-- Commenti per documentazione
COMMENT ON TABLE geo_locations IS 'Tabella comuni italiani con supporto full-text search per autocompletamento';
COMMENT ON COLUMN geo_locations.search_vector IS 'Vettore full-text aggiornato automaticamente via trigger per ricerca veloce';
COMMENT ON COLUMN geo_locations.caps IS 'Array di CAP validi per il comune (alcuni comuni hanno più CAP)';
COMMENT ON INDEX idx_geo_locations_search_vector IS 'Indice GIN per full-text search ultra-veloce - Performance <50ms';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Abilita RLS sulla tabella
ALTER TABLE geo_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Permetti lettura pubblica (tutti possono cercare comuni)
-- Questa policy permette a chiunque di leggere i dati per l'autocompletamento
DROP POLICY IF EXISTS "geo_locations_select_public" ON geo_locations;
CREATE POLICY "geo_locations_select_public" 
  ON geo_locations
  FOR SELECT
  USING (true); -- Tutti possono leggere

-- Nota: INSERT/UPDATE/DELETE vengono gestiti solo via script con service_role_key
-- quindi non serve creare policy per queste operazioni (vengono bypassate con service role)
