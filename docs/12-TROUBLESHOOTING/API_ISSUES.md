# API Issues - Troubleshooting

## Overview
Guida completa per risolvere problemi comuni delle API REST e Server Actions in SpedireSicuro.

## Target Audience
- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites
- Conoscenza HTTP status codes
- Familiarità con Next.js API routes
- Accesso a Vercel logs

---

## Authentication Issues

### 401 Unauthorized

**Problema:**
```
401 Unauthorized
Error: Non autenticato
```

**Soluzione:**

1. **Verifica sessione NextAuth:**
   ```typescript
   // Server-side
   import { auth } from '@/lib/auth-config';
   const session = await auth();
   
   if (!session) {
     return NextResponse.json(
       { error: 'Non autenticato' },
       { status: 401 }
     );
   }
   ```

2. **Verifica cookie:**
   - Browser DevTools → Application → Cookies
   - Verifica `next-auth.session-token` presente
   - Verifica cookie non scaduto

3. **Verifica NEXTAUTH_SECRET:**
   ```bash
   # .env.local
   NEXTAUTH_SECRET=[random-32-char-string]
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Riavvia server dopo modifica env vars:**
   ```bash
   # Ctrl+C per fermare
   npm run dev
   ```

**Vedi:** [Authentication](../8-SECURITY/AUTHENTICATION.md)

---

### 403 Forbidden

**Problema:**
```
403 Forbidden
Error: Accesso negato
```

**Soluzione:**

1. **Verifica permessi utente:**
   ```typescript
   const context = await requireSafeAuth();
   const isAdmin = isSuperAdmin(context);
   
   if (!isAdmin) {
     return NextResponse.json(
       { error: 'Accesso negato' },
       { status: 403 }
     );
   }
   ```

2. **Verifica Acting Context:**
   - Usa `requireSafeAuth()` per ottenere context
   - Verifica `context.target.id` per operazioni

3. **Verifica capabilities:**
   ```typescript
   const hasCap = await hasCapability(
     userId,
     'can_manage_price_lists'
   );
   ```

**Vedi:** [Authorization](../8-SECURITY/AUTHORIZATION.md)

---

## Server Errors (500)

### 500 Internal Server Error

**Problema:**
```
500 Internal Server Error
Error: Errore interno del server
```

**Soluzione:**

1. **Controlla Vercel logs:**
   - Vercel Dashboard → Deployments → Logs
   - Cerca errori recenti

2. **Controlla Supabase logs:**
   - Supabase Dashboard → Logs → Postgres Logs
   - Cerca errori SQL

3. **Errori comuni:**

   **a) Colonna database mancante:**
   ```bash
   # Esegui migration mancante
   npx supabase migration up
   ```

   **b) Funzione SQL non definita:**
   ```sql
   -- Verifica funzione esiste
   SELECT routine_name 
   FROM information_schema.routines
   WHERE routine_name = 'function_name';
   ```

   **c) RLS policy blocca:**
   - Verifica policy esistente
   - Usa `supabaseAdmin` per operazioni server-side

4. **Debug locale:**
   ```bash
   # Avvia server con debug
   npm run dev
   
   # Controlla console per errori
   ```

---

### Database Connection Error

**Problema:**
```
Error: Database connection failed
Error: PGRST301 - Connection pool exhausted
```

**Soluzione:**

1. **Verifica env vars:**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
   SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
   ```

2. **Verifica connection pool:**
   - Supabase Dashboard → Settings → Database
   - Aumenta pool size se necessario

3. **Ottimizza query:**
   - Evita query lente
   - Chiudi connessioni sempre

**Vedi:** [Database Issues](DATABASE_ISSUES.md)

---

## Validation Errors (400/422)

### 400 Bad Request

**Problema:**
```
400 Bad Request
Error: Peso obbligatorio e deve essere > 0
```

**Soluzione:**

1. **Verifica validazione input:**
   ```typescript
   import { z } from 'zod';
   
   const schema = z.object({
     weight: z.number().positive(),
     zip: z.string().min(1),
   });
   
   const validated = schema.parse(body);
   ```

2. **Verifica formato request:**
   - Content-Type: `application/json`
   - Body JSON valido
   - Parametri richiesti presenti

3. **Errori comuni:**
   - Parametro mancante → aggiungi a schema
   - Tipo errato → verifica tipo in schema
   - Valore invalido → aggiungi validazione

---

### 422 Unprocessable Entity

**Problema:**
```
422 Unprocessable Entity
Error: Errore di validazione
```

**Soluzione:**

