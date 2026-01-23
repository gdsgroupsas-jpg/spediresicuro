# Pricing Calculation Guide

Quick reference for using the new pricing system with database price lists.

## Overview

All pricing now comes from `price_lists` table (supplier + custom). No more hard-coded calculations.

## Quick Start

### Import

```typescript
import { calculatePriceFromPriceList } from '@/lib/services/pricing/calculate-from-pricelist';
```

### Basic Usage

```typescript
const priceResult = await calculatePriceFromPriceList({
  userId: 'user-uuid',
  courierCode: 'Gls',
  weight: 5.0,
  destination: {
    zip: '00100',
    province: 'RM',
    city: 'Roma',
    country: 'IT',
  },
  serviceType: 'standard',
  options: {
    cashOnDelivery: false,
    declaredValue: 0,
    insurance: false,
  },
});

if (priceResult.success) {
  console.log('Final price:', priceResult.price); // e.g., 8.50
  console.log('Supplier cost:', priceResult.supplierPrice); // e.g., 7.00
  console.log('Margin:', priceResult.margin); // e.g., 1.50
} else {
  console.error('Error:', priceResult.error);
}
```

## Frontend Integration

### Comparator → Form → Backend

```typescript
// 1. Comparator receives quote
const finalPrice = selectedQuote.total_price; // 8.50€

// 2. Pass to form callback
onContractSelected?.(
  courierName,
  contractCode,
  accessoryService,
  configId,
  finalPrice // ✨ Pass price for optimization
);

// 3. Form passes to backend
const payload = {
  ...formData,
  final_price: selectedQuoteExactPrice.price, // ✨ Backend will use this
};
```

## Backend Integration

### Shipment Creation API

```typescript
// app/api/spedizioni/route.ts

// Option 1: Use frontend price (optimization)
if (body.final_price > 0) {
  prezzoFinale = body.final_price;
}

// Option 2: Calculate from DB (fallback)
else {
  const result = await calculatePriceFromPriceList({
    userId: await getSupabaseUserIdFromEmail(session.actor.email),
    courierCode: body.corriere,
    weight: parseFloat(body.peso),
    destination: {
      zip: body.destinatarioCap,
      province: body.destinatarioProvincia,
    },
  });

  if (!result.success) {
    return NextResponse.json(
      { error: 'Price not available', message: result.error },
      { status: 400 }
    );
  }

  prezzoFinale = result.price;
}
```

## Parameters

### Required

| Parameter         | Type   | Description             | Example              |
| ----------------- | ------ | ----------------------- | -------------------- |
| `userId`          | string | User UUID               | `"904dc243-e9da..."` |
| `courierCode`     | string | Courier identifier      | `"Gls"`              |
| `weight`          | number | Package weight (kg)     | `5.0`                |
| `destination.zip` | string | Destination postal code | `"00100"`            |

### Optional

| Parameter                | Type    | Default      | Description                 |
| ------------------------ | ------- | ------------ | --------------------------- |
| `destination.province`   | string  | -            | Province code (IT)          |
| `destination.city`       | string  | -            | City name                   |
| `destination.country`    | string  | `"IT"`       | Country code                |
| `serviceType`            | string  | `"standard"` | `"standard"` or `"express"` |
| `options.cashOnDelivery` | boolean | `false`      | COD enabled                 |
| `options.declaredValue`  | number  | `0`          | Declared value (€)          |
| `options.insurance`      | boolean | `false`      | Insurance enabled           |

## Return Type

```typescript
interface PriceCalculationResult {
  success: boolean;
  price?: number; // Final price with margin
  supplierPrice?: number; // Base supplier cost
  margin?: number; // Applied margin
  contractCode?: string; // Contract identifier
  carrierCode?: string; // Carrier identifier
  configId?: string; // API config ID
  error?: string; // Error message if failed
  details?: any; // Full quote details
}
```

## Error Handling

### Common Errors

| Error                           | Cause                                  | Solution                       |
| ------------------------------- | -------------------------------------- | ------------------------------ |
| `Parametri mancanti`            | Missing userId, courierCode, or weight | Check all required params      |
| `CAP destinazione obbligatorio` | Missing zip code                       | Add destination.zip            |
| `Utente non trovato`            | Invalid userId                         | Verify user exists             |
| `Nessun listino attivo`         | No price lists configured              | Configure price lists in admin |

### Example

```typescript
const result = await calculatePriceFromPriceList(params);

if (!result.success) {
  // Handle error
  if (result.error?.includes('listino')) {
    // No price list configured
    return 'Please configure price lists in admin panel';
  } else {
    // Other error
    return `Error: ${result.error}`;
  }
}

// Use price
const price = result.price;
```

## Use Cases

### 1. Comparator Preview (Frontend)

**Goal**: Show prices for all couriers before creating shipment

**Solution**: Call `/api/quotes/db` (uses `calculatePriceFromPriceList` internally)

