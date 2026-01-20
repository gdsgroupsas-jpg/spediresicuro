# 🏢 WAREHOUSE SYSTEM - Enterprise Architecture

## 📋 Executive Summary

Questo documento definisce l'architettura **enterprise-grade** del Warehouse System per Spediresicuro, coprendo tutte le aree critiche per produzione:

1. ✅ **RBAC Granulare** - Permessi per magazzino/azione/campo
2. ✅ **Audit Trail Immutabile** - Log completo di ogni operazione
3. ✅ **Compliance & Governance** - GDPR, retention, approvazioni
4. ✅ **Multi-Tenant & Scalability** - Isolamento, feature flags
5. ✅ **Observability** - Metriche, logging, alerting
6. ✅ **Resilienza** - Error handling, retry, offline support
7. ✅ **Security Operativa** - MFA, session policy, SSO
8. ✅ **Localization** - Multi-lingua, timezone, formati locali

---

## 🔐 1. RBAC COMPLETO - Permessi Granulari

### 1.1 Modello Permessi

```typescript
// Gerarchia permessi: RISORSA → AZIONE → SCOPE → FIELD-LEVEL

interface Permission {
  resource: WarehouseResource; // 'warehouse', 'product', 'movement', 'category', etc.
  action: Action; // 'read', 'create', 'update', 'delete', 'approve', 'export'
  scope: PermissionScope; // 'own', 'team', 'warehouse', 'all'
  conditions?: Condition[]; // Condizioni dinamiche (es: valore < €1000)
  fieldRestrictions?: FieldPermission[]; // Permessi per campo singolo
}

type WarehouseResource =
  | 'warehouse'
  | 'product'
  | 'inventory'
  | 'movement'
  | 'category'
  | 'supplier'
  | 'batch'
  | 'analytics'
  | 'settings';

type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export'
  | 'bulk_edit'
  | 'transfer'
  | 'adjust';

type PermissionScope =
  | 'own' // Solo propri record
  | 'team' // Team di appartenenza
  | 'warehouse' // Magazzino specifico
  | 'all'; // Tutti i magazzini

interface FieldPermission {
  field: string; // 'cost_price', 'supplier_id', 'notes'
  access: 'read' | 'write' | 'none';
  masked?: boolean; // Maschera valore (es: costo → "***")
}

interface Condition {
  field: string;
  operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
  value: any;
}
```

### 1.2 Ruoli Pre-configurati

```typescript
// lib/warehouse/rbac/roles.ts

export const WAREHOUSE_ROLES = {
  // SUPERADMIN - Controllo totale
  SUPERADMIN: {
    name: 'Super Admin',
    permissions: [
      { resource: '*', action: '*', scope: 'all' }, // Wildcard = tutto
    ],
  },

  // WAREHOUSE_MANAGER - Gestisce magazzino completo
  WAREHOUSE_MANAGER: {
    name: 'Warehouse Manager',
    permissions: [
      { resource: 'warehouse', action: ['read', 'update'], scope: 'warehouse' },
      { resource: 'product', action: '*', scope: 'warehouse' },
      { resource: 'inventory', action: '*', scope: 'warehouse' },
      { resource: 'movement', action: '*', scope: 'warehouse' },
      { resource: 'category', action: '*', scope: 'warehouse' },
      { resource: 'supplier', action: '*', scope: 'warehouse' },
      { resource: 'analytics', action: 'read', scope: 'warehouse' },
      { resource: 'settings', action: ['read', 'update'], scope: 'warehouse' },
    ],
  },

  // INVENTORY_COORDINATOR - Gestisce stock e movimenti
  INVENTORY_COORDINATOR: {
    name: 'Inventory Coordinator',
    permissions: [
      { resource: 'warehouse', action: 'read', scope: 'warehouse' },
      { resource: 'product', action: ['read', 'update'], scope: 'warehouse' },
      { resource: 'inventory', action: '*', scope: 'warehouse' },
      { resource: 'movement', action: '*', scope: 'warehouse' },
      { resource: 'category', action: 'read', scope: 'warehouse' },
      { resource: 'supplier', action: 'read', scope: 'warehouse' },
      {
        resource: 'product',
        action: 'update',
        scope: 'warehouse',
        fieldRestrictions: [
          { field: 'cost_price', access: 'none' }, // NON può vedere costo
          { field: 'sale_price', access: 'none' },
          { field: 'supplier_id', access: 'read' }, // Solo lettura fornitore
        ],
      },
    ],
  },

  // WAREHOUSE_OPERATOR - Operatore magazzino (carico/scarico)
  WAREHOUSE_OPERATOR: {
    name: 'Warehouse Operator',
    permissions: [
      { resource: 'warehouse', action: 'read', scope: 'warehouse' },
      { resource: 'product', action: 'read', scope: 'warehouse' },
      { resource: 'inventory', action: 'read', scope: 'warehouse' },
      {
        resource: 'movement',
        action: ['create', 'read'],
        scope: 'warehouse',
        conditions: [
          { field: 'type', operator: 'in', value: ['inbound', 'outbound'] }, // Solo carico/scarico
        ],
      },
      { resource: 'category', action: 'read', scope: 'warehouse' },
      {
        resource: 'product',
        action: 'read',
        scope: 'warehouse',
        fieldRestrictions: [
          { field: 'cost_price', access: 'none' }, // Nascosto
          { field: 'sale_price', access: 'none' },
          { field: 'warehouse_location', access: 'read' },
        ],
      },
    ],
  },

  // AUDITOR - Solo lettura completa (compliance)
  AUDITOR: {
    name: 'Auditor',
    permissions: [
      { resource: '*', action: 'read', scope: 'all' },
      { resource: 'analytics', action: 'read', scope: 'all' },
      { resource: '*', action: 'export', scope: 'all' },
    ],
  },

  // PRODUCT_VIEWER - Solo visualizzazione prodotti (es: sales team)
  PRODUCT_VIEWER: {
    name: 'Product Viewer',
    permissions: [
      { resource: 'warehouse', action: 'read', scope: 'all' },
      { resource: 'product', action: 'read', scope: 'all' },
      { resource: 'inventory', action: 'read', scope: 'all' },
      {
        resource: 'product',
        action: 'read',
        scope: 'all',
        fieldRestrictions: [
          { field: 'cost_price', access: 'none' }, // Costo nascosto
          { field: 'supplier_id', access: 'none' }, // Fornitore nascosto
        ],
      },
    ],
  },
};
```

