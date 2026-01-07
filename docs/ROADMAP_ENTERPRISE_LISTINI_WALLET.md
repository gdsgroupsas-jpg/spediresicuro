# 🏢 ROADMAP ENTERPRISE: Sistema Listini & Wallet Multi-Tenant

> **Classificazione:** CONFIDENTIAL - Internal Use Only  
> **Versione:** 1.0.0  
> **Data:** 2026-01-07  
> **Owner:** Engineering Lead  
> **Stakeholder:** Product, Finance, Security  

---

## 📋 EXECUTIVE SUMMARY

Questo documento definisce il piano di implementazione per portare il sistema Listini e Wallet a standard **Enterprise-Grade**, risolvendo le criticità identificate nell'audit del 07/01/2026.

### Criticità Identificate

| ID | Criticità | Severità | Business Impact |
|----|-----------|----------|-----------------|
| **C-001** | Mancato tracking costi piattaforma | 🔴 CRITICAL | Impossibile calcolare P&L reale |
| **C-002** | UX frammentata clienti/listini | 🟡 HIGH | Churn reseller, inefficienza operativa |
| **C-003** | Nessuna riconciliazione automatica | 🔴 CRITICAL | Rischio contabile, audit failure |
| **C-004** | Architettura non scalabile | 🟡 HIGH | Tech debt, difficoltà manutenzione |

### Obiettivi

1. **Zero Revenue Leakage** - Ogni euro tracciato end-to-end
2. **Single Source of Truth** - Dashboard unificata per operazioni
3. **Audit-Ready** - Compliance finanziaria completa
4. **Scale-Ready** - Architettura per 10x volume

---

## 🎯 SPRINT PLAN

### Overview Timeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│ SPRINT 1 (2 settimane)     │ SPRINT 2 (2 settimane)    │ SPRINT 3      │
│ Foundation & Security      │ UX Unification            │ Optimization  │
│─────────────────────────────────────────────────────────────────────────│
│ ■ DB Schema               │ ■ Unified Client Dashboard │ ■ Refactoring │
│ ■ Financial Tracking      │ ■ Inline Listino Mgmt     │ ■ Performance │
│ ■ API Source Detection    │ ■ Reconciliation UI       │ ■ Monitoring  │
│ ■ Security Hardening      │ ■ Reporting               │ ■ Load Tests  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 SPRINT 1: FOUNDATION & FINANCIAL TRACKING

**Durata:** 2 settimane  
**Priorità:** P0 - CRITICAL  
**Obiettivo:** Tracciamento completo flusso finanziario piattaforma  

---

### TASK 1.1: Database Schema Extension

**Epic:** Financial Tracking Infrastructure  
**Effort:** 3 giorni  
**Risk:** Medium (migration su produzione)  

#### 1.1.1 Creare tabella `platform_provider_costs`

**Scopo:** Tracciare i costi REALI che SpedireSicuro paga ai corrieri quando un Reseller/BYOC usa i contratti piattaforma.

