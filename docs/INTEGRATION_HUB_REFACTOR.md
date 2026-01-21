# 🔧 Integration Hub Refactor: Courier Configs Unification

## 📊 Current State Analysis

### 1. UI Components → Data Mapping

| Component                     | Path                                                       | Reads From                                                  | Writes To                                     | Key Fields Used                                                                     |
| ----------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| **CourierAPIConfig**          | `components/integrazioni/courier-api-config.tsx`           | `courier_configs` (via `listConfigurations()`)              | `courier_configs` (via `saveConfiguration()`) | `provider_id`, `api_key`, `base_url`, `contract_mapping`, `is_active`, `is_default` |
| **SpedisciOnlineConfig**      | `components/integrazioni/spedisci-online-config.tsx`       | `courier_configs` (filter: `provider_id='spedisci_online'`) | `courier_configs`                             | `api_key`, `base_url`, `contract_mapping`, `description` (dominio)                  |
| **SpedisciOnlineConfigMulti** | `components/integrazioni/spedisci-online-config-multi.tsx` | `courier_configs` (filter: `provider_id='spedisci_online'`) | `courier_configs`                             | `name`, `base_url`, `api_key`, `contracts`, `is_active`, `is_default`               |
| **ConfigurationsPage**        | `app/dashboard/admin/configurations/page.tsx`              | `courier_configs` (all)                                     | `courier_configs`                             | All fields + `assigned_config_id` (users)                                           |
| **AutomationPage**            | `app/dashboard/admin/automation/page.tsx`                  | `courier_configs` (filter: `provider_id='spedisci_online'`) | `courier_configs`                             | `automation_enabled`, `automation_settings`, `session_data`, `last_automation_sync` |
| **SpedisciOnlineWizard**      | `components/integrazioni/SpedisciOnlineWizard.tsx`         | `courier_configs`                                           | `courier_configs`                             | `api_key`, `base_url`, `contract_mapping`                                           |

### 2. Current Schema: `courier_configs`

**Table**: `public.courier_configs` (Migration 010)

**Fields**:

- `id` (UUID, PK)
- `name` (TEXT) - Nome configurazione
- `provider_id` (TEXT) - 'spedisci_online', 'gls', 'brt', 'poste'
- `api_key` (TEXT) - Criptato
- `api_secret` (TEXT, nullable) - Criptato
- `base_url` (TEXT)
- `contract_mapping` (JSONB) - `{"poste": "CODE123", "gls": "CODE456"}`
- `is_active` (BOOLEAN) - Default: true
- `is_default` (BOOLEAN) - Default: false
- `description` (TEXT, nullable)
- `notes` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `created_by` (TEXT) - Email admin/utente

**Missing for Integration Hub**:

- ❌ `status` (health check: 'active', 'error', 'testing')
- ❌ `last_tested_at` (TIMESTAMPTZ)
- ❌ `test_result` (JSONB) - `{ success: boolean, error?: string, tested_at: string }`
- ❌ `account_type` (TEXT) - 'admin', 'byoc', 'reseller'
- ❌ `owner_user_id` (UUID, nullable) - Per BYOC/reseller
- ❌ `automation_enabled` (BOOLEAN) - Esiste in automation ma non in schema base
- ❌ `automation_settings` (JSONB) - Esiste in automation ma non in schema base
- ❌ `session_data` (JSONB) - Esiste in automation ma non in schema base

---

## 🎯 Target Schema: Unified `carrier_configs`

### Extended Schema (Backward Compatible)

```sql
-- Estende courier_configs esistente (NON crea nuova tabella)
ALTER TABLE public.courier_configs
  -- Status e Health Check
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'testing', 'inactive')),
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS test_result JSONB DEFAULT '{}'::JSONB,

  -- Multi-tenant e BYOC
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'admin' CHECK (account_type IN ('admin', 'byoc', 'reseller')),
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Automation (già usato ma non in schema)
  ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_settings JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS last_automation_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS automation_encrypted BOOLEAN DEFAULT false;

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_carrier_configs_status ON courier_configs(status);
CREATE INDEX IF NOT EXISTS idx_carrier_configs_account_type ON courier_configs(account_type);
CREATE INDEX IF NOT EXISTS idx_carrier_configs_owner ON courier_configs(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carrier_configs_provider_status ON courier_configs(provider_id, status) WHERE is_active = true;
```