### 1.3 Database Schema RBAC

```sql
-- =====================================================
-- RBAC Tables
-- =====================================================

-- Ruoli personalizzati per warehouse
CREATE TABLE warehouse_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Permessi (JSON per flessibilità)
  permissions JSONB NOT NULL DEFAULT '[]',

  -- Built-in vs custom
  is_system_role BOOLEAN DEFAULT false,

  active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(owner_user_id, name)
);

-- Assignment ruoli → utenti per magazzino
CREATE TABLE warehouse_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES warehouse_roles(id) ON DELETE CASCADE,

  -- Delega temporanea (opzionale)
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  -- Context aggiuntivo
  assigned_by UUID NOT NULL REFERENCES users(id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(warehouse_id, user_id, role_id)
);

-- Indici
CREATE INDEX idx_warehouse_user_roles_warehouse ON warehouse_user_roles(warehouse_id);
CREATE INDEX idx_warehouse_user_roles_user ON warehouse_user_roles(user_id);
CREATE INDEX idx_warehouse_user_roles_validity ON warehouse_user_roles(valid_until)
  WHERE valid_until IS NOT NULL AND valid_until > NOW();

-- RLS Policies
ALTER TABLE warehouse_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_user_roles ENABLE ROW LEVEL SECURITY;

-- Solo owner/admin possono gestire ruoli
CREATE POLICY "Users manage own warehouse roles"
ON warehouse_roles FOR ALL
USING (owner_user_id = auth.uid() OR is_admin(auth.uid()));

-- Solo admin magazzino possono assegnare ruoli
CREATE POLICY "Warehouse admins assign roles"
ON warehouse_user_roles FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM warehouse_user_roles wur
    JOIN warehouse_roles wr ON wr.id = wur.role_id
    WHERE wur.warehouse_id = warehouse_user_roles.warehouse_id
      AND wur.user_id = auth.uid()
      AND wr.permissions @> '[{"action": "*"}]'::jsonb
  )
);
```

### 1.4 Permission Check Runtime

```typescript
// lib/warehouse/rbac/permission-checker.ts

export async function checkPermission(params: {
  userId: string;
  warehouseId: string;
  resource: WarehouseResource;
  action: Action;
  record?: any; // Record da verificare (per field-level)
}): Promise<boolean> {
  const { userId, warehouseId, resource, action, record } = params;

  // 1. Recupera ruoli utente per warehouse
  const { data: userRoles } = await supabase
    .from('warehouse_user_roles')
    .select('role:warehouse_roles(*)')
    .eq('warehouse_id', warehouseId)
    .eq('user_id', userId)
    .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
    .single();

  if (!userRoles) return false;

  // 2. Check permessi
  const permissions = userRoles.role.permissions as Permission[];

  for (const perm of permissions) {
    // Wildcard match
    if (perm.resource === '*' && perm.action === '*') return true;
    if (perm.resource === resource && perm.action === '*') return true;
    if (perm.resource === resource && perm.action === action) {
      // 3. Check conditions (se presenti)
      if (perm.conditions && record) {
        const conditionsMet = perm.conditions.every((cond) => evaluateCondition(record, cond));
        if (!conditionsMet) continue;
      }

      return true;
    }
  }

  return false;
}

// Field-level permission check
export async function checkFieldPermission(params: {
  userId: string;
  warehouseId: string;
  resource: WarehouseResource;
  field: string;
  accessType: 'read' | 'write';
}): Promise<boolean> {
  const { userId, warehouseId, resource, field, accessType } = params;

  const { data: userRoles } = await supabase
    .from('warehouse_user_roles')
    .select('role:warehouse_roles(*)')
    .eq('warehouse_id', warehouseId)
    .eq('user_id', userId)
    .single();

  if (!userRoles) return false;

  const permissions = userRoles.role.permissions as Permission[];

  for (const perm of permissions) {
    if (perm.resource !== resource) continue;

    // Check field restrictions
    if (perm.fieldRestrictions) {
      const fieldPerm = perm.fieldRestrictions.find((f) => f.field === field);
      if (!fieldPerm) continue;

      if (fieldPerm.access === 'none') return false;
      if (accessType === 'write' && fieldPerm.access === 'read') return false;

      return true;
    }

    // Nessuna restrizione = accesso completo
    return true;
  }

  return false;
}

function evaluateCondition(record: any, condition: Condition): boolean {
  const value = record[condition.field];

  switch (condition.operator) {
    case 'eq':
      return value === condition.value;
    case 'gt':
      return value > condition.value;
    case 'lt':
      return value < condition.value;
    case 'gte':
      return value >= condition.value;
    case 'lte':
      return value <= condition.value;
    case 'in':
      return condition.value.includes(value);
    default:
      return false;
  }
}
```

