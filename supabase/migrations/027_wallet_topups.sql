-- Create table for AI Bank Transfer Requests
CREATE TABLE IF NOT EXISTS top_up_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount DECIMAL(10, 2), -- Amount detected or declared
    file_url TEXT NOT NULL, -- Path to PDF/Image in Storage
    extracted_data JSONB, -- Data extracted by Gemini (iban, trn, date, etc.)
    ai_confidence FLOAT, -- Confidence score from AI (0.0 - 1.0)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'manual_review')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Associate table with RLS
ALTER TABLE top_up_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own top-up requests" 
ON top_up_requests FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create top-up requests" 
ON top_up_requests FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create table for Card Payment Transactions (Intesa XPay)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    
    amount_credit DECIMAL(10, 2) NOT NULL, -- The amount added to wallet
    amount_fee DECIMAL(10, 2) NOT NULL,    -- The commission paid by user
    amount_total DECIMAL(10, 2) NOT NULL,  -- Total charged (credit + fee)
    
    provider TEXT DEFAULT 'intesa' CHECK (provider IN ('intesa', 'stripe', 'paypal')),
    provider_tx_id TEXT, -- External Transaction ID (TRN/CRO from Bank)
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'success', 'failed', 'cancelled')),
    
    metadata JSONB, -- Extra info from gateway
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Associate table with RLS
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment transactions" 
ON payment_transactions FOR SELECT 
USING (auth.uid() = user_id);

-- Create Storage Bucket for Receipts if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Users can upload to their own folder
CREATE POLICY "Users can upload receipts" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'receipts' AND 
    auth.uid() = owner
);

CREATE POLICY "Users can read own receipts" 
ON storage.objects FOR SELECT 
USING (
    bucket_id = 'receipts' AND 
    auth.uid() = owner
);
