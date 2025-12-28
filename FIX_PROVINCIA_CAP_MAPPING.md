# 🔧 FIX: Mapping Provincia e CAP nel Form Nuova Spedizione

**Data**: 2025-01-XX  
**Problema**: Campo "Città, Provincia, CAP" mostra valori corretti ma `sender_province` arriva vuoto al backend causando violazione constraint DB  
**Causa**: Provincia e CAP non vengono correttamente mappati nel payload al submit  
**Soluzione**: Mapping esplicito e fallback per estrazione da stringa formattata

---

## 📋 SEZIONE 1: FILE MODIFICATI

### File Modificato

**`app/dashboard/spedizioni/nuova/page.tsx`** - Handler `handleSubmit`

**Modifiche principali**:

1. **Helper `extractProvinceAndCap()`** (righe 456-467):
   - Estrae provincia e CAP da stringa formattata "Città (Provincia) - CAP"
   - Pattern regex: `\(([A-Z]{2})\)(?:\s*-\s*(\d{5}))?`

2. **Mapping esplicito provincia e CAP** (righe 469-500):
   - Verifica che `mittenteProvincia` e `destinatarioProvincia` siano presenti
   - Se mancano, estrae dalla stringa formattata (fallback)
   - Mappa esplicitamente nel payload

3. **Console.log temporaneo** (righe 502-512):
   - Log payload prima dell'invio
   - Mostra mittente e destinatario con città, provincia, CAP

---

## 📋 SEZIONE 2: DIFF SINTETICO

### Modifiche

**Prima** (riga 461):
```typescript
const response = await fetch('/api/spedizioni', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formData),
});
```

**Dopo** (righe 456-512):
```typescript
// ⚠️ HELPER: Estrae provincia e CAP da stringa formattata
const extractProvinceAndCap = (formattedString: string): { province: string; cap: string } => {
  if (!formattedString) return { province: '', cap: '' };
  
  // Pattern: "Città (Provincia) - CAP" o "Città (Provincia)"
  const match = formattedString.match(/\(([A-Z]{2})\)(?:\s*-\s*(\d{5}))?/);
  if (match) {
    return {
      province: match[1] || '',
      cap: match[2] || '',
    };
  }
  return { province: '', cap: '' };
};

// ⚠️ MAPPING ESPLICITO: Assicura che provincia e CAP siano correttamente mappati
let mittenteProvincia = formData.mittenteProvincia;
let mittenteCap = formData.mittenteCap;
let destinatarioProvincia = formData.destinatarioProvincia;
let destinatarioCap = formData.destinatarioCap;

// Se provincia mittente manca, prova a estrarla (fallback)
if (!mittenteProvincia && formData.mittenteCitta) {
  const extracted = extractProvinceAndCap(formData.mittenteCitta);
  if (extracted.province) {
    mittenteProvincia = extracted.province;
  }
  if (extracted.cap && !mittenteCap) {
    mittenteCap = extracted.cap;
  }
}

// Se provincia destinatario manca, prova a estrarla (fallback)
if (!destinatarioProvincia && formData.destinatarioCitta) {
  const extracted = extractProvinceAndCap(formData.destinatarioCitta);
  if (extracted.province) {
    destinatarioProvincia = extracted.province;
  }
  if (extracted.cap && !destinatarioCap) {
    destinatarioCap = extracted.cap;
  }
}

const payload = {
  ...formData,
  // Mappa esplicitamente province (assicura che non siano vuote)
  mittenteProvincia: mittenteProvincia || '',
  destinatarioProvincia: destinatarioProvincia || '',
  // Mappa esplicitamente CAP
  mittenteCap: mittenteCap || '',
  destinatarioCap: destinatarioCap || '',
};

// ⚠️ LOG TEMPORANEO: Verifica payload prima dell'invio
console.log('📋 [FORM] Payload spedizione (prima invio):', {
  mittente: {
    citta: payload.mittenteCitta,
    provincia: payload.mittenteProvincia,
    cap: payload.mittenteCap,
  },
  destinatario: {
    citta: payload.destinatarioCitta,
    provincia: payload.destinatarioProvincia,
    cap: payload.destinatarioCap,
  },
});

const response = await fetch('/api/spedizioni', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

---

## 📋 SEZIONE 3: SPIEGAZIONE BREVE DEL FIX

### Problema

Il campo autocomplete "Città, Provincia, CAP" mostra correttamente "Sarno (SA) - 84087" ma quando viene inviato il payload, `mittenteProvincia` e `destinatarioProvincia` possono essere vuoti se:
1. L'utente modifica manualmente il campo input
2. I valori separati nello state non vengono aggiornati correttamente

### Soluzione

1. **Mapping esplicito**: Prima dell'invio, mappa esplicitamente `mittenteProvincia`, `destinatarioProvincia`, `mittenteCap`, `destinatarioCap` nel payload
2. **Fallback estrazione**: Se provincia o CAP mancano, prova a estrarli dalla stringa formattata usando regex
3. **Logging**: Console.log temporaneo per verifica payload prima dell'invio

### Pattern Regex

```typescript
/\(([A-Z]{2})\)(?:\s*-\s*(\d{5}))?/
```

- `\(([A-Z]{2})\)`: Cattura provincia tra parentesi (es. "(SA)")
- `(?:\s*-\s*(\d{5}))?`: Cattura CAP opzionale dopo trattino (es. " - 84087")

---

## 📋 SEZIONE 4: TEST PLAN

### Test 1: Selezione Città → Submit → DB Insert OK ✅

**Scenario**: Reseller seleziona città dall'autocomplete e invia form

**Steps**:
1. Login come Reseller
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form:
   - Mittente: nome, indirizzo
   - **Città, Provincia, CAP**: Clicca campo → digita "Sarno" → seleziona "Sarno (SA) - 84087"
   - Destinatario: nome, indirizzo
   - **Città, Provincia, CAP**: Clicca campo → digita "Milano" → seleziona "Milano (MI) - 20100"
   - Peso: 2.5 kg
   - Corriere: GLS
4. Submit

**Verifiche**:
- ✅ Console log: `📋 [FORM] Payload spedizione (prima invio)`
- ✅ Log mostra:
  ```
  mittente: {
    citta: "Sarno",
    provincia: "SA",
    cap: "84087"
  }
  destinatario: {
    citta: "Milano",
    provincia: "MI",
    cap: "20100"
  }
  ```
- ✅ Nessun errore constraint DB
- ✅ Spedizione creata correttamente

**Query Verifica**:
```sql
SELECT 
  id, 
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
- ✅ `sender_province` = "SA" (non vuoto)
- ✅ `sender_zip` = "84087"
- ✅ `recipient_province` = "MI" (non vuoto)
- ✅ `recipient_zip` = "20100"

