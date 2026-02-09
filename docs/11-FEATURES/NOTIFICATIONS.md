# Notifiche Intelligenti Tracking

## Overview

Sistema di notifiche "smart, non spammy" per eventi tracking. Notifica solo eventi significativi (consegna, giacenza, in consegna), con deduplicazione e supporto multi-canale.

**Principio:** L'utente riceve notifiche SOLO quando serve davvero. Mai spam.

## Target Audience

- [x] Developers
- [ ] DevOps
- [x] Business/PM
- [x] AI Agents

---

## Regole di Notifica

| Evento Webhook       | Status Normalizzato | Tipo Notifica               | Canali              | Priorita |
| -------------------- | ------------------- | --------------------------- | ------------------- | -------- |
| `tracking.delivered` | `delivered`         | `shipment_delivered`        | in_app, push        | Alta     |
| `tracking.exception` | `in_giacenza`       | `giacenza_detected`         | in_app, push, email | Critica  |
| —                    | `exception`         | `delivery_failed`           | in_app, push, email | Critica  |
| —                    | `out_for_delivery`  | `tracking_out_for_delivery` | in_app, push        | Media    |
| `tracking.updated`   | `in_transit`        | **NESSUNA**                 | —                   | —        |
| `tracking.updated`   | `created`           | **NESSUNA**                 | —                   | —        |
| `tracking.updated`   | `picked_up`         | **NESSUNA**                 | —                   | —        |

> **Perche no in_transit?** Troppo frequente (ogni hub di smistamento). Genererebbe spam.

---

## Deduplicazione

Nessun duplicato per la stessa combinazione `(user_id, type, shipment_id)` entro **1 ora**.

```sql
-- Query di verifica
SELECT id FROM support_notifications
WHERE user_id = :user_id
  AND type = :type
  AND shipment_id = :shipment_id
  AND created_at >= NOW() - INTERVAL '1 hour'
LIMIT 1;
```

---

## Canali

### In-App (sempre attivo)

Notifica salvata in `support_notifications`. Visibile nel `NotificationBell`.

### Email (solo per critici)

Inviata solo per `giacenza_detected` e `delivery_failed`, e solo se l'utente ha attivato il canale email nelle preferenze.

**Template email:**

- Header colorato per tipo (verde=consegna, ambra=giacenza, rosso=eccezione)
- Card con tracking number monospace + corriere
- Pulsante "Vai alla Dashboard"
- Design responsive

**File:** `lib/services/tracking/notification-dispatcher.ts` → `trackingNotificationEmailHtml()`

### Push / SMS / WhatsApp (futuro)

Predisposto ma non ancora implementato.

---

## Notifiche Reseller

Quando una spedizione appartiene a un **child workspace** (cliente di un reseller), il sistema notifica anche l'**owner del parent workspace** (il reseller).

**Regole:**

- Solo per `giacenza_detected` e `delivery_failed` (evita spam al reseller)
- Prefisso `[Cliente]` nel messaggio
- Metadata `is_reseller_alert: true` per distinguere nell'UI

**Flusso:**

```
Spedizione in giacenza (workspace cliente)
    ↓
1. Notifica al proprietario della spedizione (cliente)
    ↓
2. Lookup workspace.parent_workspace_id
    ↓
3. Lookup workspace_members.role = 'owner' del parent
    ↓
4. Notifica al reseller con prefisso [Cliente]
```

---

## Implementazione

### File Principale

`lib/services/tracking/notification-dispatcher.ts`

### Funzioni Esportate

```typescript
// Dispatch non-bloccante — chiamato con .catch() dal webhook handler
export async function dispatchTrackingNotification(
  payload: SpedisciWebhookPayload,
  shipmentId: string
): Promise<void>;
```

### Dipendenze

- `normalizeStatus()` da `tracking-service.ts`
- `sendEmail()` da `lib/email/resend.ts` (import dinamico)
- Tabella `support_notifications` per persistenza
- Tabella `anne_user_memory` per preferenze canali utente
- Tabella `workspace_members` per lookup reseller parent

---

## NotificationBell

**File:** `components/anne/NotificationBell.tsx`

Campanella nella top bar con:

- Polling ogni 30 secondi
- Contatore notifiche non lette (badge rosso)
- Click per espandere lista
- Custom event listener per aggiornamenti immediati
- Notifiche tracking con icone e colori per stato

---

## Tipi Notifica in DB

La tabella `support_notifications` supporta i seguenti tipi tracking:

- `shipment_delivered`
- `giacenza_detected`
- `delivery_failed`
- `tracking_out_for_delivery`

---

## Test Coverage

| File                                         | Descrizione                             | N. Test |
| -------------------------------------------- | --------------------------------------- | ------- |
| `tests/unit/notification-dispatcher.test.ts` | Regole, deduplicazione, reseller parent | TBD     |

---

## Related Documentation

- [Tracking Real-Time](TRACKING.md) — Sistema tracking completo
- [Webhooks API](../3-API/WEBHOOKS.md) — Webhook Spedisci.Online

---

## Changelog

| Data       | Versione | Descrizione                                                                               |
| ---------- | -------- | ----------------------------------------------------------------------------------------- |
| 2026-02-08 | 1.0.0    | Notification dispatcher, regole smart, deduplicazione, reseller alerts, email per critici |

---

_Last Updated: 2026-02-09_
_Status: Active_
_Maintainer: Dev Team_
