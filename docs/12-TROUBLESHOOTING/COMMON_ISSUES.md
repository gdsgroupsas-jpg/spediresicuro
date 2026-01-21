# Common Issues - Troubleshooting

> **Scopo:** Soluzioni rapide ai problemi più comuni nello sviluppo e deployment di SpedireSicuro

## Overview

Questa documentazione raccoglie i problemi più frequenti che sviluppatori e DevOps incontrano lavorando con SpedireSicuro, fornendo soluzioni rapide e link a documentazione dettagliata.

## Target Audience

- [x] Developers
- [ ] DevOps
- [ ] Business/PM
- [ ] AI Agents

## Quick Reference

| Issue                     | Soluzione                           | Link                                       |
| ------------------------- | ----------------------------------- | ------------------------------------------ |
| npm install fallisce      | Pulisci node_modules e package-lock | [Setup](../1-GETTING-STARTED/)             |
| Build TypeScript errori   | `npm run type-check` per dettagli   | [Testing](../5-TESTING/)                   |
| Database connection error | Verifica env vars                   | [Environment](../6-DEPLOYMENT/ENV_VARS.md) |
| API returns 500           | Controlla logs Supabase             | [Database](../2-ARCHITECTURE/DATABASE.md)  |
| Test falliscono           | Verifica database setup             | [Testing](../5-TESTING/)                   |

---

## Environment & Setup Issues

### npm install fallisce

**Problema:**

```bash
npm ERR! code ERESOLVE
npm ERR! errno EACCES
```

**Soluzione:**

```bash
# Pulisci cache e dipendenze
rm -rf node_modules package-lock.json
npm install
```

**Se persiste:**

- Verifica versione Node.js (minimo 18+)
- Verifica connessione internet
- Prova con `npm cache clean --force`

---

### Variabili environment mancanti

**Problema:**

```
Error: NEXT_PUBLIC_SUPABASE_URL is not defined
```

**Soluzione:**

```bash
# Copia template
cp .env.example .env.local

# Modifica .env.local con le tue credenziali
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Build & TypeScript Issues

### TypeScript errori di compilazione

**Problema:**

```
TS2345: Argument of type 'string' is not assignable to parameter of type 'never'
```

**Soluzione:**

```bash
# Vedi dettagli completo errore
npm run type-check

# Errori comuni:
# - "possibly undefined": aggiungi null check o default value
# - "any type": usa type guards o Zod validation
```

**Errori ricorrenti:**

- Property undefined su optional types → aggiungi `?.` o `|| defaultValue`
- Type mismatch su API response → aggiorna tipo in schema

---

### ESLint errors

**Problema:**

```bash
npm run lint
# Error: 'console' is not defined
```

**Soluzione:**

```bash
# Correggi errori automaticamente (quando possibile)
npm run lint --fix

# Oppure rimuovi console.log prima di commit
# Usa logger: `lib/logger.ts` invece di console
```

---

## Database Issues

### Connection timeout Supabase

**Problema:**

```
Error: Database connection timeout
```

**Soluzione:**

```bash
# Verifica stato Supabase
npx supabase status

# Se locale, riavvia
npx supabase start

# Verifica env vars
# NEXT_PUBLIC_SUPABASE_URL corretto?
```

---

### RLS policy errors

**Problema:**

```
Error: new row violates row-level security policy
```

**Soluzione:**

```sql
-- Verifica che RLS sia abilitato
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Verifica policy specifica
\d+ tablename
```

**Documentazione:** [Security Overview](../8-SECURITY/OVERVIEW.md) - RLS policies complete

---

## API Issues

### API returns 401 Unauthorized

**Problema:**

```
401 Unauthorized
```

**Soluzione:**

```bash
# Verifica token/sessione
# Controlla next-auth session
# Verifica service_role_key (per admin operations)
```

---

### API returns 500 Internal Server Error

**Problema:**

```
500 Internal Server Error
```

**Soluzione:**

```bash
# Controlla logs Supabase Dashboard
# Controlla logs Vercel (se deployato)
# Verifica che migrations siano applicate
```

**Errori comuni 500:**

- Colonna database mancante → esegui migration mancante
- Funzione SQL non definita → verifica migrations
- RLS policy blocca → [vedi sopra](#rls-policy-errors)

---

## Testing Issues

### Tests timeout o falliscono

**Problema:**

```
Test timeout after 5000ms
```

**Soluzione:**

```bash
# Verifica database configurato
npm run verify:supabase

