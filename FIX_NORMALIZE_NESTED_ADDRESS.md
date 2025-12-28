# 🔧 FIX: Mapping Campi Nested Indirizzo in Normalizer

**Data**: 2025-12-28  
**Problema**: Frontend invia `{ mittente: { città, provincia, cap }, destinatario: { ... } }` ma normalizer rimuove questi oggetti causando `sender_*` e `recipient_*` undefined  
**Causa**: Normalizer elimina oggetti non-JSONB PRIMA di estrarre i campi  
**Soluzione**: Estrai campi nested PRIMA di rimuovere gli oggetti

---

## 📋 PROBLEMA

### Payload Frontend
```javascript
{
  mittente: {
    città: "Milano",
    provincia: "MI",
    cap: "20100"
  },
  destinatario: {
    città: "Roma",
    provincia: "RM",
    cap: "00100"
  }
}
```

### Normalizer (PRIMA del fix)
```typescript
// 5. Normalizza altri tipi (string, number, boolean)
if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
  // Oggetto non JSONB → rimuovi (causa "[OBJECT]" nel payload)
  console.warn(`⚠️ [NORMALIZE] Campo ${key} è un oggetto non JSONB, rimosso`);
  continue; // ❌ Rimuove mittente/destinatario senza estrarre i campi
}
```

### Risultato
```javascript
{
  // ❌ sender_city: undefined
  // ❌ sender_province: undefined
  // ❌ sender_zip: undefined
  // ❌ recipient_city: undefined
  // ❌ recipient_province: undefined
  // ❌ recipient_zip: undefined
}
```

### Guardrail Failure
```
❌ [GUARDRAIL] Payload finale NON valido: {
  errors: [
    "sender_province invalida: 'undefined' (deve essere sigla 2 lettere maiuscole)",
    "recipient_province invalida: 'undefined' (deve essere sigla 2 lettere maiuscole)",
    "sender_zip invalido: 'undefined' (deve essere 5 cifre numeriche)",
    "recipient_zip invalido: 'undefined' (deve essere 5 cifre numeriche)"
  ]
}
```

---

## 📋 FIX IMPLEMENTATO

### File: `app/api/spedizioni/route.ts`

**Funzione**: `normalizeShipmentPayload`

#### 1. Estrai Campi Nested PRIMA del Loop

**Aggiunto all'inizio della funzione**:

```typescript
function normalizeShipmentPayload(payload: any): any {
  const normalized: any = {};
  
  // ⚠️ FIX CRITICO: Estrai campi nested da mittente/destinatario PRIMA di normalizzare
  // Frontend invia: { mittente: { città, provincia, cap }, destinatario: { ... } }
  // DB richiede: { sender_city, sender_province, sender_zip, recipient_city, ... }
  if (payload.mittente && typeof payload.mittente === 'object') {
    normalized.sender_city = payload.mittente.città || payload.mittente.city || null;
    normalized.sender_province = payload.mittente.provincia || payload.mittente.province || null;
    normalized.sender_zip = payload.mittente.cap || payload.mittente.zip || payload.mittente.postal_code || null;
    console.log('📋 [NORMALIZE] Estratti campi mittente:', {
      sender_city: normalized.sender_city,
      sender_province: normalized.sender_province,
      sender_zip: normalized.sender_zip,
    });
  }
  
  if (payload.destinatario && typeof payload.destinatario === 'object') {
    normalized.recipient_city = payload.destinatario.città || payload.destinatario.city || null;
    normalized.recipient_province = payload.destinatario.provincia || payload.destinatario.province || null;
    normalized.recipient_zip = payload.destinatario.cap || payload.destinatario.zip || payload.destinatario.postal_code || null;
    console.log('📋 [NORMALIZE] Estratti campi destinatario:', {
      recipient_city: normalized.recipient_city,
      recipient_province: normalized.recipient_province,
      recipient_zip: normalized.recipient_zip,
    });
  }
  
  // ... resto del loop
```

---

#### 2. Rimuovi mittente/destinatario DOPO Estrazione

**Modificato nel loop**:

```typescript
// 5. Normalizza altri tipi (string, number, boolean)
if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
  // ⚠️ FIX: Rimuovi mittente/destinatario DOPO averli mappati (già fatto sopra)
  if (key === 'mittente' || key === 'destinatario') {
    console.log(`✅ [NORMALIZE] Campo ${key} rimosso (già mappato a campi flat)`);
    continue; // OK: già estratto sopra
  }
  // Oggetto non JSONB → rimuovi (causa "[OBJECT]" nel payload)
  console.warn(`⚠️ [NORMALIZE] Campo ${key} è un oggetto non JSONB, rimosso per evitare "[OBJECT]"`);
  continue; // Rimuovi oggetti non JSONB
}
```

