/**
 * Script Rapido per Verificare Configurazione OAuth
 *
 * Esegui con: node scripts/verifica-oauth-rapida.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifica Configurazione Google OAuth\n');
console.log('='.repeat(50));
console.log();

// Verifica se .env.local esiste
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

let envContent = '';

if (fs.existsSync(envLocalPath)) {
  console.log('✅ File .env.local trovato');
  envContent = fs.readFileSync(envLocalPath, 'utf8');
} else if (fs.existsSync(envPath)) {
  console.log('⚠️  File .env.local NON trovato, ma .env esiste');
  console.log('   ⚠️  Next.js legge .env.local, non .env!');
  envContent = fs.readFileSync(envPath, 'utf8');
} else {
  console.log('❌ File .env.local NON trovato!');
  console.log();
  console.log('📝 COSA FARE:');
  console.log('1. Crea un file chiamato .env.local nella root del progetto');
  console.log('2. Aggiungi le variabili Google OAuth (vedi ESEMPIO_ENV_LOCAL.txt)');
  console.log('3. Riavvia il server: npm run dev');
  process.exit(1);
}

console.log();

// Verifica variabili
const variabili = {
  GOOGLE_CLIENT_ID: {
    trovata: false,
    commentata: false,
    valore: null,
  },
  GOOGLE_CLIENT_SECRET: {
    trovata: false,
    commentata: false,
    valore: null,
  },
  NEXTAUTH_URL: {
    trovata: false,
    commentata: false,
    valore: null,
  },
  NEXTAUTH_SECRET: {
    trovata: false,
    commentata: false,
    valore: null,
  },
};

// Analizza il file
const righe = envContent.split('\n');
righe.forEach((riga, index) => {
  const rigaPulita = riga.trim();

  // Salta righe vuote
  if (!rigaPulita) return;

  // Verifica ogni variabile
  Object.keys(variabili).forEach((varName) => {
    // Cerca la variabile (con o senza #)
    if (rigaPulita.includes(varName + '=') || rigaPulita.includes(varName + ' =')) {
      const commentata = rigaPulita.startsWith('#');
      const match = rigaPulita.match(new RegExp(`${varName}\\s*=\\s*(.+)`));

      if (match) {
        variabili[varName].trovata = true;
        variabili[varName].commentata = commentata;
        variabili[varName].valore = match[1].trim();
        variabili[varName].riga = index + 1;
      }
    }
  });
});

// Mostra risultati
let errori = 0;
let warning = 0;

console.log('📋 Verifica Variabili:\n');

Object.entries(variabili).forEach(([nome, info]) => {
  if (!info.trovata) {
    console.log(`❌ ${nome}: NON TROVATA`);
    console.log(`   Aggiungi in .env.local: ${nome}=valore`);
    errori++;
  } else if (info.commentata) {
    console.log(`⚠️  ${nome}: COMMENTATA (ha # davanti)`);
    console.log(`   Riga ${info.riga}: Rimuovi il # per abilitarla`);
    warning++;
  } else {
    const valore = info.valore || '';
    const valido =
      valore &&
      !valore.includes('your-') &&
      !valore.includes('xxxxx') &&
      !valore.includes('placeholder') &&
      valore.length > 5;

    if (!valido) {
      console.log(`⚠️  ${nome}: VALORE NON VALIDO`);
      console.log(`   Riga ${info.riga}: Sostituisci il placeholder con un valore reale`);
      console.log(`   Valore attuale: ${valore.substring(0, 50)}...`);
      warning++;
    } else {
      // Mostra solo i primi e ultimi caratteri per sicurezza
      const masked =
        valore.length > 20
          ? `${valore.substring(0, 10)}...${valore.substring(valore.length - 5)}`
          : '***';
      console.log(`✅ ${nome}: Configurata (${masked})`);
    }
  }
  console.log();
});

// Verifica specifiche per Google OAuth
console.log('\n🔍 Verifica Specifica Google OAuth:\n');

if (variabili.GOOGLE_CLIENT_ID.trovata && !variabili.GOOGLE_CLIENT_ID.commentata) {
  const clientId = variabili.GOOGLE_CLIENT_ID.valore || '';
  if (!clientId.includes('.apps.googleusercontent.com')) {
    console.log('⚠️  GOOGLE_CLIENT_ID non sembra valido');
    console.log('   Dovrebbe finire con: .apps.googleusercontent.com');
    warning++;
  } else {
    console.log('✅ GOOGLE_CLIENT_ID ha formato corretto');
  }
} else {
  console.log('❌ GOOGLE_CLIENT_ID non configurata');
  errori++;
}

if (variabili.GOOGLE_CLIENT_SECRET.trovata && !variabili.GOOGLE_CLIENT_SECRET.commentata) {
  const secret = variabili.GOOGLE_CLIENT_SECRET.valore || '';
  if (!secret.startsWith('GOCSPX-') && secret.length < 10) {
    console.log('⚠️  GOOGLE_CLIENT_SECRET potrebbe non essere valido');
    console.log('   Dovrebbe iniziare con: GOCSPX-');
    warning++;
  } else {
    console.log('✅ GOOGLE_CLIENT_SECRET ha formato corretto');
  }
} else {
  console.log('❌ GOOGLE_CLIENT_SECRET non configurata');
  errori++;
}

// Verifica NextAuth
console.log('\n🔍 Verifica NextAuth:\n');

if (!variabili.NEXTAUTH_URL.trovata || variabili.NEXTAUTH_URL.commentata) {
  console.log('❌ NEXTAUTH_URL non configurata');
  console.log('   Aggiungi: NEXTAUTH_URL=http://localhost:3000');
  errori++;
} else {
  const url = variabili.NEXTAUTH_URL.valore || '';
  if (!url.includes('localhost:3000') && !url.includes('127.0.0.1:3000')) {
    console.log('⚠️  NEXTAUTH_URL non punta a localhost:3000');
    console.log(`   Valore attuale: ${url}`);
    console.log('   Per sviluppo locale, usa: http://localhost:3000');
    warning++;
  } else {
    console.log('✅ NEXTAUTH_URL configurato correttamente');
  }
}

if (!variabili.NEXTAUTH_SECRET.trovata || variabili.NEXTAUTH_SECRET.commentata) {
  console.log('❌ NEXTAUTH_SECRET non configurata');
  console.log(
    "   Genera con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  );
  errori++;
} else {
  const secret = variabili.NEXTAUTH_SECRET.valore || '';
  if (secret.length < 32) {
    console.log('⚠️  NEXTAUTH_SECRET sembra troppo corto');
    console.log('   Consigliato: almeno 32 caratteri');
    warning++;
  } else {
    console.log('✅ NEXTAUTH_SECRET configurato');
  }
}

// Riepilogo
console.log('\n' + '='.repeat(50));
console.log('📊 RIEPILOGO:\n');

if (errori === 0 && warning === 0) {
  console.log('✅ Tutto configurato correttamente!');
  console.log();
  console.log('⚠️  IMPORTANTE: Se vedi ancora l\'errore "Configuration":');
  console.log('   1. Riavvia il server: Ctrl+C e poi npm run dev');
  console.log('   2. Verifica che il server mostri: "✅ Google OAuth: Configurato"');
  console.log('   3. Controlla la console del browser per altri errori');
  process.exit(0);
} else {
  if (errori > 0) {
    console.log(`❌ ${errori} errore/i critico/i trovato/i`);
    console.log('   ⚠️  Google OAuth NON funzionerà senza queste variabili!\n');
  }
  if (warning > 0) {
    console.log(`⚠️  ${warning} avviso/i trovato/i\n`);
  }

  console.log('📝 PROSSIMI PASSI:');
  console.log('1. Apri il file .env.local');
  console.log('2. Correggi gli errori indicati sopra');
  console.log('3. Assicurati di NON avere # davanti alle variabili OAuth');
  console.log('4. Salva il file');
  console.log('5. Riavvia il server: npm run dev');
  console.log();
  console.log('💡 Guida completa: vedi FIX_GOOGLE_OAUTH_LOCALE.md');
  process.exit(errori > 0 ? 1 : 0);
}
