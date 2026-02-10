-- ============================================================
-- Migration: WMS Cross-Workspace Guards
--
-- Problema: le FK puntano solo su id, senza verificare che
-- l'entità referenziata appartenga allo stesso workspace_id.
-- Questo permette potenziale contaminazione cross-tenant.
--
-- Soluzione: trigger BEFORE INSERT/UPDATE che verificano
-- workspace_id match su tutte le tabelle con FK cross-entità.
-- ============================================================

-- ─── 1. product_suppliers: product_id e supplier_id devono essere dello stesso workspace ───

CREATE OR REPLACE FUNCTION check_product_supplier_workspace()
RETURNS TRIGGER AS $$
BEGIN
  -- Verifica product_id appartiene allo stesso workspace
  IF NOT EXISTS (
    SELECT 1 FROM products WHERE id = NEW.product_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'product_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  -- Verifica supplier_id appartiene allo stesso workspace
  IF NOT EXISTS (
    SELECT 1 FROM suppliers WHERE id = NEW.supplier_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'supplier_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_product_supplier_workspace ON product_suppliers;
CREATE TRIGGER trg_check_product_supplier_workspace
  BEFORE INSERT OR UPDATE ON product_suppliers
  FOR EACH ROW EXECUTE FUNCTION check_product_supplier_workspace();

-- ─── 2. inventory: product_id e warehouse_id devono essere dello stesso workspace ───

CREATE OR REPLACE FUNCTION check_inventory_workspace()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM products WHERE id = NEW.product_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'product_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses WHERE id = NEW.warehouse_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'warehouse_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_inventory_workspace ON inventory;
CREATE TRIGGER trg_check_inventory_workspace
  BEFORE INSERT OR UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION check_inventory_workspace();

-- ─── 3. warehouse_movements: product_id, warehouse_id, to_warehouse_id ───

CREATE OR REPLACE FUNCTION check_movement_workspace()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM products WHERE id = NEW.product_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'product_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses WHERE id = NEW.warehouse_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'warehouse_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  -- to_warehouse_id è opzionale (solo per transfer)
  IF NEW.to_warehouse_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM warehouses WHERE id = NEW.to_warehouse_id AND workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'to_warehouse_id non appartiene al workspace (cross-tenant violation)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_movement_workspace ON warehouse_movements;
CREATE TRIGGER trg_check_movement_workspace
  BEFORE INSERT OR UPDATE ON warehouse_movements
  FOR EACH ROW EXECUTE FUNCTION check_movement_workspace();

-- ─── 4. purchase_orders: supplier_id deve essere dello stesso workspace ───

CREATE OR REPLACE FUNCTION check_purchase_order_workspace()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM suppliers WHERE id = NEW.supplier_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'supplier_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_purchase_order_workspace ON purchase_orders;
CREATE TRIGGER trg_check_purchase_order_workspace
  BEFORE INSERT OR UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION check_purchase_order_workspace();

-- ─── 5. purchase_order_items: purchase_order_id, product_id, warehouse_id ───

CREATE OR REPLACE FUNCTION check_po_item_workspace()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM purchase_orders WHERE id = NEW.purchase_order_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'purchase_order_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM products WHERE id = NEW.product_id AND workspace_id = NEW.workspace_id
  ) THEN
    RAISE EXCEPTION 'product_id non appartiene al workspace (cross-tenant violation)';
  END IF;

  -- warehouse_id è opzionale
  IF NEW.warehouse_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM warehouses WHERE id = NEW.warehouse_id AND workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'warehouse_id non appartiene al workspace (cross-tenant violation)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_po_item_workspace ON purchase_order_items;
CREATE TRIGGER trg_check_po_item_workspace
  BEFORE INSERT OR UPDATE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION check_po_item_workspace();

-- ─── 6. Aggiorna wms_update_stock per verificare workspace ownership ───
-- La funzione originale fa upsert; aggiungiamo check pre-insert

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
  -- Verifica cross-workspace prima di operare
  IF NOT EXISTS (
    SELECT 1 FROM products WHERE id = p_product_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'product_id non appartiene al workspace';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses WHERE id = p_warehouse_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'warehouse_id non appartiene al workspace';
  END IF;

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

-- ─── 7. Funzione atomica: stock update + movimento in una transazione ───
-- Risolve il problema di scrittura parziale: se il movimento fallisce,
-- anche lo stock viene rollbackato automaticamente (stessa transazione PL/pgSQL)

CREATE OR REPLACE FUNCTION wms_update_stock_with_movement(
  p_workspace_id UUID,
  p_product_id UUID,
  p_warehouse_id UUID,
  p_delta INTEGER,
  p_movement_type TEXT,
  p_created_by UUID,
  p_notes TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_new_qty INTEGER;
BEGIN
  -- Verifica cross-workspace
  IF NOT EXISTS (
    SELECT 1 FROM products WHERE id = p_product_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'product_id non appartiene al workspace';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM warehouses WHERE id = p_warehouse_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'warehouse_id non appartiene al workspace';
  END IF;

  -- Upsert inventory
  INSERT INTO inventory (workspace_id, product_id, warehouse_id, quantity_available, quantity_reserved, quantity_on_order)
  VALUES (p_workspace_id, p_product_id, p_warehouse_id, 0, 0, 0)
  ON CONFLICT (product_id, warehouse_id) DO NOTHING;

  -- Update atomico stock
  UPDATE inventory
  SET quantity_available = quantity_available + p_delta,
      updated_at = NOW()
  WHERE workspace_id = p_workspace_id
    AND product_id = p_product_id
    AND warehouse_id = p_warehouse_id
    AND quantity_available + p_delta >= 0
  RETURNING quantity_available INTO v_new_qty;

  IF v_new_qty IS NULL THEN
    RETURN -1;
  END IF;

  -- Registra movimento nella stessa transazione
  INSERT INTO warehouse_movements (
    workspace_id, product_id, warehouse_id, type, quantity,
    created_by, notes, reference_type, reference_id
  ) VALUES (
    p_workspace_id, p_product_id, p_warehouse_id, p_movement_type, p_delta,
    p_created_by, p_notes, p_reference_type, p_reference_id
  );

  RETURN v_new_qty;
END;
$$ LANGUAGE plpgsql;

-- ─── 8. View per low-stock: confronto colonne lato DB ───
-- Supabase non supporta .lte('col_a', 'col_b'), quindi usiamo una view
-- che filtra direttamente in SQL: quantity_available <= reorder_point

CREATE OR REPLACE VIEW inventory_low_stock AS
SELECT i.*
FROM inventory i
WHERE i.reorder_point > 0
  AND i.quantity_available <= i.reorder_point;

-- RLS sulla view: stessa policy della tabella inventory
ALTER VIEW inventory_low_stock SET (security_invoker = on);

-- Grant per service_role
GRANT SELECT ON inventory_low_stock TO service_role;
