# CI Gate e Telemetria Strutturata

## CI Gate (GitHub Actions)

Il workflow `.github/workflows/ci.yml` esegue automaticamente su ogni PR e push su `master`:

1. **npm ci** - Installazione dipendenze
2. **npm run test:unit** - Test unitari
3. **npm run test:integration** - Test di integrazione
4. **npm run type-check** - Verifica TypeScript
5. **npm run build** - Build produzione

### Variabili d'ambiente CI

Il workflow usa variabili d'ambiente mock per il build (non necessarie per i test):

- `ANTHROPIC_API_KEY` (opzionale, usa `test-key` se non presente)
- `GOOGLE_API_KEY` (opzionale, usa `test-key` se non presente)
- `NEXTAUTH_SECRET` (opzionale, usa `test-secret` se non presente)
- `NEXTAUTH_URL` (default: `http://localhost:3000`)
- `SUPABASE_URL` (opzionale, usa URL mock se non presente)
- `SUPABASE_SERVICE_ROLE_KEY` (opzionale, usa `test-key` se non presente)

## Telemetria Strutturata

### Logging senza PII

Tutti i log strutturati sono in formato JSON e **non contengono PII** (Personally Identifiable Information):

- ❌ **NO** email
- ❌ **NO** userId completo
- ❌ **NO** userName
- ✅ **SÌ** trace_id (univoco per richiesta)
- ✅ **SÌ** user_id_hash (primi 8 caratteri, non reversibile)
- ✅ **SÌ** userRole (non PII)

### Eventi Telemetria

#### 1. `intentDetected`

Loggato quando viene rilevato un intento preventivo.

```json
{
  "event": "intentDetected",
  "trace_id": "trace_1234567890_abc123",
  "user_id_hash": "user_12345678",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "intent_detected": true,
  "service": "anne-v2",
  "environment": "production"
}
```

#### 2. `usingPricingGraph`

Loggato quando il pricing graph viene utilizzato con successo.

```json
{
  "event": "usingPricingGraph",
  "trace_id": "trace_1234567890_abc123",
  "user_id_hash": "user_12345678",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "execution_time_ms": 1234,
  "pricing_options_count": 3,
  "service": "anne-v2",
  "environment": "production"
}
```

#### 3. `graphFailed`

Loggato quando il pricing graph fallisce.

```json
{
  "event": "graphFailed",
  "trace_id": "trace_1234567890_abc123",
  "user_id_hash": "user_12345678",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "error_type": "Error",
  "error_message": "Graph execution failed",
  "service": "anne-v2",
  "environment": "production"
}
```

#### 4. `fallbackToLegacy`

Loggato quando viene fatto fallback al codice legacy.

```json
{
  "event": "fallbackToLegacy",
  "trace_id": "trace_1234567890_abc123",
  "user_id_hash": "user_12345678",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "reason": "graph_failed",
  "service": "anne-v2",
  "environment": "production"
}
```

### Utilizzo

```typescript
import { 
  generateTraceId, 
  logIntentDetected, 
  logUsingPricingGraph, 
  logGraphFailed, 
  logFallbackToLegacy 
} from '@/lib/telemetry/logger';

// All'inizio della richiesta
const traceId = generateTraceId();

// Quando rilevi un intento
logIntentDetected(traceId, userId, true);

// Quando usi il pricing graph
logUsingPricingGraph(traceId, userId, executionTime, pricingOptionsCount);

// Quando il graph fallisce
logGraphFailed(traceId, error, userId);

// Quando fai fallback
logFallbackToLegacy(traceId, userId, 'graph_failed');
```

### Trace ID nei Metadata

Il `trace_id` viene incluso nei metadata delle risposte API per permettere il tracciamento end-to-end:

```json
{
  "success": true,
  "message": "...",
  "metadata": {
    "trace_id": "trace_1234567890_abc123",
    "userRole": "user",
    "usingPricingGraph": true,
    "pricingOptionsCount": 3,
    // NO userId, NO email (PII)
  }
}
```

## Verifica PII

Per verificare che non ci sia PII nei log:

1. Cerca `userId` nei metadata delle risposte API → ❌ NON deve esserci
2. Cerca `email` o `userEmail` nei log strutturati → ❌ NON deve esserci
3. Verifica che `user_id_hash` usi solo i primi 8 caratteri → ✅ OK
4. Verifica che `trace_id` sia univoco ma non contenga dati utente → ✅ OK

## Analisi Log

I log strutturati possono essere analizzati con:

- **Vercel Logs**: Filtra per `service: "anne-v2"`
- **CloudWatch / Datadog**: Query JSON per eventi specifici
- **Loki / Grafana**: Query LogQL per aggregazioni

Esempio query per tasso di fallback:

```logql
{service="anne-v2"} | json | event="fallbackToLegacy" | rate(5m)
```

