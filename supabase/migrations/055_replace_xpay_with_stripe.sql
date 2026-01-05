-- ============================================
-- MIGRATION: 055_replace_xpay_with_stripe.sql
-- DESCRIZIONE: Sostituisce XPay con Stripe, mantiene compatibilità backward
-- DATA: 2026-01 (Business Features)
-- ============================================

-- ============================================
-- 1. AGGIORNA COMMENTI TABELLA
-- ============================================

COMMENT ON TABLE payment_transactions IS 'Transazioni pagamento: Stripe (default), legacy Intesa XPay (deprecato)';

-- ============================================
-- 2. MANTIENI COMPATIBILITÀ BACKWARD
-- ============================================

-- Le transazioni esistenti con provider='intesa' rimangono leggibili
-- Non modifichiamo il CHECK constraint per mantenere compatibilità
-- Il provider 'intesa' rimane valido per transazioni storiche

-- ============================================
-- 3. AGGIORNA DEFAULT PROVIDER (opzionale)
-- ============================================

-- Non modifichiamo il DEFAULT perché potrebbe rompere transazioni esistenti
-- Il nuovo codice usa sempre 'stripe' esplicitamente

-- ============================================
-- 4. NOTA PER DEPRECATION
-- ============================================

-- XPay (Intesa) è stato sostituito da Stripe per:
-- - Migliore UX (Stripe Checkout)
-- - Supporto internazionale
-- - Webhook più affidabili
-- - PCI DSS compliance gestita da Stripe
-- 
-- Transazioni esistenti con provider='intesa' rimangono accessibili
-- per audit e storico, ma nuovi pagamenti usano Stripe.



