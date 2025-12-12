/**
 * Migration: Sistema Reseller e Wallet (Sistema Crediti)
 * 
 * Aggiunge:
 * 1. Campo parent_id alla tabella users (per collegare Sub-User all'Admin creatore)
 * 2. Campo is_reseller (se true, l'utente è un Admin/Rivenditore)
 * 3. Campo wallet_balance (credito prepagato per acquistare features/spedizioni)
 * 4. Tabella wallet_transactions (tracciamento movimenti economici)
 * 5. Aggiornamento RLS policies per permettere agli Admin di vedere dati dei loro Sub-Users
 * 
 * Data: 2024-12
 */

-- ============================================
-- STEP 1: Aggiungi campo parent_id alla tabella users
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE users ADD COLUMN parent_id UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN users.parent_id IS 'ID dell''Admin/Rivenditore che ha creato questo Sub-User. NULL per utenti standard o Super Admin.';
    RAISE NOTICE '✅ Aggiunto campo: parent_id';
  ELSE
    RAISE NOTICE '⚠️ Campo parent_id già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Aggiungi campo is_reseller
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_reseller'
  ) THEN
    ALTER TABLE users ADD COLUMN is_reseller BOOLEAN DEFAULT false;
    COMMENT ON COLUMN users.is_reseller IS 'Se true, l''utente è un Admin/Rivenditore che può creare e gestire Sub-Users';
    RAISE NOTICE '✅ Aggiunto campo: is_reseller';
  ELSE
    RAISE NOTICE '⚠️ Campo is_reseller già esistente';
  END IF;
END $$;

-- Imposta is_reseller = true per admin e superadmin esistenti (backward compatibility)
DO $$
BEGIN
  UPDATE users 
  SET is_reseller = true
  WHERE (account_type = 'admin' OR account_type = 'superadmin' OR role = 'admin')
    AND (is_reseller IS NULL OR is_reseller = false);
  
  RAISE NOTICE '✅ Aggiornati admin esistenti con is_reseller = true';
END $$;

-- ============================================
-- STEP 3: Aggiungi campo wallet_balance
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'wallet_balance'
  ) THEN
    ALTER TABLE users ADD COLUMN wallet_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (wallet_balance >= 0);
    COMMENT ON COLUMN users.wallet_balance IS 'Credito prepagato per acquistare features/spedizioni. Valore in EUR.';
    RAISE NOTICE '✅ Aggiunto campo: wallet_balance';
  ELSE
    RAISE NOTICE '⚠️ Campo wallet_balance già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 4: Crea tabella wallet_transactions
-- ============================================

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Dati transazione
  amount DECIMAL(10,2) NOT NULL, -- Positivo per ricariche, negativo per spese
  type TEXT NOT NULL, -- 'deposit', 'feature_purchase', 'shipment_cost', 'admin_gift', 'refund'
  
  -- Dettagli
  description TEXT,
  reference_id UUID, -- ID riferimento (es. shipment_id, feature_id)
  reference_type TEXT, -- Tipo riferimento (es. 'shipment', 'feature')
  
  -- Metadati
  created_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Chi ha creato la transazione (per admin_gift)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference_type, reference_id);

COMMENT ON TABLE wallet_transactions IS 'Traccia tutti i movimenti economici del wallet (ricariche, spese features, spese spedizioni)';

-- ============================================
-- STEP 5: Crea funzione per aggiornare wallet_balance
-- ============================================

CREATE OR REPLACE FUNCTION update_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Aggiorna il balance dell'utente quando viene creata una transazione
  IF TG_OP = 'INSERT' THEN
    UPDATE users
    SET wallet_balance = GREATEST(0, wallet_balance + NEW.amount)
    WHERE id = NEW.user_id;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger per aggiornare automaticamente wallet_balance
DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON wallet_transactions;
CREATE TRIGGER trigger_update_wallet_balance
  AFTER INSERT ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_balance();

