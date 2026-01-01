# 🚀 PROMPT IMPLEMENTAZIONE P3 - AI Agent Business Value

**Data:** 1 Gennaio 2026  
**Obiettivo:** Trasformare telemetria in valore utente, kill friction, validazione monetaria  
**Base:** P1 e P2 completati e testati

---

## 📋 CONTESTO

P1 e P2 hanno creato l'infrastruttura tecnica. **P3 deve creare valore misurabile per l'utente.**

**Principi P3:**
- ✅ **80% user-facing** - L'utente vede e sente il valore
- ✅ **20% tech di supporto** - Solo quello necessario per il valore
- ❌ **0% "bella architettura"** - Niente refactoring fine a sé stesso

**Decisione finale:** CEO

---

## 🎯 TODO P3 (Business Value - Non Architettura)

### Task 1: Value Dashboard - "Hai risparmiato X minuti" (3 giorni)
**File:** 
- `components/anne/ValueDashboard.tsx` (NUOVO)
- `app/api/ai/value-stats/route.ts` (NUOVO)

**Requisiti:**
- Componente UI che mostra all'utente:
  - "Hai risparmiato X minuti questa settimana" (calcolato da telemetria)
  - "Abbiamo evitato Y errori" (calcolato da fallback/retry)
  - "Confidence media: Z%" (da confidenceScore aggregato)
- Mostra solo se utente ha usato Anne almeno 3 volte
- Aggiornamento in tempo reale (non cache statica)
- Design minimale, non invasivo (badge o card piccola)

**Calcolo risparmio tempo:**
- Tempo medio preventivo manuale: 5 minuti (stima)
- Tempo medio con Anne: `duration_ms` da telemetria
- Risparmio = (5 min * numero richieste) - (somma duration_ms)

**Calcolo errori evitati:**
- Conta `fallbackToLegacy` con `fallbackReason != 'graph_error'`
- Conta `retry` events
- Ogni fallback/retry = errore potenziale evitato

**Riferimenti:**
- `lib/telemetry/logger.ts` - Eventi telemetria
- `lib/agent/orchestrator/state.ts` - confidenceScore
- Query Supabase: aggregare eventi per user_id_hash

**Pattern:**
```typescript
// In AnneAssistant.tsx
{hasValueStats && (
  <ValueDashboard userId={userId} />
)}
```

---

### Task 2: Auto-Proceed - Kill Friction (4 giorni)
**File:**
- `lib/agent/orchestrator/supervisor.ts` (modificare)
- `lib/agent/workers/booking.ts` (modificare)
- `components/anne/AutoProceedBanner.tsx` (NUOVO)

**Requisiti:**
- Se `confidenceScore > 85%` E `validationErrors.length === 0`:
  - **Auto-proceed** senza chiedere conferma utente
  - Mostra banner: "✅ Dati verificati, procedo automaticamente"
  - Permette "Annulla" se utente vuole controllare
- Se `confidenceScore > 70%` ma < 85%:
  - Mostra "Suggerimento: Dati quasi completi, procedi?" (1 click invece di form completo)
- Se `confidenceScore < 70%`:
  - Comportamento attuale (chiedi conferma completa)

**Soglie configurabili:**
- `AUTO_PROCEED_CONFIDENCE_THRESHOLD = 85` (env var)
- `SUGGEST_PROCEED_CONFIDENCE_THRESHOLD = 70` (env var)

**Applicare a:**
- Booking: se preflight passa E confidence > soglia → auto-book
- Pricing: se dati completi E confidence > soglia → mostra preventivi senza "calcola"
- Address: se normalizzazione OK E confidence > soglia → auto-accetta

**Riferimenti:**
- `lib/agent/orchestrator/state.ts` - confidenceScore, validationErrors
- `lib/agent/workers/booking.ts` - preflight checks
- `lib/agent/workers/address.ts` - address normalization

**Pattern:**
```typescript
// In supervisor.ts
if (state.confidenceScore > AUTO_PROCEED_THRESHOLD && !state.validationErrors.length) {
  return {
    next_step: 'auto_proceed',
    autoProceed: true,
    userMessage: '✅ Dati verificati, procedo automaticamente',
  };
}
```

---

### Task 3: Human Error Messages - "Errori spiegati come umani" (2 giorni)
**File:**
- `lib/agent/error-translator.ts` (NUOVO)
- `components/anne/HumanError.tsx` (NUOVO)

**Requisiti:**
- Trasformare errori tecnici in messaggi umani
- Esempi:
  - `"validationErrors: ['destinationZip']"` → "Manca il CAP di destinazione. Puoi indicarlo?"
  - `"fallbackReason: 'graph_error'"` → "Ho avuto un problema tecnico. Riprova tra un attimo."
  - `"preflightFailed: ['peso']"` → "Per procedere, ho bisogno del peso del pacco."
- Usa `debug_worker` (P2) per analisi errori
- Mostra sempre soluzione, non solo problema

**Mapping errori:**
- `validationErrors` → messaggi campo-specifici
- `fallbackReason` → messaggi sistema
- `preflightFailed` → messaggi booking
- `confidenceScore < 50` → "I dati non sono chiari, puoi riformulare?"

**Riferimenti:**
- `lib/agent/workers/debug.ts` - Analisi errori (P2)
- `lib/agent/orchestrator/state.ts` - validationErrors, confidenceScore

