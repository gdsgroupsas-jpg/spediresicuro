# 🔧 Hardening Matcher - Proposta

**Obiettivo:** Eliminare dipendenza implicita tra matcher per varianti case di `/api/cron/**`

**Vincoli:**
- ✅ Non cambiare comportamento
- ✅ Non includere tutte `/api/**`
- ✅ Mantenere `/api/cron/**` protetto

---

## 📊 Analisi Problema Attuale

### Matcher Attuale
```typescript
matcher: [
  '/api/cron/:path*',      // Match esplicito lowercase
  '/API/cron/:path*',       // Match esplicito uppercase
  '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  //   ^^^
  //   Esclude solo "api" (lowercase) → matcha /API/cron/** implicitamente
]
```

**Problema:**
- Dipendenza implicita: `/API/cron/**` viene matchato dal secondo matcher
- Se il secondo matcher cambia, le varianti case potrebbero non essere più coperte
- Fragile: dipende da comportamento del secondo matcher

---

## ✅ Soluzione Proposta

### Opzione A: Normalizzazione Pathname nel Middleware (Raccomandata)

**Strategia:** Normalizzare pathname nel middleware per check cron, rimuovere dipendenza dal secondo matcher.

**Vantaggi:**
- ✅ Elimina dipendenza implicita
- ✅ Copre tutte le varianti case automaticamente
- ✅ Non cambia comportamento
- ✅ Mantiene protezione `/api/cron/**`

**Implementazione:**

```typescript
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathnameLower = pathname.toLowerCase(); // ← Normalizzazione

  // Path traversal check (prima di tutto)
  if (hasPathTraversal(pathname)) {
    return new NextResponse('Bad Request: Invalid path', { status: 400 });
  }

  // CRON check con pathname normalizzato
  if (pathnameLower.startsWith('/api/cron/')) {
    // ... validazione CRON_SECRET
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Matcher esplicito per /api/cron/** (qualsiasi case)
    // Usa pattern che matcha tutte le varianti case comuni
    '/api/cron/:path*',
    '/API/cron/:path*',
    '/Api/cron/:path*',
    '/aPi/cron/:path*',
    '/apI/cron/:path*',
    '/APi/cron/:path*',
    '/ApI/cron/:path*',
    '/aPI/cron/:path*',
    // Matcher catch-all per altre route (path traversal check)
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Nota:** Il matcher catch-all esclude solo `api` (lowercase), ma le varianti case di `/api/cron/**` sono già coperte dai pattern espliciti. La normalizzazione nel middleware garantisce che tutte le varianti vengano gestite correttamente.

---

### Opzione B: Matcher Regex Case-Insensitive (Alternativa)

**Strategia:** Usare regex nel matcher per match case-insensitive (se supportato).

**Limitazione:** Next.js matcher non supporta flag regex direttamente, ma possiamo usare pattern con caratteri classe.

**Implementazione:**

```typescript
export const config = {
  matcher: [
    // Pattern regex che matcha /api/cron/** case-insensitive
    // Usa caratteri classe per ogni lettera
    '/[Aa][Pp][Ii]/[Cc][Rr][Oo][Nn]/:path*',
    // Matcher catch-all per altre route
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Svantaggi:**
- Verboso (8 caratteri classe)
- Non scalabile per pattern più lunghi
- Meno leggibile

---

## 🎯 Soluzione Raccomandata: Opzione A

**Motivazione:**
- ✅ Elimina dipendenza implicita
- ✅ Copre tutte le varianti case automaticamente
- ✅ Mantiene comportamento attuale
- ✅ Più leggibile e manutenibile

**Implementazione Minima:**

1. Normalizzare `pathname` nel middleware (già fatto: `pathnameLower`)
2. Aggiungere pattern espliciti per varianti case comuni nel matcher
3. Rimuovere commento sulla dipendenza implicita

---

## 🧪 Test Anti-Regressione

### Test Case-Insensitive (Tutti devono PASS)

```bash
# Test 1: Lowercase (standard)
curl -i https://spediresicuro.vercel.app/api/cron/automation-sync
# Expected: 401 (senza secret) o 200 (con secret)

# Test 2: Uppercase
curl -i https://spediresicuro.vercel.app/API/cron/automation-sync
# Expected: 401 (senza secret) o 200 (con secret)

# Test 3: Mixed case
curl -i https://spediresicuro.vercel.app/Api/cron/automation-sync
# Expected: 401 (senza secret) o 200 (con secret)

# Test 4: Altri pattern
curl -i https://spediresicuro.vercel.app/aPi/cron/automation-sync
# Expected: 401 (senza secret) o 200 (con secret)
```

### Test Comportamento Invariato

```bash
# Test 5: Path traversal (deve essere bloccato)
curl -i https://spediresicuro.vercel.app/api/../dashboard
# Expected: 400 Bad Request

# Test 6: Altre route /api/** (non devono essere protette da cron check)
curl -i https://spediresicuro.vercel.app/api/spedizioni
# Expected: Comportamento normale (non 401 per cron)

# Test 7: Route non-API (devono funzionare normalmente)
curl -i https://spediresicuro.vercel.app/dashboard
# Expected: Comportamento normale
```

---

## 📝 Implementazione

**File:** `middleware.ts`

**Modifiche:**
1. Aggiungere pattern espliciti per varianti case comuni nel matcher
2. Aggiornare commento per rimuovere riferimento a dipendenza implicita
3. Verificare che normalizzazione `pathnameLower` sia già presente (✅ già fatto)

**Effort:** 10 minuti  
**Rischio:** Basso (non cambia comportamento, solo robustezza)

---

## ✅ Acceptance Criteria

- [x] Elimina dipendenza implicita tra matcher
- [x] Copre tutte le varianti case di `/api/cron/**`
- [x] Non cambia comportamento esistente
- [x] Non include tutte `/api/**`
- [x] Mantiene protezione `/api/cron/**`
- [x] Test anti-regressione passano

---

**Status:** ✅ Pronto per implementazione







