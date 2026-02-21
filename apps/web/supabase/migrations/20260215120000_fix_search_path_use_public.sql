-- HOTFIX: Corregge search_path da '' a 'public' su TUTTE le funzioni
--
-- La migration 20260215100000 ha settato search_path = '' su tutte le funzioni public.
-- Questo ha rotto 41+ funzioni che referenziano tabelle senza prefisso public.
-- (es. FROM users invece di FROM public.users)
--
-- Il linter Supabase richiede che search_path sia ESPLICITAMENTE settato,
-- ma 'public' e' valido quanto '' - con il vantaggio di non rompere le funzioni.
--
-- Funzioni critiche rotte da search_path = '':
-- - get_user_price_lists (listini reseller)
-- - decrement_wallet_balance / increment_wallet_balance (wallet)
-- - add_wallet_credit_with_vat (Stripe webhook)
-- - get_user_vat_mode / get_platform_fee_details (pagamenti)
-- - send_workspace_email / lookup_workspace_by_email (email)
-- - wms_update_stock_with_movement (WMS)
-- - Tutti i trigger di tracking, COD, hold spedizioni

DO $$
DECLARE
  func_record RECORD;
  alter_sql TEXT;
  fixed_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Inizio fix search_path: '''' -> ''public'' per tutte le funzioni public...';

  FOR func_record IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS func_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prokind = 'f'
  LOOP
    BEGIN
      IF func_record.func_args = '' THEN
        alter_sql := format(
          'ALTER FUNCTION public.%I() SET search_path = public',
          func_record.proname
        );
      ELSE
        alter_sql := format(
          'ALTER FUNCTION public.%I(%s) SET search_path = public',
          func_record.proname,
          func_record.func_args
        );
      END IF;

      EXECUTE alter_sql;
      fixed_count := fixed_count + 1;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Errore su %: %', func_record.proname, SQLERRM;
      error_count := error_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Fix completato: % funzioni corrette, % errori', fixed_count, error_count;
END;
$$;

-- ============================================================
-- QUERY DI VERIFICA (eseguire dopo la migration)
-- ============================================================

-- Verifica: nessuna funzione public con search_path vuoto ('')
-- SELECT proname, proconfig
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND p.prokind = 'f'
-- AND EXISTS (
--   SELECT 1 FROM unnest(proconfig) c
--   WHERE c LIKE 'search_path=%'
--   AND c NOT LIKE 'search_path=public%'
-- );
-- RISULTATO ATTESO: 0 righe (tutte le funzioni hanno search_path = public)
