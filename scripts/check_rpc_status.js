
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env.local manually
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
} catch (e) {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkRPC() {
  console.log('Testing RPC call to approve_top_up_request...');
  // Use a random UUID. If function exists, it should return "Richiesta non trovata" (success=false)
  // If function does not exist, it will throw 404 or similar.
  const dumpUuid = '00000000-0000-0000-0000-000000000000';
  
  const { data, error } = await supabase.rpc('approve_top_up_request', {
    p_request_id: dumpUuid,
    p_admin_user_id: dumpUuid,
    p_approved_amount: 10.00
  });

  if (error) {
    console.error('Result: RPC FAILED');
    console.error('Error:', error);
    // Code 42883 = undefined_function (Postgres)
    // Code 404 from REST API = not found
  } else {
    console.log('Result: RPC CALLED SUCCESSFULLY');
    console.log('Response:', data);
    
    // Check if response validates our logic
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.error_message === 'Richiesta non trovata') {
        console.log('✅ Function logic is active and working (returned expected "Not Found" logic).');
    } else {
        console.log('⚠️ Function returned unexpected data:', row);
    }
  }
}

checkRPC();
