# 🔧 FIX: account_type Corretto per Reseller

**Data**: 2025-12-28  
**Problema**: Wizard Spedisci.Online salva con `account_type='user'` invece di `'reseller'`  
**Causa**: `savePersonalConfiguration` non controlla `is_reseller` dell'utente  
**Soluzione**: Forza `account_type='reseller'` se `user.is_reseller === true`

---

## 📋 PROBLEMA CONFERMATO

### Log Guardrail
```
⚠️ [Booking] Utente non trovato: <user_id>
```

### Causa Root
`savePersonalConfiguration` non imposta:
- `account_type` (default `null` o `'user'`)
- `owner_user_id` (non associa config all'utente)

### Risultato
Motore spedizioni non trova la configurazione perché:
1. Query cerca `account_type='reseller'` ma trova `null`
2. Query cerca `owner_user_id=<user_id>` ma trova `null`

---

## 📋 FIX IMPLEMENTATO

### File: `actions/configurations.ts`

**Modifiche a `savePersonalConfiguration`**:

#### 1. Recupera `is_reseller` da DB

**Prima**:
```typescript
const { data: userData, error: userError } = await supabaseAdmin
  .from('users')
  .select('id, assigned_config_id')
  .eq('email', session.user.email)
  .single();
```

**Dopo**:
```typescript
const { data: userData, error: userError } = await supabaseAdmin
  .from('users')
  .select('id, assigned_config_id, is_reseller')
  .eq('email', session.user.email)
  .single();

// ⚠️ FIX CRITICO: Forza account_type corretto per reseller
const isReseller = userData.is_reseller === true;
const accountType = isReseller ? 'reseller' : 'byoc';

console.log(`📋 [savePersonalConfiguration] User: ${session.user.email}, is_reseller: ${isReseller}, account_type: ${accountType}`);
```

---

#### 2. Aggiungi `account_type` e `owner_user_id` al payload

**Prima**:
```typescript
const configData: any = {
  name: data.name,
  provider_id: data.provider_id,
  api_key: isEncrypted(data.api_key) ? data.api_key : encryptCredential(data.api_key),
  base_url: data.base_url,
  contract_mapping: data.contract_mapping || {},
  is_active: data.is_active ?? true,
  is_default: false,
  description: data.description || null,
  notes: data.notes || null,
  updated_at: new Date().toISOString(),
};
```

**Dopo**:
```typescript
const configData: any = {
  name: data.name,
  provider_id: data.provider_id,
  api_key: isEncrypted(data.api_key) ? data.api_key : encryptCredential(data.api_key),
  base_url: data.base_url,
  contract_mapping: data.contract_mapping || {},
  is_active: data.is_active ?? true,
  is_default: false,
  description: data.description || null,
  notes: data.notes || null,
  account_type: accountType, // ⚠️ FIX: Forza account_type corretto (reseller o byoc)
  owner_user_id: userData.id, // ⚠️ FIX: Associa config all'utente
  updated_at: new Date().toISOString(),
};
```

---

#### 3. Usa UPSERT invece di INSERT/UPDATE manuale

**Prima**:
```typescript
// Cerca configurazione esistente
let existingConfigId: string | null = null;
if (userData.assigned_config_id) {
  const { data: existingConfig } = await supabaseAdmin
    .from('courier_configs')
    .select('id, created_by')
    .eq('id', userData.assigned_config_id)
    .eq('provider_id', data.provider_id)
    .single();
  
  if (existingConfig && existingConfig.created_by === session.user.email) {
    existingConfigId = existingConfig.id;
  }
}

// Insert o update manuale
if (existingConfigId) {
  // Update...
} else {
  // Insert...
}
```

**Dopo**:
```typescript
// UPSERT su (owner_user_id, provider_id)
configData.created_by = session.user.email;

const { data: result, error: upsertError } = await supabaseAdmin
  .from('courier_configs')
  .upsert(configData, {
    onConflict: 'owner_user_id,provider_id', // Constraint unico su questi campi
    ignoreDuplicates: false, // Aggiorna se esiste
  })
  .select()
  .single();

console.log(`✅ Configurazione personale salvata (upsert):`, {
  id: result.id,
  account_type: result.account_type,
  owner_user_id: result.owner_user_id,
  provider_id: result.provider_id,
});
```

---

## 📋 RISULTATO ATTESO

### Prima del Fix
```sql
SELECT id, account_type, owner_user_id, provider_id, created_by
FROM courier_configs
WHERE provider_id = 'spedisci_online'
  AND created_by = '<reseller_email>';
```

**Risultato**:
```
id: <uuid>
account_type: NULL           ❌ PROBLEMA
owner_user_id: NULL          ❌ PROBLEMA
provider_id: "spedisci_online"
created_by: "<reseller_email>"
```

---

### Dopo il Fix
```sql
SELECT id, account_type, owner_user_id, provider_id, created_by
FROM courier_configs
WHERE provider_id = 'spedisci_online'
  AND created_by = '<reseller_email>';
```

**Risultato**:
```
id: <uuid>
account_type: "reseller"     ✅ CORRETTO
owner_user_id: "<user_id>"   ✅ CORRETTO
provider_id: "spedisci_online"
created_by: "<reseller_email>"
```

---

## 📋 TEST PLAN

### Test 1: Reseller Salva Configurazione

**Steps**:
1. Login come reseller
2. Vai a `/dashboard/integrazioni`
3. Completa wizard Spedisci.Online
4. Salva

**Verifiche Log**:
```
📋 [savePersonalConfiguration] User: <reseller_email>, is_reseller: true, account_type: reseller
✅ Configurazione personale salvata (upsert): {
  id: "<uuid>",
  account_type: "reseller",
  owner_user_id: "<user_id>",
  provider_id: "spedisci_online"
}
```

**Verifica DB**:
```sql
SELECT account_type, owner_user_id
FROM courier_configs
WHERE created_by = '<reseller_email>'
  AND provider_id = 'spedisci_online';
```

**Risultato Atteso**:
```
account_type: "reseller"   ✅
owner_user_id: "<user_id>" ✅
```

---

### Test 2: Reseller Crea Spedizione

**Steps**:
1. Login come reseller (stesso account Test 1)
2. Vai a `/dashboard/spedizioni/nuova`
3. Compila form e submit

**Verifiche Log**:
```
✅ [Booking] Configurazione personale trovata per utente: <reseller_email>
🚀 [SPEDISCI.ONLINE] INIZIO CREAZIONE SPEDIZIONE
🔍 [SPEDISCI.ONLINE] Codice contratto trovato: <contract_code>
```

**Verifica**: Nessun errore "Utente non trovato"

---

### Test 3: Utente Normale Salva Configurazione

**Steps**:
1. Login come utente normale (`is_reseller = false`)
2. Completa wizard

**Verifiche Log**:
```
📋 [savePersonalConfiguration] User: <user_email>, is_reseller: false, account_type: byoc
✅ Configurazione personale salvata (upsert): {
  id: "<uuid>",
  account_type: "byoc",
  owner_user_id: "<user_id>",
  provider_id: "spedisci_online"
}
```

---

## 📋 RIEPILOGO

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **account_type** | `null` ❌ | `'reseller'` o `'byoc'` ✅ |
| **owner_user_id** | `null` ❌ | `<user_id>` ✅ |
| **Upsert** | Insert/Update manuale ❌ | UPSERT su constraint ✅ |
| **Duplicati** | Possibili ❌ | Impossibili (constraint) ✅ |
| **Motore Spedizioni** | Non trova config ❌ | Trova config ✅ |

---

**Firma**:  
Senior Backend Engineer  
Data: 2025-12-28