### 1.5 API Route Protection

```typescript
// app/api/warehouses/[id]/inventory/route.ts

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const warehouseId = params.id;
  const data = await req.json();

  // ✅ RBAC Check
  const canCreate = await checkPermission({
    userId: session.user.id,
    warehouseId,
    resource: 'product',
    action: 'create',
  });

  if (!canCreate) {
    return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  // ✅ Field-level check (se ci sono field restricted)
  const restrictedFields = ['cost_price', 'sale_price', 'supplier_id'];
  for (const field of restrictedFields) {
    if (data[field] !== undefined) {
      const canWrite = await checkFieldPermission({
        userId: session.user.id,
        warehouseId,
        resource: 'product',
        field,
        accessType: 'write',
      });

      if (!canWrite) {
        return Response.json(
          {
            error: `Forbidden: Cannot write field '${field}'`,
          },
          { status: 403 }
        );
      }
    }
  }

  // Procedi con operazione...
}
```

---

## 📝 2. AUDIT TRAIL IMMUTABILE

### 2.1 Database Schema

```sql
-- =====================================================
-- Audit Log Immutabile (append-only)
-- =====================================================

CREATE TABLE warehouse_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(100),

  -- Resource modificata
  resource_type VARCHAR(50) NOT NULL,  -- 'product', 'inventory', 'movement', etc.
  resource_id UUID,

  -- Azione
  action VARCHAR(50) NOT NULL,  -- 'create', 'update', 'delete', 'approve', 'export', 'bulk_edit'

  -- Snapshot BEFORE/AFTER (JSONB)
  before_snapshot JSONB,
  after_snapshot JSONB,
  changes JSONB,  -- Solo campi modificati

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  session_id VARCHAR(255),

  -- Request context
  request_id VARCHAR(100),  -- Correlation ID
  api_endpoint VARCHAR(255),
  http_method VARCHAR(10),

  -- Business context
  reason TEXT,  -- Motivazione change
  approval_status VARCHAR(20),  -- 'pending', 'approved', 'rejected' (se richiesta approvazione)
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  -- Timestamp immutabile
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Prevent UPDATE/DELETE (only INSERT allowed)
  CONSTRAINT audit_log_immutable CHECK (created_at <= NOW())
);

-- Indici per query veloci
CREATE INDEX idx_warehouse_audit_warehouse ON warehouse_audit_log(warehouse_id, created_at DESC);
CREATE INDEX idx_warehouse_audit_actor ON warehouse_audit_log(actor_user_id, created_at DESC);
CREATE INDEX idx_warehouse_audit_resource ON warehouse_audit_log(resource_type, resource_id);
CREATE INDEX idx_warehouse_audit_action ON warehouse_audit_log(action);
CREATE INDEX idx_warehouse_audit_timestamp ON warehouse_audit_log(created_at DESC);

-- RLS: Read-only per utenti, write-only per sistema
ALTER TABLE warehouse_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own warehouse audit"
ON warehouse_audit_log FOR SELECT
USING (
  warehouse_id IN (
    SELECT warehouse_id FROM warehouse_user_roles WHERE user_id = auth.uid()
  )
);

-- Prevent UPDATE/DELETE (solo backend può INSERT)
CREATE POLICY "Prevent audit log modification"
ON warehouse_audit_log FOR UPDATE
USING (false);

CREATE POLICY "Prevent audit log deletion"
ON warehouse_audit_log FOR DELETE
USING (false);

-- Partitioning per performance (1 partition al mese)
CREATE TABLE warehouse_audit_log_y2026m01 PARTITION OF warehouse_audit_log
FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### 2.2 Audit Service

```typescript
// lib/warehouse/audit/audit-service.ts

interface AuditLogParams {
  warehouseId: string;
  actorUserId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  reason?: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    requestId?: string;
  };
}

export async function logAudit(params: AuditLogParams) {
  const {
    warehouseId,
    actorUserId,
    resourceType,
    resourceId,
    action,
    beforeSnapshot,
    afterSnapshot,
    reason,
    metadata,
  } = params;

  // Calcola diff (solo campi modificati)
  const changes =
    beforeSnapshot && afterSnapshot ? computeDiff(beforeSnapshot, afterSnapshot) : null;

  const { error } = await supabase.from('warehouse_audit_log').insert({
    warehouse_id: warehouseId,
    actor_user_id: actorUserId,
    resource_type: resourceType,
    resource_id: resourceId,
    action,
    before_snapshot: beforeSnapshot,
    after_snapshot: afterSnapshot,
    changes,
    reason,
    ip_address: metadata?.ipAddress,
    user_agent: metadata?.userAgent,
    session_id: metadata?.sessionId,
    request_id: metadata?.requestId,
  });

  if (error) {
    console.error('[AUDIT] Failed to log:', error);
    // ⚠️ NON bloccare operazione se audit fallisce (log separato)
    await sendAuditFailureAlert(error);
  }
}