```sql
-- File: supabase/migrations/090_platform_provider_costs.sql

CREATE TABLE platform_provider_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Riferimento spedizione
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  shipment_tracking_number TEXT NOT NULL,
  
  -- Chi ha fatto la spedizione (Reseller o suo cliente)
  billed_user_id UUID NOT NULL REFERENCES users(id),
  billed_amount DECIMAL(10,2) NOT NULL, -- Quanto abbiamo addebitato al Reseller
  
  -- Costo reale piattaforma
  provider_cost DECIMAL(10,2) NOT NULL, -- Quanto paghiamo noi al corriere
  platform_margin DECIMAL(10,2) GENERATED ALWAYS AS (billed_amount - provider_cost) STORED,
  platform_margin_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN provider_cost > 0 
    THEN ((billed_amount - provider_cost) / provider_cost * 100)
    ELSE 0 END
  ) STORED,
  
  -- Fonte API (quale contratto è stato usato)
  api_source TEXT NOT NULL CHECK (api_source IN ('platform', 'reseller_own', 'byoc_own')),
  price_list_id UUID REFERENCES price_lists(id),
  master_price_list_id UUID REFERENCES price_lists(id), -- Se derivato da master
  
  -- Corriere e servizio
  courier_code TEXT NOT NULL,
  service_type TEXT,
  
  -- Stato riconciliazione
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (reconciliation_status IN ('pending', 'matched', 'discrepancy', 'resolved')),
  reconciliation_notes TEXT,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES users(id),
  
  -- Provider invoice matching
  provider_invoice_id TEXT, -- ID fattura corriere
  provider_invoice_date DATE,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: una sola entry per spedizione
  CONSTRAINT unique_shipment_cost UNIQUE (shipment_id)
);

-- Indici critici per reporting
CREATE INDEX idx_ppc_billed_user ON platform_provider_costs(billed_user_id);
CREATE INDEX idx_ppc_api_source ON platform_provider_costs(api_source);
CREATE INDEX idx_ppc_reconciliation ON platform_provider_costs(reconciliation_status);
CREATE INDEX idx_ppc_created_at ON platform_provider_costs(created_at DESC);
CREATE INDEX idx_ppc_courier_date ON platform_provider_costs(courier_code, created_at);

-- RLS: Solo SuperAdmin può vedere
ALTER TABLE platform_provider_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ppc_superadmin_only ON platform_provider_costs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
  );

COMMENT ON TABLE platform_provider_costs IS 
  'Traccia i costi reali che SpedireSicuro paga ai corrieri per spedizioni effettuate con contratti piattaforma. Usato per P&L e riconciliazione.';
```

**Acceptance Criteria:**
- [ ] Tabella creata con tutti i campi
- [ ] RLS policy attiva (solo superadmin)
- [ ] Indici per query reporting < 100ms
- [ ] Migration reversibile (down script)
- [ ] Test integration con shipments FK

---

#### 1.1.2 Estendere tabella `shipments`

**Scopo:** Aggiungere campo per identificare fonte API.

```sql
-- File: supabase/migrations/091_shipments_api_source.sql

-- Aggiungere campo api_source
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS api_source TEXT DEFAULT 'unknown'
  CHECK (api_source IN ('platform', 'reseller_own', 'byoc_own', 'unknown'));

-- Aggiungere campo per tracciare listino usato
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS price_list_used_id UUID REFERENCES price_lists(id);

-- Indice per filtering
CREATE INDEX IF NOT EXISTS idx_shipments_api_source ON shipments(api_source);

COMMENT ON COLUMN shipments.api_source IS 
  'Indica quale API/contratto è stato usato: platform (SpedireSicuro), reseller_own (contratto proprio), byoc_own (BYOC), unknown (legacy)';
```

**Acceptance Criteria:**
- [ ] Campo aggiunto senza downtime
- [ ] Default 'unknown' per record esistenti
- [ ] Backfill script per record storici (best-effort)

---

#### 1.1.3 Vista aggregata per P&L

```sql
-- File: supabase/migrations/092_platform_pnl_views.sql

-- Vista giornaliera P&L
CREATE OR REPLACE VIEW v_platform_daily_pnl AS
SELECT 
  DATE(ppc.created_at) AS date,
  ppc.courier_code,
  COUNT(*) AS shipments_count,
  SUM(ppc.billed_amount) AS total_billed,
  SUM(ppc.provider_cost) AS total_provider_cost,
  SUM(ppc.platform_margin) AS total_margin,
  AVG(ppc.platform_margin_percent) AS avg_margin_percent,
  COUNT(*) FILTER (WHERE ppc.reconciliation_status = 'discrepancy') AS discrepancies
FROM platform_provider_costs ppc
WHERE ppc.api_source = 'platform'
GROUP BY DATE(ppc.created_at), ppc.courier_code
ORDER BY date DESC, courier_code;

-- Vista mensile per reseller
CREATE OR REPLACE VIEW v_reseller_monthly_platform_usage AS
SELECT 
  DATE_TRUNC('month', ppc.created_at) AS month,
  ppc.billed_user_id,
  u.email AS user_email,
  u.name AS user_name,
  COUNT(*) AS shipments_count,
  SUM(ppc.billed_amount) AS total_billed,
  SUM(ppc.platform_margin) AS margin_generated
FROM platform_provider_costs ppc
JOIN users u ON u.id = ppc.billed_user_id
WHERE ppc.api_source = 'platform'
GROUP BY DATE_TRUNC('month', ppc.created_at), ppc.billed_user_id, u.email, u.name
ORDER BY month DESC, total_billed DESC;

COMMENT ON VIEW v_platform_daily_pnl IS 'P&L giornaliero per spedizioni con contratti piattaforma';
COMMENT ON VIEW v_reseller_monthly_platform_usage IS 'Usage mensile per reseller che usano contratti piattaforma';
```

