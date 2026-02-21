-- Seed: Automazioni iniziali
-- Tutte DISATTIVATE (enabled = false) — l'admin le attiva quando vuole.

INSERT INTO automations (slug, name, description, category, enabled, schedule, config, config_schema)
VALUES
  (
    'postpaid-monthly-billing',
    'Fatturazione Mensile Postpagato',
    'Genera fatture mensili per tutti gli utenti in modalità postpagato. Raccoglie le spedizioni POSTPAID_CHARGE del mese precedente e crea fattura con IVA 22%.',
    'billing',
    false,
    '0 2 1 * *',
    '{"dryRun": false, "notifyAdmin": true, "notifyWorkspaceOwner": true}',
    '{
      "type": "object",
      "properties": {
        "dryRun": {
          "type": "boolean",
          "title": "Modalità Test",
          "description": "Se attivo, simula la fatturazione senza creare fatture reali",
          "default": false
        },
        "notifyAdmin": {
          "type": "boolean",
          "title": "Notifica Admin",
          "description": "Invia email riepilogo all''admin dopo l''esecuzione",
          "default": true
        },
        "notifyWorkspaceOwner": {
          "type": "boolean",
          "title": "Notifica Proprietario",
          "description": "Invia email al proprietario del workspace con il dettaglio fattura",
          "default": true
        }
      }
    }'
  ),
  (
    'low-balance-alert',
    'Alert Saldo Basso',
    'Invia notifiche ai workspace il cui saldo wallet scende sotto la soglia configurata. Previene interruzioni di servizio.',
    'notifications',
    false,
    '0 9 * * *',
    '{"thresholdEur": 10, "notifyOwner": true, "notifyAdmin": false}',
    '{
      "type": "object",
      "properties": {
        "thresholdEur": {
          "type": "number",
          "title": "Soglia (EUR)",
          "description": "Saldo minimo sotto il quale inviare l''alert",
          "default": 10,
          "minimum": 1,
          "maximum": 1000
        },
        "notifyOwner": {
          "type": "boolean",
          "title": "Notifica Proprietario",
          "description": "Invia email al proprietario del workspace",
          "default": true
        },
        "notifyAdmin": {
          "type": "boolean",
          "title": "Notifica Admin",
          "description": "Invia riepilogo all''admin con tutti i workspace sotto soglia",
          "default": false
        }
      }
    }'
  )
ON CONFLICT (slug) DO NOTHING;
