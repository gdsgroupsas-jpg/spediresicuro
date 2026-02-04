# API Documentation

Documentazione completa delle API di SpedireSicuro con schema OpenAPI auto-generated.

> **📅 Last Validated:** 2026-02-04
> **✅ Status:** Endpoints validated against production implementation
> **⚠️ Note:** Some documented endpoints are marked as NOT IMPLEMENTED
> **🆕 New:** Workspace APIs added in Architecture V2 (Feb 2026)

---

## 🎯 **Overview**

SpedireSicuro espone API REST per:

- **Workspace Management** (NEW v2.0) - Multi-tenant workspace switching
- Gestione spedizioni
- Pricing engine
- Wallet operations
- AI Agent interactions
- Courier integrations

**Base URL:** `https://spediresicuro.vercel.app/api`

---

## 🔐 **Authentication**

SpedireSicuro API supports **two authentication methods**:

### **1. Cookie-Based Authentication (Web/Browser)**

Used automatically by the web application. Handled by NextAuth.js session cookies.

```typescript
// Automatic authentication via browser cookies
// Cookie: next-auth.session-token

// No special headers required when using web app
fetch('/api/quotes/realtime', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    /* data */
  }),
  credentials: 'include', // Include cookies
});
```

**Use case:** Web dashboard, browser-based integrations

---

### **2. API Key Authentication (Server-to-Server)**

Used for external server integrations and programmatic access.

#### **Obtaining an API Key**

1. Log in to SpedireSicuro dashboard
2. Navigate to **Settings → API Keys**
3. Click **"Create New API Key"**
4. Set permissions (scopes) and expiry
5. **Copy the key immediately** (shown only once, never retrievable)

#### **Using an API Key**

Include the API key in the `Authorization` header as a Bearer token:

```bash
curl -X POST https://spediresicuro.vercel.app/api/quotes/realtime \
  -H "Authorization: Bearer sk_live_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "weight": 5.0,
    "origin": { "zip": "20100" },
    "destination": { "zip": "00100" }
  }'
```

**JavaScript/TypeScript:**

```typescript
const apiKey = process.env.SPEDIRESICURO_API_KEY; // Store in environment

const response = await fetch('https://spediresicuro.vercel.app/api/quotes/realtime', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    weight: 5.0,
    origin: { zip: '20100' },
    destination: { zip: '00100' },
  }),
});

const data = await response.json();
```

**Python:**

```python
import os
import requests

api_key = os.environ['SPEDIRESICURO_API_KEY']

response = requests.post(
    'https://spediresicuro.vercel.app/api/quotes/realtime',
    headers={'Authorization': f'Bearer {api_key}'},
    json={
        'weight': 5.0,
        'origin': {'zip': '20100'},
        'destination': {'zip': '00100'},
    }
)

data = response.json()
```

---

#### **API Key Scopes (Permissions)**

API keys have granular permissions. Request only the scopes you need:

| Scope              | Description            | Example Use Case                |
| ------------------ | ---------------------- | ------------------------------- |
| `quotes:read`      | Get pricing quotes     | Price calculator widget         |
| `quotes:create`    | Create price quotes    | Integration with booking system |
| `shipments:read`   | List shipments         | Dashboard display               |
| `shipments:create` | Create new shipment    | Automated order fulfillment     |
| `shipments:update` | Update shipment status | Tracking updates                |
| `wallet:read`      | View wallet balance    | Account monitoring              |
| `*`                | Full access (admin)    | Complete integration            |

**Example: Creating a key with limited scopes**

```json
POST /api/api-keys/create

{
  "name": "Production Price Calculator",
  "scopes": ["quotes:read", "quotes:create"],
  "expiresInDays": 90
}
```

---

#### **Security Best Practices**

✅ **DO:**

- Store keys in environment variables (never hardcode)
- Use minimum required scopes
- Rotate keys every 90 days
- Revoke unused keys immediately
- Monitor usage in dashboard
- Use HTTPS for all requests

❌ **DON'T:**

