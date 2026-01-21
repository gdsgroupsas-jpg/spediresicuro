# 🚀 Integration Hub: Implementation Guide

## 📋 Summary

**Current State**: Tabella unica `courier_configs` con `provider_id` ✅

**Target**: Estendere `courier_configs` per Integration Hub (BYOC + Reseller + Health Check) mantenendo UI quasi identica.

---

## 🗺️ Component UI → Data Mapping

### 1. CourierAPIConfig

- **Reads**: `courier_configs` (via `listConfigurations()`)
- **Writes**: `courier_configs` (via `saveConfiguration()`)
- **Fields**: `provider_id`, `api_key`, `base_url`, `contract_mapping`, `is_active`, `is_default`
- **No changes needed** ✅

### 2. SpedisciOnlineConfig

- **Reads**: `courier_configs` (filter: `provider_id='spedisci_online'`)
- **Writes**: `courier_configs`
- **Fields**: `api_key`, `base_url`, `contract_mapping`, `description`
- **No changes needed** ✅

### 3. SpedisciOnlineConfigMulti

- **Reads**: `courier_configs` (filter: `provider_id='spedisci_online'`)
- **Writes**: `courier_configs`
- **Fields**: `name`, `base_url`, `api_key`, `contracts`, `is_active`, `is_default`
- **No changes needed** ✅

### 4. ConfigurationsPage (Admin)

- **Reads**: `courier_configs` (all)
- **Writes**: `courier_configs`
- **Fields**: All fields + `assigned_config_id` (users)
- **UI Changes**: 3 micro-additions (status badge, test button, account type badge)

### 5. AutomationPage

- **Reads**: `courier_configs` (filter: `provider_id='spedisci_online'`)
- **Writes**: `courier_configs`
- **Fields**: `automation_enabled`, `automation_settings`, `session_data`, `last_automation_sync`
- **No changes needed** ✅ (campi già esistenti da migration 015)

---

## 🗄️ Schema Unificato

### Current: `courier_configs` (Migration 010)

**Existing Fields**:

- `id`, `name`, `provider_id`
- `api_key`, `api_secret`, `base_url`
- `contract_mapping` (JSONB)
- `is_active`, `is_default`
- `description`, `notes`
- `created_at`, `updated_at`, `created_by`

**Already Extended** (Migration 015):

- `automation_enabled` (BOOLEAN)
- `automation_settings` (JSONB)
- `session_data` (JSONB)

### Extended: `courier_configs` (Migration 032)

**New Fields** (all nullable/default for backward compatibility):

- `status` (TEXT) - 'active', 'error', 'testing', 'inactive'
- `last_tested_at` (TIMESTAMPTZ)
- `test_result` (JSONB) - `{ success: boolean, error?: string, tested_at: string }`
- `account_type` (TEXT) - 'admin', 'byoc', 'reseller'
- `owner_user_id` (UUID) - FK to users(id)
- `automation_encrypted` (BOOLEAN) - Flag per password criptate
- `last_automation_sync` (TIMESTAMPTZ) - Se non presente

**Note**: `carrier_configs` = alias/rename di `courier_configs` (compatibilità)

---

## 🔄 Migration Plan (Zero Downtime)

### Phase 1: Schema Extension ✅

**File**: `supabase/migrations/032_integration_hub_schema.sql`

**Steps**:

1. Aggiungi colonne (tutte nullable/default)
2. Aggiungi constraints
3. Migra dati esistenti (status da is_active, account_type da created_by)
4. Crea indici

**Timing**: Safe durante produzione (colonne nullable)

### Phase 2: Compatibility Layer ✅

**File**: `lib/integrations/carrier-configs-compat.ts` (NEW)

**Functions**:

- `listCarrierConfigs(filters?)` - Lista con filtri opzionali
- `getCarrierConfigForUser(userId, providerId)` - Supporta BYOC/Reseller
- `testCarrierCredentials(configId)` - Test credenziali

**Backward Compatibility**:

- Type alias: `CourierConfig = CarrierConfig`
- Default values per nuovi campi
- Vecchio codice continua a funzionare

### Phase 3: Update Actions ✅

**File**: `actions/configurations.ts`

**Changes**:

- Aggiungi nuovi campi opzionali a `CourierConfigInput` e `CourierConfig`
- `saveConfiguration()` supporta nuovi campi (opzionali)
- `listConfigurations()` include nuovi campi (default se mancanti)

**No Breaking Changes**: Campi esistenti invariati

