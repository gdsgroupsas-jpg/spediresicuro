# 🔧 Fix Summary: Spedisci.Online 401 Unauthorized

## 📊 Root Cause

**Problema**: 401 Unauthorized dopo aggiornamento API key

**Causa Identificata**:
1. **Multiple auth strategies**: Il codice provava 3 strategie diverse (Bearer, Token, X-API-KEY) invece di usare SOLO Bearer come richiesto dall'OpenAPI spec
2. **Base URL non validato**: Nessuna verifica che baseUrl sia corretto (demo vs production)

---

## 🛠️ Fix Applicati

### File: `lib/adapters/couriers/spedisci-online.ts`

#### Fix 1: Rimossa strategie fallback multiple (Lines 344-469)

**PRIMA**: Provava 3 strategie in sequenza
```typescript
const authStrategies = [
  { name: 'Bearer', header: 'Authorization', value: `Bearer ${this.API_KEY}` },
  { name: 'Token', header: 'Authorization', value: this.API_KEY },
  { name: 'X-API-KEY', header: 'X-API-KEY', value: this.API_KEY },
];
```

**DOPO**: Usa SOLO Bearer token (OpenAPI spec)
```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${this.API_KEY}`,
};
```

#### Fix 2: Validazione baseUrl (Lines 156-180)

**Aggiunto**:
- Validazione formato baseUrl
- Warning se baseUrl non contiene `spedisci.online`
- Warning se baseUrl non contiene `/api/v2`
- Log per distinguere demo vs production

#### Fix 3: Logging diagnostico migliorato

**Aggiunto**:
- Log pre-request con baseUrl e fingerprint API key
- Log errore 401 con hint diagnostici
- Messaggio errore più dettagliato per 401

---

## 📝 Diff Description

### `lib/adapters/couriers/spedisci-online.ts`

**Lines 156-180** (Constructor):
- Aggiunta validazione baseUrl
- Aggiunto logging baseUrl (demo vs production)
- Warning se formato errato

**Lines 344-469** (createShipmentJSON):
- Rimossa logica loop strategie multiple
- Usa SOLO Bearer token
- Migliorato logging diagnostico
- Messaggi errore più chiari

**Lines 320-335** (getTracking):
- ✅ Già usa Bearer correttamente (nessun cambio)

**Lines 182-195** (connect):
- ✅ Già usa Bearer correttamente (nessun cambio)

---

## 🧪 Smoke Test Steps

### Test 1: Verifica Base URL nei Log

**Dopo deploy, cerca nei log Vercel**:
```
🔧 [SPEDISCI.ONLINE] Base URL configurato: {
  baseUrl: "https://...",
  isDemo: false,
  isProduction: true
}
```

**Se `isDemo: true` ma dovrebbe essere production**:
- Verifica configurazione in `/dashboard/admin/configurations`
- Base URL production: `https://{tuodominio}.spedisci.online/api/v2/`

### Test 2: Test Creazione Spedizione

1. **Login** in produzione
2. **Crea spedizione** con corriere supportato (es: GLS, Poste)
3. **Verifica log Vercel**:

**Successo**:
```
📡 [SPEDISCI.ONLINE] API call: {
  method: "POST",
  url: "https://...spedisci.online/api/v2/shipping/create",
  baseUrl: "https://...spedisci.online/api/v2/",
  apiKeyFingerprint: "abc12345",
  authHeader: "Bearer [REDACTED]"
}

✅ [SPEDISCI.ONLINE] Success: {
  status: 200,
  hasTracking: true,
  hasLabel: true
}
```

**Errore 401 (se ancora presente)**:
```
❌ [SPEDISCI.ONLINE] API error: {
  status: 401,
  baseUrl: "https://...",
  hint: "Verifica: 1) API key valida, 2) Base URL corretto (demo vs production), 3) Bearer token formato corretto"
}
```

### Test 3: Verifica Configurazione Database

```sql
-- In Supabase SQL Editor
SELECT 
  name,
  provider_id,
  base_url,
  is_active,
  is_default
FROM courier_configs
WHERE provider_id = 'spedisci_online'
AND is_active = true
ORDER BY is_default DESC;
```

**Verifica**:
- ✅ `base_url` contiene `spedisci.online`
- ✅ `base_url` contiene `/api/v2`
- ✅ `base_url` corretto per ambiente (demo vs production)

### Test 4: Test Manuale con curl (Opzionale)

```bash
# Sostituisci con valori reali
API_KEY="tua_api_key_qui"
BASE_URL="https://tuodominio.spedisci.online/api/v2"

curl -X POST "${BASE_URL}/shipping/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d '{
    "carrierCode": "gls",
    "contractCode": "gls-contract-code",
    "packages": [{"length": 10, "width": 10, "height": 10, "weight": 1}],
    "shipFrom": {
      "name": "Test Sender",
      "street1": "Via Test 1",
      "city": "Milano",
      "state": "MI",
      "postalCode": "20100",
      "country": "IT"
    },
    "shipTo": {
      "name": "Test Recipient",
      "street1": "Via Test 2",
      "city": "Roma",
      "state": "RM",
      "postalCode": "00100",
      "country": "IT"
    },
    "notes": "Test shipment",
    "insuranceValue": 0,
    "codValue": 0,
    "accessoriServices": []
  }'
```

**Risultato atteso**: Status 200 con tracking number

---

## 🔍 Troubleshooting

### Se ancora 401 dopo fix:

1. **Verifica API Key**:
   - Spedisci.Online Dashboard → Impostazioni → Chiave API
   - Aggiorna in `/dashboard/admin/configurations` se cambiata

2. **Verifica Base URL**:
   - Demo: `https://demo1.spedisci.online/api/v2/`
   - Production: `https://{tuodominio}.spedisci.online/api/v2/`
   - Deve corrispondere all'ambiente dell'API key

3. **Verifica Decriptazione**:
   - Cerca nei log: `CREDENTIAL_DECRYPT_FAILED`
   - Se presente, riconfigura credenziali

4. **Verifica Header Authorization**:
   - Nei log dovresti vedere: `authHeader: "Bearer [REDACTED]"`
   - Se non vedi "Bearer", c'è un problema

---

## ✅ Checklist

- [x] Fix applicato (rimossa strategie multiple)
- [x] Validazione baseUrl aggiunta
- [x] Logging diagnostico migliorato
- [ ] Deploy Vercel completato
- [ ] Test creazione spedizione funziona
- [ ] Nessun errore 401 nei log
- [ ] Base URL corretto (demo vs production)

---

**Status**: Fix pronto per deploy e test ✅
