/**
 * Migration: Sistema Avanzato Listini Prezzi
 * 
 * Estende il sistema listini esistente con:
 * 1. Campo price_list_id su shipments (per audit)
 * 2. Campo assigned_price_list_id su users (listino predefinito)
 * 3. Campo rules (JSONB) su price_lists per regole avanzate
 * 4. Campi per gerarchia e priorità
 * 5. Supporto multi-corriere e versionamento avanzato
 * 
 * Data: 2025-01
 * 
 * ⚠️ PREREQUISITO: La tabella price_lists deve esistere (creata in migration 001_complete_schema.sql)
 */

-- ============================================
-- STEP 0: Verifica/Crea tabella price_lists se non esiste
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'price_lists'
  ) THEN
    RAISE NOTICE '⚠️ Tabella price_lists non trovata. Creazione struttura base...';
    
    -- Crea tabella price_lists base (se non esiste)
    CREATE TABLE IF NOT EXISTS price_lists (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      courier_id UUID,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      valid_from DATE,
      valid_until DATE,
      source_type TEXT,
      source_file_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      created_by UUID
    );
    
    -- Crea indici base
    CREATE INDEX IF NOT EXISTS idx_price_lists_courier ON price_lists(courier_id);
    CREATE INDEX IF NOT EXISTS idx_price_lists_status ON price_lists(status);
    
    RAISE NOTICE '✅ Tabella price_lists creata (struttura base)';
  ELSE
    RAISE NOTICE '✅ Tabella price_lists verificata';
  END IF;
END $$;

-- ============================================
-- STEP 1: Aggiungi price_list_id a shipments
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'price_list_id'
  ) THEN
    -- Aggiungi colonna senza foreign key prima
    ALTER TABLE shipments ADD COLUMN price_list_id UUID;
    
    -- Aggiungi foreign key dopo
    ALTER TABLE shipments 
    ADD CONSTRAINT fk_shipments_price_list 
    FOREIGN KEY (price_list_id) 
    REFERENCES price_lists(id) 
    ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_shipments_price_list_id ON shipments(price_list_id);
    COMMENT ON COLUMN shipments.price_list_id IS 'ID listino prezzi applicato alla spedizione (per audit e reporting)';
    RAISE NOTICE '✅ Aggiunto campo: shipments.price_list_id';
  ELSE
    RAISE NOTICE '⚠️ Campo shipments.price_list_id già esistente';
  END IF;
END $$;

-- Campo per tracciare regola applicata
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'applied_price_rule_id'
  ) THEN
    ALTER TABLE shipments ADD COLUMN applied_price_rule_id TEXT;
    COMMENT ON COLUMN shipments.applied_price_rule_id IS 'ID regola di prezzo applicata (dalla struttura rules JSONB)';
    RAISE NOTICE '✅ Aggiunto campo: shipments.applied_price_rule_id';
  ELSE
    RAISE NOTICE '⚠️ Campo shipments.applied_price_rule_id già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Aggiungi assigned_price_list_id a users
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'assigned_price_list_id'
  ) THEN
    -- Aggiungi colonna senza foreign key prima
    ALTER TABLE users ADD COLUMN assigned_price_list_id UUID;
    
    -- Aggiungi foreign key dopo
    ALTER TABLE users 
    ADD CONSTRAINT fk_users_assigned_price_list 
    FOREIGN KEY (assigned_price_list_id) 
    REFERENCES price_lists(id) 
    ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_users_assigned_price_list_id ON users(assigned_price_list_id);
    COMMENT ON COLUMN users.assigned_price_list_id IS 'Listino prezzi predefinito assegnato all''utente';
    RAISE NOTICE '✅ Aggiunto campo: users.assigned_price_list_id';
  ELSE
    RAISE NOTICE '⚠️ Campo users.assigned_price_list_id già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Estendi price_lists con campi avanzati
-- ============================================

-- Campo rules (JSONB) per regole avanzate
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'rules'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN rules JSONB DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS idx_price_lists_rules ON price_lists USING GIN (rules);
    COMMENT ON COLUMN price_lists.rules IS 'Array di regole di calcolo prezzi avanzate (PriceRule[])';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.rules';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.rules già esistente';
  END IF;
END $$;

-- Campo priority per gerarchia
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'priority'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN priority TEXT DEFAULT 'default' CHECK (priority IN ('global', 'partner', 'client', 'default'));
    CREATE INDEX IF NOT EXISTS idx_price_lists_priority ON price_lists(priority);
    COMMENT ON COLUMN price_lists.priority IS 'Priorità listino: global (admin), partner (reseller), client (utente), default';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.priority';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.priority già esistente';
  END IF;
END $$;

-- Campo is_global
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN is_global BOOLEAN DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_price_lists_is_global ON price_lists(is_global);
    COMMENT ON COLUMN price_lists.is_global IS 'Se true, listino globale creato da admin (visibile a tutti)';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.is_global';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.is_global già esistente';
  END IF;
