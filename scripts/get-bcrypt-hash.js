const bcrypt = require('bcryptjs');
const fs = require('fs');

const password = 'testpassword123';

// Genera hash sincrono (per script)
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('Hash generato:', hash);

// Salva in un file temporaneo
fs.writeFileSync('temp-hash.txt', hash);
console.log('Hash salvato in temp-hash.txt');

