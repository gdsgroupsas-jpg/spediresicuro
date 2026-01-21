# Debug Guide - Complete Troubleshooting

## Overview

Guida completa per debugging e troubleshooting in SpedireSicuro, incluse tecniche, tools e best practices.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites

- Conoscenza browser DevTools
- Familiarità con logging
- Accesso a Vercel/Supabase dashboards

---

## Debugging Tools

### Browser DevTools

**Chrome/Edge DevTools:**

- **F12** o **Ctrl+Shift+I** per aprire
- **Console:** Log JavaScript, errori
- **Network:** Richieste HTTP, timing
- **Application:** Cookies, Local Storage
- **Sources:** Debugger, breakpoints

**Firefox DevTools:**

- **F12** per aprire
- Stessa struttura di Chrome

---

### Vercel Logs

**Access:**

- Vercel Dashboard → Deployments → Logs
- Real-time logs
- Filter per time range, function

**Log Levels:**

- `error` - Errori critici
- `warn` - Warning
- `info` - Informazioni
- `debug` - Debug (development)

---

### Supabase Logs

**Access:**

- Supabase Dashboard → Logs
- **Postgres Logs:** Query SQL, errori
- **API Logs:** Richieste API
- **Auth Logs:** Autenticazione

---

## Debugging Techniques

### 1. Logging

**Structured Logging:**

```typescript
console.log(
  JSON.stringify({
    event: 'shipment_created',
    shipment_id: shipmentId,
    user_id_hash: userId.substring(0, 8) + '***',
    cost: 12.5,
    timestamp: new Date().toISOString(),
  })
);
```

**Error Logging:**

```typescript
try {
  // ... operation
} catch (error) {
  console.error('Operation failed:', error, {
    context: 'shipment_creation',
    userId: userIdHash,
    requestId: requestId,
  });
  throw error;
}
```

**⚠️ IMPORTANTE:** Non loggare PII (email, password, ecc.)

---

### 2. Breakpoints

**Browser DevTools:**

```typescript
// Aggiungi breakpoint in Sources tab
// Oppure usa debugger statement
debugger; // Pausa qui quando DevTools aperto
```

**VS Code:**

- Clicca a sinistra del numero riga
- Oppure usa `debugger;` statement
- Avvia debugger: F5

---

### 3. Network Inspection

**Browser DevTools → Network:**

- Vedi tutte le richieste HTTP
- Status codes, timing
- Request/Response headers
- Request/Response body

**Filtri utili:**

- `XHR` - Solo API calls
- `Fetch` - Fetch requests
- `WS` - WebSocket connections

---

### 4. Database Inspection

**Supabase Dashboard → SQL Editor:**

```sql
-- Verifica dati
SELECT * FROM shipments
WHERE user_id = 'user-id'
ORDER BY created_at DESC
LIMIT 10;

-- Verifica wallet
SELECT * FROM wallet_transactions
WHERE user_id = 'user-id'
ORDER BY created_at DESC;

-- Verifica utente
SELECT * FROM users
WHERE email = 'user@example.com';
```

---

## Common Debug Scenarios

### Scenario 1: API Returns 500

**Steps:**

1. **Controlla Vercel logs:**
   - Vercel Dashboard → Deployments → Logs
   - Cerca errori recenti
   - Leggi stack trace

2. **Controlla Supabase logs:**
   - Supabase Dashboard → Logs → Postgres Logs
   - Cerca errori SQL

