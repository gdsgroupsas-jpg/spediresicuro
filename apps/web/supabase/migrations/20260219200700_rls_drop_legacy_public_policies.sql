-- ============================================================================
-- MIGRAZIONE: Rimuovi policy legacy con ruolo 'public' su tabelle multi-tenant
-- ============================================================================
-- Le nuove policy (20260219200000) con ruolo 'authenticated' + SECURITY DEFINER
-- coprono già tutti i casi. Le policy legacy 'public' sono ridondanti e in alcuni
-- casi pericolose (es. price_list_entries_select_all con USING: true).
--
-- service_role bypassa RLS automaticamente — nessun impatto sulle API routes.
-- Nessuna query client-side dipende da queste policy (audit confermato).
-- ============================================================================

-- === price_list_entries ===
-- CRITICAL: price_list_entries_select_all ha USING: true — data leak totale sui prezzi
DROP POLICY IF EXISTS "price_list_entries_select_all" ON public.price_list_entries;
DROP POLICY IF EXISTS "price_list_entries_insert_owner" ON public.price_list_entries;
DROP POLICY IF EXISTS "price_list_entries_update_owner" ON public.price_list_entries;
DROP POLICY IF EXISTS "price_list_entries_delete_owner" ON public.price_list_entries;

-- === wallet_transactions ===
-- wallet_transactions_select usa is_super_admin() legacy (funzione volatile, diversa da is_superadmin())
-- Users can view own transactions usa user_id direttamente senza workspace scope
DROP POLICY IF EXISTS "wallet_transactions_select" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;

-- === commercial_quotes ===
DROP POLICY IF EXISTS "commercial_quotes_select_own" ON public.commercial_quotes;
DROP POLICY IF EXISTS "commercial_quotes_insert_own" ON public.commercial_quotes;
DROP POLICY IF EXISTS "commercial_quotes_update_own" ON public.commercial_quotes;
DROP POLICY IF EXISTS "commercial_quotes_delete_draft" ON public.commercial_quotes;
DROP POLICY IF EXISTS "commercial_quotes_superadmin_all" ON public.commercial_quotes;

-- === commercial_quote_events ===
DROP POLICY IF EXISTS "commercial_quote_events_select" ON public.commercial_quote_events;
DROP POLICY IF EXISTS "commercial_quote_events_insert" ON public.commercial_quote_events;
DROP POLICY IF EXISTS "commercial_quote_events_superadmin_all" ON public.commercial_quote_events;

-- === outreach_channel_config ===
DROP POLICY IF EXISTS "outreach_channel_config_select" ON public.outreach_channel_config;
DROP POLICY IF EXISTS "outreach_channel_config_insert" ON public.outreach_channel_config;
DROP POLICY IF EXISTS "outreach_channel_config_update" ON public.outreach_channel_config;

-- === outreach_sequences ===
DROP POLICY IF EXISTS "outreach_sequences_select" ON public.outreach_sequences;
DROP POLICY IF EXISTS "outreach_sequences_insert" ON public.outreach_sequences;
DROP POLICY IF EXISTS "outreach_sequences_update" ON public.outreach_sequences;

-- === outreach_templates ===
DROP POLICY IF EXISTS "outreach_templates_select" ON public.outreach_templates;
DROP POLICY IF EXISTS "outreach_templates_insert" ON public.outreach_templates;
DROP POLICY IF EXISTS "outreach_templates_update" ON public.outreach_templates;

-- === outreach_enrollments ===
DROP POLICY IF EXISTS "outreach_enrollments_select" ON public.outreach_enrollments;
DROP POLICY IF EXISTS "outreach_enrollments_insert" ON public.outreach_enrollments;
DROP POLICY IF EXISTS "outreach_enrollments_update" ON public.outreach_enrollments;

-- === outreach_executions ===
DROP POLICY IF EXISTS "outreach_executions_select" ON public.outreach_executions;
DROP POLICY IF EXISTS "outreach_executions_insert" ON public.outreach_executions;
DROP POLICY IF EXISTS "outreach_executions_update" ON public.outreach_executions;

-- === reseller_prospects ===
DROP POLICY IF EXISTS "prospect_workspace_select" ON public.reseller_prospects;
DROP POLICY IF EXISTS "prospect_workspace_insert" ON public.reseller_prospects;
DROP POLICY IF EXISTS "prospect_workspace_update" ON public.reseller_prospects;
DROP POLICY IF EXISTS "prospect_workspace_delete" ON public.reseller_prospects;

-- === prospect_events ===
DROP POLICY IF EXISTS "prospect_events_select" ON public.prospect_events;
DROP POLICY IF EXISTS "prospect_events_insert" ON public.prospect_events;

-- ============================================================================
-- Dopo questa migration, ogni tabella avrà SOLO:
-- [ALL] "Superadmin full access ..." (authenticated) — is_superadmin() SECURITY DEFINER
-- [ALL] "Member access own workspace ..." (authenticated) — get_user_accessible_workspace_ids()
-- ============================================================================
-- FINE MIGRAZIONE: Drop policy legacy public su tabelle multi-tenant
-- ============================================================================
