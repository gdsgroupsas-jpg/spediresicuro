-- ============================================
-- Aggiunge CHECK constraints per sector e lead_source su leads
-- Previene valori non validi da INSERT/UPDATE diretti in DB
-- ============================================

-- CHECK su sector (nullable, solo valori noti)
ALTER TABLE leads ADD CONSTRAINT leads_sector_check
  CHECK (sector IS NULL OR sector IN ('ecommerce', 'food', 'pharma', 'artigianato', 'industria', 'logistica', 'altro'));

-- CHECK su lead_source (nullable, solo valori noti)
ALTER TABLE leads ADD CONSTRAINT leads_lead_source_check
  CHECK (lead_source IS NULL OR lead_source IN ('direct', 'website_form', 'referral', 'cold_outreach', 'event', 'partner'));
