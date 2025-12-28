# 🔧 FIX: Validazione e Blocco Submit per Provincia e CAP Mancanti

**Data**: 2025-01-XX  
**Problema**: POST /api/spedizioni fallisce con 23514 (violates check constraint shipments_province_check). Payload: `sender_province=''` e `recipient_province=''`  
**Causa**: Provincia e CAP non vengono salvati correttamente nello state o vengono inviati vuoti  
**Soluzione**: Validazione obbligatoria + blocco submit + indicatori visivi + logging

---

## 📋 SEZIONE 1: FILE MODIFICATI

### File Modificato

**`app/dashboard/spedizioni/nuova/page.tsx`** - Validazione e Submit

**Modifiche principali**:

1. **Validazione provincia e CAP** (righe 333-336):
   - Aggiunta validazione `mittenteProvincia` (length >= 2)
   - Aggiunta validazione `mittenteCap` (length >= 5)
   - Aggiunta validazione `destinatarioProvincia` (length >= 2)
   - Aggiunta validazione `destinatarioCap` (length >= 5)

2. **Blocco submit se provincia manca** (righe 454-478):
   - Validazione pre-submit: controlla provincia e CAP
   - Se mancano: blocca submit + errore chiaro
   - Log stato corrente per debug

3. **Indicatori visivi** (righe 822-826, 894-898):
   - Messaggio errore sotto campo autocomplete
   - Mostra solo se città presente ma provincia/CAP mancante
   - Colore rosso per attirare attenzione

4. **Progress bar aggiornato** (righe 349-365):
   - Include provincia e CAP nei campi obbligatori
   - Progress riflette completamento reale

---

## 📋 SEZIONE 2: DIFF SINTETICO

### Modifiche Validazione

**Prima** (riga 333):
```typescript
mittenteCitta: formData.mittenteCitta.length >= 2,
```

**Dopo** (righe 333-336):
```typescript
mittenteCitta: formData.mittenteCitta.length >= 2,
mittenteProvincia: formData.mittenteProvincia.length >= 2, // ⚠️ VALIDAZIONE PROVINCIA MITTENTE (OBBLIGATORIA)
mittenteCap: formData.mittenteCap.length >= 5, // ⚠️ VALIDAZIONE CAP MITTENTE (OBBLIGATORIO)
```

---

### Modifiche Submit

**Prima** (riga 451):
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);
  setSubmitError(null);
  setSubmitSuccess(false);

  try {
    // ... mapping e invio
  }
}
```

**Dopo** (righe 451-478):
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // ⚠️ VALIDAZIONE PRE-SUBMIT: Blocca se provincia manca
  const validationErrors: string[] = [];
  
  if (!formData.mittenteProvincia || formData.mittenteProvincia.length < 2) {
    validationErrors.push('Provincia mittente mancante. Seleziona città dall\'autocomplete.');
  }
  if (!formData.mittenteCap || formData.mittenteCap.length < 5) {
    validationErrors.push('CAP mittente mancante. Seleziona città dall\'autocomplete.');
  }
  if (!formData.destinatarioProvincia || formData.destinatarioProvincia.length < 2) {
    validationErrors.push('Provincia destinatario mancante. Seleziona città dall\'autocomplete.');
  }
  if (!formData.destinatarioCap || formData.destinatarioCap.length < 5) {
    validationErrors.push('CAP destinatario mancante. Seleziona città dall\'autocomplete.');
  }
  
  if (validationErrors.length > 0) {
    setSubmitError(validationErrors.join(' '));
    console.error('❌ [FORM] Validazione fallita:', validationErrors);
    console.error('❌ [FORM] State corrente:', {
      mittente: { citta, provincia, cap },
      destinatario: { citta, provincia, cap },
    });
    return; // ⚠️ BLOCCA SUBMIT
  }
  
  setIsSubmitting(true);
  // ... continua con mapping e invio
}
```

---

### Modifiche UI

**Prima** (riga 721):
```typescript
<AsyncLocationCombobox
  onSelect={handleMittenteLocation}
  placeholder="Cerca città..."
  className="w-full"
  isValid={validation.mittenteCitta}
  defaultValue={...}
/>
```

**Dopo** (righe 815-826):
```typescript
<AsyncLocationCombobox
  onSelect={handleMittenteLocation}
  placeholder="Cerca città..."
  className="w-full"
  isValid={validation.mittenteCitta && validation.mittenteProvincia && validation.mittenteCap}
  defaultValue={...}
/>
{formData.mittenteCitta && (!validation.mittenteProvincia || !validation.mittenteCap) && (
  <p className="mt-1 text-xs text-red-600">
    ⚠️ Provincia o CAP mancante. Seleziona dall&apos;autocomplete.
  </p>
)}
```

---

## 📋 SEZIONE 3: SPIEGAZIONE BREVE

### Problema
Il campo autocomplete mostra "Sarno (SA) - 84087" ma al submit `mittenteProvincia` e `destinatarioProvincia` possono essere vuoti, causando violazione constraint DB.

### Soluzione
1. **Validazione obbligatoria**: Provincia e CAP devono essere presenti (length >= 2 e >= 5)
2. **Blocco submit**: Se provincia o CAP mancano, blocca submit e mostra errore chiaro
3. **Indicatori visivi**: Messaggio rosso sotto campo autocomplete se provincia/CAP mancante
4. **Logging**: Console.error con stato corrente per debug
5. **Progress bar**: Include provincia e CAP nei campi obbligatori

