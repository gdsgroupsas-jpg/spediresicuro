-- Add dimension columns to price_list_entries
-- Allows entries to specify max package dimensions (e.g., InPost S/M/L sizes)
-- so that a single price list per courier can contain entries for all size variants.

ALTER TABLE price_list_entries
  ADD COLUMN IF NOT EXISTS max_length numeric,
  ADD COLUMN IF NOT EXISTS max_width numeric,
  ADD COLUMN IF NOT EXISTS max_height numeric,
  ADD COLUMN IF NOT EXISTS size_label text;

-- size_label is a human-readable label like "S", "M", "L" for display purposes

COMMENT ON COLUMN price_list_entries.max_length IS 'Max package length in cm';
COMMENT ON COLUMN price_list_entries.max_width IS 'Max package width in cm';
COMMENT ON COLUMN price_list_entries.max_height IS 'Max package height in cm';
COMMENT ON COLUMN price_list_entries.size_label IS 'Human-readable size label (e.g. S, M, L)';
