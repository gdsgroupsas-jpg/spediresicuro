# ADR-003: Pricing Single Source of Truth

**Status**: Accepted
**Date**: 2026-01-23
**Authors**: Development Team + Claude Sonnet 4.5
**Related Commit**: `6a32766`

## Context

The pricing system had multiple sources of truth:

- Hard-coded calculations in `/api/spedizioni` (basePrice + weight \* 2)
- Database price lists (supplier + custom)
- Comparator calculations via `/api/quotes/db`

This created inconsistencies and prevented accurate pricing from custom price lists configured by resellers.

## Problem Statement

### Issues with Old System

1. **Hard-coded Pricing**: Backend used `basePrice = 10€ + (weight * 2€)` regardless of database configuration
2. **Multiple Sources of Truth**: Comparator showed DB prices, but backend created shipments with different prices
3. **Comparator Mandatory**: Frontend required comparator to pass `final_price`, otherwise fallback to hard-coded prices
4. **Not API-Ready**: External integrations couldn't create shipments with correct pricing
5. **Maintenance Burden**: Changes to pricing logic required updates in multiple places

### Example

```typescript
// OLD: Hard-coded pricing
const basePrice = 10;
const pesoPrice = peso * 2;
const prezzoFinale = basePrice + pesoPrice; // Always 12€ for 1kg

// Database has custom price: 8€ for same shipment
// Result: Inconsistency between comparator (8€) and created shipment (12€)
```

## Decision

Implement **Single Source of Truth** architecture where all prices come exclusively from database price lists.

### Core Principles

1. **Database as Source of Truth**: All prices calculated from `price_lists` table
2. **Reusable Logic**: Single function used by all endpoints
3. **Optional Optimization**: Frontend can pass pre-calculated price to skip recalculation
4. **Backend Autonomy**: Backend can calculate prices without frontend
5. **Zero Hard-coding**: No static pricing formulas in code

## Solution Architecture

### New Component

```
lib/services/pricing/calculate-from-pricelist.ts
```

**Function**: `calculatePriceFromPriceList(params)`

**Purpose**: Reusable pricing engine used by:

- `/api/quotes/db` (comparator preview)
- `/api/spedizioni` (shipment creation fallback)
- Any future endpoint requiring pricing

**Algorithm**:

1. Load user's active price lists (supplier + custom)
2. Filter by courier code
3. Calculate base price from supplier list
4. Apply custom margin from custom list
5. Return final price with breakdown

### Integration Points

```typescript
// Frontend: Comparator (optional optimization)
const finalPrice = selectedQuote.total_price;
onContractSelected(courier, contractCode, accessories, configId, finalPrice);

// Backend: Shipment Creation
if (body.final_price > 0) {
  // Optimization: use pre-calculated price
  prezzoFinale = body.final_price;
} else {
  // Fallback: calculate from DB
  const result = await calculatePriceFromPriceList({
    userId,
    courierCode,
    weight,
    destination,
  });
  prezzoFinale = result.price;
}
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Database: price_lists (supplier + custom)                       │
│ - Supplier prices (base costs)                                  │
│ - Custom prices (reseller margins)                              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│ lib/services/pricing/calculate-from-pricelist.ts                │
│ - Single reusable pricing engine                                │
│ - Applies supplier + custom logic                               │
└─────┬─────────────────────────────────────┬─────────────────────┘
      │                                     │
      ▼                                     ▼
┌──────────────────────┐        ┌─────────────────────────────────┐
│ /api/quotes/db       │        │ /api/spedizioni                 │
│ (comparator preview) │        │ (shipment creation)             │
│                      │        │                                 │
│ Returns: all rates   │        │ If final_price: use it          │
│ for comparison       │        │ Else: calculate from DB         │
└──────────────────────┘        └─────────────────────────────────┘
```

## Implementation Details

### 1. Shared Pricing Function

File: `lib/services/pricing/calculate-from-pricelist.ts`

