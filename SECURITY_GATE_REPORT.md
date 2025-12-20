# 🔒 Security Gate Report — Middleware Next.js 14

**Progetto:** SpedireSicuro.it  
**Data Analisi:** 2025-01-XX  
**File Analizzati:** `middleware.ts`, `app/api/cron/**/*.ts`  
**Metodo:** Analisi statica con evidenze da codice

---

## A) Executive Summary

### Overall: **NO-GO** ❌

**Motivo:** Requisiti P0 (BLOCKER) non soddisfatti.

**Conteggio:**
- **P0 (BLOCKER):** 0/2 PASS ❌
- **P1 (IMPORTANTE):** 0/2 PASS ❌
- **P2 (NICE TO HAVE):** 0/1 PASS ⚠️

**Verdetto:** Il middleware attuale è un placeholder senza protezioni. Le route `/api/cron/**` sono esposte pubblicamente e la validazione del secret avviene solo lato endpoint, violando i requisiti fail-closed.

---

## B) Checklist Dettagliata

| Requisito | Status | Evidenza | Rischio | Fix Concept |
|-----------|--------|----------|---------|-------------|
| **G1** - `/api/cron` non pubblico | ❌ **FAIL** | `middleware.ts:27-38` - Matcher esclude `api`, quindi middleware non viene eseguito su `/api/cron/**`. Route cron sono accessibili pubblicamente fino al controllo endpoint. | **CRITICO** - Endpoint cron esposti pubblicamente. Attaccante può triggerare job costosi o esaurire risorse. | Aggiungere branch esplicito nel middleware per `/api/cron/**` con validazione CRON_SECRET prima di raggiungere endpoint. |
| **G2** - CRON_SECRET validation INLINE | ❌ **FAIL** | `middleware.ts:14-23` - Nessun controllo su header `Authorization` o `CRON_SECRET`. Validazione esiste solo in `app/api/cron/automation-sync/route.ts:20-32` e `app/api/cron/trigger-sync/route.ts:17-57` (lato endpoint). | **CRITICO** - Fail-open: richieste raggiungono endpoint anche se secret manca. Timing attack possibile se validazione non è constant-time. | Implementare check nel middleware con `crypto.subtle.timingSafeEqual` (o polyfill Edge-safe) per confronto constant-time. Fail-closed: deny se secret manca o non matcha. |
| **G3** - Path traversal validation | ❌ **FAIL** | `middleware.ts:14-23` - Nessun controllo su pattern `..`, `//`, `%2F`, `%2E`. Next.js normalizza automaticamente, ma non è fail-closed esplicito. | **ALTO** - Possibile bypass di routing se Next.js ha bug o configurazione errata. | Aggiungere validazione esplicita: decode URL, controllare presenza di `..`, `//`, e varianti encoded. Return 400 se pattern sospetti. |
| **G4** - Case-insensitive matching | ⚠️ **N/A** | `middleware.ts:14-23` - Non applicabile: middleware non ha logica di routing (solo log e pass-through). | **BASSO** - Non critico perché non c'è classificazione route. | Se si aggiunge logica di routing, usare `pathname.toLowerCase()` prima di `startsWith()` o match. |
| **G5** - auth() timeout wrapper | ⚠️ **N/A** | `middleware.ts:14-23` - Non applicabile: non c'è chiamata `auth()` nel middleware. | **BASSO** - Non critico perché non c'è auth() da proteggere. | Se si aggiunge `auth()` (es. NextAuth v5), wrappare con `Promise.race()` con timeout (es. 5s) e fallback a deny. |

---

## C) Evidence Snippets

### ❌ G1 - `/api/cron` esposto pubblicamente

**File:** `middleware.ts`

