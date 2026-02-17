# SpedireSicuro — Regole per AI Agent

## REGOLA #1: Isolamento Multi-Tenant (OBBLIGATORIO)

Ogni query su tabella multi-tenant DEVE usare `workspaceQuery(workspaceId)` da `@/lib/db/workspace-query`.

```typescript
// ✅ CORRETTO
import { workspaceQuery } from '@/lib/db/workspace-query';
const wq = workspaceQuery(workspaceId);
const { data } = await wq.from('price_lists').select('*');

// ❌ VIETATO — supabaseAdmin.from() su tabelle multi-tenant
import { supabaseAdmin } from '@/lib/db/client';
const { data } = await supabaseAdmin.from('price_lists').select('*');
```

**Tabelle multi-tenant** (lista completa in `lib/db/workspace-query.ts`):
shipments, price*lists, wallet_transactions, commercial_quotes, emails,
leads, reseller_prospects, audit_logs, outreach*\*, warehouse/WMS tables

**Tabelle globali** (ok usare supabaseAdmin direttamente):
users, workspaces, workspace_members, couriers, courier_configs, system_settings

Il test `workspace-query-guardian.test.ts` monitora il numero di violazioni.
Il numero attuale è 57. NON deve MAI aumentare. Ogni PR deve ridurlo.

## REGOLA #2: Testing Obbligatorio

Ogni modifica DEVE avere test. Lavoro "finito" = test verdi + build OK.

```bash
npm run test:unit    # Unit test (Vitest)
npm run build        # Zero errori compilazione
```

## REGOLA #3: Privacy e Sicurezza

- Il superadmin NON vede dati privati dei reseller (config, listini, wallet)
- MAI committare segreti (.env.local per locale, Vercel Dashboard per prod)
- Ogni RPC PostgreSQL: SECURITY DEFINER + SET search_path = public, pg_temp
- Ogni nuova tabella multi-tenant: aggiungere a WORKSPACE_SCOPED_TABLES

## REGOLA #4: Delivery Flow

1. Scrivi codice + test
2. `npm run test:unit` — tutti verdi
3. `npm run build` — zero errori
4. Review sicurezza (XSS, privacy, atomicità)
5. `git commit` (linter/prettier via pre-commit hook)
6. `git push origin master`
7. Verifica deploy Vercel

## Convenzioni

- File: kebab-case | Components: PascalCase | Variables: camelCase
- Commenti: italiano
- Branch: master