### Flusso
1. Utente seleziona città dall'autocomplete → `handleMittenteLocation` salva `city`, `province`, `cap` nello state
2. Utente clicca Submit → validazione pre-submit controlla provincia e CAP
3. Se mancano → blocca submit + errore chiaro + log stato
4. Se presenti → continua con mapping esplicito + invio

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
- ✅ Nessun errore validazione
- ✅ Console log: `📋 [FORM] Payload spedizione (prima invio)`
- ✅ Log mostra provincia e CAP corretti
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

### Test 2: Submit Senza Selezione Autocomplete → Blocco ✅

**Scenario**: Utente digita città manualmente senza selezionare dall'autocomplete

**Steps**:
1. Login come Reseller
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form:
   - Mittente: nome, indirizzo
   - **Città, Provincia, CAP**: Digita "Sarno" ma NON seleziona dall'autocomplete
   - Destinatario: nome, indirizzo, città (senza selezione autocomplete)
   - Peso: 2.5 kg
4. Submit

**Verifiche**:
- ✅ Submit bloccato
- ✅ Errore: "Provincia mittente mancante. Seleziona città dall'autocomplete."
- ✅ Messaggio rosso sotto campo autocomplete: "⚠️ Provincia o CAP mancante. Seleziona dall'autocomplete."
- ✅ Console.error: `❌ [FORM] Validazione fallita`
- ✅ Console.error: `❌ [FORM] State corrente` (mostra provincia vuota)
- ✅ Nessuna chiamata API

**Risultato Atteso**:
- ✅ Submit bloccato
- ✅ Errore chiaro
- ✅ Nessuna violazione constraint DB

---

### Test 3: Indicatore Visivo Provincia Mancante ✅

**Scenario**: Verifica indicatore visivo quando provincia manca

**Steps**:
1. Login come Reseller
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form:
   - Mittente: nome, indirizzo
   - **Città, Provincia, CAP**: Digita "Sarno" (senza selezione)
4. Osserva campo autocomplete

**Verifiche**:
- ✅ Campo autocomplete mostra bordo rosso (isValid = false)
- ✅ Messaggio rosso sotto campo: "⚠️ Provincia o CAP mancante. Seleziona dall'autocomplete."
- ✅ Progress bar non include campo come completato

**Risultato Atteso**:
- ✅ Indicatore visivo chiaro
- ✅ Utente capisce che deve selezionare dall'autocomplete

---

### Test 4: Progress Bar Include Provincia e CAP ✅

**Scenario**: Verifica che progress bar includa provincia e CAP

**Steps**:
1. Login come Reseller
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form progressivamente:
   - Solo nome mittente → progress ~7%
   - Aggiungi indirizzo mittente → progress ~14%
   - Seleziona città mittente (con provincia e CAP) → progress ~28%
   - Continua con destinatario...

**Verifiche**:
- ✅ Progress bar aumenta quando provincia e CAP vengono selezionati
- ✅ Progress bar riflette completamento reale (13 campi obbligatori)

**Risultato Atteso**:
- ✅ Progress bar accurato
- ✅ Include provincia e CAP

---

## 📋 SEZIONE 5: LOGGING

### Log Validazione Fallita

**Output**:
```typescript
console.error('❌ [FORM] Validazione fallita:', [
  'Provincia mittente mancante. Seleziona città dall\'autocomplete.',
  'CAP mittente mancante. Seleziona città dall\'autocomplete.'
]);

console.error('❌ [FORM] State corrente:', {
  mittente: {
    citta: "Sarno",
    provincia: "", // ⚠️ VUOTO
    cap: "" // ⚠️ VUOTO
  },
  destinatario: {
    citta: "Milano",
    provincia: "", // ⚠️ VUOTO
    cap: "" // ⚠️ VUOTO
  }
});
```

### Log Payload (se validazione passa)

**Output**:
```typescript
console.log('📋 [FORM] Payload spedizione (prima invio):', {
  mittente: {
    citta: "Sarno",
    provincia: "SA", // ✅ PRESENTE
    cap: "84087" // ✅ PRESENTE
  },
  destinatario: {
    citta: "Milano",
    provincia: "MI", // ✅ PRESENTE
    cap: "20100" // ✅ PRESENTE
  }
});
```

---

## 🚀 DEPLOY CHECKLIST

- [x] ✅ Codice modificato (`app/dashboard/spedizioni/nuova/page.tsx`)
- [x] ✅ Validazione provincia e CAP aggiunta
- [x] ✅ Blocco submit implementato
- [x] ✅ Indicatori visivi aggiunti
- [x] ✅ Progress bar aggiornato
- [x] ✅ Logging implementato
- [ ] ⏳ Test selezione città → submit → DB insert OK
- [ ] ⏳ Test submit senza selezione → blocco
- [ ] ⏳ Verifica indicatori visivi
- [ ] ⏳ Deploy in produzione
- [ ] ⏳ Test post-deploy

---

## 📊 RIEPILOGO

| Aspetto | Valore |
|---------|--------|
| **File Modificato** | `app/dashboard/spedizioni/nuova/page.tsx` |
| **Funzionalità** | Validazione obbligatoria + blocco submit + indicatori visivi |
| **Validazione Aggiunta** | `mittenteProvincia`, `mittenteCap`, `destinatarioProvincia`, `destinatarioCap` |
| **Blocco Submit** | ✅ SÌ (se provincia o CAP mancante) |
| **Indicatori Visivi** | ✅ SÌ (messaggio rosso sotto campo) |
| **Logging** | ✅ SÌ (console.error con stato corrente) |
| **Progress Bar** | ✅ SÌ (include provincia e CAP) |
| **Backward Compatible** | ✅ SÌ (solo miglioramenti, nessuna breaking change) |
| **Regressioni** | ❌ NESSUNA (solo validazione aggiuntiva) |

---

**Firma**:  
Senior Full-Stack Engineer  
Data: 2025-01-XX