**Acceptance Criteria:**
- [ ] Viste create e query < 500ms su 100k record
- [ ] Accesso limitato a superadmin via RLS underlying tables

---

### TASK 1.2: Business Logic - API Source Detection

**Epic:** Financial Tracking Infrastructure  
**Effort:** 2 giorni  
**Risk:** High (modifica flusso critico)  

#### 1.2.1 Modificare `create-shipment-core.ts`

**Scopo:** Determinare `api_source` e registrare costo piattaforma.

```typescript
// File: lib/shipments/create-shipment-core.ts
// Aggiungere DOPO creazione shipment con successo

/**
 * NUOVO: Determina api_source e registra costo piattaforma
 */
async function recordPlatformCost(params: {
  shipmentId: string;
  trackingNumber: string;
  billedUserId: string;
  billedAmount: number;
  providerCost: number;
  courierCode: string;
  serviceType?: string;
  priceListId?: string;
  masterPriceListId?: string;
  supabaseAdmin: SupabaseClient;
}): Promise<void> {
  const {
    shipmentId,
    trackingNumber,
    billedUserId,
    billedAmount,
    providerCost,
    courierCode,
    serviceType,
    priceListId,
    masterPriceListId,
    supabaseAdmin,
  } = params;

  // Determina api_source
  let apiSource: 'platform' | 'reseller_own' | 'byoc_own' = 'reseller_own';
  
  if (masterPriceListId) {
    // Listino derivato da master = usa contratti piattaforma
    apiSource = 'platform';
  } else if (priceListId) {
    // Verifica se listino è assegnato dal superadmin
    const { data: priceList } = await supabaseAdmin
      .from('price_lists')
      .select('master_list_id, list_type, is_global')
      .eq('id', priceListId)
      .single();
    
    if (priceList?.master_list_id || priceList?.is_global) {
      apiSource = 'platform';
    }
  }

  // Registra solo se usa piattaforma (gli altri non generano costo per noi)
  if (apiSource === 'platform') {
    const { error } = await supabaseAdmin
      .from('platform_provider_costs')
      .insert({
        shipment_id: shipmentId,
        shipment_tracking_number: trackingNumber,
        billed_user_id: billedUserId,
        billed_amount: billedAmount,
        provider_cost: providerCost,
        api_source: apiSource,
        price_list_id: priceListId,
        master_price_list_id: masterPriceListId,
        courier_code: courierCode,
        service_type: serviceType,
      });

    if (error) {
      // NON bloccare la spedizione, log error per investigation
      console.error('[PLATFORM_COST] Failed to record:', {
        shipmentId,
        error: error.message,
      });
      
      // Audit log per recovery
      await supabaseAdmin.from('security_audit_log').insert({
        event_type: 'platform_cost_recording_failed',
        severity: 'high',
        user_id: billedUserId,
        resource_type: 'shipment',
        resource_id: shipmentId,
        message: `Failed to record platform cost: ${error.message}`,
        metadata: { billedAmount, providerCost, courierCode },
      });
    }
  }

  // Aggiorna shipment con api_source
  await supabaseAdmin
    .from('shipments')
    .update({ 
      api_source: apiSource,
      price_list_used_id: priceListId,
    })
    .eq('id', shipmentId);
}
```

**Acceptance Criteria:**
- [ ] `api_source` correttamente determinato per ogni spedizione
- [ ] Record in `platform_provider_costs` per api_source='platform'
- [ ] Nessun blocco spedizione se recording fallisce (graceful degradation)
- [ ] Audit log per failure recovery
- [ ] Unit test coverage > 90%

---

#### 1.2.2 Determinare `provider_cost` reale

