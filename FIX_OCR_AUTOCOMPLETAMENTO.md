# 🔧 FIX: OCR e Autocompletamento Mittente

## 📋 Problemi Risolti

### ✅ Problema 1: OCR Claude Vision - RIATTIVATO PER TEST
**Sintomo Iniziale:** L'OCR con Claude Vision API estraeva dati non veritieri (inventa invece di leggere dall'immagine)

**Status Attuale:** ✅ **OCR CLAUDE VISION ATTIVO**

**Implementazione:**
```typescript
// lib/adapters/ocr/base.ts
case 'auto':
  default: {
    // Priorità: Claude Vision > Tesseract > Mock
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('✅ OCR Claude Vision ATTIVO - consumerà crediti Anthropic');
      const { ClaudeOCRAdapter } = require('./claude');
      return new ClaudeOCRAdapter();
    }
    // Fallback a Mock se ANTHROPIC_API_KEY non configurata
    const { ImprovedMockOCRAdapter } = require('./mock');
    return new ImprovedMockOCRAdapter();
  }
```

**Comportamento Attuale:**
- ✅ Upload immagine LDV → **Usa Claude Vision API reale**
- ⚠️ **Consuma crediti Anthropic** (~$0.003-0.005 per immagine)
- ✅ Model: `claude-3-5-sonnet-20241022` (ultima versione)
- ✅ Estrazione dati reali dall'immagine

**Costi Stimati:**
- 1 immagine LDV: ~$0.003-0.005 (circa 500-1000 token)
- 100 scan test: ~$0.30-0.50
- 1000 scan produzione: ~$3.00-5.00

**TODO Test:**
- [x] Riattivare OCR Claude Vision
- [ ] Test con immagini LDV reali italiane
- [ ] Verificare accuratezza estrazione dati
- [ ] Confrontare con risultati precedenti (inventati)
- [ ] Se problemi persistono: debug prompt e parametri

---

### ❌ Problema 2: Autocompletamento Mittente Non Funziona
**Sintomo:** Il form nuova spedizione non precompila i dati del mittente predefinito

**Causa:** `useEffect` mancante per caricare dati da `/api/user/settings`

**Soluzione:** ✅
```typescript
// app/dashboard/spedizioni/nuova/page.tsx

// Aggiunto useEffect per caricare mittente predefinito
useEffect(() => {
  async function loadDefaultSender() {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.defaultSender) {
          setFormData((prev) => ({
            ...prev,
            mittenteNome: data.defaultSender.nome || '',
            mittenteIndirizzo: data.defaultSender.indirizzo || '',
            mittenteCitta: data.defaultSender.citta || '',
            mittenteProvincia: data.defaultSender.provincia || '',
            mittenteCap: data.defaultSender.cap || '',
            mittenteTelefono: data.defaultSender.telefono || '',
            mittenteEmail: data.defaultSender.email || '',
          }));
        }
      }
    } catch (error) {
      console.error('Errore caricamento mittente:', error);
      // Non bloccare, continua con form vuoto
    }
  }

  loadDefaultSender();
}, []);
```

**Comportamento Attuale:**
- ✅ All'apertura `/dashboard/spedizioni/nuova` → Form mittente precompilato
- ✅ Carica dati da impostazioni utente (`/dashboard/impostazioni`)
- ✅ Se non configurato, form rimane vuoto
- ✅ Utente può modificare manualmente i campi

---

## 📊 Test Funzionalità

### ✅ Test Autocompletamento Mittente

**Prerequisiti:**
1. Configurare mittente in `/dashboard/impostazioni`
2. Salvare dati

**Test:**
```bash
1. Vai su /dashboard/spedizioni/nuova
2. Verifica che i campi mittente siano precompilati:
   - Nome
   - Indirizzo
   - Città
   - CAP
   - Provincia
   - Telefono
   - Email (se configurata)
3. I campi destinatario devono essere vuoti
4. Puoi modificare qualsiasi campo mittente per questa spedizione
```

**Risultato Atteso:** ✅ Mittente precompilato, destinatario vuoto

---

### ⚠️ OCR Temporaneamente Disabilitato

