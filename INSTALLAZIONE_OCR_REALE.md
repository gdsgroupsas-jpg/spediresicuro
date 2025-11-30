# 🔍 Installazione OCR Reale con Tesseract.js

**Problema:** Il mock OCR genera dati casuali, non analizza l'immagine reale.

**Soluzione:** Installare Tesseract.js per OCR reale e gratuito.

---

## ✅ Cosa Ho Fatto

1. ✅ **Implementato TesseractAdapter** con OCR reale
2. ✅ **Pattern matching avanzato** per estrarre dati dal testo
3. ✅ **Fallback automatico** a mock migliorato se Tesseract non disponibile
4. ✅ **Auto-rilevamento** Tesseract nell'API route

---

## 📦 Installazione

### Opzione 1: Installazione Completa (Consigliata)

```bash
npm install tesseract.js
```

**Tempo installazione:** ~2-3 minuti (scarica modelli linguistici)

### Opzione 2: Solo per Test

Se vuoi testare subito senza installare, il sistema userà automaticamente il mock migliorato.

---

## 🚀 Dopo l'Installazione

1. **Riavvia il server:**
   ```bash
   # Ferma il server (Ctrl+C)
   npm run dev
   ```

2. **Testa OCR:**
   - Vai su `/dashboard/spedizioni/nuova`
   - Clicca "AI Import"
   - Carica un'immagine con testo reale
   - Verifica che i dati vengano estratti correttamente

---

## 🎯 Come Funziona Ora

### Con Tesseract Installato:
1. ✅ Analizza **realmente** l'immagine
2. ✅ Estrae testo dall'immagine
3. ✅ Usa pattern matching per trovare:
   - Nome (dopo "destinatario", "spedire a", etc.)
   - Indirizzo (via, corso, piazza + numero)
   - CAP (5 cifre)
   - Città (dopo CAP)
   - Provincia (2-3 lettere tra parentesi)
   - Telefono (3xx o 0xx)
   - Email (pattern standard)
   - Note (dopo "note", "osservazioni")

### Senza Tesseract (Mock Migliorato):
- ✅ Genera dati più vari e realistici
- ✅ Più nomi, città, indirizzi
- ✅ Telefoni più realistici
- ✅ Email più varie

---

## 📊 Qualità OCR

### Tesseract.js:
- ✅ **Gratuito** e open-source
- ✅ **Supporta italiano** (ita+eng)
- ✅ **Buona accuratezza** su testo chiaro
- ⚠️ **Richiede immagini di qualità** (testo leggibile)
- ⚠️ **Più lento** del mock (~2-5 secondi)

### Mock Migliorato:
- ✅ **Istantaneo** (~1-2 secondi)
- ✅ **Sempre disponibile**
- ❌ **Non analizza l'immagine reale**

---

## 🔧 Configurazione Avanzata

### Variabile Ambiente (Opzionale):

Nel `.env.local` puoi forzare il tipo OCR:

```env
# Forza Tesseract (se installato)
OCR_TYPE=tesseract

# Forza Mock
OCR_TYPE=mock

# Auto-rilevamento (default)
OCR_TYPE=auto
```

---

## 🧪 Test Qualità

### Test 1: Immagine con Testo Chiaro
- Screenshot WhatsApp con indirizzo
- Foto documento con testo leggibile
- **Risultato atteso:** Dati estratti correttamente

### Test 2: Immagine con Testo Poco Chiaro
- Foto sfocata
- Testo piccolo
- **Risultato atteso:** Alcuni dati estratti, altri mancanti

### Test 3: Immagine senza Testo
- Foto normale
- **Risultato atteso:** Dati mock (se Tesseract non trova nulla)

---

## 💡 Suggerimenti per Migliorare Qualità

1. **Usa immagini di qualità:**
   - Testo chiaro e leggibile
   - Buona risoluzione (min 300x300px)
   - Contrasto buono

2. **Formato immagine:**
   - JPG, PNG, GIF supportati
   - Evita immagini troppo compresse

3. **Orientamento:**
   - Testo orizzontale funziona meglio
   - Tesseract ruota automaticamente se necessario

---

## 📝 Note Tecniche

- **Tesseract.js** è una libreria JavaScript che usa Tesseract OCR
- **Modelli linguistici** vengono scaricati automaticamente alla prima esecuzione
- **Worker** viene creato una volta e riutilizzato per performance
- **Pattern matching** estrae dati strutturati dal testo OCR

---

## ✅ Checklist

- [x] TesseractAdapter implementato
- [x] Pattern matching avanzato
- [x] Fallback automatico
- [x] Auto-rilevamento Tesseract
- [ ] **Installa Tesseract.js** (`npm install tesseract.js`)
- [ ] **Riavvia server** e testa

---

**Vuoi installare Tesseract.js ora?** 🚀

```bash
npm install tesseract.js
```

Poi riavvia il server e prova con un'immagine reale!


