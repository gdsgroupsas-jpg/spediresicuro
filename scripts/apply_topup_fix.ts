
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const fixSQL = `
-- 029_add_topup_update_policy.sql
DROP POLICY IF EXISTS "Admins can update top-up requests" ON top_up_requests;

CREATE POLICY "Admins can update top-up requests" 
ON top_up_requests FOR UPDATE 
USING (
  auth.uid() IS NULL 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND (
      users.account_type IN ('admin', 'superadmin') 
      OR users.role = 'admin'
    )
  )
)
WITH CHECK (
  auth.uid() IS NULL 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND (
      users.account_type IN ('admin', 'superadmin') 
      OR users.role = 'admin'
    )
  )
);

-- 030_add_topup_approve_function.sql
CREATE OR REPLACE FUNCTION approve_top_up_request(
  p_request_id UUID,
  p_admin_user_id UUID,
  p_approved_amount DECIMAL(10,2)
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  updated_id UUID
) AS $$
DECLARE
  v_current_status TEXT;
  v_user_id UUID;
BEGIN
  SELECT status, user_id INTO v_current_status, v_user_id
  FROM top_up_requests
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Richiesta non trovata'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  IF v_current_status NOT IN ('pending', 'manual_review') THEN
    RETURN QUERY SELECT FALSE, 'Richiesta già processata'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  UPDATE top_up_requests
  SET 
    status = 'approved',
    approved_by = p_admin_user_id,
    approved_at = NOW(),
    approved_amount = p_approved_amount,
    updated_at = NOW()
  WHERE id = p_request_id
    AND status IN ('pending', 'manual_review');
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Impossibile aggiornare richiesta'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT, p_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function main() {
  console.log('🚀 Applying Top-Up Fix Migrations via RPC/REST...');
  
  try {
     // Try exec_sql via POST
     const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql: fixSQL }),
      });

      if (response.ok) {
        console.log('✅ Migrations applied successfully via exec_sql!');
      } else {
        const text = await response.text();
        console.error('❌ exec_sql failed:', response.status, text);
        console.log('ℹ️ NOTE: If exec_sql is not enabled, this is expected. We cannot apply DDL without database access.');
      }
  } catch (err) {
      console.error('❌ Unexpected error:', err);
  }
}

main();