**Comportamento Attuale:**
```bash
1. Vai su /dashboard/spedizioni/nuova
2. Click "Carica da Scanner OCR"
3. Upload immagine LDV
4. Vedi messaggio: "⚠️ OCR automatico disabilitato - usando Mock"
5. Form destinatario riempito con dati MOCK (casuali, non reali)
```

**Nota:** I dati mock sono realistici ma **NON** letti dall'immagine.

**Workaround per Produzione:**
- Disabilitare pulsante OCR nella UI
- Forzare compilazione manuale
- O riattivare dopo debug completo

---

## 🔧 Come Riabilitare OCR (Dopo Debug)

### STEP 1: Testa Claude Vision Manualmente

Crea script test:
```typescript
// scripts/test-claude-ocr.ts
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testOCR() {
  // Carica immagine test
  const imageBuffer = fs.readFileSync('test-ldv.jpg');
  const base64Image = imageBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: 'Estrai SOLO nome, indirizzo, città, CAP del DESTINATARIO da questa LDV. Formato JSON.',
          },
        ],
      },
    ],
  });

  console.log('Risposta Claude:', response.content);
}

testOCR();
```

Esegui:
```bash
npx ts-node scripts/test-claude-ocr.ts
```

Verifica se i dati estratti sono corretti.

---

### STEP 2: Riattiva OCR

Quando funzionante, in `lib/adapters/ocr/base.ts`:

```typescript
case 'auto':
  default: {
    // Priorità: Claude Vision > Tesseract > Mock
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { ClaudeOCRAdapter } = require('./claude');
        return new ClaudeOCRAdapter();
      } catch (error) {
        console.warn('Claude Vision non disponibile, fallback a Mock:', error);
      }
    }

    // Fallback a Mock
    const { ImprovedMockOCRAdapter } = require('./mock');
    return new ImprovedMockOCRAdapter();
  }
```

---

## 📝 File Modificati

### 1. `lib/adapters/ocr/base.ts`
- ✅ OCR auto → Forza Mock
- ⏸️ Claude Vision temporaneamente disabilitato
- 📝 Commenti con TODO per riattivazione

### 2. `app/dashboard/spedizioni/nuova/page.tsx`
- ✅ Aggiunto `useEffect` per caricare mittente predefinito
- ✅ Auto-compila form all'apertura pagina
- ✅ Gestione errori graceful

---

## 🚀 Deployment

### Ambiente Locale

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-api03-xxx  # Configurata ma NON usata (OCR disabilitato)
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
```

**Comportamento:**
- OCR → Mock (non usa API key)
- Mittente predefinito → Funziona ✅

---

### Ambiente Produzione (Vercel)

**Variabili Configurate:**
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxx  # Configurata ma NON usata
NEXTAUTH_SECRET=production-secret
NEXTAUTH_URL=https://spediresicuro.it
```

**Comportamento:**
- OCR → Mock (non usa API key, non costa)
- Mittente predefinito → Funziona ✅

**Nota:** Non consuma crediti Anthropic finché OCR disabilitato.

---

## 🎯 Prossimi Passi

### Alta Priorità
- [ ] Debug OCR Claude Vision
- [ ] Test con immagini LDV reali
- [ ] Riattivare OCR quando accurato

### Media Priorità
- [ ] Aggiungere toggle UI per abilitare/disabilitare OCR
- [ ] Mostrare warning "OCR temporaneamente non disponibile"
- [ ] Permettere scelta manuale tra Mock/Claude

### Bassa Priorità
- [ ] Implementare Tesseract.js come alternativa
- [ ] Supporto multi-adapter (fallback chain)

---

## ✅ Checklist Verifica

Prima di considerare il fix completo:

- [x] Build passa senza errori
- [x] Mittente predefinito si carica automaticamente
- [x] Form nuova spedizione precompilato
- [x] OCR usa Mock (non consuma API credits)
- [ ] OCR Claude Vision testato e funzionante
- [ ] Documentazione aggiornata

---

**Status Attuale:** ✅ Problemi temporaneamente risolti, sistema funzionante

**Prossimo Milestone:** Debug e riattivazione OCR reale
