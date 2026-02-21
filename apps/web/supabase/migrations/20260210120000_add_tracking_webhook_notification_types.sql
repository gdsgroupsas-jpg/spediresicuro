-- Aggiunge nuovi tipi notifica per webhook tracking Spedisci.Online
--
-- Tipi aggiunti:
-- - tracking_out_for_delivery: pacco in consegna oggi
-- - tracking_exception: problema generico tracking
--
-- I tipi esistenti (shipment_delivered, giacenza_detected, delivery_failed)
-- coprono gia' i casi principali webhook.

-- Drop e ricrea il CHECK constraint con i nuovi tipi
ALTER TABLE support_notifications
  DROP CONSTRAINT IF EXISTS support_notifications_type_check;

ALTER TABLE support_notifications
  ADD CONSTRAINT support_notifications_type_check
  CHECK (type IN (
    'giacenza_detected',           -- Spedizione in giacenza
    'tracking_stale',              -- Tracking non aggiornato >48h
    'delivery_failed',             -- Consegna fallita
    'hold_expiring',               -- Giacenza in scadenza
    'shipment_delivered',          -- Spedizione consegnata
    'refund_processed',            -- Rimborso processato
    'escalation_update',           -- Aggiornamento su escalation
    'tracking_out_for_delivery',   -- NUOVO: pacco in consegna oggi (webhook)
    'tracking_exception'           -- NUOVO: problema generico tracking (webhook)
  ));

COMMENT ON CONSTRAINT support_notifications_type_check ON support_notifications IS
  'Vincolo tipi notifica: include tipi originali + tipi webhook tracking (v2)';
