# Sprint 2.5: OCR Immagini - Guida Decisionale

**Stato:** 🟡 IN DEFINIZIONE  
**Obiettivo:** Implementare estrazione dati da immagini in `ocrWorker`  
**Data:** 2025-12-27

---

## 📋 CHECKLIST DECISIONI (da compilare)

### 1. ARCHITETTURA

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Riuso vs Riscrittura** | A) Riusare `extractData()` + mapping | ⬜ | |
| | B) Riscrivere prompt per output `ShipmentDraft` diretto | ⬜ | |
| | C) Ibrido: nuovo prompt ma stessa infrastruttura LLM | ⬜ | |

**Pro/Contro:**
- **Opzione A:** Meno codice nuovo, ma schema mismatch da gestire
- **Opzione B:** Schema pulito, ma duplicazione logica LLM
- **Opzione C:** Bilanciato, riusa LLM setup ma prompt ottimizzato

---

### 2. TEST & FIXTURE

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Immagini di test** | A) Screenshot WhatsApp anonimizzati | ⬜ | |
| | B) Etichette spedizione generate | ⬜ | |
| | C) Immagini sintetiche con dati noti | ⬜ | |
| | D) Mix di tutte | ⬜ | |

**Requisiti fixture:**
- [ ] Almeno 5 immagini con dati completi (CAP, città, provincia, peso)
- [ ] Almeno 3 immagini con dati parziali
- [ ] Almeno 2 immagini "rumorose" (watermark, loghi, multi-colonna)
- [ ] Almeno 1 immagine illeggibile (per testare fallback)

---

### 3. FALLBACK STRATEGY

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Se Gemini fallisce** | A) Clarification immediata | ⬜ | |
| | B) Retry con timeout | ⬜ | |
| | C) Fallback a OCR adapter (Tesseract) | ⬜ | |
| **Se confidence basso** | A) Mostra draft con warning | ⬜ | |
| | B) Chiedi conferma esplicita | ⬜ | |
| | C) Blocca e chiedi chiarimento | ⬜ | |

---

### 4. FEATURE FLAG

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Nome flag** | A) `ENABLE_OCR_IMAGES` | ⬜ | |
| | B) `OCR_VISION_ENABLED` | ⬜ | |
| | C) `FEATURE_OCR_VISION` | ⬜ | |
| **Default** | A) `false` (opt-in) | ⬜ | |
| | B) `true` (opt-out) | ⬜ | |

---

### 5. CONFIDENCE SCORING

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Granularità** | A) Score globale per estrazione | ⬜ | |
| | B) Score per singolo campo | ⬜ | |
| **Soglia minima** | A) 0.7 (70%) | ⬜ | |
| | B) 0.8 (80%) | ⬜ | |
| | C) Configurabile | ⬜ | |

---

## 🔧 SCHEMA OUTPUT ATTESO

### Da `extractData()` (legacy)
```typescript
shipmentData: {
  recipient_name: string;
  recipient_address: string;
  recipient_city: string;
  recipient_zip: string;
  recipient_province: string;
  recipient_phone: string;
  recipient_email: string;
  cash_on_delivery_amount: number | null;
  notes: string;
}
```

### Target `ShipmentDraft`
```typescript
shipmentDraft: {
  recipient: {
    fullName: string;
    addressLine1: string;
    city: string;
    postalCode: string;  // 5 cifre
    province: string;    // 2 lettere
    phone: string;
    email: string;
    country: 'IT';
  };
  parcel: {
    weightKg: number;
  };
  options: {
    cashOnDelivery: number | null;
  };
  missingFields: string[];
}
```

### Mapping necessario
```typescript
// Da legacy a nuovo
const mapping = {
  'recipient_name': 'recipient.fullName',
  'recipient_address': 'recipient.addressLine1',
  'recipient_city': 'recipient.city',
  'recipient_zip': 'recipient.postalCode',
  'recipient_province': 'recipient.province',
  'recipient_phone': 'recipient.phone',
  'recipient_email': 'recipient.email',
  'cash_on_delivery_amount': 'options.cashOnDelivery',
};
```

---

## 📁 FILE DA MODIFICARE

| File | Modifica |
|------|----------|
| `lib/agent/workers/ocr.ts` | Sostituire placeholder (righe 427-440) con implementazione reale |
| `lib/config.ts` | Aggiungere feature flag `OCR_VISION_ENABLED` |
| `tests/unit/ocr-worker.test.ts` | Aggiungere test con fixture immagini |
| `tests/fixtures/images/` | Creare cartella con immagini di test |

---

## 📊 METRICHE SUCCESSO

- [ ] Test con immagini reali passano
- [ ] Nessun PII nei log
- [ ] Fallback funzionante se Gemini down
- [ ] Feature flag attivo/disattivo funziona
- [ ] ShipmentDraft prodotto correttamente
- [ ] Merge con draft esistente non distruttivo

---

## ⚠️ ANTI-CARTONATO CHECKLIST

Prima di considerare DONE:

- [ ] **Test con immagine reale** (non mock) passa
- [ ] **Test con immagine illeggibile** ritorna clarification (non crash)
- [ ] **Test con Gemini API key mancante** ritorna clarification (non crash)
- [ ] **Test anti-hallucination**: immagine senza CAP non produce CAP inventato
- [ ] **Telemetria** non contiene base64 o dati estratti

---

## 🚦 STATO CORRENTE

```
[ ] Decisioni architettura prese
[ ] Fixture immagini pronte
[ ] Feature flag implementato
[ ] Implementazione ocrWorker
[ ] Test unitari
[ ] Test integrazione
[ ] Documentazione MIGRATION_MEMORY
[ ] Review & merge
```

---

## PROSSIMI PASSI

1. **Compila le decisioni sopra** (marca con ✅)
2. **Fornisci/valida fixture immagini** 
3. **Via libera per implementazione**


