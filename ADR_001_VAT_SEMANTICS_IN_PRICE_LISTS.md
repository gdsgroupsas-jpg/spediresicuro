# ADR-001: VAT Semantics in Price Lists

**Status:** Accepted  
**Date:** 2025-01-16  
**Deciders:** Domain Architecture Team  
**Tags:** pricing, vat, price-lists, fiscal-compliance

---

## Context

The SpedireSicuro platform manages price lists from multiple sources:
- **Supplier price lists**: Imported from external providers (e.g., Spedisci.Online)
- **Custom price lists**: Created by resellers/BYOC users, often cloned from supplier lists
- **Global price lists**: Template lists created by superadmins

Currently, the system has **no explicit modeling of VAT semantics**. All prices are implicitly assumed to be VAT-excluded, but this assumption is:
- Not documented
- Not verifiable
- Not enforceable
- Potentially incorrect for supplier lists where VAT semantics are unknown

This creates risks:
1. **Fiscal misalignment**: Mixing VAT-included and VAT-excluded prices without conversion
2. **Incorrect margin calculations**: Applying margin on VAT-included base prices
3. **User confusion**: Prices displayed without VAT context
4. **Compliance issues**: Inability to generate correct fiscal documents

**Reference Analysis:** See `ANALISI_SEMANTICA_IVA_LISTINI.md` for detailed technical findings.

---

## Decision

### 1. Price List VAT Semantics

#### 1.1 Allowed VAT Modes

A price list **MUST** have exactly one VAT mode for all its entries:

- **`vat_mode: 'excluded'`**: All prices in the list are VAT-excluded (net prices)
- **`vat_mode: 'included'`**: All prices in the list are VAT-included (gross prices)
- **`vat_mode: null`**: Legacy mode (assumed `'excluded'` for backward compatibility)

**Mixing VAT modes within a single price list is NOT allowed.**

#### 1.2 Storage Location

VAT semantics **MUST** be stored at the **list header level** (`price_lists` table):

- Field: `vat_mode` (TEXT, CHECK constraint: `'included' | 'excluded' | NULL`)
- Field: `vat_rate` (DECIMAL(5,2), default: 22.00, range: 0-100)

**Rationale:**
- Ensures uniform semantics across all entries in a list
- Simplifies queries and filtering
- Prevents inconsistencies
- Aligns with business reality (suppliers typically provide lists with uniform VAT treatment)

#### 1.3 Default for Legacy Data

For existing price lists without `vat_mode`:
- **Default:** `vat_mode = NULL` (treated as `'excluded'` in all calculations)
- **Migration:** Legacy lists remain functional but should be explicitly set to `'excluded'` when updated

---

### 2. Canonical Meaning of "Final Price"

#### 2.1 Definition

`final_price` in the system represents the **commercial price to the customer**, and its VAT semantics **MUST** match the source price list's `vat_mode`:

- If `price_list.vat_mode = 'excluded'` → `final_price` is VAT-excluded
- If `price_list.vat_mode = 'included'` → `final_price` is VAT-included
- If `price_list.vat_mode = NULL` (legacy) → `final_price` is VAT-excluded (assumed)

#### 2.2 Storage Requirement

