# 🗄️ Database Schema & Invariants

## Schema Overview

SpedireSicuro uses **PostgreSQL** via Supabase with the following core modules:

1. **User Management** - Users, roles, authentication
2. **Shipments** - Spedizioni, tracking, corrieri
3. **Financial** - Wallet, transactions, top-ups
4. **Security** - Audit logs, impersonation tracking
5. **CRM** - Leads, conversions
6. **Automation** - Courier configs, diagnostics

---

## Core Tables

### users
**Purpose:** User profiles with wallet and role-based access

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT,  -- bcrypt hash
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user',  -- 'user', 'admin', 'superadmin'
  account_type TEXT,  -- 'superadmin', 'reseller', 'user'
  
  -- Wallet
  wallet_balance DECIMAL(10,2) DEFAULT 0.00 CHECK (wallet_balance >= 0),
  
  -- Reseller hierarchy
  parent_user_id UUID REFERENCES users(id),
  is_reseller BOOLEAN DEFAULT false,
  
  -- Contact info
  phone TEXT,
  company_name TEXT,
  vat_number TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_parent ON users(parent_user_id);
```

**RLS Policies:**
```sql
-- Users can view themselves + admins can view all
CREATE POLICY "users_select" ON users FOR SELECT USING (
  auth.uid() = id 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Users can update themselves, admins can update all
CREATE POLICY "users_update" ON users FOR UPDATE USING (
  auth.uid() = id 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);
```

**Invariants:**
- `wallet_balance >= 0` (enforced by CHECK constraint)
- `email` must be unique
- If `is_reseller = true`, user can have children via `parent_user_id`
- SuperAdmin should NOT have `parent_user_id` set

---

### shipments
**Purpose:** Core shipment records

```sql
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Status
  status TEXT DEFAULT 'draft',  -- draft, confirmed, cancelled, delivered
  
  -- Courier info
  carrier TEXT,  -- 'GLS', 'BRT', 'POSTE', etc.
  provider_id TEXT,  -- Integration provider (e.g., 'spediscionline')
  tracking_number TEXT,
  shipment_id_external TEXT,  -- ID from courier API
  
  -- Sender
  sender_name TEXT,
  sender_address TEXT,
  sender_city TEXT,
  sender_postal_code TEXT,
  sender_country TEXT DEFAULT 'IT',
  sender_phone TEXT,
  
  -- Recipient
  recipient_name TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  recipient_city TEXT NOT NULL,
  recipient_postal_code TEXT NOT NULL,
  recipient_country TEXT DEFAULT 'IT',
  recipient_phone TEXT,
  
  -- Package details
  weight DECIMAL(10,2),  -- kg
  length DECIMAL(10,2),  -- cm
  width DECIMAL(10,2),   -- cm
  height DECIMAL(10,2),  -- cm
  
  -- Pricing
  quoted_price DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  
  -- Idempotency
  idempotency_key TEXT,
  
  -- Metadata
  notes TEXT,
  label_url TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_shipments_user_id ON shipments(user_id);
CREATE INDEX idx_shipments_status ON shipments(status);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX idx_shipments_idempotency ON shipments(user_id, idempotency_key);
```

**RLS Policies:**
```sql
-- Users see their own shipments + admins see all
CREATE POLICY "shipments_select" ON shipments FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Users can insert their own shipments
CREATE POLICY "shipments_insert" ON shipments FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Orphan prevention policy (migration 035)
CREATE POLICY "prevent_orphan_shipments" ON shipments FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE deleted_at IS NULL)
);
```

**Invariants:**
- `user_id` must reference valid user
- `status` transitions: draft → confirmed → [shipped, cancelled, delivered]
- `tracking_number` unique per carrier (when set)
- `total_cost` should match wallet debit (for non-superadmin users)

---

### wallet_transactions
**Purpose:** Immutable ledger of all wallet operations

```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Transaction details
  amount DECIMAL(10,2) NOT NULL,  -- Positive = credit, Negative = debit
  type TEXT NOT NULL,  -- 'deposit', 'SHIPMENT_CHARGE', 'refund', 'adjustment'
  status TEXT DEFAULT 'COMPLETED',  -- 'PENDING', 'COMPLETED', 'FAILED'
  
  -- Metadata
  description TEXT,
  reference_id TEXT,  -- Link to shipment, top_up_request, etc.
  
  -- Audit
  created_by UUID REFERENCES users(id),  -- Admin who created (for manual ops)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_tx_created_at ON wallet_transactions(created_at);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(type);