**Note**:

- `carrier_configs` = alias/rename di `courier_configs` (compatibilità)
- Tutti i campi esistenti rimangono invariati
- Nuovi campi sono opzionali (default/nullable)

---

## 🔄 Migration Plan (Zero Downtime)

### Phase 1: Schema Extension (Safe)

**File**: `supabase/migrations/032_integration_hub_schema.sql`

```sql
-- Step 1: Aggiungi colonne (tutte nullable/default per backward compatibility)
ALTER TABLE public.courier_configs
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS test_result JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_settings JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS last_automation_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS automation_encrypted BOOLEAN DEFAULT false;

-- Step 2: Aggiungi constraints (dopo che le colonne esistono)
ALTER TABLE public.courier_configs
  ADD CONSTRAINT IF NOT EXISTS check_status
    CHECK (status IN ('active', 'error', 'testing', 'inactive')),
  ADD CONSTRAINT IF NOT EXISTS check_account_type
    CHECK (account_type IN ('admin', 'byoc', 'reseller'));

-- Step 3: Migra dati esistenti
UPDATE public.courier_configs
SET
  status = CASE
    WHEN is_active = false THEN 'inactive'
    ELSE 'active'
  END,
  account_type = CASE
    WHEN created_by IS NOT NULL AND created_by != 'system' THEN 'byoc'
    ELSE 'admin'
  END,
  owner_user_id = (
    SELECT id FROM users
    WHERE email = courier_configs.created_by
    LIMIT 1
  )
WHERE status IS NULL OR account_type IS NULL;

-- Step 4: Indici
CREATE INDEX IF NOT EXISTS idx_carrier_configs_status ON courier_configs(status);
CREATE INDEX IF NOT EXISTS idx_carrier_configs_account_type ON courier_configs(account_type);
CREATE INDEX IF NOT EXISTS idx_carrier_configs_owner ON courier_configs(owner_user_id) WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carrier_configs_provider_status ON courier_configs(provider_id, status) WHERE is_active = true;
```

**Timing**: Eseguire durante maintenance window o in background (colonne nullable = safe)

### Phase 2: Compatibility Layer (Code)

**File**: `lib/integrations/carrier-configs-compat.ts` (NEW)

```typescript
/**
 * Compatibility Layer: courier_configs → carrier_configs
 *
 * Mantiene compatibilità con codice esistente durante migrazione
 */

import { supabaseAdmin } from '@/lib/db/client';

// Type alias per backward compatibility
export type CourierConfig = CarrierConfig;

export interface CarrierConfig {
  // Campi esistenti (invariati)
  id: string;
  name: string;
  provider_id: string;
  api_key: string;
  api_secret?: string;
  base_url: string;
  contract_mapping: Record<string, string>;
  is_active: boolean;
  is_default: boolean;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;

  // Nuovi campi (opzionali)
  status?: 'active' | 'error' | 'testing' | 'inactive';
  last_tested_at?: string;
  test_result?: { success: boolean; error?: string; tested_at: string };
  account_type?: 'admin' | 'byoc' | 'reseller';
  owner_user_id?: string;
  automation_enabled?: boolean;
  automation_settings?: any;
  session_data?: any;
  last_automation_sync?: string;
  automation_encrypted?: boolean;
}

/**
 * Lista configurazioni con filtri Integration Hub
 */
export async function listCarrierConfigs(filters?: {
  provider_id?: string;
  account_type?: 'admin' | 'byoc' | 'reseller';
  status?: 'active' | 'error' | 'testing' | 'inactive';
  owner_user_id?: string;
}): Promise<CarrierConfig[]> {
  let query = supabaseAdmin.from('courier_configs').select('*');

  if (filters?.provider_id) {
    query = query.eq('provider_id', filters.provider_id);
  }
  if (filters?.account_type) {
    query = query.eq('account_type', filters.account_type);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.owner_user_id) {
    query = query.eq('owner_user_id', filters.owner_user_id);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CarrierConfig[];
}
```

