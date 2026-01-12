-- ============================================
-- TEST P0.1: KILL-SWITCHES VERIFICATION
-- SpedireSicuro - Security Audit Test Suite
-- ============================================
-- 
-- SCOPO: Verificare che i kill-switches siano configurati 
--        correttamente (fail-closed by default).
--
-- KILL-SWITCHES:
--   1. ALLOW_SUPERADMIN_WALLET_BYPASS = false (fail-closed)
--   2. ENABLE_OCR_VISION = true (default enabled, opt-out)
--
-- ⚠️ ATTENZIONE:
--   - NON cambiare i valori in produzione
--   - NON testare il bypass wallet in produzione
--   - Questi test sono principalmente di VERIFICA, non modifica
--
-- ============================================

-- ============================================
-- STEP 0: INTRO
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 ============================================';
  RAISE NOTICE '   TEST P0.1: KILL-SWITCHES VERIFICATION';
  RAISE NOTICE '   ============================================';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: I kill-switches sono env vars, non DB';
  RAISE NOTICE '   Questa query verifica:';
  RAISE NOTICE '   1. Tabella security_events esiste';
  RAISE NOTICE '   2. Eventi di bypass loggati (se presenti)';
  RAISE NOTICE '   3. Configurazione attesa documentata';
  RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 1: VERIFICA security_events TABLE
-- ============================================
SELECT 
  'CHECK 1: security_events table' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'security_events'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Creare tabella security_events!'
  END AS status;

-- Se esiste, mostra struttura
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events') THEN
    RAISE NOTICE '';
    RAISE NOTICE '📋 Struttura security_events:';
  END IF;
END $$;

SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'security_events'
ORDER BY ordinal_position;

-- ============================================
-- STEP 2: VERIFICA SECURITY EVENTS LOGGATI
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 CHECK 2: Eventi di sicurezza (ultimi 7 giorni)';
END $$;

-- Query che funziona solo se la tabella esiste
DO $$
DECLARE
  v_total_events INTEGER := 0;
  v_bypass_events INTEGER := 0;
  v_ocr_events INTEGER := 0;
BEGIN
  -- Conta eventi totali
  BEGIN
    SELECT COUNT(*) INTO v_total_events
    FROM security_events
    WHERE created_at > NOW() - INTERVAL '7 days';
    
    RAISE NOTICE '  📍 Eventi totali (7 giorni): %', v_total_events;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE '  ❌ Tabella security_events non esiste';
      RETURN;
  END;
  
  -- Conta eventi wallet bypass
  BEGIN
    SELECT COUNT(*) INTO v_bypass_events
    FROM security_events
    WHERE event_type LIKE '%wallet%bypass%'
    AND created_at > NOW() - INTERVAL '7 days';
    
    RAISE NOTICE '  📍 Eventi wallet bypass: %', v_bypass_events;
    
    IF v_bypass_events > 0 THEN
      RAISE NOTICE '  ⚠️ ATTENZIONE: Rilevati tentativi di wallet bypass!';
    ELSE
      RAISE NOTICE '  ✅ Nessun tentativo di wallet bypass';
    END IF;
  EXCEPTION
    WHEN undefined_column THEN
      RAISE NOTICE '  ⚠️ Colonna event_type non trovata';
  END;
  
  -- Conta eventi OCR
  BEGIN
    SELECT COUNT(*) INTO v_ocr_events
    FROM security_events
    WHERE event_type LIKE '%ocr%'
    AND created_at > NOW() - INTERVAL '7 days';
    
    RAISE NOTICE '  📍 Eventi OCR: %', v_ocr_events;
  EXCEPTION
    WHEN undefined_column THEN
      RAISE NOTICE '  ⚠️ Colonna event_type non trovata';
  END;
END $$;

-- Mostra ultimi eventi di sicurezza (se esistono)
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 Ultimi 10 eventi di sicurezza:';
END $$;

SELECT 
  id,
  event_type,
  user_id,
  details,
  created_at