```

**RLS Policies:**
```sql
-- Users see their own transactions + admins see all (read-only)
CREATE POLICY "wallet_tx_select" ON wallet_transactions FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- NO INSERT policy for users (only via RPC functions)
-- NO UPDATE/DELETE policies (immutable ledger)
```

**Invariants:**
- **Append-only** (no updates, no deletes)
- `SUM(amount) WHERE user_id = X` MUST equal `users.wallet_balance` for user X
- Every wallet debit should have corresponding operation (shipment, refund, etc.)
- Daily reconciliation job verifies integrity

**Trigger:** Auto-updates `users.wallet_balance` on INSERT
```sql
CREATE TRIGGER update_wallet_balance_on_transaction
AFTER INSERT ON wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION update_wallet_balance();
```

---

### top_up_requests
**Purpose:** Bank transfer recharge requests (manual approval workflow)

```sql
CREATE TABLE top_up_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Request details
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0 AND amount <= 10000),
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  
  -- File upload
  file_url TEXT NOT NULL,
  file_hash TEXT,  -- SHA256 for duplicate detection
  
  -- Admin review
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  approved_amount DECIMAL(10,2),  -- Can differ from requested amount
  admin_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_topup_user_id ON top_up_requests(user_id);
CREATE INDEX idx_topup_status ON top_up_requests(status);
CREATE INDEX idx_topup_file_hash ON top_up_requests(user_id, file_hash) WHERE file_hash IS NOT NULL;
```

**RLS Policies:**
```sql
-- Users see their own requests + admins see all
CREATE POLICY "topup_select" ON top_up_requests FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Users can insert their own requests
CREATE POLICY "topup_insert" ON top_up_requests FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Admins can update (approve/reject)
CREATE POLICY "topup_update" ON top_up_requests FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);
```

**Invariants:**
- `amount <= 10000` (€10k max per request, enforced by CHECK)
- `file_hash` prevents duplicate uploads (same file)
- Once `status != 'pending'`, request is immutable
- Rate limit: Max 5 requests per user per 24h (enforced in app logic)

---

### audit_logs
**Purpose:** Security audit trail (ALL sensitive operations)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Acting Context (impersonation-aware)
  actor_id UUID REFERENCES users(id),  -- Who performed the action
  target_id UUID REFERENCES users(id),  -- For whom (same as actor if no impersonation)
  impersonation_active BOOLEAN DEFAULT false,
  
  -- Legacy compatibility
  user_id UUID REFERENCES users(id),  -- Always = target_id
  user_email TEXT,
  
  -- Action details
  action TEXT NOT NULL,  -- From AUDIT_ACTIONS enum
  resource_type TEXT,  -- 'shipment', 'wallet', 'user', etc.
  resource_id TEXT,
  
  -- Metadata
  audit_metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_target ON audit_logs(target_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_impersonation ON audit_logs(impersonation_active) WHERE impersonation_active = true;
```

**RLS Policies:**
```sql
-- NO RLS policies (service role only)
-- Admin UI uses supabaseAdmin client
```

**Invariants:**
- **Append-only** (no updates, no deletes)
- If `impersonation_active = true`, then `actor_id != target_id`
- All sensitive operations MUST log:
  - Shipment create/update/delete
  - Wallet credit/debit
  - User role changes
  - Impersonation start/stop
  - Courier credential access

---

### courier_configs
**Purpose:** Courier API credentials (encrypted)

```sql
CREATE TABLE courier_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Courier details
  courier_code TEXT NOT NULL,  -- 'posteitaliane', 'gls', 'brt', etc.
  provider_id TEXT,  -- 'spediscionline', 'direct', etc.
  
  -- Credentials (encrypted)
  username TEXT,
  password_encrypted TEXT,  -- AES-256 encrypted with ENCRYPTION_KEY
  api_key TEXT,
  
  -- Session management
  session_data JSONB DEFAULT '{}',  -- Cookies, tokens, etc.
  session_expires_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_validated_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_courier_config_user ON courier_configs(user_id);
CREATE INDEX idx_courier_config_code ON courier_configs(courier_code);
CREATE UNIQUE INDEX idx_courier_config_unique ON courier_configs(user_id, courier_code, provider_id);
```

**RLS Policies:**
```sql
-- Users see their own configs + admins see all (SELECT only, no password exposure)
CREATE POLICY "courier_config_select" ON courier_configs FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

-- Only service role can insert/update (via server actions)
```