**Usage**: Gradual migration - nuovo codice usa `listCarrierConfigs()`, vecchio codice continua a funzionare

### Phase 3: Update Actions (Backward Compatible)

**File**: `actions/configurations.ts`

**Changes**:

- Aggiungi campi opzionali a `CourierConfigInput` e `CourierConfig`
- `saveConfiguration()` supporta nuovi campi (opzionali)
- `listConfigurations()` include nuovi campi (default se mancanti)

**No breaking changes**: Campi esistenti invariati, nuovi campi opzionali

---

## 🎨 UI Changes (Max 3 Micro-Changes)

### Change 1: Status Badge (Minimal)

**File**: `app/dashboard/admin/configurations/page.tsx`

**Add** (after line ~400, in config list):

```tsx
{
  /* Status Badge */
}
{
  config.status && config.status !== 'active' && (
    <span
      className={`px-2 py-1 text-xs rounded ${
        config.status === 'error'
          ? 'bg-red-100 text-red-800'
          : config.status === 'testing'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-gray-100 text-gray-800'
      }`}
    >
      {config.status === 'error'
        ? '⚠️ Errore'
        : config.status === 'testing'
          ? '🧪 Test'
          : '⏸️ Inattiva'}
    </span>
  );
}
```

**Location**: Nella lista configurazioni, dopo nome/config

### Change 2: Test Credentials Button (Minimal)

**File**: `app/dashboard/admin/configurations/page.tsx`

**Add** (in config actions, after Edit button):

```tsx
<button
  onClick={() => handleTestCredentials(config.id)}
  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
  title="Testa credenziali"
>
  🧪 Test
</button>
```

**Function** (add to component):

