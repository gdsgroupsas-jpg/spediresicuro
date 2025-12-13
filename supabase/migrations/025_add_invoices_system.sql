-- ============================================
-- MIGRATION: 025_add_invoices_system.sql
-- DESCRIZIONE: Implementazione sistema finanziario (Fatture e Incassi)
-- DATA: 2025-01 (Auto AI Agent)
-- ============================================

-- ============================================
-- 1. ENUMS
-- ============================================

-- Status fattura
DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM (
        'draft',      -- Bozza (modificabile)
        'issued',     -- Emessa (definitiva, inviata a SDI/Cliente)
        'paid',       -- Pagata interamente
        'overdue',    -- Scaduta e non pagata
        'cancelled',  -- Annullata (Nota di credito necessaria se era issued)
        'refunded'    -- Rimborsata
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Status pagamento
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'pending',
        'authorized',
        'captured',
        'failed',
        'refunded',
        'chargeback'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Metodo pagamento
DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'credit_card',
        'paypal',
        'bank_transfer', -- Bonifico
        'wallet',        -- Credito prepagato interno
        'cash'           -- Contanti (raro, ma possibile per ritiri in sede)
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ============================================
-- 2. TABELLA: invoices (Testata Fattura)
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Dati documento
    invoice_number TEXT, -- Progressivo annuale (es. "2025-0001"). NULL se draft.
    invoice_date DATE,   -- Data emissione. NULL se draft.
    due_date DATE,       -- Data scadenza pagamento
    
    status invoice_status DEFAULT 'draft',
    
    -- Dati economici
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'EUR',
    
    amount_paid DECIMAL(10,2) DEFAULT 0, -- Quanto è stato pagato finora
    
    -- Dati Cliente (Snapshot al momento emissione)
    recipient_name TEXT,
    recipient_vat_number TEXT, -- P.IVA o CF
    recipient_sdi_code TEXT,
    recipient_pec TEXT,
    recipient_address TEXT,
    recipient_city TEXT,
    recipient_province TEXT,
    recipient_zip TEXT,
    recipient_country TEXT DEFAULT 'IT',
    
    -- PDF Link
    pdf_url TEXT, -- URL su Storage
    
    -- Note
    notes TEXT,
    internal_notes TEXT,
    
    -- Metadati
    created_by UUID REFERENCES users(id), -- Chi ha creato la bozza (es. admin)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
-- Unicità numero fattura (solo per fatture emesse, non bozze)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_number ON invoices(invoice_number) WHERE invoice_number IS NOT NULL;


-- ============================================
-- 3. TABELLA: invoice_items (Righe Fattura)
-- ============================================

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Collegamento opzionale a spedizione (se la riga si riferisce a una spedizione)
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 22.00, -- Aliquota IVA %
    
    total DECIMAL(10,2) NOT NULL, -- (quantity * unit_price)
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_shipment ON invoice_items(shipment_id);


-- ============================================
-- 4. FUNZIONE: Calcolo Totali Fattura
-- ============================================

CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
    -- Aggiorna la fattura padre ricalcolando i totali dalle righe
    UPDATE invoices
    SET 
        subtotal = (SELECT COALESCE(SUM(total), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id),
        -- Semplificazione IVA: assumiamo calcolo approssimativo per ora, o somma precisa se avessimo campo tax_amount su items
        -- Per ora calcoliamo IVA sul totale imponibile * 0.22 (default) se non specificato diversamente
        -- In produzione servirebbe logica più complessa per aliquote miste
        tax_amount = (SELECT COALESCE(SUM(total * (tax_rate/100)), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id),
        
        total = (SELECT COALESCE(SUM(total * (1 + tax_rate/100)), 0) FROM invoice_items WHERE invoice_id = NEW.invoice_id),
        updated_at = NOW()
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON invoice_items;
CREATE TRIGGER trigger_update_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW
EXECUTE FUNCTION update_invoice_totals();


-- ============================================
-- 5. FUNZIONE: Generazione Numero Fattura Progressivo
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    current_year TEXT;
    next_seq INTEGER;
BEGIN
    -- Se lo stato passa a 'issued' e non ha ancora un numero
    IF NEW.status = 'issued' AND OLD.status != 'issued' AND NEW.invoice_number IS NULL THEN
        current_year := TO_CHAR(NOW(), 'YYYY');
        
        -- Cerca l'ultimo numero per l'anno corrente (formato YYYY-XXXX)
        SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 6) AS INTEGER)), 0) + 1
        INTO next_seq
        FROM invoices
        WHERE invoice_number LIKE current_year || '-%';
        
        -- Assegna il nuovo numero pad 4 (es. 2025-0001)
        NEW.invoice_number := current_year || '-' || LPAD(next_seq::TEXT, 4, '0');
        NEW.invoice_date := COALESCE(NEW.invoice_date, CURRENT_DATE);
        
        -- Se non c'è scadenza, imposta default 30gg
        NEW.due_date := COALESCE(NEW.due_date, CURRENT_DATE + INTERVAL '30 days');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON invoices;
CREATE TRIGGER trigger_generate_invoice_number
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION generate_invoice_number();


-- ============================================
-- 6. RLS POLICIES (Sicurezza)
-- ============================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Policy Select: Admin/Superadmin vedono tutto, Utenti vedono solo le proprie
CREATE POLICY invoices_select_policy ON invoices
FOR SELECT USING (
    -- Admin
    (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'service_role')) 
    OR 
    -- Utente proprietario
    (user_id = auth.uid())
    OR
    -- Reseller vede fatture dei sub-user (usando colonna is_reseller aggiunta nella migrazione 019)
    (
       EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (u.role = 'admin' OR u.is_reseller = true))
    )
);

-- Policy Insert/Update: Solo Admin/System possono creare/modificare fatture 
-- (L'utente non si autodichiara fatture)
CREATE POLICY invoices_modify_policy ON invoices
FOR ALL USING (
    (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'service_role'))
);

-- Policy Items: Stessa logica della fattura padre
CREATE POLICY invoice_items_select_policy ON invoice_items
FOR SELECT USING (
    EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND (
        (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'service_role')) 
        OR 
        (i.user_id = auth.uid())
    ))
);

-- ============================================
-- 7. NOTIFICHE (Commenti)
-- ============================================
COMMENT ON TABLE invoices IS 'Sistema Fatturazione interno. Sostituisce i PDF volanti.';
COMMENT ON COLUMN invoices.invoice_number IS 'Progressivo annuale YYYY-XXXX generato automaticamente all''emissione.';
