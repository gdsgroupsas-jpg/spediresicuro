# ✅ Fix Completo: Spedisci.Online 401 Unauthorized

## 📊 Root Cause

**Problema**: 401 Unauthorized dopo aggiornamento API key

**Causa**: 
- Il codice provava **multiple strategie di autenticazione** (Bearer, Token, X-API-KEY) invece di usare **SOLO Bearer** come richiesto dall'OpenAPI spec
- Base URL non validato (possibile mismatch demo vs production)

**Evidenza OpenAPI Spec**:
- Documentazione: `Authorization: Bearer {api_key}`
- Codice precedente: provava 3 strategie diverse in sequenza

---

## 🛠️ Fix Applicati

### File: `lib/adapters/couriers/spedisci-online.ts`

#### 1. Rimossa strategie fallback multiple ✅

**PRIMA** (Lines 357-468):
```typescript
// Provava 3 strategie in sequenza
const authStrategies = [
  { name: 'Bearer', header: 'Authorization', value: `Bearer ${this.API_KEY}` },
  { name: 'Token', header: 'Authorization', value: this.API_KEY },
  { name: 'X-API-KEY', header: 'X-API-KEY', value: this.API_KEY },
];

for (let i = 0; i < authStrategies.length; i++) {
  // Prova ogni strategia...
}
```

**DOPO** (Lines 344-469):
```typescript
// Usa SOLO Bearer token (OpenAPI spec)
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `Bearer ${this.API_KEY}`,
};

// Singola chiamata con Bearer
const response = await fetch(url, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload),
});
```

#### 2. Validazione baseUrl ✅

**Aggiunto** (Lines 156-180):
- Validazione che baseUrl contenga `spedisci.online`
- Validazione che baseUrl contenga `/api/v2`
- Log per distinguere demo vs production
- Warning se formato errato

#### 3. Logging diagnostico migliorato ✅

**Aggiunto**:
- Log pre-request con baseUrl e fingerprint API key
- Log errore 401 con hint diagnostici specifici
- Messaggio errore più dettagliato per 401

---

## 📝 Files Changed

### `lib/adapters/couriers/spedisci-online.ts`

**Lines 156-180** (Constructor):
- ✅ Aggiunta validazione baseUrl
- ✅ Aggiunto logging baseUrl (demo vs production)
- ✅ Warning se formato errato

**Lines 344-469** (createShipmentJSON):
- ✅ Rimossa logica loop strategie multiple
- ✅ Usa SOLO Bearer token
- ✅ Migliorato logging diagnostico
- ✅ Messaggi errore più chiari per 401

**Note**: 
- `getTracking()` (Line 320) - ✅ Già usa Bearer correttamente
- `connect()` (Line 185) - ✅ Già usa Bearer correttamente

---

## 🧪 Smoke Test

### Test 1: Verifica Base URL

**Dopo deploy, cerca nei log Vercel**:
```
🔧 [SPEDISCI.ONLINE] Base URL configurato: {
  baseUrl: "https://tuodominio.spedisci.online/api/v2/",
  isDemo: false,
  isProduction: true
}
```

**Se `isDemo: true` ma dovrebbe essere production**:
- Verifica in `/dashboard/admin/configurations`
- Base URL production: `https://{tuodominio}.spedisci.online/api/v2/`

### Test 2: Test Creazione Spedizione

1. **Login** in produzione
2. **Crea spedizione** con corriere supportato
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

### Test 3: Verifica Configurazione

```sql
-- In Supabase SQL Editor
SELECT name, base_url, is_active, is_default
FROM courier_configs
WHERE provider_id = 'spedisci_online'
AND is_active = true;
```

**Verifica**:
- ✅ `base_url` contiene `spedisci.online`
- ✅ `base_url` contiene `/api/v2`
- ✅ `base_url` corretto per ambiente

---

## 🔍 Troubleshooting

### Se ancora 401:

1. **API Key errata/scaduta**:
   - Spedisci.Online Dashboard → Impostazioni → Chiave API
   - Aggiorna in `/dashboard/admin/configurations`

2. **Base URL errato**:
   - Demo: `https://demo1.spedisci.online/api/v2/`
   - Production: `https://{tuodominio}.spedisci.online/api/v2/`
   - Deve corrispondere all'ambiente dell'API key

3. **Decriptazione fallita**:
   - Cerca nei log: `CREDENTIAL_DECRYPT_FAILED`
   - Riconfigura credenziali se necessario

---

## ✅ Checklist

- [x] Fix applicato (rimossa strategie multiple)
- [x] Validazione baseUrl aggiunta
- [x] Logging diagnostico migliorato
- [ ] Deploy Vercel completato
- [ ] Test creazione spedizione funziona
- [ ] Nessun errore 401 nei log

---

**Status**: Fix pronto per commit e deploy ✅
