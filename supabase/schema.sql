-- Create geo_locations table for Italian cities autocomplete
CREATE TABLE IF NOT EXISTS public.geo_locations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  province TEXT NOT NULL,
  caps TEXT[] NOT NULL,
  region TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('italian', name) || to_tsvector('italian', province)
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.geo_locations ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "geo_locations_select_public"
  ON public.geo_locations
  FOR SELECT
  USING (true);

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS geo_locations_search_idx 
  ON public.geo_locations 
  USING GIN (search_vector);

-- Create index on name and province for faster lookups
CREATE INDEX IF NOT EXISTS geo_locations_name_idx 
  ON public.geo_locations 
  USING GIN (caps);

CREATE INDEX IF NOT EXISTS geo_locations_province_idx 
  ON public.geo_locations (province);