**Pattern:**
```typescript
// In error-translator.ts
export function translateError(error: AgentError): HumanMessage {
  if (error.type === 'validation') {
    return `Manca: ${error.field}. Puoi indicarlo?`;
  }
  if (error.type === 'system') {
    return 'Ho avuto un problema tecnico. Riprova tra un attimo.';
  }
  // ...
}
```

---

### Task 4: Smart Suggestions - Suggerimenti Proattivi (2 giorni)
**File:**
- `lib/agent/smart-suggestions.ts` (NUOVO)
- `components/anne/SmartSuggestions.tsx` (NUOVO)

**Requisiti:**
- Analizza telemetria utente per suggerimenti proattivi
- Esempi:
  - Se utente fa sempre preventivi per stesso destinatario → "Vuoi salvare questo destinatario?"
  - Se utente usa sempre stesso corriere → "Vuoi impostare GLS come predefinito?"
  - Se utente ha sempre stesso peso → "Pacco standard da 2kg?"
- Mostra solo 1 suggerimento alla volta (non spam)
- Utente può ignorare (non invasivo)

**Analisi telemetria:**
- Query Supabase: ultimi 10 preventivi utente
- Pattern detection: destinatario/corriere/peso ricorrenti
- Soglia: se stesso valore 3+ volte → suggerisci

**Riferimenti:**
- `lib/telemetry/logger.ts` - Eventi telemetria
- Query Supabase: `shipments` table per pattern

**Pattern:**
```typescript
// In smart-suggestions.ts
export async function getSmartSuggestion(userId: string): Promise<Suggestion | null> {
  const recentShipments = await getRecentShipments(userId, 10);
  const patterns = detectPatterns(recentShipments);
  
  if (patterns.recurringRecipient) {
    return {
      type: 'save_recipient',
      message: 'Vuoi salvare questo destinatario per prossime spedizioni?',
      action: 'save_recipient',
    };
  }
  // ...
}
```

---

## 🔒 VINCOLI E REGOLE

### Business Value (NON NEGOZIABILI)
1. ✅ **Misurabile:** Ogni feature deve avere metrica chiara (minuti risparmiati, errori evitati)
2. ✅ **User-facing:** L'utente deve VEDERE il valore, non solo "sentirlo"
3. ✅ **Non invasivo:** Suggerimenti opzionali, non obbligatori
4. ✅ **Fail-safe:** Auto-proceed sempre annullabile

### Architettura (MINIMA)
1. ✅ **Reutilizza P1/P2:** Usa telemetria esistente, non creare nuovo sistema
2. ✅ **Query semplici:** Aggregazioni Supabase, non data warehouse
3. ✅ **Cache locale:** localStorage per value stats (non query ogni volta)

### Testing
1. ✅ **Metriche reali:** Test con dati reali, non mock
2. ✅ **A/B ready:** Soglie configurabili per test A/B
3. ✅ **Fallback:** Se telemetria manca, nascondi feature (non crash)

---

## 📚 DOCUMENTAZIONE DA CONSULTARE

- `lib/telemetry/logger.ts` - Eventi telemetria disponibili
- `lib/agent/orchestrator/state.ts` - confidenceScore, validationErrors
- `lib/agent/workers/debug.ts` - Analisi errori (P2)
- `docs/MONEY_FLOWS.md` - Business context per messaggi

---

## ✅ DEFINITION OF DONE

Ogni task è considerato completo quando:

- [ ] Feature visibile all'utente (non solo backend)
- [ ] Metrica misurabile (minuti risparmiati, errori evitati, etc.)
- [ ] Test con dati reali (non solo mock)
- [ ] Non invasivo (utente può ignorare/annullare)
- [ ] Documentazione aggiornata (`MIGRATION_MEMORY.md`)
- [ ] Nessuna regressione (test esistenti passano)

---

## 🚀 ORDINE DI IMPLEMENTAZIONE CONSIGLIATO

1. **Task 3** (2d) - Human Error Messages - Quick win, valore immediato
2. **Task 1** (3d) - Value Dashboard - Mostra valore accumulato
3. **Task 2** (4d) - Auto-Proceed - Kill friction principale
4. **Task 4** (2d) - Smart Suggestions - Cherry on top

**Totale:** ~11 giorni

---

## 💬 ISTRUZIONI PER AI AGENT

1. **Focus su valore utente** - Non architettura, non refactoring
2. **Misura tutto** - Ogni feature deve avere metrica chiara
3. **Fail-safe** - Auto-proceed sempre annullabile, suggerimenti opzionali
4. **Reutilizza P1/P2** - Non creare nuovo sistema telemetria
5. **Test con dati reali** - Non solo mock, usa telemetria esistente

**Inizia con Task 3 (Human Error Messages) - è il più veloce e mostra valore immediato.**

---

## 📊 METRICHE DI SUCCESSO

### Task 1: Value Dashboard
- Utenti che vedono dashboard: >50% degli utenti attivi
- Engagement: click su "Dettagli" >10%

### Task 2: Auto-Proceed
- Auto-proceed rate: >30% delle richieste (confidence >85%)
- Annullamenti: <5% (utenti fiduciosi)
- Tempo medio booking: -40% (da 2min a 1.2min)

### Task 3: Human Error Messages
- Errori risolti senza supporto: +50%
- Tempo risoluzione errore: -60% (da 5min a 2min)

### Task 4: Smart Suggestions
- Acceptance rate: >20% (utenti accettano suggerimenti)
- Tempo creazione spedizione: -25% (da 3min a 2.25min)

---

*Prompt creato per implementazione P3 AI Agent Business Value*  
*Data: 1 Gennaio 2026*  
*Prerequisiti: P1 e P2 completati*

