# Tracking Real-Time

## Overview

Sistema di tracking spedizioni completo: sincronizzazione dati da Spedisci.Online API, aggiornamenti real-time via Supabase Realtime, notifiche intelligenti, e UI live con feedback aptico/sonoro.

**Principio:** Webhook inserisce in `tracking_events` → trigger PostgreSQL aggiorna `shipments` → Supabase Realtime broadcast → UI si aggiorna live.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

---

## Architettura

```
                    ┌─────────────────────┐
                    │  Spedisci.Online API │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐  ┌─────────────┐  ┌──────────┐
     │  Webhook   │  │  Cron Sync  │  │ On-Demand │
     │  (push)    │  │  (hourly)   │  │ (user)    │
     └─────┬──────┘  └──────┬──────┘  └─────┬────┘
           │                │               │
           └────────┬───────┴───────┬───────┘
                    ▼               │
           ┌───────────────┐       │
           │tracking_events│◄──────┘
           │  (DB table)   │
           └───────┬───────┘
                   │ trigger PostgreSQL
                   ▼
           ┌───────────────┐
           │  shipments    │ (tracking_status, delivered_at, ...)
           └───────┬───────┘
                   │ Supabase Realtime
                   ▼
           ┌───────────────┐
           │  UI Live      │ (toast, modal, progress bar)
           └───────────────┘
```

---

## Canali di Acquisizione Dati

### 1. Cron Sync (Produzione)

Sincronizzazione batch ogni ora via GitHub Actions.

**Endpoint:** `POST /api/cron/sync-tracking`

**File:**

- `app/api/cron/sync-tracking/route.ts` — API route
- `lib/services/tracking/tracking-service.ts` — Service con logica
- `.github/workflows/sync-tracking.yml` — Cron workflow

**Caratteristiche v2:**

- **5 worker paralleli** — 5x piu veloce del sync sequenziale
- **Batch upsert** — 1 sola chiamata DB per spedizione (non 1 per evento)
- **Retry con backoff esponenziale** — Per errori transient (500, timeout)
- **Error classification** — Permanent (404/400/403) vs Transient (500/network)
- **Metriche dettagliate** — SyncMetrics con 10 campi

**Configurazione (env vars):**

| Variabile                     | Default | Descrizione                   |
| ----------------------------- | ------- | ----------------------------- |
| `TRACKING_CACHE_TTL_MINUTES`  | 30      | TTL cache tracking            |
| `TRACKING_SYNC_MAX_AGE_HOURS` | 1       | Eta massima dati per sync     |
| `TRACKING_SYNC_BATCH_LIMIT`   | 300     | Max spedizioni per run        |
| `TRACKING_SYNC_DELAY_MS`      | 200     | Delay tra API call per worker |
| `TRACKING_SYNC_LOOKBACK_DAYS` | 30      | Finestra temporale            |
| `TRACKING_SYNC_CONCURRENCY`   | 5       | Worker paralleli              |
| `TRACKING_SYNC_MAX_RETRIES`   | 2       | Retry per errori transient    |

**Security:** Header `x-cron-secret` con `CRON_SECRET` env var. Se non configurato, endpoint disabilitato (503).

**SyncMetrics restituito:**

```typescript
interface SyncMetrics {
  synced: number; // Spedizioni sincronizzate con successo
  errors: number; // Totale errori
  skipped: number; // Saltate (cache fresca)
  totalShipments: number; // Totale spedizioni trovate
  totalEventsUpserted: number; // Totale eventi inseriti
  durationMs: number; // Durata totale
  avgApiCallMs: number; // Media tempo per chiamata API
  permanentErrors: number; // Errori permanenti (404, 400, 403)
  transientErrors: number; // Errori transient (500, timeout)
  retriesUsed: number; // Retry effettuati
}
```

### 2. Webhook (Push)

Ricezione istantanea di aggiornamenti tracking da Spedisci.Online.

