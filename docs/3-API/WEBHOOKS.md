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

| Provider | Endpoint              | Eventi         | Documentazione                      |
| -------- | --------------------- | -------------- | ----------------------------------- |
| Stripe   | `/api/stripe/webhook` | Payment events | [Stripe Webhooks](#stripe-webhooks) |

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

## Courier Webhooks (Future)

### Planned Integrations

**Spedisci.Online:**

- Tracking updates
- Label generation status
- Delivery confirmations

**Poste Italiane:**

- Tracking events
- Delivery notifications

**Note:** Attualmente non implementati. Tracking viene fatto via polling.

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
- [Security](../8-SECURITY/OVERVIEW.md) - Webhook security

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | Dev Team |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Dev Team_