### Phase 4: UI Micro-Changes

**File**: `app/dashboard/admin/configurations/page.tsx`

**Changes** (3 micro-additions):

1. Status badge (after config name)
2. Test button (in actions)
3. Account type badge (after status badge)

**Total**: ~30 lines aggiunte, zero layout changes

---

## 🎨 UI Changes (Max 3)

### Change 1: Status Badge

**Location**: Config list, after config name

```tsx
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

### Change 2: Test Credentials Button

**Location**: Config actions, after Edit button

```tsx
<button
  onClick={() => handleTestCredentials(config.id)}
  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
  title="Testa credenziali"
>
  🧪 Test
</button>
```

**Function**:

```tsx
async function handleTestCredentials(configId: string) {
  try {
    const response = await fetch('/api/integrations/test-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config_id: configId }),
    });
    const result = await response.json();

    if (result.success) {
      alert('✅ Credenziali valide');
      await loadConfigurations();
    } else {
      alert(`❌ Errore: ${result.error}`);
    }
  } catch (error) {
    alert('Errore durante test credenziali');
  }
}
```

### Change 3: Account Type Badge

**Location**: Config list, after status badge

```tsx
{
  config.account_type && config.account_type !== 'admin' && (
    <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">
      {config.account_type === 'byoc' ? '🔑 BYOC' : '🏢 Reseller'}
    </span>
  );
}
```

---

## 🔒 Security

### Credential Encryption ✅

- `api_key` e `api_secret` già criptati via `encryptCredential()`
- `automation_settings` password criptate se `automation_encrypted = true`

### No Secrets in Logs ✅

- Fingerprint SHA256 invece di API key completa
- `test_result` non contiene secrets (solo success/error)

### Status Visibility ✅

- Status chiaro: 'active', 'error', 'testing', 'inactive'
- Test result salvato in JSONB (no secrets)

---

## 🧪 Test Plan

### Test 1: Reseller Multi-Account

**Setup**:

1. Crea 2 config Spedisci.Online con `account_type='reseller'`
2. Assegna a 2 utenti (`users.assigned_config_id`)
3. Crea spedizione utente 1 → usa config 1
4. Crea spedizione utente 2 → usa config 2

**Expected**: ✅ Utente 1 usa config 1, Utente 2 usa config 2

### Test 2: BYOC

**Setup**:

1. Utente non-admin crea config personale
2. `account_type='byoc'`, `owner_user_id=user.id`
3. Crea spedizione → usa config BYOC

**Expected**: ✅ Config BYOC salvata, spedizione usa config BYOC

### Test 3: Multi-Account Same Provider

**Setup**:

1. Admin crea 3 config Spedisci.Online (tutte `is_active=true`)
2. Una è `is_default=true`
3. Utente senza `assigned_config_id` crea spedizione

**Expected**: ✅ Usa config default

### Test 4: Credential Test

**Setup**:

1. Config con API key valida
2. Click "Test" button
3. Verifica status aggiornato

**Expected**: ✅ Status: 'active' se OK, 'error' se 401, `test_result` salvato

### Test 5: Error 401 Handling

**Setup**:

1. Config con API key errata
2. Crea spedizione
3. Verifica gestione errore

**Expected**: ✅ Errore 401 gestito, status aggiornato a 'error'

---

## 📝 Files Created/Modified

### New Files

1. ✅ `supabase/migrations/032_integration_hub_schema.sql`
2. ✅ `lib/integrations/carrier-configs-compat.ts`
3. ✅ `app/api/integrations/test-credentials/route.ts`

### Modified Files

1. ✅ `actions/configurations.ts` - Aggiunti nuovi campi (opzionali)
2. ⏳ `app/dashboard/admin/configurations/page.tsx` - UI changes (3 micro-additions)

### No Changes Required

- ✅ `components/integrazioni/courier-api-config.tsx`
- ✅ `components/integrazioni/spedisci-online-config.tsx`
- ✅ `components/integrazioni/spedisci-online-config-multi.tsx`
- ✅ `app/dashboard/admin/automation/page.tsx`

---

## ✅ Implementation Checklist

- [x] Schema extension migration creata
- [x] Compatibility layer creato
- [x] Test endpoint creato
- [x] Actions aggiornate (backward compatible)
- [ ] UI changes applicate (3 micro-additions)
- [ ] Migration eseguita in staging
- [ ] Test plan eseguito
- [ ] Deploy produzione

---

**Status**: Pronto per implementazione ✅
