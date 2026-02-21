-- ============================================================
-- Migration: WMS MVP
-- Magazzino, Prodotti, Inventory, Movimenti, Ordini Fornitore
--
-- Modello dati ispirato al gestionale "PER TE" del pilot:
-- - Anagrafica prodotti con EAN, sconti cascata, RAEE
-- - Fornitori con condizioni commerciali
-- - Magazzini (depositi) con giacenze
-- - Movimenti stock (inbound/outbound/adjustment)
-- - Ordini fornitore (testata + righe)
--
-- Multi-tenant: tutto isolato per workspace_id
-- ============================================================

-- ─── 1. SUPPLIERS (Fornitori) ───

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  code TEXT,
  name TEXT NOT NULL,
  company_name TEXT,
  vat_number TEXT,

  email TEXT,
  phone TEXT,
  website TEXT,

  address TEXT,
  city TEXT,
  zip TEXT,
  province TEXT,
  country TEXT DEFAULT 'IT',

  payment_terms TEXT,
  min_order_quantity INTEGER,
  min_order_value NUMERIC(12,2),

  ships_from_city TEXT,
  ships_from_zip TEXT,
  average_processing_days INTEGER,

  notes TEXT,

  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_members_read_suppliers" ON suppliers
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "ws_owner_manage_suppliers" ON suppliers
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_suppliers_workspace ON suppliers(workspace_id);
CREATE INDEX idx_suppliers_code ON suppliers(workspace_id, code) WHERE code IS NOT NULL;

-- ─── 2. PRODUCTS (Prodotti) ───

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,

  category TEXT,
  subcategory TEXT,
  tags TEXT[],

  type TEXT NOT NULL DEFAULT 'physical' CHECK (type IN ('physical', 'digital', 'service', 'dropshipping')),

  -- Dimensioni (per calcolo spedizione)
  weight NUMERIC(10,3),
  length NUMERIC(10,2),
  width NUMERIC(10,2),
  height NUMERIC(10,2),

  -- Prezzi base
  cost_price NUMERIC(12,2),
  sale_price NUMERIC(12,2),
  suggested_retail_price NUMERIC(12,2),

  -- Contributi obbligatori (es. RAEE per elettrodomestici)
  raee_amount NUMERIC(8,2) DEFAULT 0,
  eco_contribution NUMERIC(8,2) DEFAULT 0,

  image_url TEXT,

  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_product_sku_workspace UNIQUE (workspace_id, sku)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_members_read_products" ON products
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "ws_owner_manage_products" ON products
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_products_workspace ON products(workspace_id);
CREATE INDEX idx_products_sku ON products(workspace_id, sku);
CREATE INDEX idx_products_barcode ON products(workspace_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_category ON products(workspace_id, category) WHERE category IS NOT NULL;

-- ─── 3. PRODUCT_SUPPLIERS (Prodotto-Fornitore con sconti cascata) ───

CREATE TABLE product_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,

  supplier_sku TEXT,
  list_price NUMERIC(12,2) NOT NULL,

  -- Sconti a cascata (come "PER TE": 20, 5, 13, 15 -> prezzo * 0.80 * 0.95 * 0.87 * 0.85)
  discount_1 NUMERIC(5,2) DEFAULT 0,
  discount_2 NUMERIC(5,2) DEFAULT 0,
  discount_3 NUMERIC(5,2) DEFAULT 0,
  discount_4 NUMERIC(5,2) DEFAULT 0,
  discount_5 NUMERIC(5,2) DEFAULT 0,

  -- Costo netto calcolato (prezzo * prodotto sconti + contributi)
  net_cost NUMERIC(12,2),

  min_order_quantity INTEGER DEFAULT 1,
  lead_time_days INTEGER,
  priority INTEGER DEFAULT 1,

  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_product_supplier UNIQUE (product_id, supplier_id)
);

ALTER TABLE product_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_members_read_product_suppliers" ON product_suppliers
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "ws_owner_manage_product_suppliers" ON product_suppliers
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

CREATE TRIGGER update_product_suppliers_updated_at
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Funzione calcolo costo netto con sconti a cascata
-- Formula: list_price * (1 - sc1/100) * (1 - sc2/100) * ... + raee + eco
CREATE OR REPLACE FUNCTION calculate_net_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_raee NUMERIC(8,2);
  v_eco NUMERIC(8,2);