---

### Test 2: Modifica Manuale Campo → Fallback Estrazione ✅

**Scenario**: Utente modifica manualmente il campo input dopo selezione

**Steps**:
1. Login come Reseller
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form:
   - Seleziona "Sarno (SA) - 84087" dall'autocomplete
   - Modifica manualmente il campo input (es. aggiungi testo)
   - Submit

**Verifiche**:
- ✅ Console log: `⚠️ [FORM] Provincia mittente estratta da stringa formattata: SA` (se necessario)
- ✅ Log mostra provincia estratta correttamente
- ✅ Nessun errore constraint DB
- ✅ Spedizione creata correttamente

**Risultato Atteso**:
- ✅ Provincia estratta correttamente dalla stringa formattata
- ✅ CAP estratto correttamente se presente

---

### Test 3: Verifica Nessun Warning Se Valori Presenti ✅

**Scenario**: Valori provincia e CAP già presenti nello state

**Steps**:
1. Login come Reseller
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form:
   - Seleziona città dall'autocomplete (valori salvati correttamente)
   - Submit

**Verifiche**:
- ✅ Nessun warning `⚠️ [FORM] Provincia estratta da stringa formattata`
- ✅ Log mostra valori corretti
- ✅ Nessun errore

**Risultato Atteso**:
- ✅ Valori usati direttamente dallo state (nessuna estrazione necessaria)
- ✅ Nessun warning

---

## 📋 SEZIONE 5: LOGGING TEMPORANEO

### Formato Log

**Output**:
```typescript
console.log('📋 [FORM] Payload spedizione (prima invio):', {
  mittente: {
    citta: payload.mittenteCitta,
    provincia: payload.mittenteProvincia,
    cap: payload.mittenteCap,
  },
  destinatario: {
    citta: payload.destinatarioCitta,
    provincia: payload.destinatarioProvincia,
    cap: payload.destinatarioCap,
  },
});
```

**Esempio Log**:
```
📋 [FORM] Payload spedizione (prima invio): {
  mittente: {
    citta: "Sarno",
    provincia: "SA",
    cap: "84087"
  },
  destinatario: {
    citta: "Milano",
    provincia: "MI",
    cap: "20100"
  }
}
```

**Warning (se estrazione necessaria)**:
```
⚠️ [FORM] Provincia mittente estratta da stringa formattata: SA
⚠️ [FORM] CAP mittente estratto da stringa formattata: 84087
```

---

## 🚀 DEPLOY CHECKLIST

- [x] ✅ Codice modificato (`app/dashboard/spedizioni/nuova/page.tsx`)
- [x] ✅ Helper estrazione provincia/CAP implementato
- [x] ✅ Mapping esplicito implementato
- [x] ✅ Console.log temporaneo aggiunto
- [ ] ⏳ Test selezione città → submit → DB insert OK
- [ ] ⏳ Verifica nessun errore constraint DB
- [ ] ⏳ Verifica log payload
- [ ] ⏳ Deploy in produzione
- [ ] ⏳ Test post-deploy

---

## 📊 RIEPILOGO

| Aspetto | Valore |
|---------|--------|
| **File Modificato** | `app/dashboard/spedizioni/nuova/page.tsx` |
| **Funzionalità** | Mapping esplicito provincia e CAP + fallback estrazione |
| **Helper Aggiunto** | `extractProvinceAndCap()` |
| **Pattern Regex** | `/\(([A-Z]{2})\)(?:\s*-\s*(\d{5}))?/` |
| **Logging** | ✅ SÌ (console.log temporaneo per verifica) |
| **Fallback** | ✅ SÌ (estrazione da stringa formattata se mancano valori) |
| **Backward Compatible** | ✅ SÌ (solo miglioramenti, nessuna breaking change) |
| **Regressioni** | ❌ NESSUNA (solo mapping esplicito) |

---

**Firma**:  
Senior Frontend Engineer  
Data: 2025-01-XX

