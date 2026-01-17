# Reseller Pricing Governance (Opt-in)

## 📋 Overview

Sistema di governance **opt-in** per controllare i prezzi dei listini personalizzati creati dai reseller.

**Default**: Libertà assoluta (nessun limite)
**Attivazione**: SuperAdmin può attivare protezioni per-reseller

---

## 🎯 Obiettivi

1. **Libertà Default**: Reseller e SuperAdmin hanno libertà assoluta sui propri listini custom
2. **Protezione Opt-in**: SuperAdmin può attivare limiti minimi per reseller specifici
3. **Audit Trail**: Soft delete con tracking completo modifiche
4. **Zero Breaking Changes**: Backward compatible con sistema esistente

---

## 🗂️ Architettura

### Database Schema

```sql
-- Tabella: reseller_pricing_policies
CREATE TABLE reseller_pricing_policies (
  id UUID PRIMARY KEY,
  reseller_id UUID REFERENCES users(id),

  -- Governance flags
  enforce_limits BOOLEAN DEFAULT false,  -- Opt-in
  min_markup_percent NUMERIC(5,2) DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  notes TEXT
);
```

### Type Definition

```typescript
interface ResellerPricingPolicy {
  id: string;
  reseller_id: string;
  enforce_limits: boolean;        // false = nessun limite (default)
  min_markup_percent: number;     // 0-100%
  created_at: string;
  updated_at: string;
  revoked_at: string | null;      // Soft delete
  created_by: string | null;
  notes: string | null;
}
```

---

## 🔐 Permessi (RLS)

| Utente | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| **SuperAdmin** | ✅ Tutte | ✅ Tutte | ✅ Tutte | ✅ Tutte |
| **Reseller** | ✅ Propria (attiva) | ❌ No | ❌ No | ❌ No |
| **User** | ❌ No | ❌ No | ❌ No | ❌ No |

---

## 📊 Workflow

### Scenario 1: Nessuna Policy (Default)

```typescript
// Nessuna policy esistente per reseller
const policy = await getResellerPricingPolicy(resellerId);
// policy === null

// Reseller può impostare QUALSIASI prezzo
await createPriceListEntry({
  base_price: 1.00,  // Anche sotto costo!
  markup_percent: -50, // Anche negativo!
}); // ✅ ACCETTATO
```

### Scenario 2: Policy Disattivata

```typescript
// Policy esistente ma enforce_limits = false
const policy = {
  enforce_limits: false,
  min_markup_percent: 10, // Ignorato
};

// Reseller ha libertà assoluta
await createPriceListEntry({
  base_price: 1.00,
  markup_percent: 5, // Sotto il 10%, ma OK
}); // ✅ ACCETTATO
```

### Scenario 3: Policy Attivata

```typescript
// SuperAdmin attiva policy per reseller specifico
await upsertResellerPricingPolicy({
  resellerId: 'reseller-uuid',
  enforce_limits: true,
  min_markup_percent: 15,
  notes: 'Reseller ha storico perdite'
});

// Reseller prova a creare entry con 10% markup
const result = await createPriceListEntry({
  base_price: 100,
  markup_percent: 10, // Sotto il 15%!
});
// ❌ RIFIUTATO: "Markup 10% below minimum 15%"
```

### Scenario 4: SuperAdmin Bypass

```typescript
// SuperAdmin ha SEMPRE bypass
const isSuperAdmin = user.account_type === 'superadmin';

const result = await createPriceListEntry({
  base_price: 100,
  markup_percent: -50, // Negativo!
});
// ✅ ACCETTATO (SuperAdmin può tutto)
```

---

## 🛠️ API Usage

### Helper Functions

```typescript
// Recupera policy attiva per reseller
const policy = await getResellerPricingPolicy(resellerId);
// Returns: ResellerPricingPolicy | null

// Valida pricing contro policy
const error = await validateResellerPricing({
  resellerId: 'uuid',
  basePrice: 100,
  finalPrice: 105, // 5% markup
  isSuperAdmin: false,
});
// Returns: string (error message) | null (valid)
```

### Validation Flow

