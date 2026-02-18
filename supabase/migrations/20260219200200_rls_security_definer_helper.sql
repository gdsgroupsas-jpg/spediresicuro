-- ============================================================================
-- MIGRAZIONE: Funzione helper SECURITY DEFINER per RLS
-- ============================================================================
-- Postgres RLS: quando una policy su tabella A fa SELECT su tabella B che ha RLS,
-- si può creare ricorsione se B ha policy che fa SELECT su se stessa.
--
-- Soluzione: funzioni SECURITY DEFINER che bypassano RLS su workspace_members,
-- usate dalle policy delle tabelle multi-tenant.
-- ============================================================================

-- Funzione: workspace correnti dell'utente (membership diretta)
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT ARRAY(
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = p_user_id
      AND status = 'active'
  );
$$;

-- Funzione: workspace dell'utente + sub-workspace dei workspace dove è owner/admin
CREATE OR REPLACE FUNCTION public.get_user_accessible_workspace_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT ARRAY(
    -- Membership diretta
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = p_user_id
      AND status = 'active'
    UNION
    -- Sub-workspace (reseller vede workspace dei propri sub-client)
    SELECT w.id
    FROM workspaces w
    WHERE w.parent_workspace_id IN (
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = p_user_id
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );
$$;

-- Funzione: verifica se l'utente è superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, auth, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id
      AND raw_user_meta_data->>'account_type' = 'superadmin'
  );
$$;

-- GRANT: solo authenticated (le funzioni vengono chiamate nelle policy RLS)
GRANT EXECUTE ON FUNCTION public.get_user_workspace_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_accessible_workspace_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin(UUID) TO authenticated;

-- ============================================================================
-- AGGIORNA TUTTE LE POLICY per usare le funzioni helper
-- Questo risolve la ricorsione infinita su workspace_members
-- ============================================================================

-- ---- SHIPMENTS ----
DROP POLICY IF EXISTS "Superadmin full access shipments" ON public.shipments;
DROP POLICY IF EXISTS "Member access own workspace shipments" ON public.shipments;

CREATE POLICY "Superadmin full access shipments" ON public.shipments
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace shipments" ON public.shipments
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  );

-- ---- WALLET_TRANSACTIONS ----
DROP POLICY IF EXISTS "Superadmin full access wallet_transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Member access own workspace wallet_transactions" ON public.wallet_transactions;

CREATE POLICY "Superadmin full access wallet_transactions" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace wallet_transactions" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  );

-- ---- PRICE_LISTS ----
DROP POLICY IF EXISTS "Superadmin full access price_lists" ON public.price_lists;
DROP POLICY IF EXISTS "Member access own workspace price_lists" ON public.price_lists;

CREATE POLICY "Superadmin full access price_lists" ON public.price_lists
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace price_lists" ON public.price_lists
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  );

-- ---- AUDIT_LOGS ----
DROP POLICY IF EXISTS "Superadmin full access audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Member access own workspace audit_logs" ON public.audit_logs;

CREATE POLICY "Superadmin full access audit_logs" ON public.audit_logs
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace audit_logs" ON public.audit_logs
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  );

-- ---- COMMERCIAL_QUOTES ----
DROP POLICY IF EXISTS "Superadmin full access commercial_quotes" ON public.commercial_quotes;
DROP POLICY IF EXISTS "Member access own workspace commercial_quotes" ON public.commercial_quotes;

CREATE POLICY "Superadmin full access commercial_quotes" ON public.commercial_quotes
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace commercial_quotes" ON public.commercial_quotes
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  );

-- ---- LEADS ----
DROP POLICY IF EXISTS "Superadmin full access leads" ON public.leads;
DROP POLICY IF EXISTS "Member access own workspace leads" ON public.leads;

CREATE POLICY "Superadmin full access leads" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace leads" ON public.leads
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  );