END $$;

-- Campo assigned_to_user_id per listini personalizzati
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'assigned_to_user_id'
  ) THEN
    -- Aggiungi colonna senza foreign key prima
    ALTER TABLE price_lists ADD COLUMN assigned_to_user_id UUID;
    
    -- Aggiungi foreign key dopo (se users esiste)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
      ALTER TABLE price_lists 
      ADD CONSTRAINT fk_price_lists_assigned_user 
      FOREIGN KEY (assigned_to_user_id) 
      REFERENCES users(id) 
      ON DELETE CASCADE;
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_price_lists_assigned_to_user ON price_lists(assigned_to_user_id);
    COMMENT ON COLUMN price_lists.assigned_to_user_id IS 'Se specificato, listino personalizzato per questo utente';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.assigned_to_user_id';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.assigned_to_user_id già esistente';
  END IF;
END $$;

-- Campi margini di default
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'default_margin_percent'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN default_margin_percent DECIMAL(5,2) DEFAULT 0;
    COMMENT ON COLUMN price_lists.default_margin_percent IS 'Margine percentuale di default se nessuna regola matcha';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.default_margin_percent';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.default_margin_percent già esistente';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'default_margin_fixed'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN default_margin_fixed DECIMAL(10,2) DEFAULT 0;
    COMMENT ON COLUMN price_lists.default_margin_fixed IS 'Margine fisso di default (€) se nessuna regola matcha';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.default_margin_fixed';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.default_margin_fixed già esistente';
  END IF;
END $$;

-- Campo parent_version_id per versionamento
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'parent_version_id'
  ) THEN
    -- Aggiungi colonna senza foreign key prima
    ALTER TABLE price_lists ADD COLUMN parent_version_id UUID;
    
    -- Aggiungi foreign key self-referencing dopo
    ALTER TABLE price_lists 
    ADD CONSTRAINT fk_price_lists_parent_version 
    FOREIGN KEY (parent_version_id) 
    REFERENCES price_lists(id) 
    ON DELETE SET NULL;
    
    COMMENT ON COLUMN price_lists.parent_version_id IS 'ID versione precedente (per storico versioni)';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.parent_version_id';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.parent_version_id già esistente';
  END IF;
END $$;

-- Campi statistiche
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN usage_count INTEGER DEFAULT 0;
    COMMENT ON COLUMN price_lists.usage_count IS 'Numero di volte che il listino è stato utilizzato';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.usage_count';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.usage_count già esistente';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'last_used_at'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN last_used_at TIMESTAMPTZ;
    COMMENT ON COLUMN price_lists.last_used_at IS 'Data/ora ultimo utilizzo del listino';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.last_used_at';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.last_used_at già esistente';
  END IF;
END $$;

-- Campo description
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'description'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN description TEXT;
    COMMENT ON COLUMN price_lists.description IS 'Descrizione dettagliata del listino';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.description';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.description già esistente';
  END IF;
END $$;

-- Campo source_file_name
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'source_file_name'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN source_file_name TEXT;
    COMMENT ON COLUMN price_lists.source_file_name IS 'Nome file originale caricato';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.source_file_name';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.source_file_name già esistente';
  END IF;
END $$;

-- Campo source_metadata (JSONB)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'price_lists' AND column_name = 'source_metadata'
  ) THEN
    ALTER TABLE price_lists ADD COLUMN source_metadata JSONB;
    COMMENT ON COLUMN price_lists.source_metadata IS 'Metadati file sorgente (dimensioni, tipo, OCR confidence, ecc.)';
    RAISE NOTICE '✅ Aggiunto campo: price_lists.source_metadata';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.source_metadata già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 4: Funzione per ottenere listino applicabile
-- ============================================

