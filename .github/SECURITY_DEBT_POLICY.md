# Security Debt Policy — SpedireSicuro

## Baseline (19 feb 2026)

| Metrica                     | Conteggio         | Target Q2 2026             |
| --------------------------- | ----------------- | -------------------------- |
| `: any` + `as any`          | 2.037             | -20% (< 1.630)             |
| `console.log` in produzione | 4.631             | -30% (< 3.240)             |
| `eslint-disable`            | 46                | < 30                       |
| Sentry captureException     | 1 (error-tracker) | Tutti gli endpoint critici |

## Guardrail Attivi

1. **ESLint `no-console`** (warn): blocca NUOVI `console.log` — `console.warn`, `console.error`, `console.debug` permessi
2. **sanitize-html**: sanitizzazione HTML via parser (htmlparser2), sostituisce regex custom
3. **Sentry wiring**: `trackError()` ora invia a Sentry automaticamente
4. **CI bloccante**: `npm audit` e CodeQL bloccano pipeline su HIGH/CRITICAL

## Processo di Riduzione

### console.log

- Ogni PR che tocca un file con `console.log` dovrebbe migrare a `createLogger()` da `lib/logger.ts`
- Non richiesto refactoring batch — riduzione incrementale file-by-file

### any

- Richiede integrazione `@typescript-eslint/parser` + `no-explicit-any` (PR dedicata)
- Nel frattempo: code review manuale su nuovi `any`

### eslint-disable

- 44/46 sono `react-hooks/exhaustive-deps` — audit singolo per verificare correttezza
- Obiettivo: rimuovere quelli non necessari, documentare quelli intenzionali

## Revisione

- **Frequenza**: mensile (primo lunedi del mese)
- **Owner**: tech lead
- **Output**: aggiornamento conteggi in questa tabella