```typescript
// Riga 27-38
export const config = {
  matcher: [
    /*
     * Match tutti i percorsi tranne:
     * - api (API routes)  ← PROBLEMA: esclude TUTTE le route /api/**
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Evidenza:** Il matcher esclude `api`, quindi il middleware **non viene eseguito** su `/api/cron/**`. Le richieste raggiungono direttamente gli endpoint senza validazione.

**File:** `app/api/cron/automation-sync/route.ts`

```typescript
// Riga 17-32
export async function GET(request: NextRequest) {
  try {
    // Verifica secret token (protezione cron job)
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.CRON_SECRET_TOKEN;

    if (secretToken && authHeader !== `Bearer ${secretToken}`) {
      // Se non c'è secret token configurato, permettere solo da Vercel
      const vercelCron = request.headers.get('x-vercel-cron');
      if (!vercelCron) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    // ... continua esecuzione
```

**Evidenza:** La validazione avviene **dopo** che la richiesta ha raggiunto l'endpoint. Se `CRON_SECRET_TOKEN` non è configurato, l'endpoint accetta richieste con header `x-vercel-cron` (fail-open).

---

### ❌ G2 - CRON_SECRET validation non INLINE nel middleware

**File:** `middleware.ts`

```typescript
// Riga 14-23
export function middleware(request: NextRequest) {
  // Esempio: log delle richieste (solo in sviluppo)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname}`);
  }

  // Aggiungi qui altre logiche se necessario
  // Esempio: redirect, controllo autenticazione, ecc.

  return NextResponse.next();
}
```

**Evidenza:** Nessun controllo su `request.headers.get('authorization')` o `process.env.CRON_SECRET`. Il middleware è un pass-through.

**Problema aggiuntivo:** Anche se la validazione fosse negli endpoint, non usa confronto constant-time. In `app/api/cron/trigger-sync/route.ts:47`:

```typescript
if (authHeader !== `Bearer ${cronSecret}`) {
```

**Evidenza:** Confronto stringa standard (`!==`) è vulnerabile a timing attack. Dovrebbe usare `crypto.subtle.timingSafeEqual` o equivalente.

---

### ❌ G3 - Path traversal validation assente

**File:** `middleware.ts`

```typescript
// Riga 14-23
export function middleware(request: NextRequest) {
  // ... nessun controllo su pathname
  return NextResponse.next();
}
```

**Evidenza:** Nessuna validazione su:
- `..` (dot-dot)
- `//` (double slash)
- `%2F%2F`, `%2E%2E` (encoded variants)

**Nota:** Next.js normalizza automaticamente, ma non è fail-closed esplicito. Se Next.js ha bug o configurazione errata, il bypass è possibile.

---

### ⚠️ G4 - Case-insensitive matching (N/A)

**Evidenza:** Non applicabile perché il middleware non ha logica di routing. Se si aggiunge in futuro, usare:

```typescript
const pathnameLower = request.nextUrl.pathname.toLowerCase();
if (pathnameLower.startsWith('/api/cron')) {
  // ...
}
```

---

### ⚠️ G5 - auth() timeout wrapper (N/A)

**Evidenza:** Non applicabile perché non c'è chiamata `auth()` nel middleware. Se si aggiunge NextAuth v5, wrappare:

```typescript
const authPromise = auth();
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Auth timeout')), 5000)
);

try {
  const session = await Promise.race([authPromise, timeoutPromise]);
} catch {
  return new NextResponse('Unauthorized', { status: 401 });
}
```

---

## D) Manual Smoke Tests (curl)

### Test 1: CRON senza header → 401 (atteso)

```bash
curl -i https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected:** `401 Unauthorized`  
**Actual (se G1/G2 FAIL):** `200 OK` (se `CRON_SECRET_TOKEN` non configurato) o `401` (se configurato ma validazione solo endpoint)

---

### Test 2: CRON con header sbagliato → 401 (atteso)

```bash
curl -i -H "Authorization: Bearer wrong-token" https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected:** `401 Unauthorized`  
**Actual (se G2 FAIL):** `401` (validazione endpoint) ma vulnerabile a timing attack se non constant-time

---

### Test 3: CRON con header corretto → 200 (se endpoint esiste)

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://spediresicuro.vercel.app/api/cron/automation-sync
```

**Expected:** `200 OK` con JSON response  
**Actual:** Dovrebbe funzionare se `CRON_SECRET_TOKEN` è configurato correttamente

---

### Test 4: Path traversal `/api/../dashboard` → 400 (atteso)

```bash
curl -i https://spediresicuro.vercel.app/api/../dashboard
```

**Expected:** `400 Bad Request` (se G3 PASS)  
**Actual (se G3 FAIL):** Next.js normalizza a `/dashboard`, ma non c'è validazione esplicita

---

### Test 5: Double slash `/api//spedizioni` → 400 (atteso)

```bash
curl -i https://spediresicuro.vercel.app/api//spedizioni
```

**Expected:** `400 Bad Request` (se G3 PASS)  
**Actual (se G3 FAIL):** Next.js normalizza a `/api/spedizioni`, ma non c'è validazione esplicita

---

### Test 6: Encoded path traversal `/api/%2E%2E/dashboard` → 400 (atteso)

```bash
curl -i "https://spediresicuro.vercel.app/api/%2E%2E/dashboard"
```

**Expected:** `400 Bad Request` (se G3 PASS)  
**Actual (se G3 FAIL):** Next.js decodifica a `/api/../dashboard` e normalizza, ma non c'è validazione esplicita

---

### Test 7: Case bypass `/API/spedizioni` → 401 (atteso se autenticato)

```bash
curl -i https://spediresicuro.vercel.app/API/spedizioni
```

**Expected:** `401 Unauthorized` (se autenticazione richiesta)  
**Actual:** Dipende da come Next.js gestisce case-sensitivity. Se middleware ha logica routing, dovrebbe essere case-insensitive (G4)

---

## E) Raccomandazioni Prioritarie

### 🔴 P0 - BLOCKER (da implementare immediatamente)

1. **Aggiungere branch esplicito per `/api/cron/**` nel middleware**
   - Modificare `config.matcher` per includere `/api/cron/**`
   - Aggiungere logica di validazione CRON_SECRET prima di raggiungere endpoint
   - Fail-closed: deny se secret manca o non matcha

2. **Implementare validazione constant-time per CRON_SECRET**
   - Usare `crypto.subtle.timingSafeEqual` (o polyfill Edge-safe)
   - Validare header `Authorization: Bearer <token>`
   - Fail-closed: deny se header manca o token non matcha

### 🟡 P1 - IMPORTANTE (da implementare prima del deploy)

3. **Aggiungere validazione path traversal**
   - Decodificare URL
   - Controllare pattern `..`, `//`, `%2F`, `%2E` (case-insensitive)
   - Return `400 Bad Request` se pattern sospetti

4. **Rendere matching case-insensitive** (se si aggiunge logica routing)
   - Usare `pathname.toLowerCase()` prima di `startsWith()` o match

### 🟢 P2 - NICE TO HAVE

5. **Aggiungere timeout wrapper per auth()** (se si aggiunge NextAuth v5)
   - `Promise.race()` con timeout 5s
   - Fallback a deny su timeout

---

## F) Conclusioni

Il middleware attuale è un **placeholder senza protezioni**. Le route `/api/cron/**` sono esposte pubblicamente e la validazione del secret avviene solo lato endpoint, violando i principi fail-closed.

**Raccomandazione:** **NO-GO** fino a quando G1 e G2 non sono implementati nel middleware.

**Prossimi step:**
1. Implementare validazione CRON_SECRET nel middleware (G1, G2)
2. Aggiungere validazione path traversal (G3)
3. Eseguire smoke tests
4. Rivalutare Security Gate

---

**Report generato da:** Security Auditor (Claude)  
**Metodo:** Analisi statica con evidenze da codice  
**File analizzati:** `middleware.ts`, `app/api/cron/**/*.ts`



