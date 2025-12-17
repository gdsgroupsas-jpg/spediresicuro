# 🔧 Fix: Spedisci.Online 401 Unauthorized

## 📊 Root Cause

**Problema**: 401 Unauthorized dopo aggiornamento API key

**Causa**: Il codice provava multiple strategie di autenticazione (Bearer, Token, X-API-KEY) in sequenza, ma l'OpenAPI spec di Spedisci.Online richiede **SOLO Bearer token**.

**Evidenza**:
- Documentazione OpenAPI: `Authorization: Bearer {api_key}`
- Codice precedente: provava 3 strategie diverse
- Questo può causare confusione se la prima strategia fallisce e prova le altre

---

## 🛠️ Fix Applicato

### File: `lib/adapters/couriers/spedisci-online.ts`

#### 1. Rimossa strategie fallback multiple (Lines 344-469)

**PRIMA**:
```typescript
// Provava 3 strategie diverse
const authStrategies = [
  { name: 'Bearer', header: 'Authorization', value: `Bearer ${this.API_KEY}` },
  { name: 'Token', header: 'Authorization', value: this.API_KEY },
  { name: 'X-API-KEY', header: 'X-API-KEY', value: this.API_KEY },
];
```

**DOPO**:
```typescript
// Usa SOLO Bearer token (come richiesto da OpenAPI spec)
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${this.API_KEY}`,
};
```

#### 2. Migliorato logging diagnostico

- Log pre-request con baseUrl e fingerprint API key
- Log errore 401 con hint diagnostici
- Messaggio errore più dettagliato per 401

#### 3. Validazione baseUrl (Lines 156-175)

**Aggiunto**:
- Validazione che baseUrl contenga `spedisci.online`
- Validazione che baseUrl contenga `/api/v2`
- Log per distinguere demo vs production
- Warning se baseUrl sembra errato

---

## 📝 Diff Summary

### `lib/adapters/couriers/spedisci-online.ts`

**Lines 156-175**: Aggiunta validazione baseUrl
- Verifica formato baseUrl
- Log demo vs production
- Warning se formato errato

**Lines 344-469**: Sostituito metodo `createShipmentJSON()`
- Rimossa logica fallback multiple strategie
- Usa SOLO Bearer token
- Migliorato logging diagnostico
- Messaggi errore più chiari per 401

---

## 🧪 Smoke Test

### Test 1: Verifica Base URL

**In produzione, verifica log**:
```
🔧 [SPEDISCI.ONLINE] Base URL configurato: {
  baseUrl: "https://...",
  isDemo: false,
  isProduction: true
}
```

**Se `isDemo: true` ma dovrebbe essere production**:
- Verifica configurazione in `/dashboard/admin/configurations`
- Base URL dovrebbe essere: `https://{tuodominio}.spedisci.online/api/v2/`

### Test 2: Test Creazione Spedizione

1. **Login** in produzione
2. **Crea spedizione** con corriere supportato (es: GLS)
3. **Verifica log Vercel**:

**Successo atteso**:
```
📡 [SPEDISCI.ONLINE] API call: {
  method: "POST",
  url: "https://...spedisci.online/api/v2/shipping/create",
  baseUrl: "https://...spedisci.online/api/v2/",
  apiKeyFingerprint: "...",
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
  hint: "Verifica: 1) API key valida, 2) Base URL corretto (demo vs production), 3) Bearer token formato corretto"
}
```

### Test 3: Verifica Configurazione Database

```sql
-- Verifica configurazione Spedisci.Online
SELECT 
  name,
  provider_id,
  base_url,
  is_active,
  is_default,
  created_at
FROM courier_configs
WHERE provider_id = 'spedisci_online'
AND is_active = true
ORDER BY is_default DESC, created_at DESC;
```

**Verifica**:
- ✅ `base_url` contiene `spedisci.online`
- ✅ `base_url` contiene `/api/v2`
- ✅ `base_url` corretto (demo vs production)

---

## 🔍 Troubleshooting

### Problema: Ancora 401 dopo fix

**Possibili cause**:

1. **API Key errata o scaduta**:
   - Verifica in Spedisci.Online dashboard → Impostazioni → Chiave API
   - Aggiorna in `/dashboard/admin/configurations`

2. **Base URL errato (demo vs production)**:
   - Demo: `https://demo1.spedisci.online/api/v2/`
   - Production: `https://{tuodominio}.spedisci.online/api/v2/`
   - Verifica che corrisponda all'ambiente dell'API key

3. **API Key non decriptata correttamente**:
   - Verifica log per: `CREDENTIAL_DECRYPT_FAILED`
   - Se presente, riconfigura credenziali (ENCRYPTION_KEY potrebbe essere cambiata)

### Verifica Manuale con curl

```bash
# Sostituisci con i tuoi valori
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

**Risultato atteso**: Status 200 con tracking number e label

**Se 401**: Verifica API key e base URL

---

## ✅ Checklist Post-Fix

- [ ] Fix applicato (commit pushato)
- [ ] Deploy Vercel completato
- [ ] Base URL verificato (demo vs production)
- [ ] API Key verificata (valida e aggiornata)
- [ ] Test creazione spedizione funziona
- [ ] Nessun errore 401 nei log
- [ ] Label generata correttamente

---

## 📚 Riferimenti

- **OpenAPI Spec**: https://spedisci.online/developer-api/index.html
- **Documentazione**: Richiede `Authorization: Bearer {api_key}`
- **File modificato**: `lib/adapters/couriers/spedisci-online.ts`

---

**Status**: Fix applicato ✅ - Pronto per test