3. **Verifica environment variables:**

   ```bash
   # .env.local
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

4. **Test endpoint localmente:**
   ```bash
   npm run dev
   # Test endpoint in browser/Postman
   ```

---

### Scenario 2: Data Not Showing

**Steps:**

1. **Verifica query database:**

   ```sql
   SELECT * FROM table_name
   WHERE user_id = 'user-id';
   ```

2. **Verifica RLS policies:**

   ```sql
   SELECT * FROM pg_policies
   WHERE tablename = 'table_name';
   ```

3. **Verifica Acting Context:**

   ```typescript
   const context = await requireSafeAuth();
   console.log('Target ID:', context.target.id);
   console.log('Actor ID:', context.actor.id);
   ```

4. **Controlla Network tab:**
   - Browser DevTools → Network
   - Verifica API response
   - Verifica status code

---

### Scenario 3: Authentication Issues

**Steps:**

1. **Verifica sessione:**

   ```typescript
   const session = await auth();
   console.log('Session:', session);
   ```

2. **Verifica cookie:**
   - Browser DevTools → Application → Cookies
   - Verifica `next-auth.session-token`

3. **Verifica NEXTAUTH_SECRET:**

   ```bash
   # .env.local
   NEXTAUTH_SECRET=[random-32-char-string]
   ```

4. **Riavvia server:**
   ```bash
   # Ctrl+C
   npm run dev
   ```

---

### Scenario 4: Wallet Balance Wrong

**Steps:**

1. **Verifica saldo:**

   ```sql
   SELECT wallet_balance
   FROM users
   WHERE id = 'user-id';
   ```

2. **Verifica transazioni:**

   ```sql
   SELECT * FROM wallet_transactions
   WHERE user_id = 'user-id'
   ORDER BY created_at DESC;
   ```

3. **Verifica integrità:**

   ```sql
   SELECT
     u.wallet_balance,
     COALESCE(SUM(wt.amount), 0) AS calculated
   FROM users u
   LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
   WHERE u.id = 'user-id'
   GROUP BY u.wallet_balance;
   ```

4. **Verifica funzioni atomiche:**
   - Verifica che `increment_wallet_balance` / `decrement_wallet_balance` siano usate
   - Non aggiornare `wallet_balance` direttamente

---

## Debugging Best Practices

### 1. Use Structured Logging

**Good:**

```typescript
console.log(
  JSON.stringify({
    event: 'shipment_created',
    shipment_id: shipmentId,
    timestamp: new Date().toISOString(),
  })
);
```

**Bad:**

```typescript
console.log('Shipment created:', shipmentId, userId); // PII exposed!
```

---

### 2. Add Context to Errors

**Good:**

```typescript
try {
  // ... operation
} catch (error) {
  console.error('Operation failed:', error, {
    context: 'shipment_creation',
    userId: userIdHash,
    requestId: requestId,
  });
}
```

**Bad:**

```typescript
catch (error) {
  console.error(error); // No context!
}
```

---

### 3. Use Debugger Strategically

**Good:**

```typescript
if (process.env.NODE_ENV === 'development') {
  debugger; // Solo in development
}
```

**Bad:**

```typescript
debugger; // Sempre, anche in produzione!
```

---

### 4. Test Locally First

**Always:**

1. Reproduce issue locally
2. Debug localmente
3. Fix localmente
4. Test localmente
5. Deploy

---

## Debugging Checklist

### Before Asking for Help

- [ ] Reproduced issue locally
- [ ] Checked Vercel logs
- [ ] Checked Supabase logs
- [ ] Checked browser console
- [ ] Checked Network tab
- [ ] Verified environment variables
- [ ] Verified database state
- [ ] Tried common solutions

---

## Tools & Resources

### Local Development

**Commands:**

```bash
# Start dev server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Test
npm test
```

---

### Database Tools

**Supabase CLI:**

```bash
# Status
npx supabase status

# Start local
npx supabase start

# Reset database
npx supabase db reset
```

---

### Browser Extensions

**Useful Extensions:**

- React DevTools
- Redux DevTools (se usato)
- Network Monitor

---

## Related Documentation

- [Common Issues](COMMON_ISSUES.md) - Problemi comuni
- [Database Issues](DATABASE_ISSUES.md) - Database troubleshooting
- [API Issues](API_ISSUES.md) - API troubleshooting
- [Performance Issues](PERFORMANCE_ISSUES.md) - Performance troubleshooting

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | Dev Team |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Dev Team_
