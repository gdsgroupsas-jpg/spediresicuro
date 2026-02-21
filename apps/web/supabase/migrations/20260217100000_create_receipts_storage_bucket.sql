-- Crea il bucket storage "receipts" per le ricevute bonifico bancario
-- Usato da uploadBankTransferReceipt() in app/actions/wallet.ts

-- Crea bucket solo se non esiste (idempotente)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: solo utenti autenticati possono caricare nella propria cartella
-- (Il server usa supabaseAdmin che bypassa RLS, ma aggiungiamo policy per sicurezza)

CREATE POLICY "Users can upload receipts to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin/superadmin possono vedere tutte le ricevute
CREATE POLICY "Admins can view all receipts"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND account_type IN ('superadmin', 'admin')
    )
  );
