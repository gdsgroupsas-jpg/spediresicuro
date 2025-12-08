/**
 * Script per verificare che l'utente di test esista e le credenziali siano corrette
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variabili d\'ambiente non configurate');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyTestUser() {
  const testEmail = 'test@example.com';
  const testPassword = 'testpassword123';
  
  console.log('🔍 Verifica utente di test...\n');
  
  // Cerca l'utente
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', testEmail)
    .single();
  
  if (error || !user) {
    console.error('❌ Utente non trovato nel database!');
    console.error('   Esegui lo script SQL per creare l\'utente:');
    console.error('   - CREATE_TEST_USER.sql');
    console.error('   - supabase/migrations/022_create_test_user.sql');
    process.exit(1);
  }
  
  console.log('✅ Utente trovato:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Name:', user.name);
  console.log('   Role:', user.role);
  console.log('   Provider:', user.provider);
  console.log('   Password hash presente:', !!user.password);
  console.log('');
  
  // Verifica password
  if (!user.password) {
    console.error('❌ Password non configurata per l\'utente!');
    console.error('   L\'utente esiste ma non ha password hash.');
    process.exit(1);
  }
  
  // Verifica che la password corrisponda
  const passwordMatch = await bcrypt.compare(testPassword, user.password);
  
  if (passwordMatch) {
    console.log('✅ Password corretta!');
    console.log('   La password "testpassword123" corrisponde all\'hash nel database.');
  } else {
    console.error('❌ Password NON corrisponde!');
    console.error('   La password "testpassword123" NON corrisponde all\'hash nel database.');
    console.error('');
    console.error('   Soluzione:');
    console.error('   1. Genera nuovo hash: node -e "const bc=require(\'bcryptjs\');console.log(bc.hashSync(\'testpassword123\',10))"');
    console.error('   2. Aggiorna l\'utente in Supabase con il nuovo hash');
    process.exit(1);
  }
  
  console.log('');
  console.log('✅ Tutto OK! L\'utente di test è configurato correttamente.');
  console.log('   Credenziali:');
  console.log('   - Email: test@example.com');
  console.log('   - Password: testpassword123');
}

verifyTestUser().catch((error) => {
  console.error('❌ Errore:', error);
  process.exit(1);
});