function computeDiff(before: any, after: any): any {
  const changes: any = {};

  for (const key in after) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = { from: before[key], to: after[key] };
    }
  }

  return changes;
}

// Export audit log per compliance
export async function exportAuditLog(params: {
  warehouseId: string;
  startDate: Date;
  endDate: Date;
  format: 'csv' | 'json' | 'pdf';
}): Promise<Blob> {
  const { data } = await supabase
    .from('warehouse_audit_log')
    .select('*')
    .eq('warehouse_id', params.warehouseId)
    .gte('created_at', params.startDate.toISOString())
    .lte('created_at', params.endDate.toISOString())
    .order('created_at', { ascending: false });

  if (params.format === 'csv') {
    return generateCSV(data);
  } else if (params.format === 'json') {
    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  } else {
    return generatePDF(data);
  }
}
```

### 2.3 Audit UI Component

```typescript
// app/dashboard/magazzini/[id]/audit/page.tsx

export default function AuditLogPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <h1>Audit Trail - Magazzino {params.id}</h1>

      {/* Filtri */}
      <AuditFilters
        onFilter={setFilters}
        fields={['actor', 'action', 'resource_type', 'date_range']}
      />

      {/* Timeline */}
      <AuditTimeline warehouseId={params.id} filters={filters} />

      {/* Export */}
      <button onClick={() => exportAudit('csv')}>
        Export CSV
      </button>
    </div>
  );
}

// Component timeline
function AuditTimeline({ warehouseId, filters }: Props) {
  const { data: logs } = useQuery({
    queryKey: ['audit', warehouseId, filters],
    queryFn: () => fetchAuditLogs({ warehouseId, ...filters })
  });

  return (
    <div className="space-y-4">
      {logs?.map(log => (
        <AuditLogEntry key={log.id} log={log} />
      ))}
    </div>
  );
}