1. **Verifica Zod validation:**
   ```typescript
   try {
     const validated = schema.parse(body);
   } catch (error) {
     if (error instanceof z.ZodError) {
       return NextResponse.json(
         { 
           error: 'Validazione fallita',
           details: error.errors 
         },
         { status: 422 }
       );
     }
   }
   ```

2. **Verifica dettagli errore:**
   - Response include `details` con errori specifici
   - Correggi input in base a `details`

---

## Rate Limiting (429)

### 429 Too Many Requests

**Problema:**
```
429 Too Many Requests
Error: Troppe richieste. Limite: 20/minuto
```

**Soluzione:**

1. **Verifica rate limit:**
   - Default: 20 richieste/minuto per utente
   - Headers response: `X-RateLimit-Remaining`

2. **Riduci frequenza richieste:**
   - Usa caching (React Query)
   - Batch multiple operazioni
   - Evita polling frequente

3. **Se necessario, aumenta limite:**
   ```typescript
   // lib/security/rate-limit.ts
   const limit = 20; // Aumenta se necessario
   ```

---

## Idempotency Issues (409)

### 409 Conflict - Duplicate Request

**Problema:**
```
409 Conflict
Error: Richiesta duplicata. Spedizione già creata.
```

**Soluzione:**

1. **Verifica idempotency:**
   - Endpoint supporta idempotency tramite hash parametri
   - Se richiesta identica entro 30 minuti, ritorna risorsa esistente

2. **Se duplicato legittimo:**
   - Usa response esistente
   - Non creare nuova risorsa

3. **Se non duplicato:**
   - Verifica parametri diversi
   - Attendi scadenza lock (30 minuti)

**Vedi:** [Shipments Feature](../11-FEATURES/SHIPMENTS.md) - Idempotency

---

## Wallet Issues (402)

### 402 Payment Required - Insufficient Credit

**Problema:**
```
402 Payment Required
Error: Credito insufficiente. Saldo attuale: €10.00, richiesto: €15.00
```

**Soluzione:**

1. **Ricarica wallet:**
   - Dashboard → Wallet → Ricarica
   - Oppure admin può ricaricare

2. **Verifica saldo:**
   ```typescript
   const { data: user } = await supabaseAdmin
     .from('users')
     .select('wallet_balance')
     .eq('id', userId)
     .single();
   ```

3. **Verifica transazioni:**
   ```sql
   SELECT * FROM wallet_transactions
   WHERE user_id = 'user-id'
   ORDER BY created_at DESC;
   ```

**Vedi:** [Wallet Feature](../11-FEATURES/WALLET.md)

---

## CORS Issues

### CORS Error

**Problema:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Soluzione:**

1. **Verifica Next.js config:**
   - Next.js gestisce CORS automaticamente per API routes
   - Non serve configurazione aggiuntiva

2. **Se problema persiste:**
   - Verifica URL corretto
   - Verifica metodo HTTP (GET, POST, ecc.)
   - Verifica headers richiesti

---

## Timeout Issues

### Request Timeout

**Problema:**
```
504 Gateway Timeout
Request timeout after 10s
```

**Soluzione:**

1. **Verifica timeout configurazione:**
   ```json
   // vercel.json
   {
     "functions": {
       "app/api/automation/**/*.ts": {
         "maxDuration": 300
       }
     }
   }
   ```

2. **Ottimizza operazioni lente:**
   - Usa background jobs per operazioni lunghe
   - Dividi operazioni in step più piccoli
   - Usa streaming per response grandi

---

## Webhook Issues

### Webhook Signature Invalid

**Problema:**
```
400 Bad Request
Error: Invalid signature
```

**Soluzione:**

1. **Verifica STRIPE_WEBHOOK_SECRET:**
   ```bash
   # .env.local
   STRIPE_WEBHOOK_SECRET=[webhook-secret]
   ```

2. **Verifica signature header:**
   ```typescript
   const signature = request.headers.get('stripe-signature');
   if (!signature) {
     return NextResponse.json(
       { error: 'Missing signature' },
       { status: 400 }
     );
   }
   ```

**Vedi:** [Webhooks](../3-API/WEBHOOKS.md)

---

## Related Documentation

- [REST API](../3-API/REST_API.md) - API endpoints
- [Error Codes](../3-API/ERROR_CODES.md) - Codici errore
- [Common Issues](COMMON_ISSUES.md) - Problemi comuni generali
- [Database Issues](DATABASE_ISSUES.md) - Problemi database

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | Dev Team |

---

*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Dev Team*
