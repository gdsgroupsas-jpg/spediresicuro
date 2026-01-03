-- ============================================
-- FIX: Crea tabella price_list_entries se mancante
-- Eseguire in Supabase SQL Editor
-- ============================================

-- Verifica e crea il tipo enum courier_service_type se non esiste
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'courier_service_type') THEN
    CREATE TYPE courier_service_type AS ENUM ('standard', 'express', 'economy', 'same_day', 'next_day');
  END IF;
END
$$;

-- Crea tabella price_list_entries
CREATE TABLE IF NOT EXISTS price_list_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_list_id UUID REFERENCES price_lists(id) ON DELETE CASCADE,

  -- Fasce peso (kg)
  weight_from DECIMAL(10,3) NOT NULL,
  weight_to DECIMAL(10,3) NOT NULL,

  -- Zone geografiche
  zone_code TEXT, -- es. "Z1", "Z2", "ISOLE", "NORD", "SUD"
  zip_code_from TEXT, -- CAP da (opzionale)
  zip_code_to TEXT, -- CAP a (opzionale)
  province_code TEXT, -- Sigla provincia (opzionale)
  region TEXT, -- Nome regione (opzionale)

  -- Tipo servizio
  service_type courier_service_type DEFAULT 'standard',

  -- Prezzi
  base_price DECIMAL(10,2) NOT NULL,

  -- Supplementi
  fuel_surcharge_percent DECIMAL(5,2) DEFAULT 0, -- Contributo carburante %
  island_surcharge DECIMAL(10,2) DEFAULT 0, -- Supplemento isole
  ztl_surcharge DECIMAL(10,2) DEFAULT 0, -- Supplemento ZTL
  cash_on_delivery_surcharge DECIMAL(10,2) DEFAULT 0, -- Supplemento contrassegno
  insurance_rate_percent DECIMAL(5,2) DEFAULT 0, -- Tasso assicurazione %

  -- SLA
  estimated_delivery_days_min INTEGER, -- Giorni minimi consegna
  estimated_delivery_days_max INTEGER, -- Giorni massimi consegna

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_price_entries_list ON price_list_entries(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_entries_weight ON price_list_entries(weight_from, weight_to);
CREATE INDEX IF NOT EXISTS idx_price_entries_zone ON price_list_entries(zone_code);
CREATE INDEX IF NOT EXISTS idx_price_entries_zip ON price_list_entries(zip_code_from, zip_code_to);
CREATE INDEX IF NOT EXISTS idx_price_entries_service ON price_list_entries(service_type);

-- RLS (Row Level Security)
ALTER TABLE price_list_entries ENABLE ROW LEVEL SECURITY;

-- Policy: lettura pubblica (i listini sono informazione pubblica per il pricing)
DROP POLICY IF EXISTS "price_list_entries_select_all" ON price_list_entries;
CREATE POLICY "price_list_entries_select_all" ON price_list_entries
  FOR SELECT USING (true);

-- Policy: insert/update/delete solo per owner del listino o admin
DROP POLICY IF EXISTS "price_list_entries_insert_owner" ON price_list_entries;
CREATE POLICY "price_list_entries_insert_owner" ON price_list_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM price_lists pl
      WHERE pl.id = price_list_id
        AND (
          pl.created_by = auth.uid()
          OR pl.assigned_to_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.user_id = auth.uid()
              AND up.account_type IN ('admin', 'superadmin')
          )
        )
    )
  );

DROP POLICY IF EXISTS "price_list_entries_update_owner" ON price_list_entries;
CREATE POLICY "price_list_entries_update_owner" ON price_list_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM price_lists pl
      WHERE pl.id = price_list_id
        AND (
          pl.created_by = auth.uid()
          OR pl.assigned_to_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.user_id = auth.uid()
              AND up.account_type IN ('admin', 'superadmin')
          )
        )
    )
  );

DROP POLICY IF EXISTS "price_list_entries_delete_owner" ON price_list_entries;
CREATE POLICY "price_list_entries_delete_owner" ON price_list_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM price_lists pl
      WHERE pl.id = price_list_id
        AND (
          pl.created_by = auth.uid()
          OR pl.assigned_to_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.user_id = auth.uid()
              AND up.account_type IN ('admin', 'superadmin')
          )
        )
    )
  );

-- Verifica
SELECT 
  'price_list_entries' as table_name,
  COUNT(*) as row_count
FROM price_list_entries;