> **Nota:** Richiede abbonamento Spedisci.Online con supporto webhook (24 EUR/mese). Il cron resta come fallback.

**Endpoint:** `POST /api/webhooks/spediscionline`

**File:**

- `app/api/webhooks/spediscionline/route.ts` — Route handler
- `lib/services/tracking/webhook-processor.ts` — Verifica firma + processing

**Vedi:** [Webhooks API - Spedisci.Online](../3-API/WEBHOOKS.md#spediscionline-webhooks)

### 3. On-Demand (Utente)

L'utente apre il TrackingModal → se dati stale (>30 min), fetch automatico dall'API.

**File:** `lib/services/tracking/tracking-service.ts` → `getTracking()`

---

## Normalizzazione Status

La funzione `normalizeStatus()` mappa i testi italiani dei corrieri agli stati normalizzati.

**File:** `lib/services/tracking/tracking-service.ts:95-127`

| Status Normalizzato | Esempi Input                                                                | Descrizione                    |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------ |
| `delivered`         | "Consegnata", "Recapitata"                                                  | Consegnato al destinatario     |
| `in_transit`        | "In transito", "Partita dalla sede"                                         | In viaggio                     |
| `out_for_delivery`  | "In consegna"                                                               | In consegna oggi               |
| `at_destination`    | "Arrivata in sede destinazione"                                             | Presso filiale di destinazione |
| `in_giacenza`       | "In giacenza", "Mancata consegna", "Fermo deposito", "Destinatario assente" | Giacenza presso corriere       |
| `created`           | "Spedizione generata"                                                       | Spedizione creata              |
| `pending_pickup`    | "In attesa di ritiro"                                                       | In attesa del corriere         |
| `picked_up`         | (via pattern)                                                               | Ritirato dal corriere          |
| `returned`          | "Reso al mittente"                                                          | Restituito                     |
| `cancelled`         | "Annullata"                                                                 | Annullata                      |
| `exception`         | "Eccezione", "Problema"                                                     | Errore generico                |
| `unknown`           | (fallback)                                                                  | Stato non riconosciuto         |

---

## UI Components

### TrackingModal

**File:** `components/tracking/TrackingModal.tsx`

Modal completo per visualizzare il tracking di una spedizione:

- Timeline eventi con animazioni
- Indicatore "LIVE" pulsante quando connesso a Realtime
- Barra progresso (`TrackingProgressBar`) in cima
- Refresh manuale, copia tracking number, link esterno corriere
- Integra `useRealtimeTracking` per aggiornamenti live

### TrackingProgressBar

**File:** `components/tracking/TrackingProgressBar.tsx`

Barra progresso a 5 step per il ciclo vita:

```
Creato → Ritirato → In Transito → In Consegna → Consegnato
                                       │
                                       └──→ [In Giacenza] (branch anomalia)
```

- **Responsive:** orizzontale su desktop, verticale su mobile
- **Branch anomalie:** deviazione visiva per giacenza/exception/reso/annullato
- **Animazioni:** CSS transitions (no Framer Motion)
- **Prop `compact`:** versione compatta senza label

### TrackingToast

**File:** `components/tracking/TrackingToast.tsx`

Toast ricco per aggiornamenti tracking real-time:

- Card glassmorphism con barra colore laterale
- Icona stato + tracking number monospace + carrier badge
- Link "Vedi dettagli" → apre TrackingModal
- Uso con Sonner: `toast.custom((t) => <TrackingToast ... />)`

---

## Hook Real-Time

### useRealtimeTracking

**File:** `hooks/useRealtimeTracking.ts`

Hook per singola spedizione — sottoscrive `tracking_events` via Supabase Realtime.

```typescript
const { isConnected, lastEvent } = useRealtimeTracking({
  shipmentId: 'xxx',
  onNewEvent: (event) => {
    /* nuovo evento tracking */
  },
  onStatusChange: (newStatus, previousStatus) => {
    /* cambio stato */
  },
  enabled: true,
});
```

**Feedback aptico differenziato:**

| Stato                       | Vibrazione                          | Suono       |
| --------------------------- | ----------------------------------- | ----------- |
| `delivered`                 | Breve successo [100,50,100]         | 800Hz 0.15s |
| `in_giacenza` / `exception` | Lunga warning [200,100,200,100,200] | 400Hz 0.2s  |
| `out_for_delivery`          | Breve info 150ms                    | 600Hz 0.1s  |

### useRealtimeShipments

**File:** `hooks/useRealtimeShipments.ts`

Hook per lista spedizioni — sottoscrive tabella `shipments` per aggiornamenti multi-device. Quando rileva cambio `tracking_status`, mostra `TrackingToast`.

---

## Trigger PostgreSQL

I trigger su `tracking_events` gestiscono automaticamente:

1. **Aggiornamento `shipments`:** `tracking_status`, `tracking_last_update`, `delivered_at`
2. **Creazione `shipment_holds`:** Per spedizioni in giacenza

Questo significa che basta inserire in `tracking_events` e tutto il resto si propaga automaticamente.

---

## Test Coverage

| File                                         | Descrizione                                                             | N. Test |
| -------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| `tests/unit/tracking-service.test.ts`        | Service: batch upsert, error types, retry, concurrency, normalizeStatus | 34      |
| `tests/unit/webhook-processor.test.ts`       | HMAC, deduplicazione, processing                                        | TBD     |
| `tests/unit/tracking-toast.test.tsx`         | Toast rendering, click, dismiss                                         | TBD     |
| `tests/unit/tracking-progress-bar.test.tsx`  | Step corretti per ogni stato                                            | TBD     |
| `tests/integration/tracking-webhook.test.ts` | POST completo, firma invalida                                           | TBD     |

---

## File Principali

### Services

- `lib/services/tracking/tracking-service.ts` — TrackingService (singleton, sync, fetch, cache)
- `lib/services/tracking/webhook-processor.ts` — Verifica HMAC + processing webhook
- `lib/services/tracking/notification-dispatcher.ts` — [Vedi NOTIFICATIONS.md](NOTIFICATIONS.md)

### API Routes

- `app/api/cron/sync-tracking/route.ts` — Cron endpoint
- `app/api/webhooks/spediscionline/route.ts` — Webhook endpoint
- `app/api/tracking/[shipmentId]/route.ts` — API per singola spedizione

### Components

- `components/tracking/TrackingModal.tsx` — Modal tracking completo
- `components/tracking/TrackingProgressBar.tsx` — Barra progresso 5 step
- `components/tracking/TrackingToast.tsx` — Toast ricco real-time

### Hooks

- `hooks/useRealtimeTracking.ts` — Realtime per singola spedizione
- `hooks/useRealtimeShipments.ts` — Realtime per lista spedizioni

### Infra

- `.github/workflows/sync-tracking.yml` — GitHub Actions cron (ogni ora)

---

## Related Documentation

- [Notifications](NOTIFICATIONS.md) — Notifiche intelligenti tracking
- [Webhooks API](../3-API/WEBHOOKS.md) — Documentazione webhook
- [Shipments](SHIPMENTS.md) — Feature spedizioni

---

## Changelog

| Data       | Versione | Descrizione                                                |
| ---------- | -------- | ---------------------------------------------------------- |
| 2026-02-09 | 2.0.0    | Sync parallelo, retry, batch upsert, metriche, cron orario |
| 2026-02-08 | 1.5.0    | Webhook, real-time UX, notifications, progress bar, toast  |
| 2026-01-XX | 1.0.0    | Tracking base con polling sequenziale ogni 4 ore           |

---

_Last Updated: 2026-02-09_
_Status: Active_
_Maintainer: Dev Team_