---

## 📋 RISULTATO

### Log Atteso (DOPO il fix)

```
📋 [NORMALIZE] Estratti campi mittente: {
  sender_city: "Milano",
  sender_province: "MI",
  sender_zip: "20100"
}
📋 [NORMALIZE] Estratti campi destinatario: {
  recipient_city: "Roma",
  recipient_province: "RM",
  recipient_zip: "00100"
}
✅ [NORMALIZE] Campo mittente rimosso (già mappato a campi flat)
✅ [NORMALIZE] Campo destinatario rimosso (già mappato a campi flat)
```

### Payload Normalizzato

```javascript
{
  sender_city: "Milano",        ✅
  sender_province: "MI",        ✅
  sender_zip: "20100",          ✅
  recipient_city: "Roma",       ✅
  recipient_province: "RM",     ✅
  recipient_zip: "00100",       ✅
  // ... altri campi
}
```

### Guardrail Passa

```
🔍 [SUPABASE] Campi indirizzo finali (PRIMA INSERT): {
  sender: {
    city: "Milano",
    province: "MI",    ✅ Valido
    zip: "20100"       ✅ Valido
  },
  recipient: {
    city: "Roma",
    province: "RM",    ✅ Valido
    zip: "00100"       ✅ Valido
  }
}
✅ [GUARDRAIL] Payload valido
✅ [SUPABASE] Spedizione salvata con successo
```

---

## 📋 TEST PLAN

### Test: Crea Spedizione con Campi Nested

**Payload**:
```json
{
  "mittenteNome": "Mario Rossi",
  "mittenteIndirizzo": "Via Roma 123",
  "mittente": {
    "città": "Milano",
    "provincia": "MI",
    "cap": "20100"
  },
  "destinatarioNome": "Luigi Verdi",
  "destinatarioIndirizzo": "Via Milano 456",
  "destinatario": {
    "città": "Roma",
    "provincia": "RM",
    "cap": "00100"
  },
  "peso": "2.5",
  "corriere": "GLS"
}
```

**Verifiche Log**:
1. ✅ `📋 [NORMALIZE] Estratti campi mittente: { sender_city: "Milano", sender_province: "MI", sender_zip: "20100" }`
2. ✅ `📋 [NORMALIZE] Estratti campi destinatario: { recipient_city: "Roma", recipient_province: "RM", recipient_zip: "00100" }`
3. ✅ `✅ [NORMALIZE] Campo mittente rimosso (già mappato a campi flat)`
4. ✅ `✅ [NORMALIZE] Campo destinatario rimosso (già mappato a campi flat)`
5. ✅ `✅ [GUARDRAIL] Payload valido`
6. ✅ `✅ [SUPABASE] Spedizione salvata con successo`

**Verifica DB**:
```sql
SELECT 
  sender_city, 
  sender_province, 
  sender_zip,
  recipient_city, 
  recipient_province, 
  recipient_zip
FROM shipments
ORDER BY created_at DESC
LIMIT 1;
```

**Risultato Atteso**:
```
sender_city: "Milano"
sender_province: "MI"      ✅ NOT NULL
sender_zip: "20100"        ✅ NOT NULL
recipient_city: "Roma"
recipient_province: "RM"   ✅ NOT NULL
recipient_zip: "00100"     ✅ NOT NULL
```

---

## 📋 RIEPILOGO

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **Estrazione Campi** | ❌ NO (oggetti rimossi) | ✅ SÌ (estratti PRIMA) |
| **sender_city** | `undefined` ❌ | `"Milano"` ✅ |
| **sender_province** | `undefined` ❌ | `"MI"` ✅ |
| **sender_zip** | `undefined` ❌ | `"20100"` ✅ |
| **recipient_city** | `undefined` ❌ | `"Roma"` ✅ |
| **recipient_province** | `undefined` ❌ | `"RM"` ✅ |
| **recipient_zip** | `undefined` ❌ | `"00100"` ✅ |
| **Guardrail** | ❌ FALLISCE | ✅ PASSA |
| **INSERT** | ❌ FALLISCE | ✅ PASSA |

---

**Firma**:  
Senior Backend Engineer  
Data: 2025-12-28

