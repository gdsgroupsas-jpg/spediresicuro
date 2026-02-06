-- ============================================
-- Fix inviti con status 'cancelled' invalido
-- ============================================
-- Bug: l'API DELETE usava status='cancelled' ma il CHECK
-- constraint accetta solo: pending, accepted, expired, revoked.
-- Questo fix corregge eventuali record rimasti bloccati.
-- ============================================

-- Prima rimuoviamo temporaneamente il CHECK per poter aggiornare
ALTER TABLE public.workspace_invitations DROP CONSTRAINT IF EXISTS workspace_invitations_status_check;

-- Aggiorna eventuali record con status invalido
UPDATE public.workspace_invitations
SET status = 'revoked'
WHERE status = 'cancelled';

-- Ricrea il CHECK constraint
ALTER TABLE public.workspace_invitations
ADD CONSTRAINT workspace_invitations_status_check
CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));
