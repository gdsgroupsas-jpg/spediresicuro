-- ============================================================================
-- MIGRAZIONE: RLS Difensivo su Tabelle Multi-Tenant (con workspace_id diretto)
-- ============================================================================
-- Secondo layer di sicurezza (il primo è workspaceQuery() in TypeScript).
-- Protegge da accesso diretto al DB (psql, Studio, SQL injection).
--
-- Principi:
--   1. service_role bypassa RLS automaticamente in Postgres (invariato)
--   2. Superadmin (account_type='superadmin') vede TUTTO
--   3. Member vede solo workspace dove ha membership attiva
--   4. Reseller (owner/admin) vede anche workspace dei propri sub-client
--   5. Righe con workspace_id IS NULL: visibili solo a superadmin
--
-- NOTA: Le 5 tabelle senza workspace_id diretto (price_list_entries,
-- price_list_assignments, commercial_quote_events, prospect_events, lead_events)
-- sono gestite nella migration successiva via FK → parent table.
-- ============================================================================

-- ============================================================================
-- TABELLE CORE CON HIERARCHY RESELLER → SUB-CLIENT
-- ============================================================================

-- ---- SHIPMENTS ----
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access shipments" ON public.shipments;
DROP POLICY IF EXISTS "Member access own workspace shipments" ON public.shipments;

CREATE POLICY "Superadmin full access shipments" ON public.shipments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace shipments" ON public.shipments
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  );

-- ---- WALLET_TRANSACTIONS ----
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access wallet_transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Member access own workspace wallet_transactions" ON public.wallet_transactions;

CREATE POLICY "Superadmin full access wallet_transactions" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace wallet_transactions" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  );

-- ---- PRICE_LISTS ----
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access price_lists" ON public.price_lists;
DROP POLICY IF EXISTS "Member access own workspace price_lists" ON public.price_lists;

CREATE POLICY "Superadmin full access price_lists" ON public.price_lists
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace price_lists" ON public.price_lists
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  );

-- ---- AUDIT_LOGS ----
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Member access own workspace audit_logs" ON public.audit_logs;

CREATE POLICY "Superadmin full access audit_logs" ON public.audit_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace audit_logs" ON public.audit_logs
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================================
-- TABELLE BUSINESS CON HIERARCHY
-- ============================================================================

-- ---- COMMERCIAL_QUOTES ----
ALTER TABLE public.commercial_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access commercial_quotes" ON public.commercial_quotes;
DROP POLICY IF EXISTS "Member access own workspace commercial_quotes" ON public.commercial_quotes;

CREATE POLICY "Superadmin full access commercial_quotes" ON public.commercial_quotes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace commercial_quotes" ON public.commercial_quotes
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  );

-- ---- LEADS ----
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access leads" ON public.leads;
DROP POLICY IF EXISTS "Member access own workspace leads" ON public.leads;

CREATE POLICY "Superadmin full access leads" ON public.leads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace leads" ON public.leads
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  );

-- ---- RESELLER_PROSPECTS ----
ALTER TABLE public.reseller_prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access reseller_prospects" ON public.reseller_prospects;
DROP POLICY IF EXISTS "Member access own workspace reseller_prospects" ON public.reseller_prospects;

CREATE POLICY "Superadmin full access reseller_prospects" ON public.reseller_prospects
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace reseller_prospects" ON public.reseller_prospects
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  );

-- ---- EMAILS ----
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access emails" ON public.emails;
DROP POLICY IF EXISTS "Member access own workspace emails" ON public.emails;