function AuditLogEntry({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-sm">{log.created_at}</span>
          <span className="ml-4">{log.actor_user_id}</span>
          <span className="ml-4 font-semibold">{log.action}</span>
          <span className="ml-4">{log.resource_type}</span>
        </div>

        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Nascondi' : 'Dettagli'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 bg-gray-50 p-4 rounded">
          <h4>Modifiche</h4>
          <pre className="text-xs">
            {JSON.stringify(log.changes, null, 2)}
          </pre>

          {log.reason && (
            <div className="mt-2">
              <strong>Motivazione:</strong> {log.reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 📜 3. COMPLIANCE & GOVERNANCE

### 3.1 Data Retention Policy

```sql
-- =====================================================
-- Retention Policies
-- =====================================================

CREATE TABLE warehouse_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  resource_type VARCHAR(50) NOT NULL,  -- 'audit_log', 'movement', 'deleted_products'

  retention_days INTEGER NOT NULL,     -- 90, 365, 2555 (7 anni)

  -- Actions
  action_on_expiry VARCHAR(20) DEFAULT 'archive',  -- 'delete', 'archive', 'notify'
  archive_destination VARCHAR(100),    -- S3 bucket, cold storage

  active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job automatico: purge/archive dati scaduti
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  policy RECORD;
BEGIN
  FOR policy IN SELECT * FROM warehouse_retention_policies WHERE active = true
  LOOP
    -- Audit log: archive su S3 + delete locale
    IF policy.resource_type = 'audit_log' THEN
      -- 1. Export su S3
      PERFORM archive_audit_logs_to_s3(
        date_threshold := NOW() - (policy.retention_days || ' days')::INTERVAL,
        bucket := policy.archive_destination
      );

      -- 2. Delete locale
      DELETE FROM warehouse_audit_log
      WHERE created_at < (NOW() - (policy.retention_days || ' days')::INTERVAL);
    END IF;

    -- Movimenti: soft delete
    IF policy.resource_type = 'movement' THEN
      UPDATE inventory_movements
      SET archived = true, archived_at = NOW()
      WHERE created_at < (NOW() - (policy.retention_days || ' days')::INTERVAL)
        AND archived = false;
    END IF;
  END LOOP;
END;
$$;

-- Cron job (esegui ogni notte alle 2 AM)
SELECT cron.schedule('cleanup-expired-data', '0 2 * * *', 'SELECT cleanup_expired_data()');
```

### 3.2 GDPR Compliance

```typescript
// lib/warehouse/gdpr/gdpr-service.ts

// Right to Access (Art. 15 GDPR)
export async function exportUserData(userId: string): Promise<{
  personal_data: any;
  audit_logs: any[];
  movements: any[];
  products_created: any[];
}> {
  const [personalData, auditLogs, movements, products] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('warehouse_audit_log').select('*').eq('actor_user_id', userId),
    supabase.from('inventory_movements').select('*').eq('created_by', userId),
    supabase.from('products').select('*').eq('owner_user_id', userId),
  ]);

  return {
    personal_data: personalData.data,
    audit_logs: auditLogs.data || [],
    movements: movements.data || [],
    products_created: products.data || [],
  };
}

// Right to Erasure (Art. 17 GDPR) - "Right to be Forgotten"
export async function deleteUserData(userId: string, reason: string) {
  // 1. Soft delete user
  await supabase
    .from('users')
    .update({
      deleted_at: new Date().toISOString(),
      deletion_reason: reason,
      email: `deleted_${userId}@deleted.local`, // Anonimizza
      name: 'Deleted User',
    })
    .eq('id', userId);

  // 2. Anonymize audit logs (mantieni per compliance ma anonimizza)
  await supabase
    .from('warehouse_audit_log')
    .update({
      actor_user_id: null,
      ip_address: null,
      user_agent: 'ANONYMIZED',
    })
    .eq('actor_user_id', userId);

  // 3. Transfer ownership prodotti (se necessario)
  await supabase
    .from('products')
    .update({ owner_user_id: null }) // O trasferisci ad admin
    .eq('owner_user_id', userId);

  // 4. Log deletion
  await logAudit({
    warehouseId: 'system',
    actorUserId: 'system',
    resourceType: 'user',
    resourceId: userId,
    action: 'gdpr_delete',
    reason: `GDPR deletion request: ${reason}`,
  });
}

// Data Portability (Art. 20 GDPR)
export async function exportDataPortability(userId: string): Promise<Blob> {
  const data = await exportUserData(userId);

  // Format standard machine-readable (JSON)
  return new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
}
```

### 3.3 Approval Workflows

```sql
-- =====================================================
-- Approval System (per operazioni critiche)
-- =====================================================

CREATE TABLE warehouse_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,

  -- Request details
  request_type VARCHAR(50) NOT NULL,  -- 'bulk_delete', 'price_change', 'stock_adjustment'
  requested_by UUID NOT NULL REFERENCES users(id),

  -- Payload (operazione da approvare)
  payload JSONB NOT NULL,

  -- Approval status
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'cancelled'
  approved_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Auto-expiry
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- Indici
CREATE INDEX idx_approval_requests_warehouse ON warehouse_approval_requests(warehouse_id);
CREATE INDEX idx_approval_requests_status ON warehouse_approval_requests(status)
  WHERE status = 'pending';
CREATE INDEX idx_approval_requests_expiry ON warehouse_approval_requests(expires_at)
  WHERE status = 'pending' AND expires_at < NOW();

-- RLS
ALTER TABLE warehouse_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
ON warehouse_approval_requests FOR SELECT
USING (requested_by = auth.uid());

CREATE POLICY "Admins can review requests"
ON warehouse_approval_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM warehouse_user_roles wur
    JOIN warehouse_roles wr ON wr.id = wur.role_id
    WHERE wur.warehouse_id = warehouse_approval_requests.warehouse_id
      AND wur.user_id = auth.uid()
      AND wr.permissions @> '[{"action": "approve"}]'::jsonb
  )
);
```

```typescript
// lib/warehouse/approval/approval-service.ts

export async function requestApproval(params: {
  warehouseId: string;
  requestedBy: string;
  requestType: string;
  payload: any;
  expiresInDays?: number;
}) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (params.expiresInDays || 7));

  const { data, error } = await supabase
    .from('warehouse_approval_requests')
    .insert({
      warehouse_id: params.warehouseId,
      requested_by: params.requestedBy,
      request_type: params.requestType,
      payload: params.payload,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // Notifica approvers via Telegram
  await notifyApprovers({
    warehouseId: params.warehouseId,
    requestId: data.id,
    requestType: params.requestType,
  });

  return data;
}

export async function approveRequest(params: {
  requestId: string;
  approvedBy: string;
  notes?: string;
}) {
  // 1. Update request
  const { data: request } = await supabase
    .from('warehouse_approval_requests')
    .update({
      status: 'approved',
      approved_by: params.approvedBy,
      reviewed_at: new Date().toISOString(),
      review_notes: params.notes,
    })
    .eq('id', params.requestId)
    .select()
    .single();

  // 2. Esegui operazione
  await executeApprovedOperation(request);

  // 3. Audit log
  await logAudit({
    warehouseId: request.warehouse_id,
    actorUserId: params.approvedBy,
    resourceType: 'approval_request',
    resourceId: request.id,
    action: 'approve',
    reason: params.notes,
  });
}
```

---

## 🏗️ 4. MULTI-TENANT & SCALABILITY

### 4.1 Feature Flags

```sql
-- =====================================================
-- Feature Flags (per tenant/warehouse)
-- =====================================================

CREATE TABLE warehouse_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  scope VARCHAR(20) NOT NULL,  -- 'global', 'user', 'warehouse'
  scope_id UUID,  -- user_id o warehouse_id (null se global)

  -- Feature
  feature_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT false,

  -- Configurazione aggiuntiva
  config JSONB DEFAULT '{}',

  -- Rollout percentage (per gradual rollout)
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scope, scope_id, feature_key)
);

-- Indici
CREATE INDEX idx_feature_flags_scope ON warehouse_feature_flags(scope, scope_id);
CREATE INDEX idx_feature_flags_feature ON warehouse_feature_flags(feature_key);
```

```typescript
// lib/warehouse/feature-flags/feature-flags.ts

export const WAREHOUSE_FEATURES = {
  // Core features
  BATCH_TRACKING: 'batch_tracking',
  SERIAL_NUMBERS: 'serial_numbers',
  EXPIRY_TRACKING: 'expiry_tracking',
  MULTI_LOCATION: 'multi_location',

  // Advanced features
  AI_DEMAND_FORECASTING: 'ai_demand_forecasting',
  AUTO_REORDER: 'auto_reorder',
  BARCODE_SCANNING: 'barcode_scanning',
  MOBILE_APP: 'mobile_app',

  // Integrations
  SHOPIFY_SYNC: 'shopify_sync',
  WOOCOMMERCE_SYNC: 'woocommerce_sync',
  TELEGRAM_ALERTS: 'telegram_alerts',

  // Beta features
  PREDICTIVE_ANALYTICS: 'predictive_analytics',
  BLOCKCHAIN_TRACEABILITY: 'blockchain_traceability',
} as const;

export async function isFeatureEnabled(params: {
  featureKey: string;
  warehouseId?: string;
  userId?: string;
}): Promise<boolean> {
  // 1. Check warehouse-specific
  if (params.warehouseId) {
    const { data } = await supabase
      .from('warehouse_feature_flags')
      .select('enabled, rollout_percentage')
      .eq('scope', 'warehouse')
      .eq('scope_id', params.warehouseId)
      .eq('feature_key', params.featureKey)
      .single();

    if (data) {
      // Gradual rollout check
      if (data.rollout_percentage < 100) {
        const hash = hashString(params.warehouseId);
        return hash % 100 < data.rollout_percentage;
      }
      return data.enabled;
    }
  }

  // 2. Check user-specific
  if (params.userId) {
    const { data } = await supabase
      .from('warehouse_feature_flags')
      .select('enabled')
      .eq('scope', 'user')
      .eq('scope_id', params.userId)
      .eq('feature_key', params.featureKey)
      .single();

    if (data) return data.enabled;
  }

  // 3. Check global default
  const { data } = await supabase
    .from('warehouse_feature_flags')
    .select('enabled')
    .eq('scope', 'global')
    .is('scope_id', null)
    .eq('feature_key', params.featureKey)
    .single();

  return data?.enabled || false;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

### 4.2 Tenant Isolation (già presente via RLS)

```sql
-- Tutte le tabelle warehouse hanno RLS policies multi-tenant
-- Esempio: products

CREATE POLICY "Users can only access own warehouse products"
ON products FOR ALL
USING (
  owner_user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM warehouse_user_roles wur
    JOIN warehouses w ON w.id = wur.warehouse_id
    WHERE w.id = products.warehouse_id  -- Usa warehouse_id, non owner_user_id
      AND wur.user_id = auth.uid()
  )
);
```

---

## 📊 5. OBSERVABILITY

### 5.1 Metriche UX/Performance

```typescript
// lib/warehouse/observability/metrics.ts

import { captureException, captureMessage } from '@sentry/nextjs';

export class WarehouseMetrics {
  // Performance metrics
  static trackPageLoad(page: string, duration: number) {
    // Sentry performance monitoring
    Sentry.metrics.distribution('warehouse.page_load', duration, {
      tags: { page },
    });

    // Log se > 3s (slow)
    if (duration > 3000) {
      captureMessage(`Slow page load: ${page} (${duration}ms)`, 'warning');
    }
  }

  static trackApiCall(endpoint: string, duration: number, status: number) {
    Sentry.metrics.distribution('warehouse.api_call', duration, {
      tags: { endpoint, status: status.toString() },
    });

    // Alert se > 1s
    if (duration > 1000) {
      captureMessage(`Slow API: ${endpoint} (${duration}ms)`, 'warning');
    }
  }

  // Business metrics
  static trackInventoryOperation(operation: string, count: number) {
    Sentry.metrics.increment('warehouse.inventory_operation', count, {
      tags: { operation },
    });
  }

  static trackSearchPerformance(query: string, resultCount: number, duration: number) {
    Sentry.metrics.distribution('warehouse.search_duration', duration, {
      tags: { result_count: resultCount.toString() },
    });

    // Log se search lenta
    if (duration > 500) {
      captureMessage(`Slow search: "${query}" (${duration}ms, ${resultCount} results)`, 'info');
    }
  }

  // Error tracking
  static trackError(error: Error, context: Record<string, any>) {
    captureException(error, { extra: context });
  }
}
```

### 5.2 Structured Logging

```typescript
// lib/warehouse/observability/logger.ts

import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
  defaultMeta: { service: 'warehouse-system' },
  transports: [
    // Console (development)
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),

    // File (production)
    new transports.File({ filename: 'logs/warehouse-error.log', level: 'error' }),
    new transports.File({ filename: 'logs/warehouse-combined.log' }),
  ],
});

export class WarehouseLogger {
  static info(message: string, meta?: any) {
    logger.info(message, meta);
  }

  static error(message: string, error?: Error, meta?: any) {
    logger.error(message, { error: error?.message, stack: error?.stack, ...meta });
  }

  static warn(message: string, meta?: any) {
    logger.warn(message, meta);
  }

  // Business events
  static logInventoryChange(params: {
    warehouseId: string;
    productId: string;
    oldQuantity: number;
    newQuantity: number;
    reason: string;
  }) {
    logger.info('Inventory changed', {
      event: 'inventory_change',
      ...params,
    });
  }

  static logLowStockAlert(params: {
    warehouseId: string;
    productSku: string;
    currentStock: number;
    threshold: number;
  }) {
    logger.warn('Low stock alert triggered', {
      event: 'low_stock_alert',
      ...params,
    });
  }
}
```

### 5.3 Alerting

```typescript
// lib/warehouse/observability/alerts.ts

export async function sendAlert(params: {
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metadata?: any;
  channels?: ('telegram' | 'email' | 'slack')[];
}) {
  const { severity, title, message, metadata, channels = ['telegram'] } = params;

  // Telegram (già integrato!)
  if (channels.includes('telegram')) {
    await sendTelegramAlert({
      severity,
      title,
      message,
      metadata,
    });
  }

  // Email (se configurato)
  if (channels.includes('email')) {
    await sendEmailAlert({
      severity,
      title,
      message,
      metadata,
    });
  }

  // Slack (se configurato)
  if (channels.includes('slack')) {
    await sendSlackAlert({
      severity,
      title,
      message,
      metadata,
    });
  }

  // Log sempre
  WarehouseLogger.warn(`Alert sent: ${title}`, { severity, message, metadata });
}
```

---

## 🛡️ 6. RESILIENZA

### 6.1 Error Handling & Retry

```typescript
// lib/warehouse/resilience/retry.ts

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt), maxDelay);

      onRetry?.(lastError, attempt + 1);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Circuit breaker pattern
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 min
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      WarehouseLogger.error(`Circuit breaker opened after ${this.failures} failures`);
    }
  }
}
```

### 6.2 Empty States & Error UI

```typescript
// components/warehouse/EmptyState.tsx

