# REST API - Complete Endpoints Documentation

## Overview
Documentazione completa di tutti gli endpoint REST API disponibili in SpedireSicuro. Gli endpoint sono organizzati per categoria funzionale.

## Target Audience
- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites
- Autenticazione NextAuth (session cookie)
- Conoscenza base di HTTP REST
- Accesso a Supabase (per operazioni admin)

## Quick Reference
| Categoria | Endpoint Base | Documentazione |
|-----------|---------------|----------------|
| Shipments | `/api/shipments/*` | [Shipments](#shipments) |
| Quotes | `/api/quotes/*` | [Quotes](#quotes) |
| Wallet | `/api/wallet/*` | [Wallet](#wallet) |
| Users | `/api/user/*` | [Users](#users) |
| Admin | `/api/admin/*` | [Admin](#admin) |
| AI Agent | `/api/ai/*`, `/api/anne/*` | [AI Agent](#ai-agent) |
| Integrations | `/api/integrations/*` | [Integrations](#integrations) |

---

## Authentication

Tutti gli endpoint (eccetto `/api/health` e webhooks) richiedono autenticazione NextAuth.

**Headers richiesti:**
```
Cookie: next-auth.session-token=<token>
```

**Risposta non autenticato:**
```json
{
  "error": "Non autenticato"
}
```
Status: `401 Unauthorized`

**Vedi:** [Authentication](../8-SECURITY/AUTHENTICATION.md) - Dettagli autenticazione

---

## Shipments

### POST `/api/shipments/create`

Crea una nuova spedizione.

**Request Body:**
```typescript
{
  recipient: {
    name: string;
    address: string;
    city: string;
    province: string;
    zip: string;
    country?: string; // default: "IT"
  };
  packages: Array<{
    weight: number; // kg
    dimensions?: {
      length: number; // cm
      width: number;
      height: number;
    };
  }>;
  carrier: string; // "GLS", "BRT", "POSTE", ecc.
  provider?: string; // "spediscionline" (default)
  services?: string[]; // ["insurance", "cod", "saturday_delivery"]
  insuranceValue?: number; // €
  codValue?: number; // €
  notes?: string;
}
```

**Response Success (200):**
```json
{
  "success": true,
  "shipment": {
    "id": "uuid",
    "tracking_number": "string",
    "carrier": "GLS",
    "total_cost": 12.50,
    "label_data": "base64_pdf",
    "sender_name": "...",
    "recipient_name": "..."
  }
}
```

**Error Codes:**
- `401` - Non autenticato
- `400` - Validazione fallita
- `409` - Duplicato (idempotency)
- `402` - Credito insufficiente (`WALLET_INSUFFICIENT`)
- `500` - Errore interno

**Idempotency:**
L'endpoint supporta idempotency tramite hash dei parametri. Se una richiesta identica viene inviata entro 30 minuti, ritorna la spedizione esistente.

**Vedi:** [Shipments Feature](../11-FEATURES/SHIPMENTS.md) - Dettagli creazione spedizioni

---

### GET `/api/spedizioni`

Lista tutte le spedizioni dell'utente autenticato.

**Query Parameters:**
- `limit?: number` - Numero risultati (default: 50, max: 100)
- `offset?: number` - Paginazione
- `status?: string` - Filtro per stato
- `carrier?: string` - Filtro per corriere

**Response (200):**
```json
{
  "success": true,
  "shipments": [
    {
      "id": "uuid",
      "tracking_number": "string",
      "carrier": "GLS",
      "status": "created",
      "total_cost": 12.50,
      "created_at": "2026-01-12T10:00:00Z"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

**Vedi:** [Shipments Feature](../11-FEATURES/SHIPMENTS.md)

---

### GET `/api/spedizioni/[id]/ldv`

Download etichetta spedizione (PDF).

**Response (200):**
- Content-Type: `application/pdf`
- Body: PDF binary

**Error Codes:**
- `404` - Spedizione non trovata
- `403` - Accesso negato (non è tua spedizione)

---

### DELETE `/api/spedizioni`

Cancella una spedizione (solo se non ancora processata dal corriere).

**Request Body:**
```json
{
  "shipmentId": "uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Spedizione cancellata"
}
```

---

## Quotes

### POST `/api/quotes/realtime`

Ottiene preventivi real-time da API corriere (Spedisci.Online).

**Request Body:**
```typescript
{
  weight: number; // kg
  zip: string; // CAP destinazione
  province?: string;
  city?: string;
  courier?: string; // "GLS", "BRT", ecc.
  contractCode?: string; // Codice contratto specifico
  services?: string[];
  insuranceValue?: number;
  codValue?: number;
  shipFrom?: { zip: string; province?: string };
  shipTo: { zip: string; province?: string };
  dimensions?: { length: number; width: number; height: number };
  allContracts?: boolean; // Se true, cerca in tutti i contratti
}
```

**Response (200):**
```json
{
  "success": true,
  "quotes": [
    {
      "carrier": "GLS",
      "service": "Standard",
      "price": 12.50,
      "currency": "EUR",
      "estimated_days": 2,
      "contractCode": "GLS5000"
    }
  ]
}
```

**Note:** Supporta multi-config: se l'utente ha più configurazioni API, unisce tutti i rates.

---

### POST `/api/quotes/db`

Ottiene preventivi da database (price lists) senza chiamate API esterne.

**Request Body:** (stesso formato di `/api/quotes/realtime`)

**Response (200):**
```json
{
  "success": true,
  "quotes": [
    {
      "carrier": "GLS",
      "price": 11.00,
      "source": "price_list",
      "price_list_id": "uuid"
    }
  ]
}
```

**Vedi:** [Price Lists Feature](../11-FEATURES/PRICE_LISTS.md)

---

### POST `/api/quotes/compare`

Confronta preventivi tra real-time e database.

**Request Body:** (stesso formato di `/api/quotes/realtime`)

**Response (200):**
```json
{
  "success": true,
  "realtime": [...],
  "database": [...],
  "comparison": {
    "best_realtime": {...},
    "best_database": {...},
    "savings": 1.50
  }
}
```

---

## Wallet

### GET `/api/wallet/transactions`

Ottiene storico transazioni wallet.

**Query Parameters:**
- `limit?: number` - Numero risultati (default: 50)
- `offset?: number` - Paginazione
- `type?: string` - Filtro tipo ("credit", "debit")

**Response (200):**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "type": "credit",
      "amount": 100.00,
      "description": "Ricarica wallet",
      "created_at": "2026-01-12T10:00:00Z"
    }
  ],
  "total": 50
}
```

**Vedi:** [Wallet Feature](../11-FEATURES/WALLET.md)

---

## Users

### GET `/api/user/info`

Ottiene informazioni utente corrente.

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Nome Utente",
    "account_type": "user",
    "wallet_balance": 150.00,
    "is_reseller": false
  }
}
```

---

### GET `/api/user/dati-cliente`

Ottiene dati cliente salvati (per autocompletamento form).

**Response (200):**
```json
{
  "success": true,
  "cliente": {
    "nome": "Azienda SRL",
    "indirizzo": "Via Roma 1",
    "citta": "Milano",
    "cap": "20100",
    "provincia": "MI"
  }
}
```

---

### POST `/api/user/dati-cliente`

Salva dati cliente per autocompletamento.

**Request Body:**
```json
{
  "nome": "Azienda SRL",
  "indirizzo": "Via Roma 1",
  "citta": "Milano",
  "cap": "20100",
  "provincia": "MI"
}
```

---

### GET `/api/user/settings`

Ottiene impostazioni utente.

**Response (200):**
```json
{
  "success": true,
  "settings": {
    "notifications": true,
    "default_carrier": "GLS",
    "preferences": {...}
  }
}
```

---

### PUT `/api/user/settings`

Aggiorna impostazioni utente.

**Request Body:**
```json
{
  "notifications": false,
  "default_carrier": "BRT"
}
```

---

## Admin

### GET `/api/admin/overview`

Statistiche dashboard admin (solo admin/superadmin).

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "total_users": 150,
    "total_shipments": 5000,
    "total_revenue": 50000.00,
    "active_resellers": 10
  }
}
```

**Authorization:** Richiede `role = 'admin'` o `account_type = 'superadmin'`

---

### GET `/api/admin/users/[id]`

Ottiene dettagli utente (solo admin).

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "wallet_balance": 100.00,
    "account_type": "user",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

### GET `/api/admin/users/[id]/features`

Ottiene features attive per un utente.

**Response (200):**
```json
{
  "success": true,
  "features": [
    {
      "code": "ai_ocr",
      "name": "OCR AI",
      "enabled": true
    }
  ]
}
```

---

### POST `/api/admin/features`

Attiva/disattiva feature per utente.

**Request Body:**
```json
{
  "targetUserEmail": "user@example.com",
  "featureCode": "ai_ocr",
  "enabled": true
}
```

**Vedi:** [AI Features Toggle](../11-FEATURES/AI_FEATURES_TOGGLE.md)

---

### GET `/api/admin/platform-features`

Ottiene stato feature globali piattaforma.

**Response (200):**
```json
{
  "success": true,
  "features": [
    {
      "code": "ai_ocr",
      "is_enabled": true,
      "description": "OCR AI per immagini"
    }
  ]
}
```

---

### POST `/api/admin/platform-fee/update`

Aggiorna fee piattaforma (solo superadmin).

**Request Body:**
```json
{
  "fee_percentage": 5.0
}
```

---

### GET `/api/admin/doctor/events`

Eventi diagnostici sistema (solo superadmin).

**Response (200):**
```json
{
  "success": true,
  "events": [
    {
      "type": "error",
      "message": "Database connection failed",
      "timestamp": "2026-01-12T10:00:00Z"
    }
  ]
}
```

---

## AI Agent

### POST `/api/anne/chat`

Chat con agente AI Anne.

**Request Body:**
```json
{
  "message": "Crea una spedizione per Milano",
  "conversationId": "uuid" // opzionale, per continuare conversazione
}
```

**Response (200):**
```json
{
  "success": true,
  "response": "Ho creato la spedizione...",
  "conversationId": "uuid",
  "tools_used": ["create_shipment"]
}
```

**Vedi:** [AI Agent](../10-AI-AGENT/OVERVIEW.md)

---

### POST `/api/ai/agent-chat`

Chat generica con AI agent (alternativa a Anne).

**Request Body:**
```json
{
  "message": "string",
  "context": {}
}
```

---

### GET `/api/ai/smart-suggestions`

Suggerimenti intelligenti basati su storico.

**Query Parameters:**
- `type?: string` - Tipo suggerimento ("carrier", "address", ecc.)

**Response (200):**
```json
{
  "success": true,
  "suggestions": [
    {
      "type": "carrier",
      "value": "GLS",
      "confidence": 0.85
    }
  ]
}
```

---

### GET `/api/ai/value-stats`

Statistiche valori spedizioni (per AI).

**Response (200):**
```json
{
  "success": true,
  "stats": {
    "average_insurance": 500.00,
    "average_cod": 100.00
  }
}
```

---

## Integrations

### POST `/api/integrations/validate-spedisci-online`

Valida credenziali Spedisci.Online.

**Request Body:**
```json
{
  "api_key": "string",
  "base_url": "https://api.spediscionline.it"
}
```

**Response (200):**
```json
{
  "success": true,
  "valid": true,
  "contracts": ["GLS5000", "BRT1000"]
}
```

---

### POST `/api/integrations/test-credentials`

Testa credenziali corriere generico.

**Request Body:**
```json
{
  "provider": "spediscionline",
  "api_key": "string",
  "config": {}
}
```

---

## Couriers

### GET `/api/couriers/available`

Ottiene corrieri disponibili per l'utente.

**Response (200):**
```json
{
  "success": true,
  "couriers": [
    {
      "displayName": "GLS 5000",
      "courierName": "GLS",
      "carrierCode": "GLS"
    }
  ],
  "total": 5
}
```

**Note:** Restituisce solo corrieri per cui esiste un listino attivo.

---

## Price Lists

### POST `/api/price-lists/upload`

Upload listino prezzi (CSV/Excel).

**Request Body:**
- `file`: File (multipart/form-data)
- `courier`: string
- `name`: string

**Response (200):**
```json
{
  "success": true,
  "price_list_id": "uuid",
  "entries_imported": 150
}
```

**Vedi:** [Price Lists Feature](../11-FEATURES/PRICE_LISTS.md)

---

## Invoices

### POST `/api/invoices/generate`

Genera fattura.

**Request Body:**
```json
{
  "shipment_ids": ["uuid1", "uuid2"],
  "period": {
    "from": "2026-01-01",
    "to": "2026-01-31"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "invoice_id": "uuid"
}
```

---

### GET `/api/invoices/[id]/pdf`

Download PDF fattura.

**Response (200):**
- Content-Type: `application/pdf`
- Body: PDF binary

---

## OCR

### POST `/api/ocr/extract`

Estrae dati da immagine (OCR AI).

**Request Body:**
- `image`: File (multipart/form-data) o base64

**Response (200):**
```json
{
  "success": true,
  "extracted": {
    "recipient_name": "Mario Rossi",
    "address": "Via Roma 1",
    "zip": "20100",
    "city": "Milano"
  }
}
```

---

## Geo

### GET `/api/geo/search`

Ricerca indirizzi (autocomplete).

**Query Parameters:**
- `q`: string - Query ricerca
- `country?: string` - Default: "IT"

**Response (200):**
```json
{
  "success": true,
  "results": [
    {
      "address": "Via Roma 1, Milano",
      "zip": "20100",
      "city": "Milano",
      "province": "MI"
    }
  ]
}
```

---

## Health & Diagnostics

### GET `/api/health`

Health check endpoint (pubblico, no auth).

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-01-12T10:00:00Z",
  "version": "1.0.0"
}
```

---

### GET `/api/diagnostics`

Diagnostica sistema (solo superadmin).

**Response (200):**
```json
{
  "success": true,
  "database": "connected",
  "redis": "connected",
  "stripe": "connected"
}
```

---

## Cron Jobs

### GET `/api/cron/compensation-queue`

Processa coda compensazione (solo interno, chiamato da cron).

**Authorization:** Richiede header `X-Cron-Secret`

**Vedi:** [Shipments Feature](../11-FEATURES/SHIPMENTS.md) - Compensation Queue

---

### GET `/api/cron/financial-alerts`

Genera alert finanziari (solo interno).

**Vedi:** [Financial Tracking](../11-FEATURES/FINANCIAL_TRACKING.md)

---

### GET `/api/cron/auto-reconciliation`

Riconciliazione automatica costi (solo interno).

**Vedi:** [Financial Tracking](../11-FEATURES/FINANCIAL_TRACKING.md)

---

## Error Handling

Tutti gli endpoint seguono il formato standardizzato:

**Success Response:**
```json
{
  "success": true,
  "data": {...}
}
```

**Error Response:**
```json
{
  "error": "Messaggio errore",
  "code": "ERROR_CODE" // opzionale
}
```

**Vedi:** [ERROR_CODES.md](ERROR_CODES.md) - Codici errore completi

---

## Rate Limiting

- **Default:** 20 richieste/minuto per utente
- **Headers Response:**
  - `X-RateLimit-Limit`: 20
  - `X-RateLimit-Remaining`: 15
  - `X-RateLimit-Reset`: 1704040000

**Vedi:** [Overview](OVERVIEW.md) - Dettagli rate limiting

---

## Related Documentation

- [Overview](OVERVIEW.md) - Panoramica API generale
- [Server Actions](SERVER_ACTIONS.md) - Server Actions Next.js
- [Webhooks](WEBHOOKS.md) - Webhooks Stripe
- [Error Codes](ERROR_CODES.md) - Codici errore
- [Shipments Feature](../11-FEATURES/SHIPMENTS.md) - Dettagli spedizioni
- [Wallet Feature](../11-FEATURES/WALLET.md) - Dettagli wallet
- [Security](../8-SECURITY/OVERVIEW.md) - Sicurezza API

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | Dev Team |

---

*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Dev Team*