CREATE OR REPLACE FUNCTION get_applicable_price_list(
  p_user_id UUID,
  p_courier_id UUID DEFAULT NULL,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  priority TEXT,
  rules JSONB,
  default_margin_percent DECIMAL,
  default_margin_fixed DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH user_listins AS (
    -- 1. Listino assegnato direttamente all'utente (priorità massima)
    SELECT pl.*, 100 as match_score
    FROM price_lists pl
    WHERE pl.assigned_to_user_id = p_user_id
      AND pl.status = 'active'
      AND (pl.valid_from IS NULL OR pl.valid_from <= p_date)
      AND (pl.valid_until IS NULL OR pl.valid_until >= p_date)
      AND (p_courier_id IS NULL OR pl.courier_id = p_courier_id OR pl.courier_id IS NULL)
    
    UNION ALL
    
    -- 2. Listino globale (admin) con priorità alta
    SELECT pl.*, 50 as match_score
    FROM price_lists pl
    WHERE pl.is_global = true
      AND pl.status = 'active'
      AND (pl.valid_from IS NULL OR pl.valid_from <= p_date)
      AND (pl.valid_until IS NULL OR pl.valid_until >= p_date)
      AND (p_courier_id IS NULL OR pl.courier_id = p_courier_id OR pl.courier_id IS NULL)
    
    UNION ALL
    
    -- 3. Listino di default (priorità bassa)
    SELECT pl.*, 10 as match_score
    FROM price_lists pl
    WHERE pl.priority = 'default'
      AND pl.status = 'active'
      AND (pl.valid_from IS NULL OR pl.valid_from <= p_date)
      AND (pl.valid_until IS NULL OR pl.valid_until >= p_date)
      AND (p_courier_id IS NULL OR pl.courier_id = p_courier_id OR pl.courier_id IS NULL)
  )
  SELECT 
    ul.id,
    ul.name,
    ul.priority,
    COALESCE(ul.rules, '[]'::jsonb) as rules,
    COALESCE(ul.default_margin_percent, 0) as default_margin_percent,
    COALESCE(ul.default_margin_fixed, 0) as default_margin_fixed
  FROM user_listins ul
  ORDER BY 
    ul.match_score DESC,
    ul.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_applicable_price_list IS 'Ottiene il listino prezzi applicabile per un utente, considerando gerarchia e priorità';

-- ============================================
-- STEP 5: Trigger per aggiornare statistiche listino
-- ============================================

CREATE OR REPLACE FUNCTION update_price_list_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.price_list_id IS NOT NULL AND (OLD.price_list_id IS NULL OR OLD.price_list_id != NEW.price_list_id) THEN
    UPDATE price_lists
    SET 
      usage_count = COALESCE(usage_count, 0) + 1,
      last_used_at = NOW()
    WHERE id = NEW.price_list_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_price_list_usage ON shipments;
CREATE TRIGGER trigger_update_price_list_usage
  AFTER INSERT OR UPDATE OF price_list_id ON shipments
  FOR EACH ROW
  WHEN (NEW.price_list_id IS NOT NULL)
  EXECUTE FUNCTION update_price_list_usage();

COMMENT ON FUNCTION update_price_list_usage IS 'Aggiorna statistiche utilizzo listino quando viene assegnato a una spedizione';

-- ============================================
-- STEP 6: RLS Policies aggiornate per price_lists
-- ============================================

-- Rimuovi policy esistenti se presenti
DROP POLICY IF EXISTS price_lists_select ON price_lists;
DROP POLICY IF EXISTS price_lists_insert ON price_lists;
DROP POLICY IF EXISTS price_lists_update ON price_lists;
DROP POLICY IF EXISTS price_lists_delete ON price_lists;

-- Policy SELECT: Admin vede tutto, utenti vedono listini globali o assegnati
CREATE POLICY price_lists_select ON price_lists
  FOR SELECT USING (
    -- Super Admin vede tutto
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type = 'superadmin'
    )
    OR
    -- Listini globali visibili a tutti
    is_global = true
    OR
    -- Listini assegnati all'utente
    assigned_to_user_id = auth.uid()::text::uuid
    OR
    -- Listini creati dall'utente
    created_by = auth.uid()::text::uuid
    OR
    -- Listini di default
    priority = 'default'
  );

-- Policy INSERT: Solo admin o utenti che creano listini per se stessi
CREATE POLICY price_lists_insert ON price_lists
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND (users.account_type IN ('admin', 'superadmin') OR users.is_reseller = true)
    )
    OR
    -- Utente può creare listino per se stesso
    (assigned_to_user_id = auth.uid()::text::uuid AND is_global = false)
  );

-- Policy UPDATE: Solo admin o proprietario
CREATE POLICY price_lists_update ON price_lists
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    created_by = auth.uid()::text::uuid
    OR
    assigned_to_user_id = auth.uid()::text::uuid
  );

-- Policy DELETE: Solo admin o proprietario
CREATE POLICY price_lists_delete ON price_lists
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid()::text::uuid 
      AND users.account_type IN ('admin', 'superadmin')
    )
    OR
    created_by = auth.uid()::text::uuid
  );

COMMENT ON POLICY price_lists_select ON price_lists IS 'RLS: Admin vede tutto, utenti vedono listini globali o assegnati';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: Sistema Avanzato Listini Prezzi';
  RAISE NOTICE '   - Aggiunto price_list_id a shipments';
  RAISE NOTICE '   - Aggiunto assigned_price_list_id a users';
  RAISE NOTICE '   - Esteso price_lists con rules, priority, gerarchia';
  RAISE NOTICE '   - Creata funzione get_applicable_price_list';
  RAISE NOTICE '   - Aggiornate RLS policies';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ PROSSIMI PASSI:';
  RAISE NOTICE '   1. Implementa logica calcolo prezzi con PriceRule';
  RAISE NOTICE '   2. Crea dashboard gestione listini';
  RAISE NOTICE '   3. Implementa caricamento CSV/Excel/PDF/OCR';
END $$;