```typescript
const response = await fetch('/api/quotes/db', {
  method: 'POST',
  body: JSON.stringify({ weight, zip, province, ... }),
});

const { rates } = await response.json();
// rates = [{ total_price: 8.50, ... }, ...]
```

### 2. Shipment Creation (Backend)

**Goal**: Create shipment with correct price from price lists

**Solution**: Backend uses `final_price` from frontend or calculates fallback

```typescript
// Already handled in /api/spedizioni
// No changes needed - works automatically
```

### 3. External API Integration

**Goal**: External system creates shipment via API

**Solution**: Backend auto-calculates price (no frontend involved)

```typescript
POST /api/spedizioni
{
  "corriere": "Gls",
  "peso": 5,
  "destinatarioCap": "00100",
  // ✅ No final_price needed - backend calculates from DB
}
```

### 4. Batch Import

**Goal**: Import shipments from CSV without price

**Solution**: Use shared function directly

```typescript
for (const shipment of csvData) {
  const priceResult = await calculatePriceFromPriceList({
    userId: batchUserId,
    courierCode: shipment.courier,
    weight: shipment.weight,
    destination: { zip: shipment.zip },
  });

  const finalShipment = {
    ...shipment,
    price: priceResult.price,
  };
}
```

## Performance Tips

### 1. Use Optimization Path

**Always pass `final_price` from comparator** to skip backend recalculation.

❌ **Slow**:

```typescript
// Frontend doesn't pass final_price
// Backend must query DB every time
```

✅ **Fast**:

```typescript
// Frontend passes final_price from comparator
// Backend skips DB query
```

### 2. Cache Price Lists

Price lists are cached by `/api/quotes/db`. If calling `calculatePriceFromPriceList` directly in loops, consider caching active price lists.

### 3. Batch Requests

For multiple shipments, batch the price list queries:

```typescript
// Load price lists once
const priceLists = await loadActivePriceLists(userId);

// Use for all shipments
for (const shipment of shipments) {
  const price = await calculateWithCachedLists(priceLists, shipment);
}
```

## Migration from Old System

### Before (Hard-coded)

```typescript
const basePrice = 10;
const pesoPrice = peso * 2;
const prezzoBase = (basePrice + pesoPrice) * expressMultiplier;
const margine = prezzoBase * 0.15;
const prezzoFinale = prezzoBase + margine;
```

### After (DB-driven)

```typescript
const result = await calculatePriceFromPriceList({
  userId,
  courierCode,
  weight: peso,
  destination: { zip, province },
});
const prezzoFinale = result.price;
```

### Breaking Change

⚠️ **Requires active price lists** configured in database. No more hard-coded fallback.

## Margin Configuration

### margin_type Options

Custom price lists support three margin types configured in `metadata.margin_type`:

| margin_type | Behavior                                     | Use Case                             |
| ----------- | -------------------------------------------- | ------------------------------------ |
| `"none"`    | **ZERO margin** - entry price IS final price | Resellers with pre-negotiated prices |
| `"percent"` | Apply `default_margin_percent` on base       | Standard markup percentage           |
| `"fixed"`   | Apply `default_margin_fixed` as flat fee     | Fixed fee per shipment               |

### Example: No Margin Configuration

```json
{
  "name": "gls 5000 rivendita",
  "list_type": "custom",
  "metadata": {
    "margin_type": "none" // ✨ ZERO margin applied
  },
  "default_margin_percent": 0,
  "default_margin_fixed": 0
}
```

**Result**: Entry price €12 → Final price €12 (no margin added)

### Important: margin_type="none" Behavior

When `margin_type` is `"none"`:

- System respects user's explicit configuration
- **No automatic margin is applied**, even if price list has a master
- The price in the entry IS the final selling price
- This was fixed in commit `ce62ffc` (2026-01-23)

## Troubleshooting

### Price is different from expected

1. Check active price lists in admin: `/dashboard/admin/price-lists`
2. Verify courier code matches exactly
3. Check weight brackets in price list
4. **Verify `metadata.margin_type`** - if "none", no margin should be applied
5. Check `default_margin_percent` and `default_margin_fixed` values

### No price returned

1. Ensure user has active price lists assigned
2. Check courier code is in `courier_configs.contract_mapping`
3. Verify destination is within price list coverage
4. Check price list status is "active"

### Performance is slow

1. Use optimization path (pass `final_price` from frontend)
2. Check database indexes on `price_lists` table
3. Monitor query performance with logging
4. Consider caching for batch operations

## Related Documentation

- [ADR-003: Pricing Single Source of Truth](../architecture/ADR-003-pricing-single-source-of-truth.md)
- [Price Lists Admin Guide](./price-lists-admin.md) _(if exists)_
- [API Documentation](../api/README.md) _(if exists)_

## Support

For questions or issues:

1. Check logs for detailed error messages
2. Review ADR-003 for architecture details
3. Contact development team

---

_Last updated: 2026-01-23 (margin_type=none fix added)_
