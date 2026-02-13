-- Aggiunge colonna margin_fixed_eur ai preventivi commerciali
-- Formula: finalPrice = base * (1 + margin_percent/100) + margin_fixed_eur
-- Margine fisso in EUR, indipendente dal margine percentuale

ALTER TABLE public.commercial_quotes
  ADD COLUMN IF NOT EXISTS margin_fixed_eur NUMERIC(10,2) DEFAULT NULL;

-- Aggiorna trigger immutabilita' per includere margin_fixed_eur
CREATE OR REPLACE FUNCTION public.enforce_commercial_quote_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Se la quote era gia' stata inviata
  IF OLD.sent_at IS NOT NULL THEN
    IF NEW.price_matrix IS DISTINCT FROM OLD.price_matrix
       OR NEW.price_includes IS DISTINCT FROM OLD.price_includes
       OR NEW.clauses IS DISTINCT FROM OLD.clauses
       OR NEW.prospect_company IS DISTINCT FROM OLD.prospect_company
       OR NEW.prospect_contact_name IS DISTINCT FROM OLD.prospect_contact_name
       OR NEW.prospect_email IS DISTINCT FROM OLD.prospect_email
       OR NEW.prospect_phone IS DISTINCT FROM OLD.prospect_phone
       OR NEW.carrier_code IS DISTINCT FROM OLD.carrier_code
       OR NEW.contract_code IS DISTINCT FROM OLD.contract_code
       OR NEW.margin_percent IS DISTINCT FROM OLD.margin_percent
       OR NEW.margin_fixed_eur IS DISTINCT FROM OLD.margin_fixed_eur
       OR NEW.validity_days IS DISTINCT FROM OLD.validity_days
       OR NEW.vat_mode IS DISTINCT FROM OLD.vat_mode
       OR NEW.vat_rate IS DISTINCT FROM OLD.vat_rate
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.revision IS DISTINCT FROM OLD.revision
       OR NEW.parent_quote_id IS DISTINCT FROM OLD.parent_quote_id
    THEN
      RAISE EXCEPTION 'IMMUTABLE_QUOTE: Preventivo gia'' inviato, non modificabile. Crea una nuova revisione.'
        USING ERRCODE = 'P0010';
    END IF;
  END IF;

  -- Calcola expires_at quando sent_at viene impostato per la prima volta
  IF NEW.sent_at IS NOT NULL AND OLD.sent_at IS NULL THEN
    NEW.expires_at := NEW.sent_at + (NEW.validity_days || ' days')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