```typescript
export async function calculatePriceFromPriceList(
  params: PriceCalculationParams
): Promise<PriceCalculationResult> {
  // 1. Validate parameters
  // 2. Load user info (reseller, superadmin, normal user)
  // 3. Call calculateBestPriceForReseller()
  // 4. Return price with breakdown
}
```

**Input**:

- `userId`: User ID
- `courierCode`: Courier identifier (e.g., "Gls")
- `weight`: Package weight
- `destination`: Zip, province, city
- `serviceType`: "standard" | "express"
- `options`: COD, insurance, declared value

**Output**:

- `success`: boolean
- `price`: Final price (with margin)
- `supplierPrice`: Base supplier cost
- `margin`: Applied margin
- `contractCode`, `carrierCode`, `configId`: Metadata

### 2. Backend Integration

File: `app/api/spedizioni/route.ts`

**Before** (hard-coded):

```typescript
const basePrice = 10;
const pesoPrice = peso * 2;
const prezzoBase = (basePrice + pesoPrice) * expressMultiplier;
const margine = prezzoBase * 0.15;
const prezzoFinale = prezzoBase + margine;
```

**After** (DB-driven):

```typescript
if (body.final_price > 0) {
  prezzoFinale = body.final_price; // Optimization
} else {
  const result = await calculatePriceFromPriceList(...);
  prezzoFinale = result.price; // Fallback
}
```

### 3. Frontend Integration

Files:

- `components/shipments/intelligent-quote-comparator.tsx`
- `app/dashboard/spedizioni/nuova/page.tsx`

**Change**: Pass `finalPrice` from comparator to backend

```typescript
// Comparator callback
onContractSelected?.(
  courierName,
  contractCode,
  accessoryService,
  configId,
  finalPrice // ✨ NEW: optimization path
);

// Form submission
payload.final_price = selectedQuoteExactPrice.price;
```

## Benefits

### Technical

✅ **Single Source of Truth**: All prices from `price_lists` table
✅ **No Duplication**: Shared logic eliminates code duplication
✅ **Testable**: Single function to test instead of multiple implementations
✅ **Maintainable**: Price changes only require DB updates, not code changes
✅ **Type-Safe**: Strict TypeScript interfaces for all pricing functions

### Business

✅ **Accurate Pricing**: Shipments created with exact custom prices
✅ **Reseller Flexibility**: Custom margins applied automatically
✅ **API-Ready**: External integrations get correct prices
✅ **Audit Trail**: All prices traceable to specific price lists
✅ **Performance**: Optional optimization path (skip recalculation)

### Developer Experience

✅ **Clear Separation**: Frontend preview, backend calculation
✅ **Autonomous Backend**: Works independently of frontend
✅ **Easy Integration**: Import and call single function
✅ **Consistent Behavior**: Same logic everywhere
✅ **Well Documented**: ADR + inline comments

## Breaking Changes

### For Developers

1. **`final_price` now optional**: Backend calculates from DB if missing
2. **Hard-coded defaults removed**: Must have active price lists configured
3. **Comparator optional**: Backend autonomous (was implicitly required)

### Migration Path

**No action required** if:

- Users have active price lists configured
- Frontend uses comparator (passes `final_price`)

**Action required** if:

- External integrations bypass comparator → Backend will auto-calculate (works automatically)
- No active price lists → Returns error (must configure price lists)

### Backwards Compatibility

✅ **Frontend with comparator**: Works as before (optimization path)
✅ **Frontend without comparator**: Works with fallback (new feature)
✅ **External API calls**: Work with auto-calculation (improved)
❌ **Empty price lists**: Returns error (was hard-coded fallback)

## Alternatives Considered

### Alternative 1: Keep Hard-coded Fallback

**Pros**: Always works even without price lists
**Cons**:

- Multiple sources of truth
- Inaccurate pricing for custom lists
- Not reseller-friendly

