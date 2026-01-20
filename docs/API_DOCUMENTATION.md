# API Documentation

Documentazione completa delle API di SpedireSicuro con schema OpenAPI auto-generated.

---

## 🎯 **Overview**

SpedireSicuro espone API REST per:

- Gestione spedizioni
- Pricing engine
- Wallet operations
- AI Agent interactions
- Courier integrations

**Base URL:** `https://spediresicuro.vercel.app/api`

---

## 🔐 **Authentication**

Tutte le API richiedono autenticazione via NextAuth.js session.

### **Session-based (Web)**

```typescript
// Automatic via NextAuth.js
// Cookie: next-auth.session-token
```

### **API Key (Server-to-Server)**

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://spediresicuro.vercel.app/api/shipments
```

**Ottenere API key:**

1. Login su dashboard
2. Settings → API Keys
3. Generate new key
4. Store securely (mostrato solo una volta)

---

## 📚 **API Endpoints**

### **Health Check**

```http
GET /api/health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-01-20T14:00:00Z",
  "services": {
    "database": "healthy",
    "ai": "healthy",
    "cache": "healthy"
  }
}
```

---

### **Pricing API**

#### **Get Price Quote**

```http
POST /api/pricing/quote
```

**Request Body:**

```json
{
  "weight": 5.0,
  "dimensions": {
    "length": 30,
    "width": 20,
    "height": 10
  },
  "origin": {
    "country": "IT",
    "zip": "20100"
  },
  "destination": {
    "country": "IT",
    "zip": "00100"
  },
  "serviceType": "standard" // or "express"
}
```

**Response:**

```json
{
  "quoteId": "quote_abc123",
  "prices": [
    {
      "courier": "poste",
      "service": "Pacco Ordinario",
      "price": {
        "net": 8.5,
        "vat": 1.87,
        "total": 10.37,
        "currency": "EUR"
      },
      "deliveryDays": "3-5",
      "trackingIncluded": true
    },
    {
      "courier": "spedisci",
      "service": "Economy",
      "price": {
        "net": 7.2,
        "vat": 1.58,
        "total": 8.78,
        "currency": "EUR"
      },
      "deliveryDays": "4-6",
      "trackingIncluded": true
    }
  ],
  "expiresAt": "2026-01-20T15:00:00Z"
}
```

**Errors:**

- `400 Bad Request` - Invalid input parameters
- `401 Unauthorized` - Missing/invalid auth
- `429 Too Many Requests` - Rate limit exceeded

---

### **Shipments API**

#### **Create Shipment**

```http
POST /api/shipments
```

**Request Body:**

```json
{
  "quoteId": "quote_abc123",
  "courierSelection": "poste",
  "sender": {
    "name": "Mario Rossi",
    "company": "Acme Inc",
    "address": "Via Roma 1",
    "city": "Milano",
    "zip": "20100",
    "country": "IT",
    "email": "mario@example.com",
    "phone": "+39 02 1234567"
  },
  "recipient": {
    "name": "Luigi Bianchi",
    "address": "Via Veneto 5",
    "city": "Roma",
    "zip": "00100",
    "country": "IT",
    "email": "luigi@example.com",
    "phone": "+39 06 7654321"
  },
  "package": {
    "description": "Electronics",
    "value": 150.0,
    "insurance": true
  }
}
```

**Response:**

```json
{
  "shipmentId": "ship_xyz789",
  "status": "created",
  "trackingNumber": "IT1234567890",
  "label": {
    "url": "https://cdn.spediresicuro.it/labels/ship_xyz789.pdf",
    "expiresAt": "2026-01-21T14:00:00Z"
  },
  "cost": {
    "charged": 10.37,
    "currency": "EUR"
  },
  "estimatedDelivery": "2026-01-25"
}
```

#### **List Shipments**

```http
GET /api/shipments?page=1&limit=20&status=pending
```

**Query Parameters:**

- `page` (default: 1)
- `limit` (default: 20, max: 100)
- `status` (optional): `pending`, `in_transit`, `delivered`, `cancelled`
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date

**Response:**

```json
{
  "shipments": [
    {
      "id": "ship_xyz789",
      "trackingNumber": "IT1234567890",
      "status": "in_transit",
      "courier": "poste",
      "createdAt": "2026-01-20T10:00:00Z",
      "recipient": {
        "name": "Luigi Bianchi",
        "city": "Roma"
      }
    }
  ],
  "pagination": {
    "total": 145,
    "page": 1,
    "pages": 8,
    "limit": 20
  }
}
```

#### **Get Shipment**

```http
GET /api/shipments/:id
```

**Response:**

```json
{
  "id": "ship_xyz789",
  "status": "in_transit",
  "trackingNumber": "IT1234567890",
  "courier": "poste",
  "sender": {
    /* full details */
  },
  "recipient": {
    /* full details */
  },
  "timeline": [
    {
      "timestamp": "2026-01-20T10:00:00Z",
      "status": "created",
      "location": "Milano"
    },
    {
      "timestamp": "2026-01-20T15:30:00Z",
      "status": "picked_up",
      "location": "Milano Hub"
    }
  ],
  "estimatedDelivery": "2026-01-25"
}
```

#### **Cancel Shipment**

```http
DELETE /api/shipments/:id
```

**Response:**

```json
{
  "id": "ship_xyz789",
  "status": "cancelled",
  "refund": {
    "amount": 10.37,
    "processedAt": "2026-01-20T16:00:00Z"
  }
}
```

---

### **Wallet API**

#### **Get Balance**

```http
GET /api/wallet/balance
```

**Response:**

```json
{
  "balance": 150.5,
  "currency": "EUR",
  "lastTransaction": "2026-01-20T14:00:00Z"
}
```

#### **Add Funds**

```http
POST /api/wallet/topup
```

**Request Body:**

```json
{
  "amount": 100.0,
  "currency": "EUR",
  "paymentMethod": "stripe_pm_abc123"
}
```

**Response:**

```json
{
  "transactionId": "txn_def456",
  "amount": 100.0,
  "status": "completed",
  "newBalance": 250.5
}
```

#### **Transaction History**

```http
GET /api/wallet/transactions?page=1&limit=20
```

**Response:**

```json
{
  "transactions": [
    {
      "id": "txn_def456",
      "type": "credit",
      "amount": 100.0,
      "description": "Wallet top-up",
      "timestamp": "2026-01-20T14:00:00Z",
      "balanceAfter": 250.5
    },
    {
      "id": "txn_ghi789",
      "type": "debit",
      "amount": 10.37,
      "description": "Shipment ship_xyz789",
      "timestamp": "2026-01-20T10:00:00Z",
      "balanceAfter": 150.5
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "pages": 3
  }
}
```

---

### **AI Agent API**

#### **Chat with Agent**

```http
POST /api/ai/agent-chat
```

**Request Body:**

```json
{
  "message": "Voglio spedire un pacco da Milano a Roma",
  "sessionId": "session_abc123" // optional, for conversation continuity
}
```

**Response:**

```json
{
  "response": "Perfetto! Per darti un preventivo preciso, ho bisogno di alcune informazioni...",
  "sessionId": "session_abc123",
  "context": {
    "intent": "get_quote",
    "extractedData": {
      "origin": "Milano",
      "destination": "Roma"
    }
  },
  "suggestedActions": [
    {
      "type": "form",
      "label": "Completa preventivo",
      "url": "/quote/new?origin=Milano&destination=Roma"
    }
  ]
}
```

#### **Upload Document (OCR)**

```http
POST /api/ai/ocr
Content-Type: multipart/form-data
```

**Request:**

```
file: [image/pdf file]
type: "invoice" | "label" | "receipt"
```

**Response:**

```json
{
  "ocrId": "ocr_jkl012",
  "extractedData": {
    "sender": {
      "name": "Acme Inc",
      "address": "Via Roma 1, Milano"
    },
    "recipient": {
      "name": "Beta Srl",
      "address": "Via Veneto 5, Roma"
    },
    "weight": 5.0,
    "confidence": 0.95
  },
  "rawText": "..."
}
```

---

## 🔢 **Rate Limiting**

| Endpoint                | Limit       | Window   |
| ----------------------- | ----------- | -------- |
| `/api/pricing/*`        | 60 req/min  | Per user |
| `/api/shipments` (POST) | 30 req/min  | Per user |
| `/api/ai/*`             | 20 req/min  | Per user |
| `/api/wallet/*`         | 100 req/min | Per user |

**Rate limit headers:**

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642684800
```

**429 Response:**

```json
{
  "error": "Too Many Requests",
  "retryAfter": 30
}
```

---

## 📊 **Webhooks**

Subscribe to events via webhooks.

### **Setup**

1. Dashboard → Settings → Webhooks
2. Add endpoint URL
3. Select events
4. Save (receives secret for signature verification)

### **Events**

| Event                 | Trigger                   |
| --------------------- | ------------------------- |
| `shipment.created`    | New shipment created      |
| `shipment.picked_up`  | Courier picked up package |
| `shipment.in_transit` | Package in transit        |
| `shipment.delivered`  | Package delivered         |
| `shipment.cancelled`  | Shipment cancelled        |
| `wallet.topup`        | Funds added to wallet     |
| `wallet.low_balance`  | Balance below threshold   |

### **Payload Example**

```json
{
  "event": "shipment.delivered",
  "timestamp": "2026-01-25T18:00:00Z",
  "data": {
    "shipmentId": "ship_xyz789",
    "trackingNumber": "IT1234567890",
    "deliveredAt": "2026-01-25T17:45:00Z",
    "signedBy": "L. Bianchi"
  }
}
```

### **Signature Verification**

```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
```

---

## 🧪 **Testing & Sandbox**

### **Test Mode**

Use test API keys (prefixed with `test_`) to access sandbox environment:

```bash
curl -H "Authorization: Bearer test_abc123" \
  https://spediresicuro.vercel.app/api/pricing/quote
```

**Test mode features:**

- No actual courier API calls
- Mock responses
- No real charges
- Unlimited requests

### **Test Data**

Use these test values for predictable responses:

| Field            | Value     | Result                  |
| ---------------- | --------- | ----------------------- |
| `zip`            | `00000`   | Always returns error    |
| `weight`         | `999`     | Returns max price       |
| `trackingNumber` | `TEST123` | Simulated delivery flow |

---

## 📖 **OpenAPI Schema**

### **Download Schema**

```http
GET /api/openapi.json
```

Returns full OpenAPI 3.0 specification.

### **Import to Postman**

1. Postman → Import
2. URL: `https://spediresicuro.vercel.app/api/openapi.json`
3. Collection imported with all endpoints

### **Swagger UI**

View interactive docs:

```
https://spediresicuro.vercel.app/api-docs
```

---

## 🛠️ **SDK & Libraries**

### **TypeScript SDK** (Coming Soon)

```bash
npm install @spediresicuro/sdk
```

```typescript
import { SpedireSicuro } from '@spediresicuro/sdk';

const client = new SpedireSicuro({ apiKey: 'your_key' });

const quote = await client.pricing.getQuote({
  weight: 5.0,
  origin: { zip: '20100' },
  destination: { zip: '00100' },
});
```

### **cURL Examples**

All endpoints include cURL examples in docs.

---

## 🔒 **Security**

### **HTTPS Only**

All API requests must use HTTPS. HTTP requests are redirected.

### **Input Validation**

All inputs are validated and sanitized server-side.

### **CORS**

CORS enabled for whitelisted domains:

```
Access-Control-Allow-Origin: https://spediresicuro.vercel.app
```

For local development:

```
Access-Control-Allow-Origin: http://localhost:3000
```

---

## 📞 **Support**

**Issues:** https://github.com/gdsgroupsas-jpg/spediresicuro/issues

**API Status:** https://status.spediresicuro.it

**Email:** api-support@spediresicuro.it

---

## 📚 **Changelog**

### **v1.0.0** (2026-01-20)

- Initial API release
- Pricing, Shipments, Wallet, AI Agent endpoints
- Webhook support
- OpenAPI 3.0 schema

---

**Last Updated:** 2026-01-20
**API Version:** 1.0.0
