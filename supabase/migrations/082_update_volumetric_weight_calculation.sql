-- ============================================
-- MIGRATION: 082_update_volumetric_weight_calculation.sql
-- DESCRIZIONE: Aggiorna calculate_volumetric_weight per usare fattore densità configurabile
-- DATA: 2026-01-XX
-- ============================================
--
-- PROBLEMA:
-- La funzione calculate_volumetric_weight usa 5000 hardcoded.
-- Deve usare il fattore volumetric_density_factor dal listino fornitore/cliente.
--
-- SOLUZIONE:
-- Crea nuova funzione calculate_volumetric_weight_with_factor che accetta fattore densità.
-- Mantiene vecchia funzione per retrocompatibilità.
-- Crea funzione helper per recuperare fattore da price_list_id.
-- ============================================

-- ============================================
-- STEP 1: Funzione helper per recuperare fattore densità da price_list_id
-- ============================================

CREATE OR REPLACE FUNCTION get_volumetric_density_factor(
  p_price_list_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  v_density_factor DECIMAL(10,2);
BEGIN
  -- Recupera fattore densità dalla configurazione listino fornitore
  SELECT volumetric_density_factor INTO v_density_factor
  FROM supplier_price_list_config
  WHERE price_list_id = p_price_list_id
  LIMIT 1;
  
  -- Se non trovato, usa default 200 kg/m³ (divisore 5000)
  IF v_density_factor IS NULL THEN
    RETURN 200.00;
  END IF;
  
  RETURN v_density_factor;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_volumetric_density_factor IS 
  'Recupera fattore densità peso/volume (kg/m³) da configurazione listino. Default: 200 kg/m³ (divisore 5000)';

-- ============================================
-- STEP 2: Nuova funzione calculate_volumetric_weight con fattore configurabile
-- ============================================

CREATE OR REPLACE FUNCTION calculate_volumetric_weight_with_factor(
  p_length DECIMAL,
  p_width DECIMAL,
  p_height DECIMAL,
  p_density_factor DECIMAL DEFAULT 200.00
)
RETURNS DECIMAL AS $$
DECLARE
  v_divisor DECIMAL;
BEGIN
  IF p_length IS NULL OR p_width IS NULL OR p_height IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Se fattore non specificato o <= 0, usa default
  IF p_density_factor IS NULL OR p_density_factor <= 0 THEN
    p_density_factor := 200.00;
  END IF;
  
  -- Calcola divisore: 1,000,000 / densità (kg/m³)
  -- Esempio: 200 kg/m³ → 1,000,000 / 200 = 5000
  v_divisor := 1000000.0 / p_density_factor;
  
  RETURN (p_length * p_width * p_height) / v_divisor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_volumetric_weight_with_factor IS 
  'Calcola peso volumetrico usando fattore densità configurabile. Formula: (L×W×H in cm) / (1,000,000 / densità_kg_per_m3). Default: 200 kg/m³ (divisore 5000)';

-- ============================================
-- STEP 3: Funzione calculate_volumetric_weight con price_list_id
-- ============================================

CREATE OR REPLACE FUNCTION calculate_volumetric_weight_from_price_list(
  p_length DECIMAL,
  p_width DECIMAL,
  p_height DECIMAL,
  p_price_list_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  v_density_factor DECIMAL(10,2);
BEGIN
  IF p_length IS NULL OR p_width IS NULL OR p_height IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Recupera fattore densità dal listino
  v_density_factor := get_volumetric_density_factor(p_price_list_id);
  
  -- Calcola usando fattore recuperato
  RETURN calculate_volumetric_weight_with_factor(
    p_length,
    p_width,
    p_height,
    v_density_factor
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_volumetric_weight_from_price_list IS 
  'Calcola peso volumetrico usando fattore densità dal listino specificato. Se listino non ha configurazione, usa default 200 kg/m³';

-- ============================================
-- STEP 4: Mantieni vecchia funzione per retrocompatibilità
-- ============================================
-- La funzione calculate_volumetric_weight esistente rimane invariata
-- per retrocompatibilità con trigger e codice esistente.
-- Usa sempre 5000 (200 kg/m³) come default.

-- ============================================
-- STEP 5: Aggiorna trigger per usare nuova funzione (opzionale, futuro)
-- ============================================
-- NOTA: Il trigger auto_calculate_volumetric_weight() attualmente usa
-- calculate_volumetric_weight() che usa 5000 hardcoded.
-- 
-- Per usare il fattore del listino nel trigger, servirebbe:
-- 1. Campo price_list_id in shipments (se non esiste già)
-- 2. Modificare trigger per chiamare calculate_volumetric_weight_from_price_list()
--
-- Per ora manteniamo retrocompatibilità. Il calcolo con fattore personalizzato
-- può essere fatto a livello applicativo quando necessario.

-- Log completamento
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 082_update_volumetric_weight_calculation completata';
  RAISE NOTICE '  - Funzione get_volumetric_density_factor() creata';
  RAISE NOTICE '  - Funzione calculate_volumetric_weight_with_factor() creata';
  RAISE NOTICE '  - Funzione calculate_volumetric_weight_from_price_list() creata';
  RAISE NOTICE '  - Vecchia funzione calculate_volumetric_weight() mantenuta per retrocompatibilità';
END $$;