```typescript
// In price-list-entries.ts action
if (priceList.list_type === 'custom' && priceList.created_by) {
  const isSuperAdmin = user.account_type === 'superadmin';

  const validationError = await validateResellerPricing({
    resellerId: priceList.created_by,
    basePrice: data.base_price,
    finalPrice: calculatedFinalPrice,
    isSuperAdmin,
  });

  if (validationError) {
    return { success: false, error: `Governance: ${validationError}` };
  }
}
```

---

## 🧪 Testing

### Test Cases

```typescript
// Test 1: No policy = no limits
test('allows any price when no policy exists', async () => {
  const result = await createEntry({ markup: -100 });
  expect(result.success).toBe(true);
});

// Test 2: Policy disabled = no limits
test('allows any price when enforce_limits=false', async () => {
  await createPolicy({ enforce_limits: false, min_markup: 20 });
  const result = await createEntry({ markup: 5 });
  expect(result.success).toBe(true);
});

// Test 3: Policy enabled = enforced
test('blocks below-minimum when enforce_limits=true', async () => {
  await createPolicy({ enforce_limits: true, min_markup: 20 });
  const result = await createEntry({ markup: 15 });
  expect(result.success).toBe(false);
  expect(result.error).toContain('below minimum 20%');
});

// Test 4: SuperAdmin bypass
test('allows any price for superadmin', async () => {
  await createPolicy({ enforce_limits: true, min_markup: 20 });
  await loginAsSuperAdmin();
  const result = await createEntry({ markup: -50 });
  expect(result.success).toBe(true);
});
```

---

## 📈 Use Cases

### Use Case 1: Reseller "Fidato"
```typescript
// Nessuna policy → Libertà assoluta
// Reseller gestisce prezzi autonomamente
```

### Use Case 2: Reseller "In Osservazione"
```typescript
// Policy con min_markup_percent = 5%
// Previene perdite accidentali
await upsertResellerPricingPolicy({
  resellerId: 'uuid',
  enforce_limits: true,
  min_markup_percent: 5,
  notes: 'Protezione base - previene sottocosto',
});
```

### Use Case 3: Reseller "Problematico"
```typescript
// Policy con min_markup_percent = 20%
// Forza marginalità minima
await upsertResellerPricingPolicy({
  resellerId: 'uuid',
  enforce_limits: true,
  min_markup_percent: 20,
  notes: 'Storico perdite - richiede margine alto',
});
```

---

## 🔄 Migration Path

### Existing Data
- ✅ Zero impatto su listini esistenti
- ✅ Nessuna policy creata automaticamente
- ✅ Default comportamento: libertà assoluta

### Rollback
```sql
-- Drop policies
DROP POLICY "SuperAdmin full access on reseller_pricing_policies"
  ON reseller_pricing_policies;
DROP POLICY "Reseller read own pricing policy"
  ON reseller_pricing_policies;

-- Drop table
DROP TABLE reseller_pricing_policies CASCADE;
```

---

## 📊 Monitoring

### Query Utili

```sql
-- Reseller con policy attiva
SELECT u.email, rpp.enforce_limits, rpp.min_markup_percent
FROM reseller_pricing_policies rpp
JOIN users u ON u.id = rpp.reseller_id
WHERE rpp.revoked_at IS NULL AND rpp.enforce_limits = true;

-- Violazioni potenziali (se policy fosse attiva)
SELECT ple.id, pl.name, ple.markup_percent, rpp.min_markup_percent
FROM price_list_entries ple
JOIN price_lists pl ON pl.id = ple.price_list_id
LEFT JOIN reseller_pricing_policies rpp
  ON rpp.reseller_id = pl.created_by
  AND rpp.revoked_at IS NULL
WHERE pl.list_type = 'custom'
  AND ple.markup_percent < COALESCE(rpp.min_markup_percent, 0);
```

---

## 📝 Changelog

### v1.0.0 (2026-01-17)
- ✅ Migration 112: Tabella `reseller_pricing_policies`
- ✅ Type: `ResellerPricingPolicy` interface
- ✅ RLS policies (SuperAdmin full, Reseller read own)
- ✅ Partial unique index per reseller attivo

---

## 🤝 Contributing

Modifiche future:
- [ ] UI SuperAdmin per gestire policies
- [ ] Dashboard reseller per vedere propria policy
- [ ] Alert automatici su markup sotto soglia
- [ ] Report mensile violazioni policies

---

**Autori**: SpedireSicuro Dev Team
**Data**: 2026-01-17
**Status**: ✅ Production Ready