**CRITICO:** Il `provider_cost` deve essere il costo REALE che SpedireSicuro paga, non il prezzo listino.

```typescript
// File: lib/pricing/platform-cost-calculator.ts

/**
 * Calcola il costo reale che SpedireSicuro paga al corriere
 * 
 * IMPORTANTE: Questo è il costo BASE senza margini, usato per P&L
 */
export async function calculatePlatformProviderCost(params: {
  courierCode: string;
  weight: number;
  destination: {
    zip: string;
    province?: string;
    country?: string;
  };
  serviceType?: string;
}): Promise<{
  cost: number;
  source: 'api_realtime' | 'master_list' | 'fallback_estimate';
}> {
  const { courierCode, weight, destination, serviceType } = params;

  // 1. Prova API real-time corriere (se disponibile)
  // TODO: Implementare quando abbiamo API costi reali

  // 2. Usa listino master (costo base senza margini)
  const { data: masterList } = await supabaseAdmin
    .from('price_lists')
    .select('id, rules, default_margin_percent')
    .eq('is_global', true)
    .eq('list_type', 'global')
    .eq('status', 'active')
    .ilike('name', `%${courierCode}%`)
    .single();

  if (masterList) {
    // Calcola prezzo base dal listino master
    const basePrice = await calculateBasePrice(masterList.id, {
      weight,
      destination,
      serviceType,
    });
    
    return {
      cost: basePrice,
      source: 'master_list',
    };
  }

  // 3. Fallback: stima basata su media storica
  const { data: avgCost } = await supabaseAdmin
    .from('platform_provider_costs')
    .select('provider_cost')
    .eq('courier_code', courierCode)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (avgCost && avgCost.length > 0) {
    const average = avgCost.reduce((sum, r) => sum + r.provider_cost, 0) / avgCost.length;
    return {
      cost: Math.round(average * 100) / 100,
      source: 'fallback_estimate',
    };
  }

  // Ultimo fallback: 70% del prezzo addebitato (margine ipotetico 30%)
  return {
    cost: 0, // Sarà calcolato come billedAmount * 0.7
    source: 'fallback_estimate',
  };
}
```

**Acceptance Criteria:**
- [ ] Provider cost sempre disponibile (fallback chain)
- [ ] Source tracking per audit
- [ ] Precisione > 95% vs costi reali (da verificare post-launch)

---

### TASK 1.3: Security Hardening

**Epic:** Security & Compliance  
**Effort:** 1 giorno  
**Risk:** Low  

#### 1.3.1 Audit Log Enhancement

```sql
-- File: supabase/migrations/093_financial_audit_log.sql

-- Tabella dedicata per audit finanziario (separata da security_audit_log)
CREATE TABLE IF NOT EXISTS financial_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Evento
  event_type TEXT NOT NULL CHECK (event_type IN (
    'wallet_debit',
    'wallet_credit',
    'platform_cost_recorded',
    'reconciliation_completed',
    'reconciliation_discrepancy',
    'margin_alert'
  )),
  
  -- Riferimenti
  user_id UUID REFERENCES users(id),
  shipment_id UUID REFERENCES shipments(id),
  price_list_id UUID REFERENCES price_lists(id),
  
  -- Valori
  amount DECIMAL(10,2),
  old_value JSONB,
  new_value JSONB,
  
  -- Context
  actor_id UUID REFERENCES users(id), -- Chi ha fatto l'azione
  actor_email TEXT,
  ip_address INET,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX idx_fal_event_type ON financial_audit_log(event_type);
CREATE INDEX idx_fal_user_id ON financial_audit_log(user_id);
CREATE INDEX idx_fal_created_at ON financial_audit_log(created_at DESC);

-- RLS: Solo superadmin
ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY fal_superadmin_only ON financial_audit_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
  );
```

**Acceptance Criteria:**
- [ ] Ogni operazione finanziaria ha audit record
- [ ] Immutabilità garantita (no UPDATE/DELETE policy)
- [ ] Retention policy definita (GDPR: 10 anni per dati fiscali)

---

### TASK 1.4: Testing & Validation

**Effort:** 2 giorni  

#### 1.4.1 Test Suite

