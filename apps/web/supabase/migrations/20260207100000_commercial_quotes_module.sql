-- ============================================
-- MIGRAZIONE: Preventivatore Commerciale (MVP)
-- Modulo per generazione preventivi PDF brandizzati
-- per agenti/reseller verso nuovi clienti azienda
-- ============================================

-- 1. TABELLA: commercial_quotes
-- Preventivi commerciali con revisioni tracciate e snapshot immutabili
CREATE TABLE IF NOT EXISTS public.commercial_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id),
  created_by UUID NOT NULL REFERENCES public.users(id),

  -- Prospect (inline in Fase 1, no tabella separata)
  prospect_company TEXT NOT NULL,
  prospect_contact_name TEXT,
  prospect_email TEXT,
  prospect_phone TEXT,
  prospect_sector TEXT,
  prospect_estimated_volume INT,
  prospect_notes TEXT,

  -- Configurazione offerta
  carrier_code TEXT NOT NULL,
  contract_code TEXT NOT NULL,
  price_list_id UUID REFERENCES public.price_lists(id),
  margin_percent NUMERIC(5,2),
  validity_days INT DEFAULT 30,

  -- Revisioni
  revision INT DEFAULT 1 NOT NULL,
  parent_quote_id UUID REFERENCES public.commercial_quotes(id),
  revision_notes TEXT,

  -- Snapshot immutabile dopo invio
  -- price_matrix: { zones: string[], weight_ranges: {from, to, label}[], prices: number[][], services_included: string[], carrier_display_name: string, vat_mode, vat_rate, generated_at }
  price_matrix JSONB NOT NULL,
  price_includes JSONB,
  clauses JSONB,

  -- VAT (ADR-001)
  currency TEXT DEFAULT 'EUR',
  vat_mode TEXT DEFAULT 'excluded' CHECK (vat_mode IN ('included', 'excluded')),
  vat_rate NUMERIC(4,2) DEFAULT 22.0,

  -- Stato pipeline
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'negotiating', 'accepted', 'rejected', 'expired')),
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_notes TEXT,
  expires_at TIMESTAMPTZ,

  -- PDF
  pdf_storage_path TEXT,

  -- Conversione (quando prospect accetta)
  converted_user_id UUID REFERENCES public.users(id),
  converted_price_list_id UUID REFERENCES public.price_lists(id),

  -- Self-learning data (Fase 2 - schema pronto)
  original_margin_percent NUMERIC(5,2),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.commercial_quotes IS 'Preventivi commerciali con revisioni tracciate e snapshot immutabili';
COMMENT ON COLUMN public.commercial_quotes.price_matrix IS 'Snapshot matrice prezzi: { zones, weight_ranges, prices[][], services_included, carrier_display_name, vat_mode, vat_rate, generated_at }';
COMMENT ON COLUMN public.commercial_quotes.status IS 'Pipeline: draft -> sent -> negotiating -> accepted|rejected|expired';
COMMENT ON COLUMN public.commercial_quotes.parent_quote_id IS 'Punta alla revisione precedente. NULL se e'' la prima versione';
COMMENT ON COLUMN public.commercial_quotes.original_margin_percent IS 'Margine iniziale prima di negoziazione (per self-learning Fase 2)';

-- 2. TABELLA: commercial_quote_events
-- Eventi per tracking lifecycle preventivi (prepara self-learning Fase 2)
CREATE TABLE IF NOT EXISTS public.commercial_quote_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.commercial_quotes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  actor_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.commercial_quote_events IS 'Eventi lifecycle preventivi commerciali (self-learning Fase 2)';

-- 3. INDICI
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_workspace_id ON public.commercial_quotes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_created_by ON public.commercial_quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_status ON public.commercial_quotes(status);
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_parent_quote_id ON public.commercial_quotes(parent_quote_id) WHERE parent_quote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_prospect_email ON public.commercial_quotes(prospect_email) WHERE prospect_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_quotes_expires_at ON public.commercial_quotes(expires_at) WHERE expires_at IS NOT NULL AND status = 'sent';
CREATE INDEX IF NOT EXISTS idx_commercial_quote_events_quote_id ON public.commercial_quote_events(quote_id);
CREATE INDEX IF NOT EXISTS idx_commercial_quote_events_type ON public.commercial_quote_events(event_type);

-- 4. TRIGGER: updated_at automatico
CREATE OR REPLACE FUNCTION public.update_commercial_quotes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_commercial_quotes_updated_at ON public.commercial_quotes;
CREATE TRIGGER trigger_commercial_quotes_updated_at
  BEFORE UPDATE ON public.commercial_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_commercial_quotes_updated_at();

-- 5. TRIGGER: Immutabilita' snapshot dopo invio + calcolo expires_at
-- Blocca modifiche a campi critici quando sent_at IS NOT NULL
-- Permette SOLO cambi a: status, responded_at, response_notes, converted_*, pdf_storage_path
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

DROP TRIGGER IF EXISTS trigger_commercial_quote_immutability ON public.commercial_quotes;
CREATE TRIGGER trigger_commercial_quote_immutability
  BEFORE UPDATE ON public.commercial_quotes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_commercial_quote_immutability();

-- 6. RLS POLICIES
ALTER TABLE public.commercial_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_quote_events ENABLE ROW LEVEL SECURITY;

-- Superadmin: accesso completo
CREATE POLICY "commercial_quotes_superadmin_all" ON public.commercial_quotes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND account_type = 'superadmin'
    )
  );

-- Utente: SELECT propri preventivi + quelli del workspace (se owner/admin)
CREATE POLICY "commercial_quotes_select_own" ON public.commercial_quotes
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = commercial_quotes.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- Utente: INSERT nel proprio workspace
CREATE POLICY "commercial_quotes_insert_own" ON public.commercial_quotes
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = commercial_quotes.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Utente: UPDATE propri + workspace (owner/admin)
CREATE POLICY "commercial_quotes_update_own" ON public.commercial_quotes
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = commercial_quotes.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- Utente: DELETE solo bozze proprie
CREATE POLICY "commercial_quotes_delete_draft" ON public.commercial_quotes
  FOR DELETE USING (
    created_by = auth.uid()
    AND status = 'draft'
  );

-- Events: superadmin accesso completo
CREATE POLICY "commercial_quote_events_superadmin_all" ON public.commercial_quote_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND account_type = 'superadmin'
    )
  );

-- Events: SELECT se ha accesso alla quote
CREATE POLICY "commercial_quote_events_select" ON public.commercial_quote_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.commercial_quotes cq
      WHERE cq.id = commercial_quote_events.quote_id
        AND (
          cq.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = cq.workspace_id
              AND wm.user_id = auth.uid()
              AND wm.role IN ('owner', 'admin')
              AND wm.status = 'active'
          )
        )
    )
  );

-- Events: INSERT se e' l'attore
CREATE POLICY "commercial_quote_events_insert" ON public.commercial_quote_events
  FOR INSERT WITH CHECK (
    actor_id = auth.uid()
  );

-- 7. GRANTS
GRANT ALL ON public.commercial_quotes TO authenticated;
GRANT ALL ON public.commercial_quotes TO service_role;
GRANT ALL ON public.commercial_quote_events TO authenticated;
GRANT ALL ON public.commercial_quote_events TO service_role;

-- 8. NOTA: Storage bucket per PDF preventivi
-- Eseguire in Supabase Dashboard o via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('commercial-quotes', 'commercial-quotes', false);
-- Oppure verra' creato automaticamente dalla server action se non esiste
