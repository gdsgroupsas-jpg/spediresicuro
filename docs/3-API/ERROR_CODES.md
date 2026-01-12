# Error Codes - Standardized API Errors

## Overview
Documentazione completa dei codici errore standardizzati utilizzati nelle API di SpedireSicuro. Tutti gli endpoint REST e Server Actions seguono questo formato.

## Target Audience
- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites
- Conoscenza HTTP status codes
- Familiarità con error handling

## Quick Reference
| Status Code | Categoria | Codice Errore | Descrizione |
|-------------|-----------|---------------|-------------|
| 400 | Client Error | `BAD_REQUEST` | Richiesta non valida |
| 401 | Auth Error | `UNAUTHORIZED` | Non autenticato |
| 403 | Auth Error | `FORBIDDEN` | Accesso negato |
| 404 | Client Error | `NOT_FOUND` | Risorsa non trovata |
| 409 | Client Error | `DUPLICATE_REQUEST` | Richiesta duplicata |
| 422 | Validation | `VALIDATION_ERROR` | Validazione fallita |
| 500 | Server Error | `INTERNAL_ERROR` | Errore interno |
| 503 | Server Error | `SERVICE_UNAVAILABLE` | Servizio non disponibile |

---

## Error Response Format

**Standard Format:**
```json
{
  "error": "Messaggio errore leggibile",
  "code": "ERROR_CODE" // opzionale
}
```

**Con Dettagli (opzionale):**
```json
{
  "error": "Validazione fallita",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Email non valida"
  }
}
```

---

## HTTP Status Codes

### 400 Bad Request

**Quando:** Richiesta malformata o parametri mancanti.

**Codici:**
- `BAD_REQUEST` - Richiesta non valida (generico)
- `MISSING_PARAMETER` - Parametro obbligatorio mancante
- `INVALID_PARAMETER` - Parametro non valido

**Esempio:**
```json
{
  "error": "Peso obbligatorio e deve essere > 0",
  "code": "BAD_REQUEST"
}
```

---

### 401 Unauthorized

**Quando:** Autenticazione mancante o invalida.

**Codici:**
- `UNAUTHORIZED` - Non autenticato
- `INVALID_TOKEN` - Token non valido
- `SESSION_EXPIRED` - Sessione scaduta

**Esempio:**
```json
{
  "error": "Non autenticato",
  "code": "UNAUTHORIZED"
}
```

**Vedi:** [Authentication](../8-SECURITY/AUTHENTICATION.md)

---

### 403 Forbidden

**Quando:** Autenticato ma senza permessi.

**Codici:**
- `FORBIDDEN` - Accesso negato (generico)
- `INSUFFICIENT_PERMISSIONS` - Permessi insufficienti
- `ROLE_REQUIRED` - Ruolo specifico richiesto

**Esempio:**
```json
{
  "error": "Accesso negato. Solo gli admin possono accedere.",
  "code": "FORBIDDEN"
}
```

**Vedi:** [Authorization](../8-SECURITY/AUTHORIZATION.md)

---

### 404 Not Found

**Quando:** Risorsa non trovata.

**Codici:**
- `NOT_FOUND` - Risorsa non trovata (generico)
- `USER_NOT_FOUND` - Utente non trovato
- `SHIPMENT_NOT_FOUND` - Spedizione non trovata
- `PRICE_LIST_NOT_FOUND` - Listino non trovato

**Esempio:**
```json
{
  "error": "Spedizione non trovata",
  "code": "SHIPMENT_NOT_FOUND"
}
```

---

### 409 Conflict

**Quando:** Conflitto con stato esistente (es. duplicato).

**Codici:**
- `CONFLICT` - Conflitto generico
- `DUPLICATE_REQUEST` - Richiesta duplicata (idempotency)
- `RESOURCE_EXISTS` - Risorsa già esistente

**Esempio:**
```json
{
  "error": "Richiesta duplicata. Spedizione già creata.",
  "code": "DUPLICATE_REQUEST"
}
```

**Note:** Usato per idempotency. Se una richiesta identica viene inviata entro 30 minuti, ritorna la risorsa esistente.

**Vedi:** [Shipments Feature](../11-FEATURES/SHIPMENTS.md) - Idempotency

---

### 402 Payment Required

**Quando:** Credito insufficiente per operazione.

**Codici:**
- `WALLET_INSUFFICIENT` - Credito wallet insufficiente
- `PAYMENT_REQUIRED` - Pagamento richiesto

**Esempio:**
```json
{
  "error": "Credito insufficiente. Saldo attuale: €10.00, richiesto: €15.00",
  "code": "WALLET_INSUFFICIENT",
  "details": {
    "current_balance": 10.00,
    "required_amount": 15.00,
    "shortfall": 5.00
  }
}
```

**Vedi:** [Wallet Feature](../11-FEATURES/WALLET.md)

---

### 422 Unprocessable Entity

**Quando:** Validazione input fallita.

**Codici:**
- `VALIDATION_ERROR` - Errore validazione (generico)
- `INVALID_EMAIL` - Email non valida
- `INVALID_PASSWORD` - Password non valida
- `INVALID_ZIP` - CAP non valido
- `INVALID_PROVINCE` - Provincia non valida

**Esempio:**
```json
{
  "error": "Errore di validazione",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Email non valida"
  }
}
```