BEGIN
  -- Recupera contributi dal prodotto
  SELECT COALESCE(raee_amount, 0), COALESCE(eco_contribution, 0)
  INTO v_raee, v_eco
  FROM products WHERE id = NEW.product_id;

  NEW.net_cost := NEW.list_price
    * (1 - COALESCE(NEW.discount_1, 0) / 100.0)
    * (1 - COALESCE(NEW.discount_2, 0) / 100.0)
    * (1 - COALESCE(NEW.discount_3, 0) / 100.0)
    * (1 - COALESCE(NEW.discount_4, 0) / 100.0)
    * (1 - COALESCE(NEW.discount_5, 0) / 100.0)
    + v_raee + v_eco;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calc_net_cost_on_insert
  BEFORE INSERT ON product_suppliers
  FOR EACH ROW EXECUTE FUNCTION calculate_net_cost();

CREATE TRIGGER calc_net_cost_on_update
  BEFORE UPDATE ON product_suppliers
  FOR EACH ROW EXECUTE FUNCTION calculate_net_cost();

-- ─── 4. WAREHOUSES (Magazzini / Depositi) ───

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'standard' CHECK (type IN ('standard', 'transit', 'returns', 'dropship')),

  address TEXT,
  city TEXT,
  zip TEXT,
  province TEXT,
  country TEXT DEFAULT 'IT',

  manager_name TEXT,
  phone TEXT,
  email TEXT,

  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_warehouse_code_workspace UNIQUE (workspace_id, code)
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_members_read_warehouses" ON warehouses
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "ws_owner_manage_warehouses" ON warehouses
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

CREATE TRIGGER update_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_warehouses_workspace ON warehouses(workspace_id);

-- ─── 5. INVENTORY (Giacenze) ───

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,

  quantity_available INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  quantity_on_order INTEGER NOT NULL DEFAULT 0,

  reorder_point INTEGER DEFAULT 0,
  reorder_quantity INTEGER DEFAULT 0,

  last_stock_take_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_inventory_product_warehouse UNIQUE (product_id, warehouse_id),
  CONSTRAINT chk_quantity_available CHECK (quantity_available >= 0),
  CONSTRAINT chk_quantity_reserved CHECK (quantity_reserved >= 0)
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_members_read_inventory" ON inventory
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "ws_owner_manage_inventory" ON inventory
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_inventory_workspace ON inventory(workspace_id);
CREATE INDEX idx_inventory_product ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse ON inventory(warehouse_id);
CREATE INDEX idx_inventory_low_stock ON inventory(workspace_id, quantity_available)
  WHERE quantity_available <= reorder_point AND reorder_point > 0;

-- ─── 6. WAREHOUSE_MOVEMENTS (Movimenti magazzino) ───

CREATE TABLE warehouse_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('inbound', 'outbound', 'transfer', 'adjustment', 'reservation', 'release')),
  quantity INTEGER NOT NULL,

  to_warehouse_id UUID REFERENCES warehouses(id),

  -- Riferimento a ordine fornitore o spedizione
  reference_type TEXT,
  reference_id UUID,

  notes TEXT,
  created_by UUID REFERENCES users(id),

  movement_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE warehouse_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_members_read_movements" ON warehouse_movements
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "ws_owner_manage_movements" ON warehouse_movements
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

CREATE INDEX idx_movements_workspace ON warehouse_movements(workspace_id);
CREATE INDEX idx_movements_product ON warehouse_movements(product_id);
CREATE INDEX idx_movements_warehouse ON warehouse_movements(warehouse_id);
CREATE INDEX idx_movements_date ON warehouse_movements(workspace_id, movement_date DESC);
CREATE INDEX idx_movements_reference ON warehouse_movements(reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ─── 7. PURCHASE_ORDERS (Ordini Fornitore) ───

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),

  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'shipped', 'partial', 'received', 'cancelled')),

  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_delivery_date TIMESTAMPTZ,
  received_date TIMESTAMPTZ,

  -- Riferimenti dal gestionale esterno
  external_reference TEXT,
  circular_reference TEXT,

  notes TEXT,
  internal_notes TEXT,

  -- Totali (calcolati)
  subtotal NUMERIC(12,2) DEFAULT 0,
  total_raee NUMERIC(10,2) DEFAULT 0,
  total_discount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,

  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_po_number_workspace UNIQUE (workspace_id, order_number)
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_members_read_purchase_orders" ON purchase_orders
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "ws_owner_manage_purchase_orders" ON purchase_orders
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_po_workspace ON purchase_orders(workspace_id);
CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_status ON purchase_orders(workspace_id, status);
CREATE INDEX idx_po_date ON purchase_orders(workspace_id, order_date DESC);

