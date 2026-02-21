-- Add courier_config_id to shipments for direct provider/config tracking
-- Enables GROUP BY courier_config_id for per-provider financial dashboards
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS courier_config_id uuid REFERENCES courier_configs(id);

-- Index for dashboard aggregation queries
CREATE INDEX IF NOT EXISTS idx_shipments_courier_config_id
  ON shipments(courier_config_id)
  WHERE courier_config_id IS NOT NULL;

COMMENT ON COLUMN shipments.courier_config_id IS
  'FK to courier_configs: which API configuration was used to create this shipment. NULL for legacy shipments.';