- Commit keys to git repositories
- Share keys in Slack/email
- Use production keys in development
- Store keys in client-side code
- Use wildcard (`*`) scope unless necessary

---

#### **Rate Limiting**

API keys have rate limits to prevent abuse:

- **Default:** 1,000 requests/hour per key
- **Custom limits:** Contact support for higher limits

Rate limit headers in response:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 2026-01-21T15:00:00Z
```

When rate limit is exceeded:

```json
HTTP/1.1 429 Too Many Requests

{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the rate limit of 1000 requests/hour",
  "resetAt": "2026-01-21T15:00:00Z"
}
```

---

#### **API Key Management Endpoints**

##### **Create API Key**

```http
POST /api/api-keys/create
Authorization: Cookie (must be logged in)
Content-Type: application/json

{
  "name": "My Integration",
  "scopes": ["quotes:read", "shipments:read"],
  "expiresInDays": 90
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "key": "sk_live_abc123...",
    "keyPrefix": "sk_live_abc12345",
    "name": "My Integration",
    "scopes": ["quotes:read", "shipments:read"],
    "expiresInDays": 90
  },
  "message": "⚠️ Save this key securely. It will NEVER be shown again."
}
```

##### **List API Keys**

```http
GET /api/api-keys/list
Authorization: Cookie (must be logged in)
```

**Response:**

```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "uuid-1",
        "keyPrefix": "sk_live_abc12345",
        "name": "Production Integration",
        "scopes": ["quotes:read", "shipments:read"],
        "expiresAt": "2026-04-21T00:00:00Z",
        "rateLimitPerHour": 1000
      }
    ],
    "count": 1
  }
}
```

##### **Revoke API Key**

```http
POST /api/api-keys/revoke
Authorization: Cookie (must be logged in)
Content-Type: application/json

