-- =============================================================================
-- AUDIT REPORT: Price Lists Integrity Check
-- =============================================================================

-- 1. Verifica Assegnazioni Duplicate Attive
-- Obiettivo: Trovare utenti che hanno più assegnazioni attive per lo stesso listino (anomalia)
SELECT 'DUPLICATE_ASSIGNMENTS' as check_type, user_id, price_list_id, COUNT(*)
FROM price_list_assignments
WHERE revoked_at IS NULL
GROUP BY user_id, price_list_id
HAVING COUNT(*) > 1;

-- 2. Verifica Violazione Isolamento "Supplier" Price Lists
-- Obiettivo: Trovare listini 'supplier' creati da chi NON è reseller o BYOC
SELECT 'ISOLATION_VIOLATION' as check_type, pl.id, pl.name, u.email, u.account_type, u.is_reseller
FROM price_lists pl
JOIN users u ON pl.created_by = u.id
WHERE pl.list_type = 'supplier' 
  AND u.is_reseller = false 
  AND u.account_type != 'byoc'
  AND u.account_type != 'admin' -- Admin può creare per test
  AND u.account_type != 'superadmin';

-- 3. Verifica Listini Orfani (Creatore non esiste più)
SELECT 'ORPHAN_PRICE_LISTS' as check_type, pl.id, pl.name, pl.created_by
FROM price_lists pl
LEFT JOIN users u ON pl.created_by = u.id
WHERE u.id IS NULL;

-- 4. Verifica Correttezza master_list_id
-- Obiettivo: Assicurarsi che i cloni puntino a listini esistenti
SELECT 'BROKEN_MASTER_LINK' as check_type, pl.id, pl.name
FROM price_lists pl
LEFT JOIN price_lists m ON pl.master_list_id = m.id
WHERE pl.master_list_id IS NOT NULL AND m.id IS NULL;

-- 5. Verifica Anomalie RLS (Simulazione logica)
-- Controllo incrociato: Listini 'custom' non assegnati e non creati dall'utente target
-- Nota: Questa è una query euristica
SELECT 'POSSIBLE_UNASSIGNED_CUSTOM' as check_type, pl.id, pl.name, pl.assigned_to_user_id
FROM price_lists pl
WHERE pl.list_type = 'custom'
  AND pl.assigned_to_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM users WHERE id = pl.assigned_to_user_id
  );
