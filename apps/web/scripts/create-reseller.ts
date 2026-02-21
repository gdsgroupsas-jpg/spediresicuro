/**
 * Script: Crea Reseller
 *
 * Crea un nuovo reseller con account_type='reseller', is_reseller=true, reseller_role='admin'
 *
 * Uso:
 *   npx tsx scripts/create-reseller.ts <email> <password> <name> [initialCredit]
 *
 * Esempio:
 *   npx tsx scripts/create-reseller.ts testspediresicuro+01@gmail.com 12345678 "Test Reseller 01" 100
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Carica variabili ambiente
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variabili ambiente mancanti:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createReseller(
  email: string,
  password: string,
  name: string,
  initialCredit: number = 0
) {
  console.log('🏪 Creazione reseller...');
  console.log('   Email:', email);
  console.log('   Nome:', name);
  console.log('   Credito iniziale:', initialCredit, '€');
  console.log('');

  const emailLower = email.toLowerCase().trim();

  // 1. Verifica se l'email esiste già
  console.log('🔍 Verifica email esistente...');
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', emailLower)
    .single();

  if (existingUser) {
    console.log('⚠️  Utente già esistente!');
    console.log('   ID:', existingUser.id);
    console.log('   Email:', existingUser.email);
    console.log('');
    console.log('✅ Utente trovato, non necessario crearlo');
    return;
  }

  // Verifica in auth.users
  const {
    data: { users: existingAuthUsers },
  } = await supabase.auth.admin.listUsers();
  const existingAuthUser = existingAuthUsers?.find(
    (u: any) => u.email?.toLowerCase() === emailLower
  );

  if (existingAuthUser) {
    console.log('⚠️  Utente già esistente in Supabase Auth!');
    console.log('   ID:', existingAuthUser.id);
    console.log('');
    console.log('✅ Utente trovato, non necessario crearlo');
    return;
  }

  console.log('✅ Email disponibile');
  console.log('');

  // 2. Crea utente in Supabase Auth
  console.log('🔐 Creazione utente in Supabase Auth...');
  const { data: authUserData, error: authError } = await supabase.auth.admin.createUser({
    email: emailLower,
    password: password,
    email_confirm: true, // Conferma email automaticamente
    user_metadata: {
      name: name.trim(),
    },
    app_metadata: {
      role: 'user',
      account_type: 'reseller',
      provider: 'credentials',
    },
  });

  if (authError || !authUserData?.user) {
    console.error('❌ Errore creazione utente in auth.users:', authError?.message);
    process.exit(1);
  }

  const authUserId = authUserData.user.id;
  console.log('✅ Utente creato in auth.users:', authUserId);
  console.log('');

  // 3. Crea record in public.users
  console.log('💾 Creazione record in public.users...');
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert([
      {
        id: authUserId, // ⚠️ CRITICO: Usa ID di auth come ID anche in public.users
        email: emailLower,
        name: name.trim(),
        password: null, // Password gestita da Supabase Auth
        account_type: 'reseller', // ⚠️ IMPORTANTE: account_type='reseller'
        is_reseller: true, // Flag reseller attivo
        reseller_role: 'admin', // ⚠️ IMPORTANTE: Automaticamente admin
        wallet_balance: initialCredit || 0,
        provider: 'credentials',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single();

  if (createError) {
    console.error('❌ Errore creazione record in public.users:', createError.message);

    // Rollback: elimina da auth.users
    console.log('🔄 Rollback: eliminazione utente da auth.users...');
    await supabase.auth.admin.deleteUser(authUserId);

    process.exit(1);
  }

  const userId = newUser.id;
  console.log('✅ Record creato in public.users:', userId);
  console.log('');

  // 4. Se c'è credito iniziale, crea transazione wallet
  if (initialCredit && initialCredit > 0) {
    console.log('💰 Creazione transazione wallet...');
    const { error: walletError } = await supabase.from('wallet_transactions').insert([
      {
        user_id: userId,
        amount: initialCredit,
        type: 'admin_gift',
        description: 'Credito iniziale alla creazione account reseller',
        created_by: userId, // Usa userId stesso come created_by per script
      },
    ]);

    if (walletError) {
      console.warn('⚠️  Errore creazione transazione wallet (non critico):', walletError.message);
    } else {
      console.log('✅ Transazione wallet creata');
    }
    console.log('');
  }

  console.log('✅ Reseller creato con successo!');
  console.log('');
  console.log('📋 Dettagli account:');
  console.log('   ID:', userId);
  console.log('   Email:', emailLower);
  console.log('   Nome:', name);
  console.log('   Account Type: reseller');
  console.log('   Is Reseller: true');
  console.log('   Reseller Role: admin');
  console.log('   Wallet Balance:', initialCredit, '€');
  console.log('');
  console.log('🔑 Credenziali:');
  console.log('   Email:', emailLower);
  console.log('   Password:', password);
  console.log('');
  console.log("✅ L'utente può ora fare login con queste credenziali");
}

// Main
const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] || 'Test Reseller';
const initialCredit = parseFloat(process.argv[5]) || 0;

if (!email || !password) {
  console.error(
    '❌ Uso: npx tsx scripts/create-reseller.ts <email> <password> [name] [initialCredit]'
  );
  console.error('');
  console.error('Esempio:');
  console.error(
    '   npx tsx scripts/create-reseller.ts testspediresicuro+01@gmail.com 12345678 "Test Reseller 01" 100'
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error('❌ Password troppo corta (minimo 8 caratteri)');
  process.exit(1);
}

createReseller(email, password, name, initialCredit)
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  });
