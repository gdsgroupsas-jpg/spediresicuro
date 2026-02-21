/**
 * Script per generare hash bcrypt e aggiornare lo script SQL
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const password = 'testpassword123';
const hash = bcrypt.hashSync(password, 10);

console.log('Hash generato:', hash);
console.log('Verifica hash:', bcrypt.compareSync(password, hash) ? '✅ Valido' : '❌ Non valido');

// Leggi lo script SQL
const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '022_create_test_user.sql');
let sqlContent = fs.readFileSync(sqlPath, 'utf8');

// Sostituisci l'hash placeholder con quello reale
const oldHashPattern = /\$2a\$10\$[^']+/;
sqlContent = sqlContent.replace(oldHashPattern, hash);

// Salva lo script aggiornato
fs.writeFileSync(sqlPath, sqlContent);

console.log('✅ Script SQL aggiornato con hash valido!');
console.log('   File:', sqlPath);