# Verifica env vars
npm run check:env:simple

# Aumenta timeout se necessario
# In test file: test.setTimeout(10000)
```

---

### E2E tests falliscono

**Problema:**

```
Test failed: page load timeout
```

**Soluzione:**

```bash
# Avvia development server
npm run dev

# In altro terminale:
npm run test:e2e:headed  # Per vedere browser
```

**Vedi:** [E2E Tests](../5-TESTING/E2E_TESTS.md) - Guida completa E2E

---

## Deployment Issues

### Build Vercel fallisce

**Problema:**

```
Error: Build failed with exit code 1
```

**Soluzione:**

```bash
# Verifica build locale
npm run build

# Verifica type-check
npm run type-check

# Verifica env vars su Vercel Dashboard
# Tutte le variabili .env.example sono configurate?
```

---

### Deploy successivo ma sito non funziona

**Problema:**

```
Deploy successful ma /api/endpoint ritorna 404
```

**Soluzione:**

```bash
# Verifica vercel.json configuration
# Rewrites corretti per API routes?
# Verifica next.config.js
```

**Vedi:** [Deployment](../6-DEPLOYMENT/) - Guida completa deployment

---

## Performance Issues

### Pagina caricamento lento

**Problema:**

- First Contentful Paint (FCP) > 3 secondi

**Soluzione:**

```bash
# Controlla bundle size
npm run build

# Verifica se API calls sono N+1
# Usa React Query caching
# Verifica immagini ottimizzate (next/image)
```

---

### API rate limiting

**Problema:**

```
429 Too Many Requests
```

**Soluzione:**

```bash
# Verifica limite rate limiting
# Upstash Redis: default 20 req/min per user

# Se localhost senza Redis, usa fallback in-memory
# Vedi lib/security/rate-limit.ts
```

---

## Wallet Issues

### Credito non scalato dopo spedizione

**Problema:**

```
Wallet debit failed but shipment created
```

**Soluzione:**

```bash
# Verifica che decrement_wallet_balance sia chiamata PRIMA
# Controlla log in wallet_transactions
# Se debit senza credit creation = BUG P0
```

**Vedi:** [Wallet](../11-FEATURES/WALLET.md) - Sistema wallet completo

---

### Idempotency lock fallito

**Problema:**

```
Error: idempotency lock acquisition failed
```

**Soluzione:**

```bash
# Verifica idempotency_locks table
# Verifica che record non sia expired (TTL 30 min)
# Usa nuova idempotency key se precedente scaduta
```

---

## AI Agent Issues

### Anne non risponde

**Problema:**

```
Anne: I'm sorry, I don't understand
```

**Soluzione:**

```bash
# Verifica GOOGLE_API_KEY in .env.local
# Verifica che LLM sia configurato (Anthropic, DeepSeek, Gemini)
# Controlla logs in lib/agent/logger.ts
```

**Vedi:** [AI Agent](../10-AI-AGENT/) - Documentazione Anne completa

---

### OCR vision non funziona

**Problema:**

```
Error: Vision API key missing or invalid
```

**Soluzione:**

```bash
# Verifica GOOGLE_API_KEY in .env.local
# Verifica che Google Cloud Vision sia abilitato
# Test con immagini fixture in tests/fixtures/ocr-images/
```

**Vedi:** [OCR Images](MIGRATION_MEMORY.md#ocr-immagini-sprint-25-done---27122025) - Documentazione OCR

---

## Related Documentation

- [Getting Started](../1-GETTING-STARTED/) - Setup rapido
- [Testing](../5-TESTING/) - Strategia testing
- [Deployment](../6-DEPLOYMENT/) - Guide deployment
- [Wallet](../11-FEATURES/WALLET.md) - Sistema wallet
- [AI Agent](../10-AI-AGENT/) - Sistema Anne

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | Dev Team |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Dev Team_