**Invariants:**
- `password_encrypted` NEVER returned to client (use server actions)
- Unique per (user_id, courier_code, provider_id)
- Session data auto-refreshed by automation service

---

### leads
**Purpose:** CRM lead management (pre-conversion users)

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Contact info
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  
  -- Lead status
  status TEXT DEFAULT 'new',  -- 'new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'
  source TEXT,  -- 'website', 'referral', 'cold_call', etc.
  
  -- Assignment
  assigned_to UUID REFERENCES users(id),
  
  -- Estimated value
  estimated_value DECIMAL(10,2),
  
  -- Notes
  notes TEXT,
  
  -- Conversion
  converted_user_id UUID REFERENCES users(id),  -- Set when status = 'won'
  converted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned ON leads(assigned_to);
CREATE INDEX idx_leads_email ON leads(email);
```

**RLS Policies:**
```sql
-- Only admins can view/manage leads
CREATE POLICY "leads_admin" ON leads FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);
```

---

### compensation_queue
**Purpose:** Failed shipment recovery (orphan cleanup)

```sql
CREATE TABLE compensation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  
  -- External shipment info
  provider_id TEXT,
  carrier TEXT,
  shipment_id_external TEXT,
  tracking_number TEXT,
  
  -- Action to take
  action TEXT NOT NULL,  -- 'DELETE', 'REFUND', 'RETRY'
  status TEXT DEFAULT 'PENDING',  -- 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'FAILED'
  
  -- Context
  original_cost DECIMAL(10,2),
  error_context JSONB DEFAULT '{}',
  
  -- Resolution
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_compensation_status ON compensation_queue(status);
CREATE INDEX idx_compensation_user ON compensation_queue(user_id);
```

**RLS Policies:**
```sql
-- Service role only (no RLS)
```

**Invariants:**
- Entries are created when shipment API succeeds but DB insert fails
- Admin dashboard shows pending items for manual resolution
- Once resolved, status = 'RESOLVED' and entry becomes read-only

---

## Database Functions (RPC)

### add_wallet_credit()
**Purpose:** Add credit to user wallet (enforces limits, creates transaction)

```sql
CREATE OR REPLACE FUNCTION add_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  MAX_SINGLE_AMOUNT CONSTANT DECIMAL(10,2) := 10000.00;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  
  IF p_amount > MAX_SINGLE_AMOUNT THEN
    RAISE EXCEPTION 'Max €10,000 per transaction. Requested: €%', p_amount;
  END IF;
  
  -- Insert transaction (trigger updates balance)
  INSERT INTO wallet_transactions (user_id, amount, type, description, created_by)
  VALUES (p_user_id, p_amount, 'deposit', p_description, p_created_by)
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### log_acting_context_audit()
**Purpose:** Write audit log with acting context (impersonation-aware)

```sql
CREATE OR REPLACE FUNCTION log_acting_context_audit(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT,
  p_actor_id UUID,
  p_target_id UUID,
  p_impersonation_active BOOLEAN,
  p_audit_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    action, resource_type, resource_id,
    actor_id, target_id, impersonation_active,
    user_id, audit_metadata
  ) VALUES (
    p_action, p_resource_type, p_resource_id,
    p_actor_id, p_target_id, p_impersonation_active,
    p_target_id, p_audit_metadata
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Common Queries

### Check wallet balance integrity
```sql
-- Find discrepancies between wallet_balance and transaction sum
SELECT 
  u.id, 
  u.email,
  u.wallet_balance AS current_balance,
  COALESCE(SUM(wt.amount), 0) AS calculated_balance,
  u.wallet_balance - COALESCE(SUM(wt.amount), 0) AS discrepancy
FROM users u
LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
GROUP BY u.id, u.email, u.wallet_balance
HAVING ABS(u.wallet_balance - COALESCE(SUM(wt.amount), 0)) > 0.01;
```

### Find orphan shipments (no user)
```sql
SELECT s.id, s.tracking_number, s.user_id
FROM shipments s
LEFT JOIN users u ON s.user_id = u.id
WHERE u.id IS NULL;
```

### Check RLS policy coverage
```sql
SELECT 
  schemaname, 
  tablename, 
  rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
ORDER BY rls_enabled, tablename;
```

---

**Document Owner:** Database Team  
**Last Updated:** December 21, 2025  
**Review Cycle:** After each migration