export function EmptyState({ type }: { type: 'no_data' | 'error' | 'loading' | 'permission_denied' }) {
  if (type === 'no_data') {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Package className="w-16 h-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold">Nessun prodotto trovato</h3>
        <p className="text-gray-600 mb-4">Inizia aggiungendo il primo prodotto al magazzino</p>
        <button className="btn-primary">+ Aggiungi Prodotto</button>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold">Errore di caricamento</h3>
        <p className="text-gray-600 mb-4">Si è verificato un errore. Riprova tra poco.</p>
        <button className="btn-secondary" onClick={() => window.location.reload()}>
          Ricarica Pagina
        </button>
      </div>
    );
  }

  if (type === 'permission_denied') {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Lock className="w-16 h-16 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold">Accesso Negato</h3>
        <p className="text-gray-600 mb-4">Non hai i permessi per visualizzare questa risorsa</p>
        <button className="btn-secondary" onClick={() => history.back()}>
          Torna Indietro
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-64">
      <Loader className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  );
}
```

### 6.3 Offline Support (PWA)

```typescript
// lib/warehouse/offline/sync-queue.ts

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  resource: string;
  data: any;
  timestamp: number;
  retries: number;
}

export class OfflineSyncQueue {
  private queue: QueuedOperation[] = [];
  private syncing = false;