```typescript
// File: tests/integration/platform-costs.test.ts

describe('Platform Provider Costs', () => {
  describe('API Source Detection', () => {
    it('should detect platform source when using master list', async () => {
      // Setup: Crea listino derivato da master
      // Action: Crea spedizione
      // Assert: api_source = 'platform'
    });

    it('should detect reseller_own when using own list', async () => {
      // Setup: Crea listino supplier del reseller
      // Action: Crea spedizione
      // Assert: api_source = 'reseller_own'
    });

    it('should record platform_provider_costs for platform shipments', async () => {
      // Setup: Reseller con listino assegnato da superadmin
      // Action: Crea spedizione
      // Assert: Record in platform_provider_costs con margine corretto
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate correct margin', async () => {
      // billed_amount = 10€, provider_cost = 7€
      // Assert: platform_margin = 3€, platform_margin_percent = 42.86%
    });
  });

  describe('Reconciliation', () => {
    it('should flag discrepancy when margin < threshold', async () => {
      // Setup: Spedizione con margine negativo
      // Assert: reconciliation_status = 'discrepancy'
    });
  });
});
```

**Acceptance Criteria:**
- [ ] Test coverage > 85% per nuovo codice
- [ ] Integration test con DB reale (non mock)
- [ ] Performance test: 1000 spedizioni in < 60s

---

## 🟡 SPRINT 2: UX UNIFICATION

**Durata:** 2 settimane  
**Priorità:** P1 - HIGH  
**Obiettivo:** Dashboard unificata clienti + listini  

---

### TASK 2.1: Unified Client Dashboard

**Epic:** UX Consolidation  
**Effort:** 4 giorni  

#### 2.1.1 Nuova pagina `/dashboard/reseller/clienti`

```typescript
// File: app/dashboard/reseller/clienti/page.tsx

/**
 * Dashboard Unificata Clienti per Reseller
 * 
 * Combina:
 * - Lista clienti (da reseller-team)
 * - Gestione listini (da listini-personalizzati)
 * - Stats aggregate
 * - Azioni rapide
 */

export default function UnifiedClientsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="I Miei Clienti"
        subtitle="Gestisci clienti, listini e wallet"
      />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Stats Cards */}
        <ClientStatsCards />
        
        {/* Actions Bar */}
        <div className="flex gap-3">
          <Button onClick={openCreateClientDialog}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nuovo Cliente
          </Button>
          <Button variant="outline" onClick={openBulkAssignDialog}>
            <FileText className="w-4 h-4 mr-2" />
            Assegna Listino
          </Button>
        </div>
        
        {/* Client List with Inline Actions */}
        <ClientListWithListini 
          clients={clients}
          onAssignListino={handleAssignListino}
          onCreateListino={handleCreateListino}
          onManageWallet={handleManageWallet}
        />
      </div>
    </div>
  );
}
```

#### 2.1.2 Componente `ClientCard` con Listino Inline

```typescript
// File: components/clients/client-card-with-listino.tsx

interface ClientCardProps {
  client: {
    id: string;
    email: string;
    name?: string;
    wallet_balance: number;
    created_at: string;
    shipments_count: number;
    assigned_listino?: {
      id: string;
      name: string;
      margin_percent: number;
    };
  };
  onAssignListino: (clientId: string) => void;
  onCreateListino: (clientId: string) => void;
  onManageWallet: (clientId: string) => void;
}

export function ClientCardWithListino({ client, ...actions }: ClientCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        {/* Client Info */}
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{client.name?.[0] || client.email[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-gray-900">{client.name || client.email}</p>
            <p className="text-sm text-gray-500">{client.email}</p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-sm text-gray-500">Wallet</p>
            <p className="font-semibold">{formatCurrency(client.wallet_balance)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">Spedizioni</p>
            <p className="font-semibold">{client.shipments_count}</p>
          </div>
        </div>
        
        {/* Listino Badge */}
        <div className="flex items-center gap-3">
          {client.assigned_listino ? (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              <FileText className="w-3 h-3 mr-1" />
              {client.assigned_listino.name}
              <span className="ml-1 text-green-600">
                +{client.assigned_listino.margin_percent}%
              </span>
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700">
              Nessun listino
            </Badge>
          )}
        </div>
        
        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => actions.onManageWallet(client.id)}>
              <Wallet className="w-4 h-4 mr-2" />
              Gestisci Wallet
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {client.assigned_listino ? (
              <DropdownMenuItem onClick={() => actions.onAssignListino(client.id)}>
                <Edit className="w-4 h-4 mr-2" />
                Cambia Listino
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => actions.onAssignListino(client.id)}>
                  <Link className="w-4 h-4 mr-2" />
                  Assegna Listino Esistente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => actions.onCreateListino(client.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crea Listino Personalizzato
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Eye className="w-4 h-4 mr-2" />
              Vedi Spedizioni
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Pagina unificata funzionante
- [ ] Tutte le azioni disponibili inline
- [ ] Nessuna navigazione necessaria per operazioni comuni
- [ ] Mobile responsive
- [ ] Performance: render < 200ms per 100 clienti

---

### TASK 2.2: Reconciliation Dashboard (SuperAdmin)

**Effort:** 3 giorni  

#### 2.2.1 Pagina `/dashboard/super-admin/riconciliazione`

```typescript
// File: app/dashboard/super-admin/riconciliazione/page.tsx