```tsx
async function handleTestCredentials(configId: string) {
  try {
    const response = await fetch(`/api/integrations/test-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_id: configId }),
    });
    const result = await response.json();

    if (result.success) {
      alert('✅ Credenziali valide');
      await loadConfigurations(); // Refresh per aggiornare status
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
  } catch (error) {
    alert('Errore durante test credenziali');
  }
}
```

### Change 3: Account Type Badge (Minimal)

**File**: `app/dashboard/admin/configurations/page.tsx`

**Add** (in config list, after status badge):

```tsx
{
  /* Account Type Badge */
}
{
  config.account_type && config.account_type !== 'admin' && (
    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">
      {config.account_type === 'byoc' ? '🔑 BYOC' : '🏢 Reseller'}
    </span>
  );
}
```

**Total UI Changes**: 3 micro-additions (badges + button), zero layout changes

---

## 🔒 Security Enhancements

### 1. Credential Encryption (Already Implemented)

✅ `api_key` e `api_secret` già criptati via `encryptCredential()`
✅ `automation_settings` password criptate se `automation_encrypted = true`

### 2. No Secrets in Logs

✅ Già implementato: fingerprint SHA256 invece di API key completa
✅ Logging production-safe: `apiKeyFingerprint` invece di `api_key`

### 3. Status Visibility

✅ Status chiaro: 'active', 'error', 'testing', 'inactive'
✅ Test result salvato in `test_result` JSONB (no secrets)

---

## 🧪 Test Plan

### Test 1: Reseller Multi-Account

**Setup**:

1. Crea 2 configurazioni Spedisci.Online con `account_type='reseller'`
2. Assegna a 2 utenti diversi (`users.assigned_config_id`)
3. Crea spedizione con utente 1 → deve usare config 1
4. Crea spedizione con utente 2 → deve usare config 2

**Expected**:

- ✅ Utente 1 usa config 1
- ✅ Utente 2 usa config 2
- ✅ Nessun conflitto

### Test 2: BYOC (Bring Your Own Carrier)

**Setup**:

1. Utente non-admin crea configurazione personale
2. `account_type='byoc'`, `owner_user_id=user.id`
3. Crea spedizione → deve usare config BYOC

**Expected**:

- ✅ Config BYOC salvata con `owner_user_id`
- ✅ Spedizione usa config BYOC
- ✅ Altri utenti non vedono config BYOC

### Test 3: Multi-Account Same Provider

**Setup**:

1. Admin crea 3 config Spedisci.Online (tutte `is_active=true`)
2. Una è `is_default=true`
3. Utente senza `assigned_config_id` crea spedizione

**Expected**:

- ✅ Usa config default
- ✅ Se default disattivata, fallback a prima attiva

### Test 4: Credential Test

**Setup**:

1. Config con API key valida
2. Click "Test" button
3. Verifica status aggiornato

**Expected**:

- ✅ Status: 'active' se test OK
- ✅ Status: 'error' se 401/403
- ✅ `test_result` salvato con dettagli
- ✅ `last_tested_at` aggiornato

### Test 5: Error 401 Handling

**Setup**:

1. Config con API key errata
2. Crea spedizione
3. Verifica gestione errore

**Expected**:

- ✅ Errore 401 gestito gracefully
- ✅ Messaggio chiaro: "Credenziali non valide. Testa in /dashboard/admin/configurations"
- ✅ Status aggiornato a 'error'

---

## 📋 Migration Checklist

### Pre-Migration

- [ ] Backup database
- [ ] Verifica schema attuale `courier_configs`
- [ ] Test migration in staging

### Migration

- [ ] Esegui `032_integration_hub_schema.sql`
- [ ] Verifica colonne aggiunte: `SELECT column_name FROM information_schema.columns WHERE table_name = 'courier_configs'`
- [ ] Verifica dati migrati: `SELECT account_type, status, COUNT(*) FROM courier_configs GROUP BY account_type, status`

### Post-Migration

- [ ] Deploy codice con compatibility layer
- [ ] Test UI esistente (nessun breaking change)
- [ ] Test nuove funzionalità (status badge, test button)
- [ ] Monitor log per errori

---

## 🔄 Compatibility Strategy

### Backward Compatibility

1. **Type Aliases**: `CourierConfig = CarrierConfig` (no breaking changes)
2. **Default Values**: Nuovi campi hanno default (esistenti funzionano)
3. **Gradual Migration**: Nuovo codice usa nuovi campi, vecchio continua a funzionare

### Code Migration Path

**Phase 1** (Now): Schema extension + compatibility layer

- ✅ Schema esteso
- ✅ Compatibility layer creato
- ✅ Actions aggiornate (backward compatible)

**Phase 2** (Future): Gradual adoption

- Nuovo codice usa `listCarrierConfigs()` con filtri
- Vecchio codice continua a usare `listConfigurations()`
- Entrambi funzionano

**Phase 3** (Future): Full migration

- Tutto il codice usa nuovi nomi/types
- Rimuovi compatibility layer (opzionale)

---

## 📝 Files to Create/Modify

### New Files

1. `supabase/migrations/032_integration_hub_schema.sql` - Schema extension
2. `lib/integrations/carrier-configs-compat.ts` - Compatibility layer
3. `app/api/integrations/test-credentials/route.ts` - Test endpoint

### Modified Files

1. `actions/configurations.ts` - Aggiungi nuovi campi (opzionali)
2. `app/dashboard/admin/configurations/page.tsx` - UI changes (3 micro-additions)
3. `lib/couriers/factory.ts` - Supporta nuovi filtri (opzionale)

### No Changes Required

- ✅ `components/integrazioni/courier-api-config.tsx` - Continua a funzionare
- ✅ `components/integrazioni/spedisci-online-config.tsx` - Continua a funzionare
- ✅ `components/integrazioni/spedisci-online-config-multi.tsx` - Continua a funzionare
- ✅ `app/dashboard/admin/automation/page.tsx` - Continua a funzionare

---

## ✅ Success Criteria

- ✅ UI esistente funziona senza modifiche (tranne 3 micro-additions)
- ✅ Dati esistenti preservati
- ✅ Nuove funzionalità (status, test) disponibili
- ✅ BYOC e Reseller supportati
- ✅ Zero downtime migration
- ✅ Backward compatibility garantita

---

**Status**: Design completo, pronto per implementazione ✅
