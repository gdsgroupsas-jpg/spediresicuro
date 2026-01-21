# 🔄 Versionamento e Monitoraggio API Corrieri

## Panoramica

Sistema per tracciare versioni API e monitorare lo stato di salute delle API dei corrieri, prevenendo rotture dovute a cambiamenti nelle API esterne.

---

## 📋 Funzionalità

### 1. Versionamento API

Registra e traccia versioni API per ogni corriere:

- **Versione API** (es: `v1`, `v2.1`, `2024-01`)
- **URL Base** per ogni versione
- **Changelog** e breaking changes
- **Deprecazione** e date di supporto

### 2. Monitoraggio Salute API

Monitora lo stato delle API in tempo reale:

- **Health Check** automatico
- **Tempo di risposta** (response time)
- **Stato** (healthy, degraded, down)
- **Alert** quando API non disponibili

---

## 🚀 Utilizzo

### Registrare una Nuova Versione API

```typescript
import { registerAPIVersion } from '@/lib/monitoring/api-versioning';

await registerAPIVersion('spedisci_online', 'v2', 'https://api.spedisci.online/v2', {
  changelog: 'Aggiunto supporto per contratti multipli',
  breakingChanges: false,
  deprecated: false,
  supportedUntil: '2025-12-31',
});
```

### Verificare Salute API

```typescript
import { checkAPIHealth } from '@/lib/monitoring/api-versioning';

const monitor = await checkAPIHealth('spedisci_online', 'https://api.spedisci.online/v2');

console.log(`Status: ${monitor.status}`);
console.log(`Response Time: ${monitor.response_time_ms}ms`);
```

### Recuperare Versione Corrente

```typescript
import { getCurrentAPIVersion } from '@/lib/monitoring/api-versioning';

const version = await getCurrentAPIVersion('spedisci_online');
if (version) {
  console.log(`Versione: ${version.version}`);
  console.log(`URL: ${version.base_url}`);
  if (version.deprecated) {
    console.warn('⚠️ Versione deprecata!');
  }
}
```

---

## 📊 Dashboard Monitoraggio

### Query Stato API

```sql
-- Stato salute API per tutti i provider
SELECT
  provider_id,
  status,
  last_check,
  response_time_ms,
  error_message
FROM api_monitors
ORDER BY last_check DESC;
```

### Versioni API Attive

```sql
-- Versioni non deprecate
SELECT
  provider_id,
  version,
  base_url,
  breaking_changes,
  supported_until
FROM api_versions
WHERE deprecated = false
ORDER BY created_at DESC;
```

---

## 🔔 Alert e Notifiche

### Configurare Alert

Quando un'API va in stato `down`, puoi configurare notifiche:

```typescript
// lib/monitoring/alerts.ts
export async function checkAndAlert() {
  const { data: monitors } = await supabaseAdmin
    .from('api_monitors')
    .select('*')
    .eq('status', 'down');

  for (const monitor of monitors || []) {
    // Invia email/notifica
    await sendAlert({
      provider: monitor.provider_id,
      status: monitor.status,
      error: monitor.error_message,
    });
  }
}
```

### Cron Job per Monitoraggio Continuo

```typescript
// app/api/cron/monitor-apis/route.ts
export async function GET(request: NextRequest) {
  const providers = ['spedisci_online', 'gls', 'brt', 'poste'];

  for (const providerId of providers) {
    const config = await getCurrentAPIVersion(providerId);
    if (config) {
      await checkAPIHealth(providerId, config.base_url);
    }
  }

  return NextResponse.json({ success: true });
}
```

Configura su Vercel Cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/monitor-apis",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## 🔄 Gestione Breaking Changes

### Quando una Versione ha Breaking Changes

1. **Registra nuova versione** con `breaking_changes: true`
2. **Mantieni versione vecchia** attiva per transizione
3. **Notifica utenti** della deprecazione
4. **Migra gradualmente** le configurazioni

### Esempio Migrazione

```typescript
// Migra configurazioni a nuova versione
async function migrateToNewVersion(providerId: string, oldVersion: string, newVersion: string) {
  // 1. Recupera tutte le config che usano vecchia versione
  const { data: configs } = await supabaseAdmin
    .from('courier_configs')
    .select('*')
    .eq('provider_id', providerId);

  // 2. Aggiorna base_url per ogni config
  for (const config of configs || []) {
    const newBaseUrl = getBaseUrlForVersion(providerId, newVersion);

    await supabaseAdmin
      .from('courier_configs')
      .update({ base_url: newBaseUrl })
      .eq('id', config.id);
  }
}
```

---

## 📈 Metriche e Reporting

### Dashboard Metriche

```sql
-- Uptime per provider (ultimi 30 giorni)
SELECT
  provider_id,
  COUNT(*) FILTER (WHERE status = 'healthy') * 100.0 / COUNT(*) as uptime_percent,
  AVG(response_time_ms) as avg_response_time
FROM api_monitors
WHERE last_check > NOW() - INTERVAL '30 days'
GROUP BY provider_id;
```

### Report Settimanale

```typescript
// Genera report settimanale stato API
export async function generateWeeklyReport() {
  const { data: monitors } = await supabaseAdmin
    .from('api_monitors')
    .select('*')
    .gte('last_check', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  // Calcola metriche
  const metrics = {
    total_checks: monitors?.length || 0,
    healthy_count: monitors?.filter((m) => m.status === 'healthy').length || 0,
    degraded_count: monitors?.filter((m) => m.status === 'degraded').length || 0,
    down_count: monitors?.filter((m) => m.status === 'down').length || 0,
    avg_response_time:
      monitors?.reduce((sum, m) => sum + (m.response_time_ms || 0), 0) / (monitors?.length || 1),
  };

  return metrics;
}
```

---

## 🛠️ Troubleshooting

### API Sempre in Stato "down"

**Possibili cause:**

1. URL base errato
2. Firewall/network blocking
3. API effettivamente non disponibile

**Soluzione:**

1. Verifica URL base nella configurazione
2. Testa manualmente con `curl` o Postman
3. Controlla log errori per dettagli

### Response Time Elevato

**Possibili cause:**

1. Network latency
2. API sovraccarica
3. Problemi infrastruttura corriere

**Soluzione:**

1. Monitora trend nel tempo
2. Contatta supporto corriere se persistente
3. Considera fallback a API alternative

---

## 📚 Riferimenti

- [API Health Check Best Practices](https://www.healthchecks.io/)
- [Semantic Versioning](https://semver.org/)
- [API Versioning Strategies](https://restfulapi.net/versioning/)
