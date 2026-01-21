/**
 * Script temporaneo per generare hash bcrypt per utente di test
 */

const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'testpassword123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash bcrypt:', hash);
  console.log('\n--- Copia questo hash nello script SQL ---');
}

generateHash().catch(console.error);
