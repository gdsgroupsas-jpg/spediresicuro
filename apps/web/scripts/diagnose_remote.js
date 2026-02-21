const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Load Environment Variables
console.log('--- DIAGNOSI REMOTA AVVIATA ---');
try {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
    console.log('✅ .env.local caricato');
  } else {
    console.error('❌ .env.local non trovato');
    process.exit(1);
  }
} catch (e) {
  console.error('❌ Errore lettura .env.local:', e.message);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variabili Supabase mancanti in .env.local');
  console.log('URL:', SUPABASE_URL ? 'OK' : 'MISSING');
  console.log('KEY:', SUPABASE_SERVICE_KEY ? 'OK' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runDiagnosis() {
  try {
    // 2. Test RPC Existence
    console.log('\n--- 1. TEST RPC FUNCTION (approve_top_up_request) ---');
    const dummyId = '00000000-0000-0000-0000-000000000000';
    const { data: rpcData, error: rpcError } = await supabase.rpc('approve_top_up_request', {
      p_request_id: dummyId,
      p_admin_user_id: dummyId,
      p_approved_amount: 10.0,
    });

    if (rpcError) {
      console.error('❌ RPC FALLITA. La funzione non esiste o ha problemi di permessi.');
      console.error('Errore:', rpcError);
      console.error('SOLUZIONE: rieseguire lo script SQL FIX_TOPUP_APPROVAL.sql手动.');
    } else {
      const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (result && result.error_message === 'Richiesta non trovata') {
        console.log('✅ RPC PRESENTE e RISPONDE CORRETTAMENTE (Test OK).');
      } else {
        console.log('⚠️ RPC risponde ma con dati inattesi:', result);
      }
    }

    // 3. Check Pending Requests
    console.log('\n--- 2. CONTROLLO RICHIESTE PENDING ---');
    const { data: requests, error: reqError } = await supabase
      .from('top_up_requests')
      .select('*')
      .in('status', ['pending', 'manual_review'])
      .order('created_at', { ascending: false });

    if (reqError) {
      console.error('❌ Errore lettura richieste:', reqError);
    } else {
      console.log(`Trovate ${requests.length} richieste in attesa.`);
      requests.forEach((r) => {
        console.log(
          `- ID: ${r.id} | User: ${r.user_id} | Amount: ${r.amount} | Status: ${r.status}`
        );
      });

      if (requests.length > 0) {
        const reqToApprove = requests[0];
        console.log(`\n--- 3. TENTATIVO APPROVAZIONE FORZATA (ID: ${reqToApprove.id}) ---`);

        // Fetch admin user ID (test reseller account)
        const { data: adminUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', 'testspediresicuro+postaexpress@gmail.com')
          .single();
        const adminId = adminUser ? adminUser.id : '00000000-0000-0000-0000-000000000000';

        console.log(`Approving as Admin ID: ${adminId}`);

        const { data: approveResult, error: approveError } = await supabase.rpc(
          'approve_top_up_request',
          {
            p_request_id: reqToApprove.id,
            p_admin_user_id: adminId,
            p_approved_amount: reqToApprove.amount,
          }
        );

        if (approveError) {
          console.error('❌ ERRORE APPROVAZIONE:', approveError);
        } else {
          const res = Array.isArray(approveResult) ? approveResult[0] : approveResult;
          if (res.success) {
            console.log('✅ APPROVAZIONE RIUSCITA! Il DB è stato aggiornato.');
            console.log(
              "Ora chiamiamo add_wallet_credit per completare l'opera (simulazione server action)..."
            );

            const { data: txId, error: creditError } = await supabase.rpc('add_wallet_credit', {
              p_user_id: reqToApprove.user_id,
              p_amount: reqToApprove.amount,
              p_description: `Approvazione Manuale Script #${reqToApprove.id}`,
              p_created_by: adminId,
            });

            if (creditError) console.error('❌ Errore accredito wallet:', creditError);
            else console.log('✅ WALLET ACCREDITATO. Transazione:', txId);
          } else {
            console.error('❌ Approvazione fallita logicamente:', res.error_message);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ ERRORE IMPREVISTO:', err);
  }
}

runDiagnosis();
