# Doc Sync Matrix - Agent Orchestrator

**Data:** 2025-12-26  
**Obiettivo:** Allineare documentazione con stato verificabile del codice (approccio "Docs as Evidence")

---

## File da Allineare (8 file identificati)

### 1. MIGRATION_MEMORY.md ✅ (COMPLETATO)
**Stato:** Aggiornato con evidenze verificabili

**Sezioni cambiate:**
- Stato fasi: DONE/NEXT aggiornato
- Evidenze per ogni DONE importante (file path + comandi)
- Sezione "Known Limits / Non-Garantito" aggiunta
- Sezione "Safety Invariants" aggiunta
- Metriche test con comandi di verifica

**Evidenza nel codice:**
- `lib/config.ts` esiste (122 righe)
- `tests/unit/processAddressCore.test.ts` esiste (26 test)
- `tests/unit/ocr-worker.test.ts` esiste (21 test)
- `tests/unit/booking-worker.test.ts` esiste (24 test)
- `lib/agent/logger.ts` esiste (51 righe, ILogger esportato)

**Come verificare:**
```bash
ls -la lib/config.ts tests/unit/processAddressCore.test.ts
npm run test:unit | grep "Test Files\|Tests"
```

---

### 2. README.md (root)
**Priorità:** Media  
**Sezioni da verificare:**
- Sezione "AI Agent (Anne)" (linea ~279)

**Evidenza nel codice:**
- `app/api/ai/agent-chat/route.ts` esiste
- `lib/agent/orchestrator/supervisor-router.ts` è entry point

**Azioni:**
- [ ] Verificare se menziona LangGraph/Supervisor (potrebbe essere obsoleto)
- [ ] Aggiungere riferimento a MIGRATION_MEMORY.md se manca
- [ ] Rimuovere affermazioni non verificabili

**Come verificare:**
```bash
grep -r "AI Agent\|Anne\|LangGraph" README.md
# Verificare se informazioni sono allineate con MIGRATION_MEMORY.md
```

---

### 3. docs/ARCHITECTURE.md
**Priorità:** Alta  
**Sezioni da verificare:**
- System Overview
- Architettura agent/orchestrator (se presente)

**Evidenza nel codice:**
- `lib/agent/orchestrator/` directory esiste
- `lib/agent/workers/` directory esiste
- `lib/agent/orchestrator/pricing-graph.ts` usa LangGraph

**Azioni:**
- [ ] Verificare se menziona architettura agent
- [ ] Se menziona, allineare con MIGRATION_MEMORY.md (architettura attuale)
- [ ] Aggiungere riferimento a `lib/config.ts` se menziona costanti

**Come verificare:**
```bash
grep -r "agent\|orchestrator\|LangGraph" docs/ARCHITECTURE.md
ls -la lib/agent/orchestrator/ lib/agent/workers/
```

---

### 4. docs/CI_AND_TELEMETRY.md
**Priorità:** Alta  
**Sezioni da verificare:**
- Eventi telemetria (intentDetected, supervisorRouterComplete, etc.)
- Logging senza PII

**Evidenza nel codice:**
- `lib/telemetry/logger.ts` contiene `logStructured()`
- `lib/agent/orchestrator/supervisor-router.ts` emette `supervisorRouterComplete`
- `lib/agent/workers/booking.ts` emette `bookingAttempt`, `bookingSuccess`, `bookingFailed`

**Azioni:**
- [ ] Verificare che eventi telemetria corrispondano a codice
- [ ] Aggiungere comandi per verificare eventi
- [ ] Rimuovere eventi non più esistenti (se presenti)

**Come verificare:**
```bash
grep -r "supervisorRouterComplete\|bookingAttempt\|bookingSuccess" lib/agent/
grep -r "logStructured\|logBooking" lib/telemetry/logger.ts
```

---

### 5. docs/AI_REQUIRED_READING.md
**Priorità:** Media  
**Sezioni da verificare:**
- Riferimenti a agent/orchestrator/workers

**Evidenza nel codice:**
- [DATO NON DISPONIBILE] - File non letto completamente

**Azioni:**
- [ ] Leggere file completo
- [ ] Verificare riferimenti a agent
- [ ] Allineare con stato attuale (MIGRATION_MEMORY.md)

**Come verificare:**
```bash
grep -r "agent\|orchestrator\|worker\|LangGraph" docs/AI_REQUIRED_READING.md
```

---

### 6. docs/README.md (indice)
**Priorità:** Bassa  
**Sezioni da verificare:**
- Riferimenti a documentazione agent/orchestrator

**Evidenza nel codice:**
- MIGRATION_MEMORY.md è file principale per agent orchestrator

**Azioni:**
- [ ] Verificare se menziona MIGRATION_MEMORY.md
- [ ] Aggiungere sezione "Agent Orchestrator" se manca

**Come verificare:**
```bash
grep -r "MIGRATION_MEMORY\|agent\|orchestrator" docs/README.md
```

---

### 7. docs/VERIFY_MIGRATION.md
**Priorità:** Media  
**Sezioni da verificare:**
- Checklist migrazione agent

**Evidenza nel codice:**
- [DATO NON DISPONIBILE] - File non letto

**Azioni:**
- [ ] Leggere file completo
- [ ] Verificare checklist allineata con stato attuale
- [ ] Aggiornare con evidenze verificabili

**Come verificare:**
```bash
cat docs/VERIFY_MIGRATION.md
```

---

### 8. docs/MIGRATIONS.md
**Priorità:** Bassa  
**Sezioni da verificare:**
- Riferimenti a migrazione agent

**Evidenza nel codice:**
- [DATO NON DISPONIBILE] - File non letto

**Azioni:**
- [ ] Leggere file completo
- [ ] Verificare se menziona migrazione agent
- [ ] Allineare con MIGRATION_MEMORY.md

**Come verificare:**
```bash
grep -r "agent\|orchestrator\|LangGraph" docs/MIGRATIONS.md
```

---

## Riepilogo Azioni

| File | Priorità | Stato | Azioni Necessarie |
|------|----------|-------|-------------------|
| MIGRATION_MEMORY.md | Alta | ✅ COMPLETATO | Nessuna |
| README.md | Media | ⏳ PENDING | Verificare sezione AI Agent |
| docs/ARCHITECTURE.md | Alta | ⏳ PENDING | Allineare architettura agent |
| docs/CI_AND_TELEMETRY.md | Alta | ⏳ PENDING | Verificare eventi telemetria |
| docs/AI_REQUIRED_READING.md | Media | ⏳ PENDING | Leggere e allineare |
| docs/README.md | Bassa | ⏳ PENDING | Aggiungere riferimento MIGRATION_MEMORY |
| docs/VERIFY_MIGRATION.md | Media | ⏳ PENDING | Leggere e allineare |
| docs/MIGRATIONS.md | Bassa | ⏳ PENDING | Leggere e allineare |

---

## Note

- **Approccio:** Solo contenuti verificabili, rimuovere ambiguità
- **Nessun numero inventato:** Usare [DATO NON DISPONIBILE] se non verificabile
- **Comandi di verifica:** Ogni sezione deve includere comandi per verificare affermazioni