FROM security_events
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- STEP 3: VERIFICA CONFIGURAZIONE ENV VARS
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 CHECK 3: CONFIGURAZIONE KILL-SWITCHES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ I kill-switches sono ENV VARS, non colonne DB!';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 CONFIGURAZIONE RICHIESTA:';
  RAISE NOTICE '';
  RAISE NOTICE '  1. ALLOW_SUPERADMIN_WALLET_BYPASS';
  RAISE NOTICE '     Valore richiesto: false (fail-closed)';
  RAISE NOTICE '     Effetto: Superadmin NON può bypassare limiti wallet';
  RAISE NOTICE '     Rischio se true: Superadmin potrebbe addebitare oltre il limite';
  RAISE NOTICE '';
  RAISE NOTICE '  2. ENABLE_OCR_VISION (o ENABLE_OCR_IMAGES)';
  RAISE NOTICE '     Valore richiesto: true (default enabled)';
  RAISE NOTICE '     Effetto: OCR immagini attivo';
  RAISE NOTICE '     Rischio se false: Feature OCR disabilitata';
  RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 4: PROCEDURA DI VERIFICA ENV VARS
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 PROCEDURA VERIFICA PRODUZIONE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 VERIFICA VERCEL (produzione):';
  RAISE NOTICE '   1. Vai su: https://vercel.com/[tuo-progetto]/settings/environment-variables';
  RAISE NOTICE '   2. Cerca: ALLOW_SUPERADMIN_WALLET_BYPASS';
  RAISE NOTICE '   3. Verifica che sia: false (o non presente = default false)';
  RAISE NOTICE '   4. Cerca: ENABLE_OCR_IMAGES';
  RAISE NOTICE '   5. Verifica che sia: true';
  RAISE NOTICE '';
  RAISE NOTICE '📋 VERIFICA LOCALE (.env.local):';
  RAISE NOTICE '   Esegui nel terminale:';
  RAISE NOTICE '   $ grep -E "ALLOW_SUPERADMIN|ENABLE_OCR" .env.local';
  RAISE NOTICE '';
  RAISE NOTICE '📋 VERIFICA RUNTIME (logs Next.js):';
  RAISE NOTICE '   In lib/config.ts o lib/security/, verifica che:';
  RAISE NOTICE '   - ocrConfig.ENABLE_OCR_IMAGES legga correttamente env';
  RAISE NOTICE '   - walletConfig.ALLOW_SUPERADMIN_BYPASS sia false';
  RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 5: TEST STAGING (NON PRODUZIONE!)
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🧪 PROCEDURA TEST STAGING';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ ESEGUI SOLO IN STAGING, MAI IN PRODUZIONE!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 TEST KILL-SWITCH WALLET BYPASS:';
  RAISE NOTICE '   1. In staging, imposta ALLOW_SUPERADMIN_WALLET_BYPASS=false';
  RAISE NOTICE '   2. Accedi come superadmin';
  RAISE NOTICE '   3. Prova a fare operazione wallet oltre limite';
  RAISE NOTICE '   4. Verifica che venga BLOCCATO';
  RAISE NOTICE '   5. Verifica che evento sia loggato in security_events';
  RAISE NOTICE '';
  RAISE NOTICE '📋 TEST KILL-SWITCH OCR:';
  RAISE NOTICE '   1. In staging, imposta ENABLE_OCR_IMAGES=false';
  RAISE NOTICE '   2. Prova a caricare immagine per OCR';
  RAISE NOTICE '   3. Verifica che venga mostrato messaggio "OCR disabilitato"';
  RAISE NOTICE '   4. Ripristina ENABLE_OCR_IMAGES=true';
  RAISE NOTICE '';
END $$;

-- ============================================
-- STEP 6: VERIFICA TABELLE CORRELATE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 CHECK 4: Tabelle correlate ai kill-switches';
END $$;

SELECT 
  'audit_logs table' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs')
    THEN '✅ PRESENTE'
    ELSE '⚠️ NON TROVATA'
  END AS status;

SELECT 
  'financial_audit_log table' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_audit_log')
    THEN '✅ PRESENTE'
    ELSE '⚠️ NON TROVATA'
  END AS status;

SELECT 
  'wallet_transactions table' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wallet_transactions')
    THEN '✅ PRESENTE'
    ELSE '⚠️ NON TROVATA'
  END AS status;

-- ============================================
-- STEP 7: RIEPILOGO
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 RIEPILOGO VERIFICA P0.1 KILL-SWITCHES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Questa query ha verificato:';
  RAISE NOTICE '  ✓ Esistenza tabella security_events';
  RAISE NOTICE '  ✓ Eventi di bypass loggati';
  RAISE NOTICE '  ✓ Tabelle audit correlate';
  RAISE NOTICE '';
  RAISE NOTICE 'Per completare la verifica:';
  RAISE NOTICE '  □ Verifica env vars su Vercel';
  RAISE NOTICE '  □ Test manuale in staging';
  RAISE NOTICE '  □ Documenta risultati';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   TEST P0.1 COMPLETATO (partial)';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- COMANDI BASH PER VERIFICA (copia e incolla)
-- ============================================
/*
📋 COMANDI BASH DA ESEGUIRE:

# 1. Verifica .env.local (locale)
grep -E "ALLOW_SUPERADMIN|ENABLE_OCR" .env.local

# 2. Verifica Vercel (richiede vercel CLI)
vercel env ls | grep -E "ALLOW_SUPERADMIN|ENABLE_OCR"

# 3. Alternativa: verifica tramite Vercel Dashboard
# https://vercel.com/[tuo-progetto]/settings/environment-variables

# 4. Test kill-switch OCR (locale)
ENABLE_OCR_IMAGES=false npm run dev
# → Verifica che OCR sia disabilitato nella UI

# 5. Test kill-switch Wallet (SOLO STAGING!)
# ALLOW_SUPERADMIN_WALLET_BYPASS=true npm run dev
# → Prova bypass wallet, verifica log in security_events
# ⚠️ MAI IN PRODUZIONE!

📋 EXPECTED OUTPUT:
ALLOW_SUPERADMIN_WALLET_BYPASS=false
ENABLE_OCR_IMAGES=true

Se mancano, aggiungi a .env:
echo "ALLOW_SUPERADMIN_WALLET_BYPASS=false" >> .env.local
echo "ENABLE_OCR_IMAGES=true" >> .env.local
*/
