CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_geo_locations_search_vector ON geo_locations USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS idx_geo_locations_name ON geo_locations USING BTREE (name);

CREATE INDEX IF NOT EXISTS idx_geo_locations_province ON geo_locations USING BTREE (province);

CREATE INDEX IF NOT EXISTS idx_geo_locations_caps ON geo_locations USING GIN (caps);

CREATE INDEX IF NOT EXISTS idx_geo_locations_name_trgm ON geo_locations USING GIN (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION update_geo_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_geo_locations_updated_at ON geo_locations;
CREATE TRIGGER trigger_update_geo_locations_updated_at
  BEFORE UPDATE ON geo_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_geo_locations_updated_at();