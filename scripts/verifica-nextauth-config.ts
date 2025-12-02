/**
 * Script di Verifica Configurazione NextAuth
 * 
 * Verifica che tutte le variabili d'ambiente necessarie per NextAuth siano configurate correttamente.
 */

const requiredVars = {
  NEXTAUTH_URL: {
    required: true,
    description: 'URL base per NextAuth (es: https://spediresicuro.vercel.app)',
    validate: (value: string) => {
      if (!value) return 'Non configurato';
      if (value.includes('localhost') && process.env.NODE_ENV === 'production') {
        return '⚠️ Non deve essere localhost in produzione!';
      }
      if (!value.startsWith('http')) {
        return '⚠️ Deve iniziare con http:// o https://';
      }
      return '✅ OK';
    },
  },
  NEXTAUTH_SECRET: {
    required: true,
    description: 'Chiave segreta per NextAuth (almeno 32 caratteri)',
    validate: (value: string) => {
      if (!value) return '❌ Non configurato - OBBLIGATORIO!';
      if (value.length < 32) {
        return `⚠️ Troppo corta (${value.length} caratteri, minimo 32)`;
      }
      if (value === 'dev-secret-not-for-production-change-in-env-local') {
        return '⚠️ Usando secret di sviluppo - genera uno nuovo per produzione!';
      }
      return '✅ OK';
    },
  },
  GOOGLE_CLIENT_ID: {
    required: false,
    description: 'Google OAuth Client ID',
    validate: (value: string) => {
      if (!value) return '⚠️ Non configurato (OAuth Google non funzionerà)';
      if (!value.includes('.apps.googleusercontent.com')) {
        return '⚠️ Formato non valido (dovrebbe contenere .apps.googleusercontent.com)';
      }
      return '✅ OK';
    },
  },
  GOOGLE_CLIENT_SECRET: {
    required: false,
    description: 'Google OAuth Client Secret',
    validate: (value: string) => {
      if (!value) return '⚠️ Non configurato (OAuth Google non funzionerà)';
      if (value.length < 20) {
        return '⚠️ Sembra troppo corto';
      }
      return '✅ OK';
    },
  },
};

console.log('🔍 Verifica Configurazione NextAuth\n');
console.log('=' .repeat(60));
console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
console.log(`Vercel URL: ${process.env.VERCEL_URL || 'N/A'}`);
console.log('=' .repeat(60));
console.log('');

let hasErrors = false;
let hasWarnings = false;

for (const [varName, config] of Object.entries(requiredVars)) {
  const value = process.env[varName];
  const result = config.validate(value || '');
  
  const status = result.includes('✅') ? '✅' : result.includes('❌') ? '❌' : '⚠️';
  const isError = result.includes('❌');
  const isWarning = result.includes('⚠️');
  
  if (isError) hasErrors = true;
  if (isWarning) hasWarnings = true;
  
  console.log(`${status} ${varName}`);
  console.log(`   ${config.description}`);
  if (value) {
    // Mostra solo i primi e ultimi caratteri per sicurezza
    const masked = value.length > 20 
      ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}`
      : '***';
    console.log(`   Valore: ${masked} (${value.length} caratteri)`);
  } else {
    console.log(`   Valore: NON CONFIGURATO`);
  }
  console.log(`   Risultato: ${result}`);
  console.log('');
}

console.log('=' .repeat(60));

if (hasErrors) {
  console.log('❌ ERRORE: Configurazione incompleta!');
  console.log('   Risolvi gli errori sopra prima di procedere.');
  process.exit(1);
} else if (hasWarnings) {
  console.log('⚠️  ATTENZIONE: Ci sono alcuni warning.');
  console.log('   La configurazione potrebbe funzionare, ma verifica i warning sopra.');
  process.exit(0);
} else {
  console.log('✅ Configurazione NextAuth completa e valida!');
  process.exit(0);
}

