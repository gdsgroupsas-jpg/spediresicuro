# Webhooks - External Integrations

## Overview

Documentazione completa dei webhook gestiti da SpedireSicuro per integrazioni esterne (Stripe, corrieri, ecc.).

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites

- Conoscenza webhook HTTP
- Accesso a configurazione Stripe (per webhook secret)
- Conoscenza event-driven architecture

## Quick Reference

| Provider        | Endpoint                       | Eventi          | Documentazione                                       |
| --------------- | ------------------------------ | --------------- | ---------------------------------------------------- |
| Stripe          | `/api/stripe/webhook`          | Payment events  | [Stripe Webhooks](#stripe-webhooks)                  |
| Spedisci.Online | `/api/webhooks/spediscionline` | Tracking events | [Spedisci.Online Webhooks](#spediscionline-webhooks) |

---

## Stripe Webhooks

### Endpoint

**POST** `/api/stripe/webhook`

### Security

**Verifica Firma:**

- Header richiesto: `stripe-signature`
- Secret: `STRIPE_WEBHOOK_SECRET` (env var)
- Verifica automatica tramite `stripe.webhooks.constructEvent()`

**Esempio:**

```typescript
const signature = request.headers.get('stripe-signature');
event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
```

**Error Response (400):**

```json
{
  "error": "Invalid signature"
}
```

---

### Eventi Gestiti

#### `checkout.session.completed`

Triggered quando un checkout Stripe viene completato.

**Payload:**

```typescript
{
  id: string; // session ID
  customer: string; // customer ID
  payment_intent: string; // payment intent ID
  metadata: {
    userId: string; // ID utente SpedireSicuro
    amount: string; // Importo in centesimi
    transactionId: string; // ID transazione interno
  }
}
```

**Actions:**

1. Verifica transazione in `payment_transactions` (idempotency)
2. Se non già processata:
   - Aggiorna `payment_transactions.status = 'completed'`
   - Chiama `add_wallet_credit()` RPC per accreditare wallet
   - Inserisce record in `wallet_transactions`
   - Audit log: `WALLET_TOPUP_STRIPE`

**Idempotency:**

- Verifica `payment_transactions.status` prima di accreditare
- Previene doppi accrediti

**Vedi:** [Wallet Feature](../11-FEATURES/WALLET.md) - Top-up flow

---

#### `payment_intent.succeeded`

Triggered quando un pagamento viene confermato.

**Payload:**

```typescript
{
  id: string; // payment intent ID
  amount: number; // Importo in centesimi
  customer: string; // customer ID
  metadata: {
    userId: string;
    transactionId: string;
  }
}
```

**Actions:**

1. Verifica transazione esistente
2. Se non già processata, stessa logica di `checkout.session.completed`

---

#### `payment_intent.payment_failed`

Triggered quando un pagamento fallisce.

**Payload:**

```typescript
{
  id: string;
  last_payment_error: {
    message: string;
    code: string;
  }
  metadata: {
    userId: string;
    transactionId: string;
  }
}
```

**Actions:**

1. Aggiorna `payment_transactions.status = 'failed'`
2. Log errore per debugging
3. **NON** accredita wallet

---

### Flow Completo

```
1. User clicca "Ricarica Wallet" → Frontend
   ↓
2. POST /api/payments/create-checkout → Backend
   ↓
3. Crea PaymentTransaction (status: 'pending')
   ↓
4. Redirect a Stripe Checkout
   ↓
5. User completa pagamento → Stripe
   ↓
6. Stripe invia webhook → POST /api/stripe/webhook
   ↓
7. Verifica firma webhook
   ↓
8. Gestisce evento (checkout.session.completed)
   ↓
9. Verifica idempotency (payment_transactions)
   ↓
10. Accredita wallet (add_wallet_credit RPC)
    ↓
11. Inserisce wallet_transactions
    ↓
12. Audit log
    ↓
13. Response 200 OK a Stripe
```

---

### Error Handling

**Invalid Signature (400):**

```json
{
  "error": "Invalid signature"
}
```

**Missing Secret (500):**

```json
{
  "error": "Webhook secret not configured"
}
```

**Processing Error (500):**

- Log errore completo
- Response 500 a Stripe (Stripe ritenterà automaticamente)

---

### Testing

**Stripe CLI:**

```bash
# Forward webhook events to local
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test event
stripe trigger checkout.session.completed
```

**Test Locale:**

1. Configura `STRIPE_WEBHOOK_SECRET` in `.env.local`
2. Usa Stripe CLI per forward eventi
3. Verifica log e database

---

## Spedisci.Online Webhooks

### Endpoint

**POST** `/api/webhooks/spediscionline`

> **Nota:** Richiede abbonamento Spedisci.Online con supporto webhook (24 EUR/mese). Il cron sync orario resta come fallback.

### Security

**Kill Switch:**

```typescript
// Disabilita webhook senza deploy: SPEDISCI_WEBHOOK_ENABLED=false
if (process.env.SPEDISCI_WEBHOOK_ENABLED !== 'true') {
  return NextResponse.json({ status: 'disabled' });
}
```

**Verifica Firma HMAC-SHA256:**

- Header richiesti: `Webhook-Timestamp`, `Webhook-Signature`
- Secret: `SPEDISCI_WEBHOOK_SECRET` (env var)
- Formato firma: `t=<timestamp>,v1=<hmac_sha256_hex>`
- Payload firmato: `"{timestamp}.{rawBody}"`
- Confronto timing-safe (previene timing attacks)
- Finestra 5 minuti anti-replay

**Deduplicazione:**

- Cache in-memory con TTL 5 minuti
- Chiave: `{event}:{tracking_number}:{timestamp}`
- Previene processing duplicati da retry del provider

**Risposta:** Sempre 200 OK (anche su errore interno) per evitare retry infiniti.

---

### Eventi Gestiti

#### `tracking.updated`

Cambio stato di una spedizione in transito.

**Payload:**

```typescript
{
  event: 'tracking.updated',
  timestamp: 1733678400,
  data: {
    tracking_number: 'ABC123456',
    carrier: 'GLS',
    status: 'In transito',
    status_description: 'Partita dalla sede di Milano',
    last_update: '2026-02-09T10:30:00Z',
    events: [
      {
        timestamp: '2026-02-09T10:30:00Z',
        status: 'In transito',
        location: 'Milano',
        description: 'Partita dalla sede'
      }
    ]
  }
}
```

**Actions:**

1. Verifica firma HMAC-SHA256
2. Deduplicazione in-memory
3. Lookup spedizione per `tracking_number` in `shipments`
4. Upsert eventi in `tracking_events` (constraint UNIQUE previene duplicati DB)
5. Trigger PostgreSQL aggiorna automaticamente `shipments.tracking_status`
6. Supabase Realtime broadcast → UI si aggiorna live
7. Dispatch notifiche (async, non-bloccante)

#### `tracking.delivered`

Spedizione consegnata al destinatario.

**Actions aggiuntive:**

- Notifica `shipment_delivered` (in-app + push)
- Trigger DB imposta `shipments.delivered_at`

#### `tracking.exception`

Problema con la spedizione (giacenza, mancata consegna).

**Actions aggiuntive:**

- Notifica `giacenza_detected` o `delivery_failed` (in-app + push + email)
- Trigger DB crea `shipment_holds` per giacenze
- Notifica anche il reseller parent (se child workspace)

#### `shipment.created`

Nuova spedizione creata su Spedisci.Online. Nessuna notifica generata.

---

### Flow Completo

```text
1. Spedisci.Online rileva cambio stato → Push webhook
   ↓
2. POST /api/webhooks/spediscionline
   ↓
3. Kill switch check (SPEDISCI_WEBHOOK_ENABLED)
   ↓
4. Leggi raw body (PRIMA del JSON parse, per HMAC)
   ↓
5. Verifica firma HMAC-SHA256 (timing-safe)
   ↓
6. Deduplicazione in-memory (5 min TTL)
   ↓
7. JSON parse + validazione payload
   ↓
8. Lookup shipment per tracking_number
   ↓
9. Upsert eventi in tracking_events (batch)
   ↓
10. Trigger PostgreSQL → aggiorna shipments + shipment_holds
    ↓
11. Supabase Realtime → UI live update
    ↓
12. Dispatch notifiche (async, fire-and-forget)
    ↓
13. Response 200 OK
```

---

### Env Vars

| Variabile                  | Descrizione                  | Obbligatoria |
| -------------------------- | ---------------------------- | ------------ |
| `SPEDISCI_WEBHOOK_ENABLED` | Kill switch (`true`/`false`) | Si           |
| `SPEDISCI_WEBHOOK_SECRET`  | Shared secret per HMAC       | Si           |

---

### Testing

```bash
# Simula webhook con curl
curl -X POST https://www.spediresicuro.it/api/webhooks/spediscionline \
  -H "Content-Type: application/json" \
  -H "Webhook-Timestamp: $(date +%s)" \
  -H "Webhook-Signature: t=$(date +%s),v1=<computed_hmac>" \
  -d '{"event":"tracking.updated","timestamp":1733678400,"data":{"tracking_number":"TEST123","carrier":"GLS","status":"In transito","events":[]}}'
```

**Vedi:** [Tracking Real-Time](../11-FEATURES/TRACKING.md) per documentazione completa del sistema tracking.

---

## Courier Webhooks (Future)

**Poste Italiane:**

- Tracking events
- Delivery notifications

**Note:** Non ancora implementati.

---

## Webhook Best Practices

### 1. Idempotency

**Sempre verificare se evento già processato:**

```typescript
const { data: existing } = await supabaseAdmin
  .from('payment_transactions')
  .select('status')
  .eq('stripe_payment_intent_id', event.data.object.id)
  .single();

if (existing?.status === 'completed') {
  return NextResponse.json({ received: true }); // Idempotent
}
```

---

### 2. Signature Verification

**Sempre verificare firma webhook:**

```typescript
try {
  event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
} catch (err) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
}
```

---

### 3. Error Handling

**Ritorna 200 per eventi processati, 500 per errori:**

```typescript
try {
  await processWebhook(event);
  return NextResponse.json({ received: true }); // 200 OK
} catch (error) {
  console.error('Webhook processing failed:', error);
  return NextResponse.json(
    { error: 'Processing failed' },
    { status: 500 } // Stripe ritenterà
  );
}
```

---

### 4. Audit Logging

**Logga tutti gli eventi webhook:**

```typescript
await writeAuditLog({
  action: 'WEBHOOK_RECEIVED',
  actor_id: null, // System event
  target_id: userId,
  metadata: {
    provider: 'stripe',
    event_type: event.type,
    event_id: event.id,
  },
});
```

---

## Related Documentation

- [Overview](OVERVIEW.md) - Panoramica API
- [REST API](REST_API.md) - Endpoints REST
- [Wallet Feature](../11-FEATURES/WALLET.md) - Wallet top-up flow
- [Tracking Real-Time](../11-FEATURES/TRACKING.md) - Sistema tracking completo
- [Notifications](../11-FEATURES/NOTIFICATIONS.md) - Notifiche intelligenti tracking
- [Security](../8-SECURITY/OVERVIEW.md) - Webhook security

---

## Changelog

| Date       | Version | Changes                                   | Author   |
| ---------- | ------- | ----------------------------------------- | -------- |
| 2026-02-09 | 2.0.0   | Aggiunto Spedisci.Online tracking webhook | Dev Team |
| 2026-01-12 | 1.0.0   | Initial version (Stripe)                  | Dev Team |

---

_Last Updated: 2026-02-09_  
_Status: 🟢 Active_  
_Maintainer: Dev Team_