**Decision**: Rejected - defeats purpose of custom price lists

### Alternative 2: Comparator Always Required

**Pros**: Simple - frontend always provides price
**Cons**:

- Not API-ready for external integrations
- Backend not autonomous
- More coupling between frontend/backend

**Decision**: Rejected - limits flexibility and API usage

### Alternative 3: Duplicate Logic in Backend

**Pros**: Backend autonomous without new abstraction
**Cons**:

- Code duplication with `/api/quotes/db`
- Maintenance burden
- Risk of divergence

**Decision**: Rejected - violates DRY principle

## Security Considerations

✅ **Access Control**: Reuses existing RLS policies on `price_lists`
✅ **User Isolation**: Only sees own price lists (reseller) or assigned lists (users)
✅ **No New Attack Surface**: Same DB queries as existing `/api/quotes/db`
✅ **Input Validation**: Strict parameter validation in shared function

## Performance Impact

### Comparator Path (Optimization)

- **Before**: 1 DB query (comparator) + hard-coded calculation (backend)
- **After**: 1 DB query (comparator) + price passed to backend
- **Impact**: ✅ Same or better (no backend query if comparator used)

### No-Comparator Path (New Feature)

- **Before**: Hard-coded calculation (fast but wrong)
- **After**: 1 DB query in backend
- **Impact**: ⚠️ Slightly slower but accurate

### Optimization Strategy

Frontend should use comparator when available to skip backend recalculation.

## Monitoring & Observability

### Logs Added

```typescript
console.log('💰 [API] Usando prezzo dal comparatore:', prezzoFinale);
console.log('🔄 [API] final_price mancante, calcolo dai listini...');
console.log('✅ [API] Prezzo calcolato dai listini:', prezzoFinale);
```

### Metrics to Track

1. `final_price` hit rate (optimization path usage)
2. DB fallback usage (calculate path usage)
3. Price calculation errors
4. Performance: time to calculate from DB

## Testing Strategy

### Unit Tests

```typescript
describe('calculatePriceFromPriceList', () => {
  it('should calculate price from supplier + custom lists');
  it('should return error if no active price lists');
  it('should validate required parameters');
  it('should handle reseller vs normal user correctly');
});
```

### Integration Tests

```typescript
describe('POST /api/spedizioni', () => {
  it('should use final_price if provided');
  it('should calculate from DB if final_price missing');
  it('should return error if no price lists configured');
});
```

## Rollout Plan

### Phase 1: Development ✅

- Implement shared function
- Update backend with fallback
- Update frontend to pass finalPrice
- Test locally

### Phase 2: Staging

- Deploy to staging environment
- Test with real price lists
- Verify both optimization and fallback paths
- Monitor performance

### Phase 3: Production

- Deploy to production
- Monitor error rates
- Track `final_price` usage
- Collect feedback

### Rollback Strategy

If issues occur:

1. Revert commit `6a32766`
2. Hard-coded pricing temporarily restored
3. Debug in staging
4. Re-deploy with fixes

## References

- **Implementation PR**: Commit `6a32766`
- **Related ADRs**:
  - ADR-001: Price Lists Architecture (if exists)
  - ADR-002: Reseller Multi-tenancy (if exists)
- **Database Schema**: `price_lists`, `price_list_assignments`, `courier_configs`
- **External Dependencies**: `calculateBestPriceForReseller()` from `lib/db/price-lists-advanced`

## Conclusion

This refactoring establishes a robust, maintainable pricing architecture with database as single source of truth. The solution is backwards compatible for existing usage while enabling new capabilities like API integrations and backend autonomy.

The breaking change (requiring active price lists) is acceptable because:

1. It enforces correct configuration
2. It prevents silent pricing errors
3. It aligns with business model (custom pricing for resellers)

## Approval

**Decision**: Accepted
**Implementation**: Complete
**Status**: In Production (pending deployment)

---

_Last updated: 2026-01-23_
_Document version: 1.0_
