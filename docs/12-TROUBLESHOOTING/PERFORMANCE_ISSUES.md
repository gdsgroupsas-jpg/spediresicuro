# Performance Issues - Troubleshooting

## Overview

Guida completa per identificare e risolvere problemi di performance in SpedireSicuro.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites

- Conoscenza Web Vitals
- Familiarità con browser DevTools
- Accesso a Vercel Analytics

---

## Frontend Performance

### Slow Page Load

**Problema:**

- First Contentful Paint (FCP) > 3 secondi
- Largest Contentful Paint (LCP) > 2.5 secondi
- Time to Interactive (TTI) > 5 secondi

**Soluzione:**

1. **Verifica bundle size:**

   ```bash
   npm run build
   # Controlla output per bundle size
   ```

2. **Ottimizza immagini:**

   ```typescript
   // Usa next/image invece di <img>
   import Image from 'next/image';

   <Image
     src="/image.jpg"
     width={500}
     height={300}
     alt="Description"
   />
   ```

3. **Code splitting:**

   ```typescript
   // Lazy load componenti pesanti
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <p>Loading...</p>,
   });
   ```

4. **Verifica API calls:**
   - Evita N+1 queries
   - Usa React Query caching
   - Batch multiple requests

---

### Slow API Response

**Problema:**

- API response time > 2 secondi
- Timeout errors

**Soluzione:**

1. **Identifica API lente:**

   ```bash
   # Vercel Dashboard → Functions → Performance
   # Identifica endpoint con response time alto
   ```

2. **Ottimizza query database:**

   ```sql
   -- Verifica query lente
   SELECT
     query,
     mean_time,
     calls
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

3. **Aggiungi indici:**

   ```sql
   CREATE INDEX idx_shipments_user_created
   ON shipments(user_id, created_at DESC);
   ```

4. **Usa caching:**
   ```typescript
   // React Query caching
   const { data } = useQuery({
     queryKey: ['shipments', userId],
     queryFn: () => getShipments(userId),
     staleTime: 5 * 60 * 1000, // 5 minuti
   });
   ```

---

## Database Performance

### Slow Queries

**Problema:**

- Query execution time > 1 secondo
- Database timeout

**Soluzione:**

1. **Identifica query lente:**

   ```sql
   SELECT
     query,
     calls,
     total_time,
     mean_time,
     max_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