{
  "keyId": "uuid-here"
}
```

**Response:**

```json
{
  "success": true,
  "message": "API key has been revoked successfully."
}
```

---

## 📚 **API Endpoints**

### **Workspace APIs** (NEW v2.0)

> These APIs manage multi-tenant workspace functionality. See [ARCHITECTURE_V2_PLAN.md](00-HANDBOOK/ARCHITECTURE_V2_PLAN.md) for architecture details.

#### **Get My Workspaces**

Returns all workspaces the authenticated user has access to.

```http
GET /api/workspaces/my
Authorization: Cookie or Bearer token
```

**Response:**

```json
{
  "workspaces": [
    {
      "workspace_id": "uuid-here",
      "workspace_name": "Logistica Milano",
      "workspace_slug": "logistica-milano",
      "workspace_type": "reseller",
      "workspace_depth": 1,
      "organization_id": "org-uuid",
      "organization_name": "SpedireSicuro",
      "organization_slug": "spediresicuro",
      "role": "owner",
      "permissions": ["shipments:create", "wallet:view"],
      "wallet_balance": 1500.0,
      "branding": {
        "logo_url": "https://...",
        "primary_color": "#FF6B00"
      },
      "member_status": "active"
    }
  ],
  "count": 1
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Database error

---

#### **Switch Workspace**

Sets the current workspace for the user. Updates both database and httpOnly cookie.

```http
POST /api/workspaces/switch
Authorization: Cookie or Bearer token
Content-Type: application/json

{
  "workspaceId": "uuid-here"
}
```

**Success Response:**

```json
{
  "success": true,
  "workspace": {
    "workspace_id": "uuid-here",
    "workspace_name": "Logistica Milano",
    "workspace_slug": "logistica-milano",
    "workspace_type": "reseller",
    "workspace_depth": 1,
    "organization_id": "org-uuid",
    "organization_name": "SpedireSicuro",
    "organization_slug": "spediresicuro",
    "role": "owner",
    "permissions": [],
    "wallet_balance": 1500.0,
    "branding": {},
    "member_status": "active"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Missing or invalid workspaceId
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a member of the workspace
- `404 Not Found` - Workspace doesn't exist
- `500 Internal Server Error` - Database update failed

**Security Notes:**

- Workspace ID is validated with strict UUID v4 regex
- httpOnly cookie prevents XSS attacks
- Database is updated BEFORE cookie (atomic operation)
- Audit log entry created for each switch

---

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
POST /api/quotes/realtime
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
POST /api/shipments/create
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
GET /api/spedizioni?page=1&limit=20&status=pending
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

### **Admin API**

#### **Delete User (Superadmin Only)**

```http
DELETE /api/admin/users/:id
Authorization: Cookie (must be superadmin)
```

**Description:** Permanently deletes a user account. This is an atomic operation that:

1. Deletes the user from Supabase Auth (`auth.users`)
2. Soft-deletes all user shipments (preserves audit trail)
3. Hard-deletes user from `public.users`
4. Creates audit log entry

**Security:**

- Only superadmin users can call this endpoint
- Cannot delete yourself
- Cannot delete other admins

**Response (Success):**

```json
{
  "success": true,
  "message": "Utente user@example.com cancellato con successo. Spedizioni cancellate: 5, Features rimosse: 0, Profili rimossi: 0",
  "statistics": {
    "deleted_shipments_count": 5,
    "deleted_features_count": 0,
    "deleted_profiles_count": 0,
    "wallet_balance_final": 25.5
  }
}
```

**Errors:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not a superadmin, or trying to delete self/other admin
- `404 Not Found` - User not found
- `500 Internal Server Error` - Deletion failed

---

### **Wallet API**

#### **Get Balance** ⚠️ DEPRECATED - Endpoint Not Implemented

> **Note:** This endpoint is documented but does not exist in the current implementation.
> Use `GET /api/wallet/transactions` and calculate balance from transaction history.

```http
GET /api/wallet/balance
```

**Status:** ❌ NOT IMPLEMENTED

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
POST /api/anne/chat
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

### **Download Schema** ⚠️ NOT IMPLEMENTED

> **Note:** This endpoint is documented but does not exist in the current implementation.

```http
GET /api/openapi.json
```

**Status:** ❌ NOT IMPLEMENTED

Returns full OpenAPI 3.0 specification.

### **Import to Postman** ⚠️ NOT AVAILABLE

1. Postman → Import
2. URL: `https://spediresicuro.vercel.app/api/openapi.json` (endpoint does not exist)
3. Collection imported with all endpoints

**Note:** Manual Postman collection must be created until OpenAPI schema endpoint is implemented.

### **Swagger UI** ⚠️ NOT AVAILABLE

View interactive docs:

```
https://spediresicuro.vercel.app/api-docs
```

**Status:** ❌ NOT IMPLEMENTED

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

### **v1.0.2** (2026-01-26)

- ✅ **ADDED:** DELETE /api/admin/users/:id - Superadmin user deletion endpoint
- ✅ **ADDED:** `delete_user_complete()` RPC function documentation
- 📋 **CHANGES:**
  - Admin API section added with user management endpoints

### **v1.0.1** (2026-01-20)

- ✅ **CORRECTED:** Updated all endpoint paths to match actual implementation
- ⚠️ **MARKED:** Non-existent endpoints clearly marked as NOT IMPLEMENTED
- ✅ **VALIDATED:** All endpoints tested against production
- 📋 **CHANGES:**
  - POST /api/pricing/quote → POST /api/quotes/realtime
  - POST /api/shipments → POST /api/shipments/create
  - GET /api/shipments → GET /api/spedizioni
  - POST /api/ai/agent-chat → POST /api/anne/chat
  - GET /api/wallet/balance → Marked as NOT IMPLEMENTED
  - GET /api/openapi.json → Marked as NOT IMPLEMENTED

### **v1.0.0** (2026-01-20)

- Initial API release
- Pricing, Shipments, Wallet, AI Agent endpoints
- Webhook support
- OpenAPI 3.0 schema (planned)

---

**Last Updated:** 2026-01-26
**API Version:** 1.0.2
**Validation Status:** ✅ All endpoints validated