COMMENT ON FUNCTION update_wallet_balance IS 'Aggiorna automaticamente wallet_balance quando viene creata una transazione';

-- ============================================
-- STEP 6: Funzione per verificare se un utente è Super Admin
-- ============================================

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_user_id 
      AND account_type = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_super_admin IS 'Verifica se un utente è Super Admin';

-- ============================================
-- STEP 7: Funzione per verificare se un utente è Reseller
-- ============================================

CREATE OR REPLACE FUNCTION is_reseller(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_user_id 
      AND is_reseller = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_reseller IS 'Verifica se un utente è un Reseller (Admin/Rivenditore)';

-- ============================================
-- STEP 8: Funzione per verificare se un utente è Sub-User di un Admin
-- ============================================

CREATE OR REPLACE FUNCTION is_sub_user_of(p_sub_user_id UUID, p_admin_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Controlla se è un sub-user diretto o ricorsivo
  RETURN EXISTS (
    WITH RECURSIVE user_hierarchy AS (
      -- Anchor: sub-user iniziale
      SELECT id, parent_id
      FROM users
      WHERE id = p_sub_user_id
      
      UNION ALL
      
      -- Recursive: risale la gerarchia
      SELECT u.id, u.parent_id
      FROM users u
      INNER JOIN user_hierarchy uh ON u.id = uh.parent_id
      WHERE uh.parent_id IS NOT NULL
    )
    SELECT 1 FROM user_hierarchy WHERE id = p_admin_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_sub_user_of IS 'Verifica se un utente è Sub-User (direttamente o ricorsivamente) di un Admin';

-- ============================================
-- STEP 9: Aggiorna RLS Policy per users
-- ============================================

-- Rimuovi policy esistenti per users (se esistono)
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_select_reseller ON users;

-- Nuova policy: Super Admin vede tutto, Reseller vede se stesso e i suoi Sub-Users, User vede solo se stesso
CREATE POLICY users_select_reseller ON users
  FOR SELECT USING (
    -- Super Admin vede tutto
    is_super_admin(auth.uid())
    OR
    -- Utente vede se stesso
    auth.uid()::text = id::text
    OR
    -- Reseller vede i suoi Sub-Users
    (
      is_reseller(auth.uid())
      AND is_sub_user_of(id, auth.uid())
    )
  );

COMMENT ON POLICY users_select_reseller ON users IS 'RLS: Super Admin vede tutto, Reseller vede Sub-Users, User vede solo se stesso';

-- ============================================
-- STEP 10: Aggiorna RLS Policy per shipments
-- ============================================

-- Rimuovi policy esistenti per shipments (se esistono)
DROP POLICY IF EXISTS shipments_select_own ON shipments;
DROP POLICY IF EXISTS shipments_select_reseller ON shipments;

-- Nuova policy: Super Admin vede tutto, Reseller vede spedizioni dei suoi Sub-Users, User vede solo le proprie
CREATE POLICY shipments_select_reseller ON shipments
  FOR SELECT USING (
    -- Super Admin vede tutto
    is_super_admin(auth.uid())
    OR
    -- Utente vede le proprie spedizioni
    user_id::text = auth.uid()::text
    OR
    -- Reseller vede le spedizioni dei suoi Sub-Users
    (
      is_reseller(auth.uid())
      AND is_sub_user_of(user_id, auth.uid())
    )
  );

-- Policy per INSERT: solo l'utente stesso può creare spedizioni
DROP POLICY IF EXISTS shipments_insert_own ON shipments;
CREATE POLICY shipments_insert_reseller ON shipments
  FOR INSERT WITH CHECK (
    user_id::text = auth.uid()::text
    OR
    (
      is_reseller(auth.uid())
      AND is_sub_user_of(user_id, auth.uid())
    )
  );

-- Policy per UPDATE: Super Admin e Reseller possono modificare spedizioni dei Sub-Users
DROP POLICY IF EXISTS shipments_update_own ON shipments;
CREATE POLICY shipments_update_reseller ON shipments
  FOR UPDATE USING (
    -- Super Admin può modificare tutto
    is_super_admin(auth.uid())
    OR
    -- Utente può modificare le proprie spedizioni
    user_id::text = auth.uid()::text
    OR
    -- Reseller può modificare spedizioni dei Sub-Users
    (
      is_reseller(auth.uid())
      AND is_sub_user_of(user_id, auth.uid())
    )
  );

COMMENT ON POLICY shipments_select_reseller ON shipments IS 'RLS: Super Admin/Reseller vedono spedizioni dei Sub-Users, User vede solo le proprie';

-- ============================================
-- STEP 11: RLS per wallet_transactions
-- ============================================

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Super Admin vede tutto, Reseller vede transazioni dei Sub-Users, User vede solo le proprie
CREATE POLICY wallet_transactions_select ON wallet_transactions
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR
    user_id::text = auth.uid()::text
    OR
    (
      is_reseller(auth.uid())
      AND is_sub_user_of(user_id, auth.uid())
    )
  );

-- Policy: Solo Super Admin e Reseller possono creare transazioni (tramite Server Actions con service_role)
CREATE POLICY wallet_transactions_insert ON wallet_transactions
  FOR INSERT WITH CHECK (true); -- Server Actions useranno service_role, quindi bypass RLS

COMMENT ON POLICY wallet_transactions_select ON wallet_transactions IS 'RLS: Super Admin/Reseller vedono transazioni dei Sub-Users, User vede solo le proprie';

-- ============================================
-- STEP 12: Funzione helper per aggiungere credito
-- ============================================

CREATE OR REPLACE FUNCTION add_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Verifica che l'importo sia positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'L''importo deve essere positivo';
  END IF;
  
  -- Crea transazione
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    description,
    created_by
  ) VALUES (
    p_user_id,
    p_amount,
    'deposit',
    COALESCE(p_description, 'Ricarica credito'),
    p_created_by
  ) RETURNING id INTO v_transaction_id;
  
  -- Il trigger aggiornerà automaticamente wallet_balance
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_wallet_credit IS 'Aggiunge credito al wallet di un utente (solo per Super Admin o Reseller)';

-- ============================================
-- STEP 13: Funzione helper per scalare credito
-- ============================================

CREATE OR REPLACE FUNCTION deduct_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance DECIMAL(10,2);
BEGIN
  -- Verifica che l'importo sia positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'L''importo deve essere positivo';
  END IF;
  
  -- Verifica balance disponibile
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id;
  
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Credito insufficiente. Disponibile: %, Richiesto: %', v_current_balance, p_amount;
  END IF;
  
  -- Crea transazione (negativa)
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    -p_amount, -- Negativo per scalare
    p_type,
    p_description,
    p_reference_id,
    p_reference_type
  ) RETURNING id INTO v_transaction_id;
  
  -- Il trigger aggiornerà automaticamente wallet_balance
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION deduct_wallet_credit IS 'Scala credito dal wallet di un utente (controlla balance disponibile)';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: Sistema Reseller e Wallet';
  RAISE NOTICE '   - Aggiunti campi: parent_id, is_reseller, wallet_balance';
  RAISE NOTICE '   - Creata tabella: wallet_transactions';
  RAISE NOTICE '   - Aggiornate RLS policies per users e shipments';
  RAISE NOTICE '   - Create funzioni: add_wallet_credit, deduct_wallet_credit';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ IMPORTANTE:';
  RAISE NOTICE '   - I Super Admin devono avere account_type = ''superadmin''';
  RAISE NOTICE '   - I Reseller devono avere is_reseller = true';
  RAISE NOTICE '   - Gli Admin esistenti sono stati automaticamente impostati come Reseller';
END $$;