-- ---- RESELLER_PROSPECTS ----
DROP POLICY IF EXISTS "Superadmin full access reseller_prospects" ON public.reseller_prospects;
DROP POLICY IF EXISTS "Member access own workspace reseller_prospects" ON public.reseller_prospects;

CREATE POLICY "Superadmin full access reseller_prospects" ON public.reseller_prospects
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace reseller_prospects" ON public.reseller_prospects
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  );

-- ---- EMAILS ----
DROP POLICY IF EXISTS "Superadmin full access emails" ON public.emails;
DROP POLICY IF EXISTS "Member access own workspace emails" ON public.emails;

CREATE POLICY "Superadmin full access emails" ON public.emails
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace emails" ON public.emails
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
  );

-- ---- WAREHOUSES ----
DROP POLICY IF EXISTS "Superadmin full access warehouses" ON public.warehouses;
DROP POLICY IF EXISTS "Member access own workspace warehouses" ON public.warehouses;

CREATE POLICY "Superadmin full access warehouses" ON public.warehouses
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace warehouses" ON public.warehouses
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- INVENTORY ----
DROP POLICY IF EXISTS "Superadmin full access inventory" ON public.inventory;
DROP POLICY IF EXISTS "Member access own workspace inventory" ON public.inventory;

CREATE POLICY "Superadmin full access inventory" ON public.inventory
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace inventory" ON public.inventory
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- WAREHOUSE_MOVEMENTS ----
DROP POLICY IF EXISTS "Superadmin full access warehouse_movements" ON public.warehouse_movements;
DROP POLICY IF EXISTS "Member access own workspace warehouse_movements" ON public.warehouse_movements;

CREATE POLICY "Superadmin full access warehouse_movements" ON public.warehouse_movements
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace warehouse_movements" ON public.warehouse_movements
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- PRODUCTS ----
DROP POLICY IF EXISTS "Superadmin full access products" ON public.products;
DROP POLICY IF EXISTS "Member access own workspace products" ON public.products;

CREATE POLICY "Superadmin full access products" ON public.products
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace products" ON public.products
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- SUPPLIERS ----
DROP POLICY IF EXISTS "Superadmin full access suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Member access own workspace suppliers" ON public.suppliers;

CREATE POLICY "Superadmin full access suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- PRODUCT_SUPPLIERS ----
DROP POLICY IF EXISTS "Superadmin full access product_suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Member access own workspace product_suppliers" ON public.product_suppliers;

CREATE POLICY "Superadmin full access product_suppliers" ON public.product_suppliers
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace product_suppliers" ON public.product_suppliers
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- PURCHASE_ORDERS ----
DROP POLICY IF EXISTS "Superadmin full access purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Member access own workspace purchase_orders" ON public.purchase_orders;

CREATE POLICY "Superadmin full access purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace purchase_orders" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- PURCHASE_ORDER_ITEMS ----
DROP POLICY IF EXISTS "Superadmin full access purchase_order_items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Member access own workspace purchase_order_items" ON public.purchase_order_items;

CREATE POLICY "Superadmin full access purchase_order_items" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace purchase_order_items" ON public.purchase_order_items
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- INVOICES ----
DROP POLICY IF EXISTS "Superadmin full access invoices" ON public.invoices;
DROP POLICY IF EXISTS "Member access own workspace invoices" ON public.invoices;

CREATE POLICY "Superadmin full access invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- INVOICE_ITEMS ----
DROP POLICY IF EXISTS "Superadmin full access invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Member access own workspace invoice_items" ON public.invoice_items;

CREATE POLICY "Superadmin full access invoice_items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace invoice_items" ON public.invoice_items
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- COD_FILES ----
DROP POLICY IF EXISTS "Superadmin full access cod_files" ON public.cod_files;
DROP POLICY IF EXISTS "Member access own workspace cod_files" ON public.cod_files;

