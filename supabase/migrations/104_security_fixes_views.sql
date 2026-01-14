-- ============================================
-- MIGRATION: 104_security_fixes_views.sql
-- DESCRIZIONE: Fix sicurezza (Security Definer Views + RLS mancanti)
-- DATA: 2026-01-14
-- ============================================

-- ============================================
-- STEP 1: Fix Security Definer Views
-- ============================================
-- Problema: Le view default hanno security_invoker=false (eseguono come owner)
-- Soluzione: Impostare security_invoker=true per rispettare RLS del chiamante

ALTER VIEW v_platform_monthly_pnl SET (security_invoker = true);
ALTER VIEW v_shipments_by_api_source SET (security_invoker = true);
ALTER VIEW v_platform_daily_pnl SET (security_invoker = true);
ALTER VIEW v_reseller_monthly_platform_usage SET (security_invoker = true);
ALTER VIEW admin_monthly_stats SET (security_invoker = true);
ALTER VIEW v_price_list_derivations SET (security_invoker = true);
ALTER VIEW v_reconciliation_pending SET (security_invoker = true);
ALTER VIEW v_financial_audit_stats SET (security_invoker = true);
ALTER VIEW v_active_assignments SET (security_invoker = true);
ALTER VIEW v_platform_margin_alerts SET (security_invoker = true);
ALTER VIEW top_customers SET (security_invoker = true);
ALTER VIEW v_financial_alerts SET (security_invoker = true);
ALTER VIEW anne_all_shipments_view SET (security_invoker = true);

-- ============================================
-- STEP 2: Fix RLS Disabled
-- ============================================
-- Problema: platform_fee_history non ha RLS abilitato esplicitamente

ALTER TABLE platform_fee_history ENABLE ROW LEVEL SECURITY;

-- Note: La policy "SuperAdmin can view fee history" esiste già (migration 050)
-- ed è corretta. Abilitando RLS, la policy diventa attiva.

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 104 completata con successo';
  RAISE NOTICE '🔒 Security Invoker abilitato su 13 views';
  RAISE NOTICE '🔒 RLS abilitato su platform_fee_history';
  RAISE NOTICE '========================================';
END $$;