CREATE POLICY "Superadmin full access emails" ON public.emails
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace emails" ON public.emails
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT w.id FROM public.workspaces w
      WHERE w.parent_workspace_id IN (
        SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================================
-- TABELLE WMS/OUTREACH — solo membership diretta (no hierarchy)
-- ============================================================================

-- ---- WAREHOUSES ----
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Member access own workspace warehouses" ON public.warehouses;

CREATE POLICY "Superadmin full access warehouses" ON public.warehouses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace warehouses" ON public.warehouses
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- INVENTORY ----
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access inventory" ON public.inventory;
DROP POLICY IF EXISTS "Member access own workspace inventory" ON public.inventory;

CREATE POLICY "Superadmin full access inventory" ON public.inventory
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace inventory" ON public.inventory
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- WAREHOUSE_MOVEMENTS ----
ALTER TABLE public.warehouse_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access warehouse_movements" ON public.warehouse_movements;
DROP POLICY IF EXISTS "Member access own workspace warehouse_movements" ON public.warehouse_movements;

CREATE POLICY "Superadmin full access warehouse_movements" ON public.warehouse_movements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace warehouse_movements" ON public.warehouse_movements
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- PRODUCTS ----
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access products" ON public.products;
DROP POLICY IF EXISTS "Member access own workspace products" ON public.products;

CREATE POLICY "Superadmin full access products" ON public.products
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace products" ON public.products
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- SUPPLIERS ----
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Member access own workspace suppliers" ON public.suppliers;

CREATE POLICY "Superadmin full access suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- PRODUCT_SUPPLIERS ----
ALTER TABLE public.product_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access product_suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Member access own workspace product_suppliers" ON public.product_suppliers;

CREATE POLICY "Superadmin full access product_suppliers" ON public.product_suppliers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace product_suppliers" ON public.product_suppliers
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- PURCHASE_ORDERS ----
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Member access own workspace purchase_orders" ON public.purchase_orders;

CREATE POLICY "Superadmin full access purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- PURCHASE_ORDER_ITEMS ----
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Member access own workspace purchase_order_items" ON public.purchase_order_items;

CREATE POLICY "Superadmin full access purchase_order_items" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace purchase_order_items" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- INVOICES ----
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access invoices" ON public.invoices;
DROP POLICY IF EXISTS "Member access own workspace invoices" ON public.invoices;

CREATE POLICY "Superadmin full access invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- INVOICE_ITEMS ----
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Member access own workspace invoice_items" ON public.invoice_items;

CREATE POLICY "Superadmin full access invoice_items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace invoice_items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- COD_FILES ----
ALTER TABLE public.cod_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access cod_files" ON public.cod_files;
DROP POLICY IF EXISTS "Member access own workspace cod_files" ON public.cod_files;

CREATE POLICY "Superadmin full access cod_files" ON public.cod_files
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace cod_files" ON public.cod_files
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- COD_ITEMS ----
ALTER TABLE public.cod_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access cod_items" ON public.cod_items;
DROP POLICY IF EXISTS "Member access own workspace cod_items" ON public.cod_items;

CREATE POLICY "Superadmin full access cod_items" ON public.cod_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace cod_items" ON public.cod_items
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- COD_DISTINTE ----
ALTER TABLE public.cod_distinte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access cod_distinte" ON public.cod_distinte;
DROP POLICY IF EXISTS "Member access own workspace cod_distinte" ON public.cod_distinte;

CREATE POLICY "Superadmin full access cod_distinte" ON public.cod_distinte
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace cod_distinte" ON public.cod_distinte
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- WORKSPACE_EMAIL_ADDRESSES ----
ALTER TABLE public.workspace_email_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access workspace_email_addresses" ON public.workspace_email_addresses;
DROP POLICY IF EXISTS "Member access own workspace workspace_email_addresses" ON public.workspace_email_addresses;

CREATE POLICY "Superadmin full access workspace_email_addresses" ON public.workspace_email_addresses
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace workspace_email_addresses" ON public.workspace_email_addresses
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- WORKSPACE_ANNOUNCEMENTS ----
ALTER TABLE public.workspace_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access workspace_announcements" ON public.workspace_announcements;
DROP POLICY IF EXISTS "Member access own workspace workspace_announcements" ON public.workspace_announcements;

CREATE POLICY "Superadmin full access workspace_announcements" ON public.workspace_announcements
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace workspace_announcements" ON public.workspace_announcements
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- WORKSPACE_CUSTOM_DOMAINS ----
ALTER TABLE public.workspace_custom_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access workspace_custom_domains" ON public.workspace_custom_domains;
DROP POLICY IF EXISTS "Member access own workspace workspace_custom_domains" ON public.workspace_custom_domains;

CREATE POLICY "Superadmin full access workspace_custom_domains" ON public.workspace_custom_domains
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace workspace_custom_domains" ON public.workspace_custom_domains
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- OUTREACH_CHANNEL_CONFIG ----
ALTER TABLE public.outreach_channel_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access outreach_channel_config" ON public.outreach_channel_config;
DROP POLICY IF EXISTS "Member access own workspace outreach_channel_config" ON public.outreach_channel_config;

CREATE POLICY "Superadmin full access outreach_channel_config" ON public.outreach_channel_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace outreach_channel_config" ON public.outreach_channel_config
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- OUTREACH_TEMPLATES ----
ALTER TABLE public.outreach_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access outreach_templates" ON public.outreach_templates;
DROP POLICY IF EXISTS "Member access own workspace outreach_templates" ON public.outreach_templates;

CREATE POLICY "Superadmin full access outreach_templates" ON public.outreach_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace outreach_templates" ON public.outreach_templates
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- OUTREACH_SEQUENCES ----
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access outreach_sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "Member access own workspace outreach_sequences" ON public.outreach_sequences;

CREATE POLICY "Superadmin full access outreach_sequences" ON public.outreach_sequences
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace outreach_sequences" ON public.outreach_sequences
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- OUTREACH_ENROLLMENTS ----
ALTER TABLE public.outreach_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access outreach_enrollments" ON public.outreach_enrollments;
DROP POLICY IF EXISTS "Member access own workspace outreach_enrollments" ON public.outreach_enrollments;

CREATE POLICY "Superadmin full access outreach_enrollments" ON public.outreach_enrollments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace outreach_enrollments" ON public.outreach_enrollments
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ---- OUTREACH_EXECUTIONS ----
ALTER TABLE public.outreach_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin full access outreach_executions" ON public.outreach_executions;
DROP POLICY IF EXISTS "Member access own workspace outreach_executions" ON public.outreach_executions;

CREATE POLICY "Superadmin full access outreach_executions" ON public.outreach_executions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

CREATE POLICY "Member access own workspace outreach_executions" ON public.outreach_executions
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ============================================================================
-- FINE MIGRAZIONE: RLS Difensivo Multi-Tenant (28 tabelle con workspace_id diretto)
-- Le 5 tabelle senza workspace_id diretto sono in: 20260219200100_rls_fix_tables_without_workspace_id.sql
-- ============================================================================
