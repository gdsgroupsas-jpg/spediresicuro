/**
 * GDPR Privacy Policies - RLS per Anonimizzazione e Export Dati
 * 
 * Questo script aggiunge le policy RLS necessarie per:
 * - Permettere agli utenti di esportare i propri dati
 * - Permettere l'anonimizzazione account (tramite service role)
 * 
 * ⚠️ NOTA: Le operazioni di anonimizzazione vengono eseguite tramite 
 * supabaseAdmin (service role) che bypassa RLS, quindi queste policy 
 * sono principalmente per operazioni client-side e documentazione.
 */

-- ============================================
-- POLICY: Users - Update per Anonimizzazione
-- ============================================

-- Verifica se esiste già una policy UPDATE per users
-- Se non esiste, creala per permettere agli utenti di aggiornare i propri dati
DO $$
BEGIN
  -- Verifica se esiste già una policy UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'users_update_own'
  ) THEN
    -- Policy per permettere agli utenti di aggiornare i propri dati
    CREATE POLICY users_update_own ON users
      FOR UPDATE
      USING (
        -- Utente può aggiornare solo se stesso (tramite email match)
        auth.email() = email
        OR
        -- Admin può aggiornare tutti
        EXISTS (
          SELECT 1 FROM users 
          WHERE email = auth.email() 
          AND role = 'admin'
        )
      )
      WITH CHECK (
        -- Stesse condizioni per WITH CHECK
        auth.email() = email
        OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE email = auth.email() 
          AND role = 'admin'
        )
      );
    
    RAISE NOTICE 'Policy users_update_own creata con successo';
  ELSE
    RAISE NOTICE 'Policy users_update_own già esistente';
  END IF;
END $$;

-- ============================================
-- POLICY: Shipments - Update per Anonimizzazione
-- ============================================

-- Verifica se esiste già una policy UPDATE per shipments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'shipments' 
    AND policyname = 'shipments_update_own'
  ) THEN
    -- Policy per permettere agli utenti di aggiornare le proprie spedizioni
    CREATE POLICY shipments_update_own ON shipments
      FOR UPDATE
      USING (
        -- Utente può aggiornare solo le proprie spedizioni
        user_id::text = (
          SELECT id::text FROM users 
          WHERE email = auth.email()
        )
        OR
        -- Admin può aggiornare tutte le spedizioni
        EXISTS (
          SELECT 1 FROM users 
          WHERE email = auth.email() 
          AND role = 'admin'
        )
      )
      WITH CHECK (
        -- Stesse condizioni per WITH CHECK
        user_id::text = (
          SELECT id::text FROM users 
          WHERE email = auth.email()
        )
        OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE email = auth.email() 
          AND role = 'admin'
        )
      );
    
    RAISE NOTICE 'Policy shipments_update_own creata con successo';
  ELSE
    RAISE NOTICE 'Policy shipments_update_own già esistente';
  END IF;
END $$;

-- ============================================
-- FUNZIONE: Verifica Permessi Anonimizzazione
-- ============================================

-- Funzione helper per verificare se un utente può anonimizzare un account
-- (Utile per validazioni lato server)
CREATE OR REPLACE FUNCTION can_anonymize_user(
  p_user_email TEXT,
  p_requester_email TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_requester_role TEXT;
BEGIN
  -- Verifica ruolo del richiedente
  SELECT role INTO v_requester_role
  FROM users
  WHERE email = p_requester_email;
  
  -- Solo admin o l'utente stesso può richiedere anonimizzazione
  IF v_requester_role = 'admin' OR p_requester_email = p_user_email THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commento funzione
COMMENT ON FUNCTION can_anonymize_user IS 
  'Verifica se un utente può richiedere l''anonimizzazione di un account. 
   Solo admin o l''utente stesso possono richiedere.';

-- ============================================
-- FUNZIONE: Anonimizza Utente (Solo Admin/Service Role)
-- ============================================

-- ⚠️ ATTENZIONE: Questa funzione deve essere chiamata SOLO tramite service role
-- o da utenti admin. Non esporre mai questa funzione direttamente al client.
CREATE OR REPLACE FUNCTION anonymize_user_account(
  p_user_id UUID,
  p_deletion_uuid UUID DEFAULT gen_random_uuid()
)
RETURNS BOOLEAN AS $$
DECLARE
  v_anonymized_email TEXT;
  v_anonymized_name TEXT;
BEGIN
  -- Genera email e nome anonimizzati
  v_anonymized_email := 'deleted_' || p_deletion_uuid || '@void.com';
  v_anonymized_name := 'Utente Eliminato';
  
  -- Anonimizza profilo utente
  UPDATE users
  SET
    email = v_anonymized_email,
    name = v_anonymized_name,
    password = NULL,
    phone = NULL,
    company_name = NULL,
    vat_number = NULL,
    image = NULL,
    dati_cliente = NULL,
    default_sender = NULL,
    integrazioni = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Anonimizza spedizioni (mantiene dati non personali)
  UPDATE shipments
  SET
    sender_name = '[Anonimizzato]',
    sender_address = NULL,
    sender_city = NULL,
    sender_zip = NULL,
    sender_province = NULL,
    sender_phone = NULL,
    sender_email = NULL,
    sender_reference = NULL,
    recipient_name = '[Anonimizzato]',
    recipient_address = NULL,
    recipient_city = NULL,
    recipient_zip = NULL,
    recipient_province = NULL,
    recipient_phone = NULL,
    recipient_email = NULL,
    recipient_notes = NULL,
    recipient_reference = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Errore durante anonimizzazione: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commento funzione
COMMENT ON FUNCTION anonymize_user_account IS 
  'Anonimizza un account utente e le relative spedizioni. 
   ⚠️ USARE SOLO TRAMITE SERVICE ROLE O ADMIN. 
   Mantiene dati non personali (peso, prezzi, tracking) per obblighi fiscali.';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- La funzione anonymize_user_account deve essere eseguibile solo da service role
-- (che ha già tutti i permessi necessari)
-- Non concediamo permessi espliciti per sicurezza

-- ============================================
-- VERIFICA FINALE
-- ============================================

-- Verifica che le policy siano state create correttamente
DO $$
DECLARE
  v_users_policy_count INTEGER;
  v_shipments_policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_users_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
  AND tablename = 'users'
  AND policyname LIKE '%update%';
  
  SELECT COUNT(*) INTO v_shipments_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
  AND tablename = 'shipments'
  AND policyname LIKE '%update%';
  
  RAISE NOTICE 'Policy UPDATE users: %', v_users_policy_count;
  RAISE NOTICE 'Policy UPDATE shipments: %', v_shipments_policy_count;
  RAISE NOTICE 'Funzione can_anonymize_user: creata';
  RAISE NOTICE 'Funzione anonymize_user_account: creata';
  RAISE NOTICE '✅ Migration completata con successo!';
END $$;