CREATE POLICY "Superadmin full access cod_files" ON public.cod_files
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace cod_files" ON public.cod_files
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- COD_ITEMS ----
DROP POLICY IF EXISTS "Superadmin full access cod_items" ON public.cod_items;
DROP POLICY IF EXISTS "Member access own workspace cod_items" ON public.cod_items;

CREATE POLICY "Superadmin full access cod_items" ON public.cod_items
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace cod_items" ON public.cod_items
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- COD_DISTINTE ----
DROP POLICY IF EXISTS "Superadmin full access cod_distinte" ON public.cod_distinte;
DROP POLICY IF EXISTS "Member access own workspace cod_distinte" ON public.cod_distinte;

CREATE POLICY "Superadmin full access cod_distinte" ON public.cod_distinte
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace cod_distinte" ON public.cod_distinte
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- WORKSPACE_EMAIL_ADDRESSES ----
DROP POLICY IF EXISTS "Superadmin full access workspace_email_addresses" ON public.workspace_email_addresses;
DROP POLICY IF EXISTS "Member access own workspace workspace_email_addresses" ON public.workspace_email_addresses;

CREATE POLICY "Superadmin full access workspace_email_addresses" ON public.workspace_email_addresses
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace workspace_email_addresses" ON public.workspace_email_addresses
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- WORKSPACE_ANNOUNCEMENTS ----
DROP POLICY IF EXISTS "Superadmin full access workspace_announcements" ON public.workspace_announcements;
DROP POLICY IF EXISTS "Member access own workspace workspace_announcements" ON public.workspace_announcements;

CREATE POLICY "Superadmin full access workspace_announcements" ON public.workspace_announcements
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace workspace_announcements" ON public.workspace_announcements
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- WORKSPACE_CUSTOM_DOMAINS ----
DROP POLICY IF EXISTS "Superadmin full access workspace_custom_domains" ON public.workspace_custom_domains;
DROP POLICY IF EXISTS "Member access own workspace workspace_custom_domains" ON public.workspace_custom_domains;

CREATE POLICY "Superadmin full access workspace_custom_domains" ON public.workspace_custom_domains
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace workspace_custom_domains" ON public.workspace_custom_domains
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- OUTREACH_CHANNEL_CONFIG ----
DROP POLICY IF EXISTS "Superadmin full access outreach_channel_config" ON public.outreach_channel_config;
DROP POLICY IF EXISTS "Member access own workspace outreach_channel_config" ON public.outreach_channel_config;

CREATE POLICY "Superadmin full access outreach_channel_config" ON public.outreach_channel_config
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace outreach_channel_config" ON public.outreach_channel_config
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- OUTREACH_TEMPLATES ----
DROP POLICY IF EXISTS "Superadmin full access outreach_templates" ON public.outreach_templates;
DROP POLICY IF EXISTS "Member access own workspace outreach_templates" ON public.outreach_templates;

CREATE POLICY "Superadmin full access outreach_templates" ON public.outreach_templates
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace outreach_templates" ON public.outreach_templates
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- OUTREACH_SEQUENCES ----
DROP POLICY IF EXISTS "Superadmin full access outreach_sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "Member access own workspace outreach_sequences" ON public.outreach_sequences;

CREATE POLICY "Superadmin full access outreach_sequences" ON public.outreach_sequences
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace outreach_sequences" ON public.outreach_sequences
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- OUTREACH_ENROLLMENTS ----
DROP POLICY IF EXISTS "Superadmin full access outreach_enrollments" ON public.outreach_enrollments;
DROP POLICY IF EXISTS "Member access own workspace outreach_enrollments" ON public.outreach_enrollments;

CREATE POLICY "Superadmin full access outreach_enrollments" ON public.outreach_enrollments
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace outreach_enrollments" ON public.outreach_enrollments
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- OUTREACH_EXECUTIONS ----
DROP POLICY IF EXISTS "Superadmin full access outreach_executions" ON public.outreach_executions;
DROP POLICY IF EXISTS "Member access own workspace outreach_executions" ON public.outreach_executions;