/**
 * Dashboard Riconciliazione per SuperAdmin
 * 
 * Visualizza:
 * - P&L giornaliero/mensile
 * - Discrepanze da risolvere
 * - Margini per corriere
 * - Alert automatici
 */

export default function ReconciliationDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Riconciliazione Finanziaria"
        subtitle="P&L e controllo margini piattaforma"
      />
      
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Period Selector */}
        <PeriodSelector value={period} onChange={setPeriod} />
        
        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            title="Fatturato Piattaforma"
            value={formatCurrency(stats.totalBilled)}
            trend={stats.billedTrend}
          />
          <KPICard
            title="Costi Corrieri"
            value={formatCurrency(stats.totalProviderCost)}
            trend={stats.costTrend}
          />
          <KPICard
            title="Margine Lordo"
            value={formatCurrency(stats.totalMargin)}
            trend={stats.marginTrend}
            highlight
          />
          <KPICard
            title="Margine %"
            value={`${stats.avgMarginPercent.toFixed(1)}%`}
            target="25%"
          />
        </div>
        
        {/* Discrepancies Alert */}
        {discrepancies.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Discrepanze da Risolvere</AlertTitle>
            <AlertDescription>
              {discrepancies.length} spedizioni con margine anomalo richiedono review
            </AlertDescription>
            <Button variant="outline" size="sm" onClick={openDiscrepanciesDialog}>
              Visualizza
            </Button>
          </Alert>
        )}
        
        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <MarginByCorriereChart data={marginByCorriereData} />
          <DailyPnLChart data={dailyPnLData} />
        </div>
        
        {/* Top Resellers by Platform Usage */}
        <TopResellersPlatformUsageTable data={topResellers} />
      </div>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Dashboard funzionante con dati reali
- [ ] Filtri per periodo (giorno/settimana/mese)
- [ ] Export CSV per contabilità
- [ ] Alert automatici per margini < 10%

---

### TASK 2.3: Navigation Update

**Effort:** 0.5 giorni  

```typescript
// File: lib/config/navigationConfig.ts

// Aggiornare sezione Reseller
const resellerSection: NavSection = {
  id: 'reseller',
  title: 'Reseller',
  icon: Building2,
  items: [
    {
      id: 'clienti',
      label: 'I Miei Clienti', // NUOVO: Unificato
      href: '/dashboard/reseller/clienti',
      icon: Users,
      description: 'Gestisci clienti, listini e wallet',
    },
    {
      id: 'listini-fornitore',
      label: 'Listini Fornitore',
      href: '/dashboard/reseller/listini-fornitore',
      icon: FileText,
    },
    // RIMOSSO: listini-personalizzati (ora in clienti)
  ],
};

// Aggiungere per SuperAdmin
const superAdminFinanceSection: NavSection = {
  id: 'superadmin-finance',
  title: 'Finanza',
  icon: DollarSign,
  items: [
    {
      id: 'riconciliazione',
      label: 'Riconciliazione',
      href: '/dashboard/super-admin/riconciliazione',
      icon: Calculator,
      description: 'P&L e controllo margini',
    },
    // ... altri item esistenti
  ],
};
```