2. **Usa EXPLAIN ANALYZE:**

   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM shipments
   WHERE user_id = 'user-id'
   ORDER BY created_at DESC
   LIMIT 50;
   ```

3. **Ottimizza query:**
   - Aggiungi indici mancanti
   - Evita `SELECT *`, seleziona solo colonne necessarie
   - Usa `LIMIT` per query grandi
   - Evita `DISTINCT` se non necessario

---

### Missing Indexes

**Problema:**

- Sequential scan su tabelle grandi
- Query lente su foreign keys

**Soluzione:**

1. **Identifica tabelle senza indici:**

   ```sql
   SELECT
     t.tablename,
     COUNT(i.indexname) AS index_count
   FROM pg_tables t
   LEFT JOIN pg_indexes i ON t.tablename = i.tablename
   WHERE t.schemaname = 'public'
   GROUP BY t.tablename
   HAVING COUNT(i.indexname) = 0;
   ```

2. **Aggiungi indici critici:**

   ```sql
   -- Foreign keys (sempre indicizzare)
   CREATE INDEX idx_shipments_user_id ON shipments(user_id);
   CREATE INDEX idx_wallet_transactions_user_id
   ON wallet_transactions(user_id);

   -- Timestamps (per ordering)
   CREATE INDEX idx_shipments_created_at
   ON shipments(created_at DESC);

   -- Composite (per query comuni)
   CREATE INDEX idx_shipments_user_created
   ON shipments(user_id, created_at DESC);
   ```

---

## Connection Pool Issues

### Connection Pool Exhausted

**Problema:**

```
PGRST301 - Connection pool exhausted
```

**Soluzione:**

1. **Verifica connection pool size:**
   - Supabase Dashboard → Settings → Database
   - Default: 60 connections
   - Aumenta se necessario

2. **Ottimizza query:**
   - Chiudi connessioni sempre
   - Evita query lente
   - Usa connection pooling

3. **Verifica connection leaks:**
   ```typescript
   // Usa try/finally per chiudere sempre
   try {
     const { data } = await supabase.from('table').select('*');
   } finally {
     // Connection chiusa automaticamente
   }
   ```

---

## Caching Issues

### Stale Data

**Problema:**

- Dati non aggiornati
- Cache non invalidata

**Soluzione:**

1. **React Query cache invalidation:**

   ```typescript
   const queryClient = useQueryClient();

   // Invalida cache dopo mutation
   await createShipment(data);
   queryClient.invalidateQueries(['shipments']);
   ```

2. **Cache headers:**
   ```typescript
   // API route
   return NextResponse.json(data, {
     headers: {
       'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
     },
   });
   ```

---

## Bundle Size Issues

### Large Bundle Size

**Problema:**

- Bundle size > 500KB
- Slow initial load

**Soluzione:**

1. **Analizza bundle:**

   ```bash
   npm run build
   # Controlla output per bundle analysis
   ```

2. **Code splitting:**

   ```typescript
   // Lazy load route
   const Dashboard = dynamic(() => import('./Dashboard'));

   // Lazy load component
   const Chart = dynamic(() => import('./Chart'));
   ```

3. **Tree shaking:**
   - Importa solo quello che serve
   - Evita `import * from 'library'`
   - Usa named imports

---

## Image Optimization

### Large Images

**Problema:**

- Immagini non ottimizzate
- Slow image load

**Soluzione:**

1. **Usa next/image:**

   ```typescript
   import Image from 'next/image';

   <Image
     src="/image.jpg"
     width={500}
     height={300}
     alt="Description"
     priority // Per immagini above-the-fold
   />
   ```

2. **Ottimizza immagini:**
   - Usa formato WebP quando possibile
   - Comprimi immagini prima di upload
   - Usa dimensioni appropriate

---

## API Rate Limiting

### Rate Limit Exceeded

**Problema:**

```
429 Too Many Requests
```

**Soluzione:**

1. **Riduci frequenza richieste:**
   - Usa React Query caching
   - Batch multiple operazioni
   - Evita polling frequente

2. **Aumenta cache time:**
   ```typescript
   const { data } = useQuery({
     queryKey: ['data'],
     queryFn: fetchData,
     staleTime: 5 * 60 * 1000, // 5 minuti
     cacheTime: 10 * 60 * 1000, // 10 minuti
   });
   ```

---

## Monitoring Performance

### Web Vitals

**Metrics:**

- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

**Monitoring:**

- Vercel Analytics → Web Vitals
- Real User Monitoring (RUM)

---

### API Performance

**Metrics:**

- Response time (p50, p95, p99)
- Throughput (requests/second)
- Error rate

**Monitoring:**

- Vercel Dashboard → Functions
- Custom logging

---

## Best Practices

### 1. Database

- ✅ Indici su foreign keys
- ✅ Indici su colonne usate in WHERE/ORDER BY
- ✅ Evita SELECT \*
- ✅ Usa LIMIT per query grandi

### 2. API

- ✅ Cache responses quando possibile
- ✅ Batch multiple operations
- ✅ Usa pagination per liste grandi

### 3. Frontend

- ✅ Code splitting
- ✅ Lazy loading
- ✅ Image optimization
- ✅ React Query caching

---

## Related Documentation

- [Database Issues](DATABASE_ISSUES.md) - Database troubleshooting
- [API Issues](API_ISSUES.md) - API troubleshooting
- [Monitoring](../7-OPERATIONS/MONITORING.md) - Performance monitoring
- [Common Issues](COMMON_ISSUES.md) - Problemi comuni generali

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | Dev Team |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Dev Team_