---

### 500 Internal Server Error

**Quando:** Errore interno del server.

**Codici:**
- `INTERNAL_ERROR` - Errore interno (generico)
- `DATABASE_ERROR` - Errore database
- `EXTERNAL_API_ERROR` - Errore API esterna
- `PROCESSING_ERROR` - Errore elaborazione

**Esempio:**
```json
{
  "error": "Errore interno del server",
  "code": "INTERNAL_ERROR"
}
```

**Note:** Non esporre dettagli tecnici in produzione. Loggare internamente.

---

### 503 Service Unavailable

**Quando:** Servizio temporaneamente non disponibile.

**Codici:**
- `SERVICE_UNAVAILABLE` - Servizio non disponibile (generico)
- `DATABASE_UNAVAILABLE` - Database non disponibile
- `REDIS_UNAVAILABLE` - Redis non disponibile
- `COURIER_API_UNAVAILABLE` - API corriere non disponibile

**Esempio:**
```json
{
  "error": "Servizio temporaneamente non disponibile",
  "code": "SERVICE_UNAVAILABLE"
}
```

---

## Database Error Codes

### PostgreSQL Error Codes

**23505 - Unique Violation:**
```json
{
  "error": "Risorsa già esistente",
  "code": "CONFLICT"
}
```

**23503 - Foreign Key Violation:**
```json
{
  "error": "Riferimento non valido",
  "code": "BAD_REQUEST"
}
```

**PGRST116 - Not Found:**
```json
{
  "error": "Risorsa non trovata",
  "code": "NOT_FOUND"
}
```

**42501 - Permission Denied:**
```json
{
  "error": "Accesso negato",
  "code": "FORBIDDEN"
}
```

---

## Business Logic Error Codes

### Wallet Errors

**`WALLET_INSUFFICIENT`** - Credito insufficiente
**`WALLET_LIMIT_EXCEEDED`** - Limite transazione superato (es. €10,000)
**`WALLET_TRANSACTION_FAILED`** - Transazione wallet fallita

---

### Shipment Errors

**`SHIPMENT_CREATION_FAILED`** - Creazione spedizione fallita
**`COURIER_API_ERROR`** - Errore API corriere
**`LABEL_GENERATION_FAILED`** - Generazione etichetta fallita
**`COMPENSATION_QUEUE_REQUIRED`** - Richiesta compensazione manuale

**Vedi:** [Shipments Feature](../11-FEATURES/SHIPMENTS.md) - Compensation Queue

---

### Price List Errors

**`PRICE_LIST_NOT_FOUND`** - Listino non trovato
**`PRICE_LIST_INVALID`** - Listino non valido
**`PRICE_CALCULATION_FAILED`** - Calcolo prezzo fallito

---

### Authentication Errors

**`INVALID_CREDENTIALS`** - Credenziali non valide
**`ACCOUNT_DISABLED`** - Account disabilitato
**`IMPERSONATION_DENIED`** - Impersonation negata (solo superadmin)

**Vedi:** [Authentication](../8-SECURITY/AUTHENTICATION.md)

---

## Rate Limiting

**429 Too Many Requests:**

```json
{
  "error": "Troppe richieste. Limite: 20/minuto",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 20,
    "remaining": 0,
    "reset_at": 1704040000
  }
}
```

**Headers:**
- `X-RateLimit-Limit`: 20
- `X-RateLimit-Remaining`: 0
- `X-RateLimit-Reset`: 1704040000

---

## Error Handling Best Practices

### 1. Always Return Standard Format

```typescript
// ✅ Good
return NextResponse.json(
  { error: "Utente non trovato", code: "USER_NOT_FOUND" },
  { status: 404 }
);

// ❌ Bad
return NextResponse.json({ message: "Not found" }, { status: 404 });
```

---

### 2. Log Errors Internally

```typescript
try {
  // ... operation
} catch (error: any) {
  console.error('Operation failed:', error); // Log interno
  return NextResponse.json(
    { error: "Operazione fallita", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
```

---

### 3. Don't Expose Sensitive Data

```typescript
// ❌ Bad - Espone dettagli tecnici
return NextResponse.json({
  error: error.message, // "Connection to database failed: password=xxx"
  code: "DATABASE_ERROR"
});

// ✅ Good - Messaggio generico
console.error('Database error:', error); // Log interno
return NextResponse.json({
  error: "Errore database",
  code: "DATABASE_ERROR"
});
```

---

### 4. Use Specific Error Codes

```typescript
// ✅ Good - Codice specifico
if (user.wallet_balance < requiredAmount) {
  return NextResponse.json(
    { 
      error: "Credito insufficiente",
      code: "WALLET_INSUFFICIENT",
      details: { current_balance: user.wallet_balance, required: requiredAmount }
    },
    { status: 402 }
  );
}

// ❌ Bad - Codice generico
return NextResponse.json(
  { error: "Operazione fallita", code: "ERROR" },
  { status: 400 }
);
```

---

## Related Documentation

- [Overview](OVERVIEW.md) - Panoramica API
- [REST API](REST_API.md) - Endpoints REST
- [Server Actions](SERVER_ACTIONS.md) - Server Actions
- [Security](../8-SECURITY/OVERVIEW.md) - Error handling security

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | Dev Team |

---

*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Dev Team*