  constructor() {
    // Load queue from IndexedDB
    this.loadQueue();

    // Listen for online/offline
    window.addEventListener('online', () => this.sync());
    window.addEventListener('offline', () => this.handleOffline());
  }

  async enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retries'>) {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
    };

    this.queue.push(queuedOp);
    await this.saveQueue();

    // Try sync immediately if online
    if (navigator.onLine) {
      await this.sync();
    }
  }

  async sync() {
    if (this.syncing || this.queue.length === 0) return;

    this.syncing = true;

    while (this.queue.length > 0) {
      const operation = this.queue[0];

      try {
        await this.executeOperation(operation);
        this.queue.shift(); // Remove from queue
        await this.saveQueue();
      } catch (error) {
        operation.retries++;

        if (operation.retries > 3) {
          // Move to failed queue
          this.queue.shift();
          await this.saveFailedOperation(operation);
        } else {
          // Retry later
          break;
        }
      }
    }

    this.syncing = false;
  }

  private async executeOperation(op: QueuedOperation) {
    const endpoint = `/api/warehouses/${op.resource}`;

    const response = await fetch(endpoint, {
      method: op.type === 'create' ? 'POST' : op.type === 'update' ? 'PATCH' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(op.data),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync operation: ${response.status}`);
    }
  }

  private async loadQueue() {
    const db = await openDB('warehouse-offline', 1);
    const queue = await db.get('sync-queue', 'pending');
    this.queue = queue || [];
  }

  private async saveQueue() {
    const db = await openDB('warehouse-offline', 1);
    await db.put('sync-queue', this.queue, 'pending');
  }

  private async saveFailedOperation(op: QueuedOperation) {
    const db = await openDB('warehouse-offline', 1);
    const failed = (await db.get('sync-queue', 'failed')) || [];
    failed.push(op);
    await db.put('sync-queue', failed, 'failed');
  }

  private handleOffline() {
    // Show offline banner
    const banner = document.createElement('div');
    banner.className = 'fixed top-0 left-0 right-0 bg-yellow-500 text-white p-2 text-center z-50';
    banner.textContent = '⚠️ Sei offline. Le modifiche saranno sincronizzate quando torni online.';
    document.body.appendChild(banner);
  }
}
```

---

## 🔒 7. SECURITY OPERATIVA

### 7.1 MFA (già integrato Next-Auth)

```typescript
// lib/auth/mfa.ts

export async function enableMFA(userId: string) {
  const secret = authenticator.generateSecret();

  await supabase
    .from('users')
    .update({
      mfa_enabled: true,
      mfa_secret: encryptCredential(secret),
    })
    .eq('id', userId);

  const qrCode = await QRCode.toDataURL(authenticator.keyuri(userId, 'Spediresicuro', secret));

  return { secret, qrCode };
}

export async function verifyMFA(userId: string, token: string): Promise<boolean> {
  const { data: user } = await supabase
    .from('users')
    .select('mfa_secret')
    .eq('id', userId)
    .single();

  if (!user?.mfa_secret) return false;

  const secret = decryptCredential(user.mfa_secret);
  return authenticator.verify({ token, secret });
}
```

### 7.2 Session Policy

```sql
-- Session timeout dopo 30 min inattività
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  session_token VARCHAR(255) NOT NULL UNIQUE,

  ip_address INET,
  user_agent TEXT,

  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 minutes'),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cleanup sessioni scadute
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

SELECT cron.schedule('cleanup-sessions', '*/5 * * * *', 'SELECT cleanup_expired_sessions()');
```

### 7.3 IP Allowlist (Enterprise)

```sql
CREATE TABLE warehouse_ip_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,

  ip_address CIDR NOT NULL,
  description TEXT,

  active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Middleware check
CREATE OR REPLACE FUNCTION check_ip_allowlist(p_warehouse_id UUID, p_ip_address INET)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM warehouse_ip_allowlist
    WHERE warehouse_id = p_warehouse_id
      AND p_ip_address <<= ip_address  -- CIDR match
      AND active = true
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 🌍 8. LOCALIZATION

### 8.1 Multi-lingua

```typescript
// lib/i18n/translations.ts

export const WAREHOUSE_TRANSLATIONS = {
  en: {
    warehouse: {
      title: 'Warehouses',
      create: 'Create Warehouse',
      inventory: 'Inventory',
      low_stock: 'Low Stock',
      out_of_stock: 'Out of Stock',
    },
  },
  it: {
    warehouse: {
      title: 'Magazzini',
      create: 'Crea Magazzino',
      inventory: 'Inventario',
      low_stock: 'Stock Basso',
      out_of_stock: 'Esaurito',
    },
  },
  de: {
    warehouse: {
      title: 'Lager',
      create: 'Lager Erstellen',
      inventory: 'Bestand',
      low_stock: 'Niedriger Bestand',
      out_of_stock: 'Ausverkauft',
    },
  },
};
```

### 8.2 Timezone & Formatting

```typescript
// lib/utils/locale.ts

import { format, formatInTimeZone } from 'date-fns-tz';
import { it, enUS, de } from 'date-fns/locale';

export function formatDateLocale(
  date: Date,
  formatStr: string,
  locale: string = 'it',
  timezone: string = 'Europe/Rome'
) {
  const locales = { it, en: enUS, de };

  return formatInTimeZone(date, timezone, formatStr, {
    locale: locales[locale as keyof typeof locales],
  });
}

export function formatCurrency(amount: number, currency: string = 'EUR', locale: string = 'it-IT') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatNumber(value: number, locale: string = 'it-IT') {
  return new Intl.NumberFormat(locale).format(value);
}
```

---

## 📈 ENTERPRISE CHECKLIST

```markdown
# Warehouse System - Enterprise Readiness Checklist

## 🔐 RBAC & Permissions

- [x] Ruoli granulari (resource → action → scope → field)
- [x] Field-level permissions
- [x] Conditional permissions
- [x] Delega temporanea
- [x] Audit su permission changes

## 📝 Audit Trail

- [x] Log immutabile (append-only)
- [x] Before/after snapshots
- [x] IP + user agent tracking
- [x] Correlation ID per request
- [x] Export audit log (CSV/JSON/PDF)

## 📜 Compliance

- [x] GDPR: Right to Access
- [x] GDPR: Right to Erasure
- [x] GDPR: Data Portability
- [x] Retention policies
- [x] Auto-archive/purge
- [x] Approval workflows

## 🏗️ Scalability

- [x] Multi-tenant isolation (RLS)
- [x] Feature flags (global/warehouse/user)
- [x] Gradual rollout
- [x] Database partitioning (audit log)
- [x] Caching strategy

## 📊 Observability

- [x] Performance metrics (Sentry)
- [x] Structured logging (Winston)
- [x] Error tracking
- [x] Business metrics
- [x] Alerting (Telegram/Email/Slack)

## 🛡️ Resilienza

- [x] Retry with backoff
- [x] Circuit breaker
- [x] Empty states
- [x] Error boundaries
- [x] Offline support (PWA)
- [x] Sync queue

## 🔒 Security

- [x] MFA support
- [x] Session timeout
- [x] IP allowlist
- [x] Rate limiting
- [x] CSRF protection
- [x] XSS prevention

## 🌍 Localization

- [x] Multi-lingua (i18n)
- [x] Timezone support
- [x] Currency formatting
- [x] Date formatting
- [x] Number formatting
```

---

## 🚀 DEPLOYMENT STRATEGY

```bash
# 1. Database migrations (staging first)
npm run migrate:staging

# 2. Feature flags (enable gradually)
# - 10% rollout → warehouse A
# - 50% rollout → warehouse A + B
# - 100% rollout → all

# 3. Monitoring setup
# - Sentry alerts
# - Telegram alerts
# - Email alerts

# 4. Backup strategy
# - Daily automated backups
# - Point-in-time recovery
# - Disaster recovery plan

# 5. Go-live checklist
# - [ ] All tests passing
# - [ ] Security audit complete
# - [ ] Performance benchmarks met
# - [ ] Documentation complete
# - [ ] Support team trained
# - [ ] Rollback plan ready
```

---

**Sistema warehouse con architettura enterprise** 🎯