CREATE POLICY "Superadmin full access outreach_executions" ON public.outreach_executions
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace outreach_executions" ON public.outreach_executions
  FOR ALL TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  )
  WITH CHECK (
    workspace_id IS NOT NULL
    AND workspace_id = ANY(public.get_user_workspace_ids(auth.uid()))
  );

-- ---- PRICE_LIST_ENTRIES (via FK) ----
DROP POLICY IF EXISTS "Superadmin full access price_list_entries" ON public.price_list_entries;
DROP POLICY IF EXISTS "Member access own workspace price_list_entries" ON public.price_list_entries;

CREATE POLICY "Superadmin full access price_list_entries" ON public.price_list_entries
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace price_list_entries" ON public.price_list_entries
  FOR ALL TO authenticated
  USING (
    price_list_id IN (
      SELECT id FROM public.price_lists
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  )
  WITH CHECK (
    price_list_id IN (
      SELECT id FROM public.price_lists
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  );

-- ---- PRICE_LIST_ASSIGNMENTS (via FK) ----
DROP POLICY IF EXISTS "Superadmin full access price_list_assignments" ON public.price_list_assignments;
DROP POLICY IF EXISTS "Member access own workspace price_list_assignments" ON public.price_list_assignments;

CREATE POLICY "Superadmin full access price_list_assignments" ON public.price_list_assignments
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace price_list_assignments" ON public.price_list_assignments
  FOR ALL TO authenticated
  USING (
    price_list_id IN (
      SELECT id FROM public.price_lists
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  )
  WITH CHECK (
    price_list_id IN (
      SELECT id FROM public.price_lists
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  );

-- ---- COMMERCIAL_QUOTE_EVENTS (via FK) ----
DROP POLICY IF EXISTS "Superadmin full access commercial_quote_events" ON public.commercial_quote_events;
DROP POLICY IF EXISTS "Member access own workspace commercial_quote_events" ON public.commercial_quote_events;

CREATE POLICY "Superadmin full access commercial_quote_events" ON public.commercial_quote_events
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace commercial_quote_events" ON public.commercial_quote_events
  FOR ALL TO authenticated
  USING (
    quote_id IN (
      SELECT id FROM public.commercial_quotes
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  )
  WITH CHECK (
    quote_id IN (
      SELECT id FROM public.commercial_quotes
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  );

-- ---- PROSPECT_EVENTS (via FK) ----
DROP POLICY IF EXISTS "Superadmin full access prospect_events" ON public.prospect_events;
DROP POLICY IF EXISTS "Member access own workspace prospect_events" ON public.prospect_events;

CREATE POLICY "Superadmin full access prospect_events" ON public.prospect_events
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace prospect_events" ON public.prospect_events
  FOR ALL TO authenticated
  USING (
    prospect_id IN (
      SELECT id FROM public.reseller_prospects
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  )
  WITH CHECK (
    prospect_id IN (
      SELECT id FROM public.reseller_prospects
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  );

-- ---- LEAD_EVENTS (via FK) ----
DROP POLICY IF EXISTS "Superadmin full access lead_events" ON public.lead_events;
DROP POLICY IF EXISTS "Member access own workspace lead_events" ON public.lead_events;

CREATE POLICY "Superadmin full access lead_events" ON public.lead_events
  FOR ALL TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE POLICY "Member access own workspace lead_events" ON public.lead_events
  FOR ALL TO authenticated
  USING (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  )
  WITH CHECK (
    lead_id IN (
      SELECT id FROM public.leads
      WHERE workspace_id = ANY(public.get_user_accessible_workspace_ids(auth.uid()))
    )
  );

-- ============================================================================
-- FINE MIGRAZIONE: Helper SECURITY DEFINER + policy aggiornate (anti-ricorsione)
-- ============================================================================