Every `shipments.final_price` **MUST** be accompanied by:
- `shipments.vat_mode` (matches the price list's `vat_mode` at creation time)
- `shipments.vat_rate` (matches the price list's `vat_rate` at creation time)

**This ensures fiscal traceability and prevents ambiguity in historical data.**

#### 2.3 Nature

`final_price` is **both commercial and fiscal**:
- **Commercial**: It is the price charged to the customer
- **Fiscal**: It carries VAT context for tax compliance and reporting

---

### 3. Pricing Invariants (Non-Negotiable Rules)

#### Invariant #1: Margin Always Applied on VAT-Excluded Base

**Rule:** Margin calculations **MUST** always operate on VAT-excluded amounts.

**Implementation Logic:**
1. If `price_list.vat_mode = 'included'`:
   - Convert base price to VAT-excluded: `base_excl = base_incl / (1 + vat_rate/100)`
   - Apply margin on VAT-excluded base: `margin = base_excl * margin_percent / 100`
   - Calculate final VAT-excluded: `final_excl = base_excl + surcharges + margin`
   - Convert to VAT-included for display: `final_incl = final_excl * (1 + vat_rate/100)`
2. If `price_list.vat_mode = 'excluded'`:
   - Apply margin directly: `margin = (base + surcharges) * margin_percent / 100`
   - Calculate final: `final = base + surcharges + margin`

**Rationale:** Margins are business margins, not tax margins. They must be calculated on net amounts to ensure consistent profitability regardless of VAT treatment.

---

#### Invariant #2: No Direct Comparison Without Normalization

**Rule:** Prices with different VAT modes **MUST NOT** be compared, sorted, or aggregated without explicit normalization to a common VAT mode.

**Enforcement:**
- Quote comparator **MUST** normalize all prices to the same VAT mode before comparison
- Dashboard aggregations **MUST** normalize before summing
- Financial reports **MUST** normalize before calculations

**Normalization Function:**
```
normalize_price(price, from_mode, to_mode, vat_rate):
  if from_mode == to_mode: return price
  if from_mode == 'included' and to_mode == 'excluded':
    return price / (1 + vat_rate/100)
  if from_mode == 'excluded' and to_mode == 'included':
    return price * (1 + vat_rate/100)
```

---

#### Invariant #3: UI Must Always Declare VAT Semantics

**Rule:** Every price displayed in the UI **MUST** be accompanied by explicit VAT context.

**Requirements:**
- Price display **MUST** include one of:
  - Badge: "IVA esclusa" or "IVA incl."
  - Suffix: "+ IVA 22%" or "IVA incl."
  - Tooltip with full VAT breakdown
- **NEVER** display a price as plain "€X.XX" without VAT indication

**Locations:**
- Quote comparator
- Shipment dashboard
- Price list detail pages
- Financial reports
- Invoice generation

---

#### Invariant #4: Shipment Persistence Must Include VAT Context

**Rule:** When creating a shipment, the system **MUST** persist:
- `shipments.final_price` (the commercial price)
- `shipments.vat_mode` (matching the price list's `vat_mode`)
- `shipments.vat_rate` (matching the price list's `vat_rate`)

**Rationale:** Historical shipments must retain fiscal context for:
- Audit trails
- Tax reporting
- Dispute resolution
- Financial reconciliation

---

### 4. Propagation Rules

#### 4.1 Price List → Pricing Engine

**Flow:**
1. Pricing engine reads `price_list.vat_mode` and `price_list.vat_rate`
2. Retrieves base price from `price_list_entries.base_price`
3. If `vat_mode = 'included'`, converts to VAT-excluded for calculations
4. Applies surcharges (assumed VAT-excluded)
5. Applies margin on VAT-excluded total
6. If `vat_mode = 'included'`, converts final back to VAT-included
7. Returns `PriceCalculationResult` with:
   - `finalPrice` (in the list's VAT mode)
   - `vatMode` (from price list)
   - `vatRate` (from price list)
   - `vatAmount` (calculated if needed)

**Files:**
- `lib/db/price-lists-advanced.ts` (calculatePriceWithRules)
- `lib/pricing/calculator.ts` (calculatePriceFromList)

---

#### 4.2 Pricing Engine → Quote API

**Flow:**
1. Quote API receives `PriceCalculationResult` from pricing engine
2. Maps to quote response format:
   - `total_price`: `finalPrice` (string)
   - `vat_mode`: `vatMode` (from result)
   - `vat_rate`: `vatRate` (from result)
   - `vat_amount`: calculated VAT amount if `vat_mode = 'excluded'`
   - `total_price_with_vat`: calculated if `vat_mode = 'excluded'`

**File:**
- `app/api/quotes/db/route.ts`

---

#### 4.3 Quote API → Comparator UI

**Flow:**
1. Comparator receives quote array with `vat_mode` and `vat_rate`
2. **Normalizes all quotes to same VAT mode** (default: 'excluded') for comparison
3. Displays normalized prices for sorting/ranking
4. Shows original price with VAT badge:
   - If `vat_mode = 'excluded'`: "€X.XX + IVA 22%"
   - If `vat_mode = 'included'`: "€X.XX IVA incl."

**File:**
- `components/shipments/intelligent-quote-comparator.tsx`

---

#### 4.4 Comparator UI → Shipment Creation

**Flow:**
1. User selects quote from comparator
2. Selected quote includes: `total_price`, `vat_mode`, `vat_rate`
3. Shipment creation API receives these values
4. Persists to `shipments` table:
   - `final_price`: `total_price`
   - `vat_mode`: from quote
   - `vat_rate`: from quote

**Files:**
- `app/api/shipments/create/route.ts`
- `lib/shipments/create-shipment-core.ts`

---

#### 4.5 Shipment Persistence → Dashboard

**Flow:**
1. Dashboard reads `shipments.final_price`, `shipments.vat_mode`, `shipments.vat_rate`
2. Displays price with VAT context:
   - If `vat_mode = 'excluded'`: "€X.XX + IVA 22%"
   - If `vat_mode = 'included'`: "€X.XX IVA incl."
3. For aggregations, normalizes to common VAT mode before summing

**Files:**
- `app/dashboard/spedizioni/page.tsx`
- `lib/database.ts` (mapSpedizioneFromSupabase)

---

### 5. Explicit Non-Goals

The following are **intentionally NOT supported**:

#### 5.1 Mixed VAT Modes in Single List

**Not Supported:** A single price list with some entries VAT-included and others VAT-excluded.

**Rationale:** 
- Creates complexity in calculations
- Increases risk of errors
- Rarely needed in practice (suppliers provide uniform lists)
- Can be achieved by creating separate price lists if needed

---

#### 5.2 Per-Entry VAT Mode

**Not Supported:** Storing `vat_mode` at the `price_list_entries` level.

**Rationale:**
- Adds unnecessary complexity
- Increases risk of inconsistencies
- List-level semantics are sufficient and clearer

---

#### 5.3 Dynamic VAT Rate Calculation

**Not Supported:** Automatically determining VAT rate based on destination country, customer type, or other factors.

**Rationale:**
- VAT rate is a fiscal parameter that should be explicit
- Different rates can be handled by creating separate price lists
- Keeps the model simple and auditable

---

#### 5.4 VAT on Platform Fees

**Not Supported:** Explicitly modeling VAT on platform fees separately from shipment prices.

**Rationale:**
- Platform fees are handled separately in the financial system
- Shipment prices are the primary concern for this ADR
- Platform fee VAT can be addressed in a separate ADR if needed

---

## Consequences

### Positive

1. **Fiscal Compliance**: System can generate correct fiscal documents with proper VAT treatment
2. **Transparency**: Users always know if prices include or exclude VAT
3. **Correct Calculations**: Margins are always calculated on net amounts, ensuring profitability
4. **Audit Trail**: Historical shipments retain VAT context for compliance
5. **Flexibility**: Supports both VAT-included and VAT-excluded supplier lists

### Negative

1. **Migration Effort**: Existing price lists must be reviewed and explicitly set to `vat_mode = 'excluded'`
2. **UI Complexity**: All price displays must include VAT context (adds visual elements)
3. **Calculation Complexity**: Pricing engine must handle VAT conversions
4. **Data Model Changes**: Requires schema migrations for `price_lists` and `shipments` tables
5. **API Contract Changes**: Quote API responses must include VAT fields

### Risks

1. **Legacy Data**: Existing shipments without `vat_mode` must be handled (assumed `'excluded'`)
2. **Supplier Lists**: Unknown VAT semantics from external providers (default to `'excluded'`, requires manual verification)
3. **User Education**: Users must understand VAT semantics when creating/editing price lists

---

## Migration / Legacy Handling

### Phase 1: Schema Migration

1. Add `vat_mode` and `vat_rate` to `price_lists` table
2. Add `vat_mode` and `vat_rate` to `shipments` table
3. Set defaults: `vat_mode = NULL` (treated as `'excluded'`), `vat_rate = 22.00`

### Phase 2: Data Migration

1. **Existing Price Lists:**
   - Review supplier lists to determine actual VAT semantics
   - Set `vat_mode = 'excluded'` for lists where semantics are unknown (conservative default)
   - Set `vat_mode = 'included'` only if explicitly confirmed

2. **Existing Shipments:**
   - Set `vat_mode = 'excluded'` for all existing shipments (assumed legacy behavior)
   - Set `vat_rate = 22.00` for all existing shipments (default Italian rate)

### Phase 3: Application Updates

1. Update pricing engine to read and respect `vat_mode`
2. Update quote API to include VAT fields
3. Update comparator UI to display VAT context
4. Update shipment creation to persist VAT context
5. Update dashboard to display VAT context

### Phase 4: Validation

1. Verify all new shipments have `vat_mode` set
2. Verify all price displays include VAT context
3. Verify margin calculations are correct for both VAT modes
4. Verify fiscal reports are accurate

---

## Open Questions

### Q1: VAT Rate per Country

**Question:** Should `vat_rate` be configurable per country, or is a single rate (22% for Italy) sufficient?

**Current Decision:** Single rate (22%) is sufficient for MVP. Multi-country VAT rates can be addressed in a future ADR if needed.

**Resolution:** Deferred to future ADR if international expansion requires it.

---

### Q2: VAT Exempt Customers

**Question:** How should the system handle VAT-exempt customers (e.g., B2B with reverse charge)?

**Current Decision:** Out of scope for this ADR. Price lists remain VAT-aware, but customer-level VAT exemptions are handled at invoice generation (separate concern).

**Resolution:** Documented as future enhancement if needed.

---

### Q3: Historical Data Accuracy

**Question:** For existing shipments with `vat_mode = NULL`, should we attempt to infer VAT semantics from price list history?

**Current Decision:** No. Conservative approach: assume all legacy shipments are VAT-excluded. If fiscal accuracy is critical, manual review and correction may be needed.

**Resolution:** Accepted as-is. Manual correction process if required.

---

## References

- Technical Analysis: `ANALISI_SEMANTICA_IVA_LISTINI.md`
- Price Disalignment Analysis: `ANALISI_DISALLINEAMENTO_PREZZO.md`
- Database Schema: `supabase/migrations/001_complete_schema.sql`
- Pricing Logic: `lib/db/price-lists-advanced.ts`

---

**End of ADR-001**
