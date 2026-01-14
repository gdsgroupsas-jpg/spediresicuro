# Finance Control Room - API Documentation

Complete API reference for the Finance Control Room module.

---

## Table of Contents

1. [Server Actions](#server-actions)
2. [React Hooks](#react-hooks)
3. [Components](#components)
4. [Utility Functions](#utility-functions)
5. [Type Definitions](#type-definitions)

---

## Server Actions

### `getMyFiscalData()`

Fetches fiscal data for the authenticated user with role-based filtering.

**Location**: `/app/actions/fiscal.ts`

**Type Signature**:
```typescript
function getMyFiscalData(): Promise<FiscalContext>
```

**Returns**:
```typescript
{
  userId: string;
  role: UserRole;
  period: { start: string; end: string };
  wallet: { balance: number };
  shipmentsSummary: {
    count: number;
    total_margin: number;
    total_revenue: number;
  };
  pending_cod_count: number;
  pending_cod_value: number;
  deadlines: FiscalDeadline[];
}
```

**Throws**:
- `Error` - If user is not authenticated
- `FiscalDataError` - If database query fails

**Example**:
```typescript
import { getMyFiscalData } from '@/app/actions/fiscal';

const fiscalData = await getMyFiscalData();
console.log(fiscalData.shipmentsSummary.total_revenue); // €12,450.00
```

---

## React Hooks

### `useFiscalData(options?)`

SWR hook for fiscal data with automatic caching and revalidation.

**Location**: `/app/dashboard/finanza/_hooks/useFiscalData.ts`

**Type Signature**:
```typescript
function useFiscalData(options?: UseFiscalDataOptions): {
  data: FiscalContext | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => Promise<FiscalContext>;
  refresh: () => Promise<FiscalContext>;
}
```

**Options**:
```typescript
interface UseFiscalDataOptions {
  refreshInterval?: number;      // Default: 30000 (30s)
  revalidateOnFocus?: boolean;   // Default: true
  revalidateOnReconnect?: boolean; // Default: true
}
```

**Example**:
```typescript
import { useFiscalData } from './_hooks/useFiscalData';

function MyComponent() {
  const { data, error, isLoading, refresh } = useFiscalData({
    refreshInterval: 60000 // 1 minute
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <p>Revenue: €{data.shipmentsSummary.total_revenue}</p>
      <button onClick={refresh}>Refresh</button>
    </div>
  );
}
```

### `useLiveFiscalData()`

Hook for live updates (polling every 10 seconds).

**Example**:
```typescript
const { data, isValidating } = useLiveFiscalData();
// isValidating = true when fetching in background
```

### `useStaticFiscalData()`

Hook with manual refresh only (no auto-revalidation).

**Example**:
```typescript
const { data, refresh } = useStaticFiscalData();
// Only updates when calling refresh() manually
```

---

## Components

### `<RevenueChart>`

Real-time revenue vs costs visualization using Recharts.

**Location**: `/app/dashboard/finanza/_components/revenue-chart.tsx`

**Props**:
```typescript
interface RevenueChartProps {
  fiscalContext?: FiscalContext;
  isLoading?: boolean;
}
```

**Example**:
```tsx
<RevenueChart
  fiscalContext={data}
  isLoading={isLoading}
/>
```

**Features**:
- Responsive bar chart
- 7-day breakdown (Mon-Sun)
- Revenue, costs, and margin visualization
- Realistic variance simulation
- Loading skeleton

---

### `<ExportDialog>`

PDF/Excel export dialog with professional formatting.

**Props**:
```typescript
interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalContext?: FiscalContext;
}
```

**Example**:
```tsx
const [isOpen, setIsOpen] = useState(false);

<ExportDialog
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  fiscalContext={data}
/>
```

**Export Formats**:
- **PDF**: Professional report with summary, COD, and deadlines
- **Excel**: Multi-sheet workbook with metrics and analysis

---

### `<PaymentDialog>`

Stripe payment integration for fiscal deadlines.

**Props**:
```typescript
interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deadline?: FiscalDeadline;
}
```

**Example**:
```tsx
<PaymentDialog
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  deadline={fiscalContext?.deadlines?.[0]}
/>
```

**Features**:
- Amount input validation
- Simulated Stripe payment flow
- Success animation
- Error handling

---

### `<AIChatDialog>`

Interactive AI assistant powered by Fiscal Brain.

**Props**:
```typescript
interface AIChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalContext?: FiscalContext;
}
```

**Example**:
```tsx
<AIChatDialog
  isOpen={isChatOpen}
  onClose={() => setIsChatOpen(false)}
  fiscalContext={data}
/>
```

**Features**:
- Real-time fiscal Q&A
- Knowledge base integration
- Message history
- Context-aware responses

---

### `<FiscalErrorBoundary>`

Error boundary for graceful error handling.

**Props**:
```typescript
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
```

**Example**:
```tsx
<FiscalErrorBoundary>
  <FinanceControlRoom />
</FiscalErrorBoundary>
```

---

### Loading Skeletons

Pre-built skeleton components for loading states.

**Available Skeletons**:
- `<KPICardSkeleton />` - KPI card placeholder
- `<ChartSkeleton />` - Chart placeholder
- `<FiscalHealthSkeleton />` - Health check placeholder
- `<PageSkeleton />` - Full page placeholder

**Example**:
```tsx
import { PageSkeleton } from './_components/loading-skeleton';

if (isLoading) {
  return <PageSkeleton />;
}
```

---

## Utility Functions

### `exportToPDF(fiscalContext)`

Export fiscal data to PDF file.

**Location**: `/app/dashboard/finanza/_utils/export-utils.ts`

**Type Signature**:
```typescript
function exportToPDF(fiscalContext: FiscalContext): Promise<void>
```

**Features**:
- Professional layout with header/footer
- Summary table
- COD section
- Deadlines table
- Automatic file download

**Example**:
```typescript
import { exportToPDF } from './_utils/export-utils';

await exportToPDF(fiscalContext);
// Downloads: fiscal-report-2026-01-14.pdf
```

---

### `exportToExcel(fiscalContext)`

Export fiscal data to Excel workbook.

**Type Signature**:
```typescript
function exportToExcel(fiscalContext: FiscalContext): Promise<void>
```

**Sheets**:
1. **Riepilogo** - Summary and metrics
2. **Scadenze** - Fiscal deadlines
3. **Metriche** - Detailed metrics for analysis

**Example**:
```typescript
import { exportToExcel } from './_utils/export-utils';

await exportToExcel(fiscalContext);
// Downloads: fiscal-report-2026-01-14.xlsx
```

---

### `consultFiscalBrain(query)`

Query the fiscal knowledge base for expert advice.

**Location**: `/lib/knowledge/fiscal_brain.ts`

**Type Signature**:
```typescript
function consultFiscalBrain(contextText: string): string
```

**Example**:
```typescript
import { consultFiscalBrain } from '@/lib/knowledge/fiscal_brain';

const query = "Ho spedizioni triangolari UE con IVA";
const advice = consultFiscalBrain(query);
// Returns relevant scenarios from knowledge base
```

---

## Type Definitions

### Core Types

**Location**: `/lib/agent/fiscal-data.types.ts`

```typescript
export type UserRole = 'user' | 'admin' | 'reseller' | 'superadmin';

export interface Shipment {
  id: string;
  created_at: string;
  status: string;
  total_price: number;
  courier_cost: number;
  margin: number;
  cash_on_delivery: boolean | number;
  cod_status: 'pending' | 'collected' | 'paid' | null;
  user_id: string;
}

export interface CODShipment {
  id: string;
  created_at: string;
  cash_on_delivery: number;
  cod_status: 'pending' | 'collected' | 'paid';
  user_id: string;
}

export interface FiscalDeadline {
  date: string; // ISO date YYYY-MM-DD
  description: string;
  type: 'F24' | 'LIPE' | 'Dichiarazione' | 'Imposte';
}

export interface FiscalContext {
  userId: string;
  role: UserRole;
  period: { start: string; end: string };
  wallet: { balance: number };
  shipmentsSummary: {
    count: number;
    total_margin: number;
    total_revenue: number;
  };
  pending_cod_count: number;
  pending_cod_value: number;
  deadlines: FiscalDeadline[];
}

export interface FiscalDataError extends Error {
  code: 'DATABASE_ERROR' | 'AUTH_ERROR' | 'VALIDATION_ERROR';
  context?: Record<string, any>;
}
```

### Fiscal Brain Types

```typescript
export interface FiscalScenario {
  id: string;
  category: 'VAT' | 'CUSTOMS' | 'STRATEGY' | 'COMPLIANCE';
  trigger_condition: string;
  expert_advice: string;
  actionable_step: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
```

---

## Business Logic Functions

### `getShipmentsByPeriod(userId, role, startDate, endDate)`

Query shipments with role-based filtering.

**Type Signature**:
```typescript
function getShipmentsByPeriod(
  userId: string,
  role: UserRole,
  startDate: string,
  endDate: string
): Promise<Shipment[]>
```

**Role Filtering**:
- **user**: Only own shipments
- **admin**: Own shipments (same as user by default)
- **reseller**: Own + sub-users' shipments
- **superadmin**: All shipments (no filter)

---

### `getPendingCOD(userId, role)`

Get pending cash-on-delivery shipments.

**Type Signature**:
```typescript
function getPendingCOD(
  userId: string,
  role: UserRole
): Promise<CODShipment[]>
```

---

### `getFiscalDeadlines()`

Get Italian fiscal calendar for current year.

**Type Signature**:
```typescript
function getFiscalDeadlines(): FiscalDeadline[]
```

**Returns**: Array of fiscal deadlines including:
- F24 monthly payments (16th of each month)
- LIPE quarterly declarations
- Annual VAT declaration
- Tax payments (IRES, IRAP)

---

### `getFiscalContext(userId, role)`

Build complete fiscal context for AI.

**Type Signature**:
```typescript
function getFiscalContext(
  userId: string,
  role: UserRole
): Promise<FiscalContext>
```

**Default Period**: Last 30 days (rolling)

---

## Error Handling

### Error Types

```typescript
// Database errors
const dbError = new Error('Query failed') as FiscalDataError;
dbError.code = 'DATABASE_ERROR';
dbError.context = { userId, role, query };

// Authentication errors
const authError = new Error('Not authenticated') as FiscalDataError;
authError.code = 'AUTH_ERROR';

// Validation errors
const validError = new Error('Invalid input') as FiscalDataError;
validError.code = 'VALIDATION_ERROR';
validError.context = { field: 'amount', value: -10 };
```

### Error Handling Best Practices

```typescript
try {
  const data = await getMyFiscalData();
} catch (error: any) {
  if (error.code === 'AUTH_ERROR') {
    // Redirect to login
    router.push('/login');
  } else if (error.code === 'DATABASE_ERROR') {
    // Show retry button
    toast.error('Database error', {
      action: {
        label: 'Retry',
        onClick: () => refresh()
      }
    });
  } else {
    // Generic error
    console.error('Unexpected error:', error);
  }
}
```

---

## Performance Optimization

### SWR Caching

```typescript
// Default configuration
{
  refreshInterval: 30000,        // 30s
  dedupingInterval: 10000,       // 10s - prevent duplicate requests
  focusThrottleInterval: 5000,   // 5s - throttle revalidation
  errorRetryCount: 3,
  errorRetryInterval: 5000,      // 5s between retries
}
```

### Best Practices

1. **Use `useFiscalData()` for automatic updates**
   ```typescript
   const { data } = useFiscalData(); // Auto-refresh every 30s
   ```

2. **Use `useStaticFiscalData()` for static views**
   ```typescript
   const { data, refresh } = useStaticFiscalData(); // Manual only
   ```

3. **Optimize re-renders with React.memo**
   ```typescript
   const MemoizedChart = React.memo(RevenueChart);
   ```

4. **Lazy load heavy components**
   ```typescript
   const ExportDialog = lazy(() => import('./_components/export-dialog'));
   ```

---

## Testing

### Unit Test Examples

```typescript
import { describe, it, expect } from 'vitest';
import { getFiscalContext } from '@/lib/agent/fiscal-data';

describe('getFiscalContext', () => {
  it('returns fiscal context for user', async () => {
    const context = await getFiscalContext('user-123', 'user');

    expect(context).toHaveProperty('userId');
    expect(context).toHaveProperty('shipmentsSummary');
    expect(context.shipmentsSummary.count).toBeGreaterThanOrEqual(0);
  });
});
```

---

## Changelog

### Version 2.0.0 (2026-01-14)
- ✅ Added SWR data fetching with caching
- ✅ Added Recharts visualization
- ✅ Added PDF/Excel export
- ✅ Added Stripe payment integration
- ✅ Added loading skeletons
- ✅ Added live metrics (30s polling)
- ✅ Added comprehensive error handling
- ✅ Full TypeScript type safety

### Version 1.0.0 (2026-01-14)
- Initial release with basic functionality

---

**Maintained by**: Engineering Team
**Last Updated**: 2026-01-14
**License**: Internal SpedireSicuro Platform - Proprietary
