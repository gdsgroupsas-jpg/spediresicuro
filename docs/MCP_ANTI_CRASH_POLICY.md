# 🛡️ MCP Anti-Crash Policy

## Problema

Quando Cursor prova a leggere automaticamente i log usando i tool MCP (`mcp_supabase_get_logs`), può causare crash dell'applicazione.

## Soluzione Implementata

### 1. Funzioni Ottimizzate con Limiti

Le funzioni `getSystemLogs` in `actions/get-logs.ts` e `actions/logs.ts` sono state ottimizzate con:

- ✅ **Limite massimo**: 100 log per query (default: 50)
- ✅ **Timeout**: 5 secondi per evitare query infinite
- ✅ **Validazione dati**: I dati vengono validati prima del processing
- ✅ **Error handling robusto**: Gli errori vengono loggati ma non causano crash

### 2. Regole Cursor

File `.cursorrules` contiene regole per evitare l'uso automatico dei tool MCP per i log.

### 3. Best Practices

#### ✅ CORRETTO: Usa le funzioni del codice

```typescript
import { getSystemLogs } from "@/actions/get-logs";

// Limite sicuro (max 100)
const logs = await getSystemLogs(50);
```

#### ❌ SBAGLIATO: Non usare MCP automaticamente

```typescript
// ❌ NON FARE: Può causare crash!
// mcp_supabase_get_logs({ service: 'api' })
```

### 4. Quando Usare MCP

I tool MCP possono essere usati **SOLO** se:

1. ✅ Richiesto esplicitamente dall'utente
2. ✅ Con limiti espliciti (max 50 log)
3. ✅ Con gestione errori appropriata
4. ✅ Non in modo automatico/background

## Configurazione

### Limiti Configurabili

I limiti sono definiti nelle funzioni:

```typescript
const MAX_LOG_LIMIT = 100; // Massimo log per query
const DEFAULT_LIMIT = 50; // Default limit
const QUERY_TIMEOUT_MS = 5000; // Timeout in millisecondi
```

### Modificare i Limiti

Se necessario, modifica questi valori in:

- `actions/get-logs.ts`
- `actions/logs.ts`

## Monitoraggio

### Log di Warning

Se una query va in timeout, vedrai:

```
⚠️ [getSystemLogs] Timeout durante recupero log
```

### Errori Gestiti

Gli errori vengono loggati ma non causano crash:

```
Errore in getSystemLogs: [messaggio errore]
```

## Test

Per testare la robustezza:

```typescript
// Test con limite alto (dovrebbe essere limitato a 100)
const logs = await getSystemLogs(1000); // Diventa 100 automaticamente

// Test con timeout (simula query lenta)
// La query viene interrotta dopo 5 secondi
```

## Troubleshooting

### Se vedi ancora crash

1. ✅ Verifica che stai usando `actions/get-logs.ts` invece di MCP
2. ✅ Controlla che i limiti siano rispettati
3. ✅ Verifica che gli errori siano gestiti

### Se le query sono troppo lente

1. ✅ Riduci il limite (es: da 50 a 20)
2. ✅ Aggiungi filtri per ridurre i risultati
3. ✅ Usa paginazione invece di caricare tutti i log

## Status

✅ **IMPLEMENTATO**: Funzioni ottimizzate con limiti e timeout
✅ **IMPLEMENTATO**: Regole Cursor per evitare uso automatico MCP
✅ **IMPLEMENTATO**: Error handling robusto

---

**Ultimo aggiornamento**: 2025-02-01
**Versione**: 1.0.0