---

## 🟢 SPRINT 3: OPTIMIZATION & HARDENING

**Durata:** 1 settimana  
**Priorità:** P2 - MEDIUM  
**Obiettivo:** Performance, monitoring, refactoring  

---

### TASK 3.1: Performance Optimization

- [ ] Query optimization con EXPLAIN ANALYZE
- [ ] Materialized views per report pesanti
- [ ] Caching Redis per listini (se volume alto)
- [ ] Pagination per liste clienti > 100

### TASK 3.2: Monitoring & Alerting

- [ ] Sentry integration per errori
- [ ] Datadog/CloudWatch per metriche
- [ ] Alert Slack per:
  - Margine negativo
  - Discrepanze > 5%
  - Errori recording platform_costs

### TASK 3.3: Refactoring (Tech Debt)

- [ ] Estrarre `PricingService` da `fulfillment-orchestrator.ts`
- [ ] Estrarre `ReconciliationService`
- [ ] Unificare Server Actions duplicati

---

## 📊 RIEPILOGO DELIVERABLES

### Sprint 1 (Foundation)

| Deliverable | File | Status |
|-------------|------|--------|
| Migration platform_provider_costs | `090_platform_provider_costs.sql` | 🔲 |
| Migration shipments extension | `091_shipments_api_source.sql` | 🔲 |
| Migration P&L views | `092_platform_pnl_views.sql` | 🔲 |
| Migration financial audit | `093_financial_audit_log.sql` | 🔲 |
| API Source Detection | `create-shipment-core.ts` | 🔲 |
| Platform Cost Calculator | `platform-cost-calculator.ts` | 🔲 |
| Test Suite | `platform-costs.test.ts` | 🔲 |

### Sprint 2 (UX)

| Deliverable | File | Status |
|-------------|------|--------|
| Unified Clients Page | `reseller/clienti/page.tsx` | 🔲 |
| Client Card Component | `client-card-with-listino.tsx` | 🔲 |
| Reconciliation Dashboard | `super-admin/riconciliazione/page.tsx` | 🔲 |
| Navigation Update | `navigationConfig.ts` | 🔲 |

### Sprint 3 (Optimization)

| Deliverable | Status |
|-------------|--------|
| Performance Optimization | 🔲 |
| Monitoring Setup | 🔲 |
| Refactoring | 🔲 |

---

## ⚠️ RISCHI E MITIGAZIONI

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Migration fallisce in prod | Medium | Critical | Test su staging, rollback script pronto |
| Performance degradation | Medium | High | Load test prima del deploy |
| Dati storici inconsistenti | High | Medium | Backfill script best-effort, alert per discrepanze |
| Resistenza utenti (UX change) | Low | Medium | Comunicazione, training, feedback loop |

---

## 📝 CHECKLIST PRE-DEPLOY

### Sprint 1

- [ ] Tutte le migration testate su staging
- [ ] Rollback script verificato
- [ ] Performance test: 1000 spedizioni
- [ ] Security review completata
- [ ] Documentation aggiornata

### Sprint 2

- [ ] UX review con stakeholder
- [ ] Mobile testing
- [ ] Accessibility audit (WCAG AA)
- [ ] E2E test suite green

### Sprint 3

- [ ] Load test: 10x volume corrente
- [ ] Monitoring dashboard attivo
- [ ] Runbook operativo aggiornato
- [ ] Team training completato

---

## 📞 ESCALATION PATH

| Severità | Contatto | SLA |
|----------|----------|-----|
| P0 (System Down) | Engineering Lead + CTO | 15 min |
| P1 (Major Feature Broken) | Engineering Lead | 1 ora |
| P2 (Minor Issue) | Team Lead | 4 ore |
| P3 (Enhancement) | Product Owner | Next sprint |

---

**Documento preparato da:** Engineering Team  
**Approvato da:** [Pending]  
**Data prossima review:** [Pending]

---

> *"Move fast with stable infrastructure."* — Engineering Principle #3