-- ─── 8. PURCHASE_ORDER_ITEMS (Righe ordine fornitore) ───

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),

  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),

  list_price NUMERIC(12,2) NOT NULL,

  -- Sconti a cascata (copiati da product_suppliers al momento dell'ordine)
  discount_1 NUMERIC(5,2) DEFAULT 0,
  discount_2 NUMERIC(5,2) DEFAULT 0,
  discount_3 NUMERIC(5,2) DEFAULT 0,
  discount_4 NUMERIC(5,2) DEFAULT 0,
  discount_5 NUMERIC(5,2) DEFAULT 0,

  -- Contributi
  raee_amount NUMERIC(8,2) DEFAULT 0,

  -- Costo unitario netto (calcolato)
  unit_net_cost NUMERIC(12,2),
  -- Totale riga (unit_net_cost * quantity_ordered)
  line_total NUMERIC(12,2),

  warehouse_id UUID REFERENCES warehouses(id),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_members_read_po_items" ON purchase_order_items
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY "ws_owner_manage_po_items" ON purchase_order_items
  FOR ALL TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
  ));

-- Trigger calcolo costo netto riga ordine
CREATE OR REPLACE FUNCTION calculate_po_item_cost()
RETURNS TRIGGER AS $$
BEGIN
  NEW.unit_net_cost := NEW.list_price
    * (1 - COALESCE(NEW.discount_1, 0) / 100.0)
    * (1 - COALESCE(NEW.discount_2, 0) / 100.0)
    * (1 - COALESCE(NEW.discount_3, 0) / 100.0)
    * (1 - COALESCE(NEW.discount_4, 0) / 100.0)
    * (1 - COALESCE(NEW.discount_5, 0) / 100.0)
    + COALESCE(NEW.raee_amount, 0);

  NEW.line_total := NEW.unit_net_cost * NEW.quantity_ordered;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calc_po_item_cost_insert
  BEFORE INSERT ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION calculate_po_item_cost();

CREATE TRIGGER calc_po_item_cost_update
  BEFORE UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION calculate_po_item_cost();

-- Trigger aggiorna totali ordine quando cambiano le righe
CREATE OR REPLACE FUNCTION update_purchase_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_order_id UUID;
BEGIN
  v_order_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);

  UPDATE purchase_orders SET
    subtotal = (SELECT COALESCE(SUM(line_total), 0) FROM purchase_order_items WHERE purchase_order_id = v_order_id),
    total_raee = (SELECT COALESCE(SUM(raee_amount * quantity_ordered), 0) FROM purchase_order_items WHERE purchase_order_id = v_order_id),
    total = (SELECT COALESCE(SUM(line_total), 0) FROM purchase_order_items WHERE purchase_order_id = v_order_id)
  WHERE id = v_order_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_po_totals_insert
  AFTER INSERT ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_purchase_order_totals();

CREATE TRIGGER update_po_totals_update
  AFTER UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_purchase_order_totals();

CREATE TRIGGER update_po_totals_delete
  AFTER DELETE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION update_purchase_order_totals();

CREATE INDEX idx_po_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_product ON purchase_order_items(product_id);

-- ─── 9. FUNZIONE ATOMICA: Aggiornamento stock ───
-- Evita race condition read-then-write: upsert + increment atomico
-- Ritorna la nuova quantity_available; -1 se stock insufficiente

CREATE OR REPLACE FUNCTION wms_update_stock(
  p_workspace_id UUID,
  p_product_id UUID,
  p_warehouse_id UUID,
  p_delta INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_new_qty INTEGER;
BEGIN
  -- Upsert: crea record inventory se non esiste
  INSERT INTO inventory (workspace_id, product_id, warehouse_id, quantity_available, quantity_reserved, quantity_on_order)
  VALUES (p_workspace_id, p_product_id, p_warehouse_id, 0, 0, 0)
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  -- Update atomico con lock implicito sulla riga
  UPDATE inventory
  SET quantity_available = quantity_available + p_delta,
      updated_at = NOW()
  WHERE workspace_id = p_workspace_id
    AND product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND quantity_available + p_delta >= 0
  RETURNING quantity_available INTO v_new_qty;

  -- Se nessuna riga aggiornata, stock insufficiente
  IF v_new_qty IS NULL THEN
    RETURN -1;
  END IF;

  RETURN v_new_qty;
END;
$$ LANGUAGE plpgsql;

-- ─── GRANT SERVICE ROLE ───

GRANT ALL ON suppliers TO service_role;
GRANT ALL ON products TO service_role;
GRANT ALL ON product_suppliers TO service_role;
GRANT ALL ON warehouses TO service_role;
GRANT ALL ON inventory TO service_role;
GRANT ALL ON warehouse_movements TO service_role;
GRANT ALL ON purchase_orders TO service_role;
GRANT ALL ON purchase_order_items TO service_role;
