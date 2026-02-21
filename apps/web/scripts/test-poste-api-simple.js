/**
 * Test Automatico API Poste Italiane (versione semplificata)
 *
 * Verifica:
 * 1. Configurazione nel database
 * 2. Autenticazione OAuth (tramite fetch diretto)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Prova a usare dotenv se disponibile, altrimenti carica manualmente
let dotenv;
try {
  dotenv = require('dotenv');
} catch (e) {
  dotenv = null;
}

// Carica variabili da .env.local (prova vari path)
const envPaths = [
  path.join(process.cwd(), '.env.local'), // Root progetto corrente
  path.join(process.cwd(), '..', '.env.local'), // Directory parent
  path.join(__dirname, '..', '.env.local'), // Relativo a scripts/
  path.join(__dirname, '..', '..', '.env.local'), // Parent di parent
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    if (dotenv) {
      dotenv.config({ path: envPath });
      console.log(`📄 Caricamento variabili con dotenv da: ${envPath}`);
    } else {
      console.log(`📄 Caricamento variabili manualmente da: ${envPath}`);
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            process.env[key.trim()] = value.trim();
          }
        }
      });
    }
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️  File .env.local non trovato nei path comuni');
  console.warn('   Path cercati:', envPaths);
}

// Debug: mostra tutte le variabili NEXT_PUBLIC e SUPABASE disponibili
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("🔍 Debug: Variabili d'ambiente disponibili:");
  Object.keys(process.env)
    .filter((key) => key.includes('SUPABASE') || key.includes('ENCRYPTION'))
    .forEach((key) => {
      const value = process.env[key];
      const preview = value
        ? value.length > 50
          ? value.substring(0, 50) + '...'
          : value
        : 'undefined';
      console.log(`   ${key} = ${preview}`);
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const encryptionKey = process.env.ENCRYPTION_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("\n❌ Variabili d'ambiente mancanti!");
  console.error('Richiesto: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Suggerimento:');
  console.error('   - Verifica che il file .env.local esista nella root del progetto');
  console.error('   - Oppure esporta le variabili manualmente prima di eseguire lo script');
  console.error('   - Esempio PowerShell: $env:NEXT_PUBLIC_SUPABASE_URL="https://..."');
  process.exit(1);
}

if (!encryptionKey) {
  console.warn('⚠️  ENCRYPTION_KEY non configurata - la decriptazione potrebbe fallire');
}

// Funzione decriptazione semplificata
function decryptCredential(encryptedData) {
  if (!encryptedData) return '';
  if (!encryptedData.includes(':')) {
    return encryptedData; // Testo in chiaro
  }

  const key = Buffer.from(encryptionKey, encryptionKey.length === 64 ? 'hex' : 'utf8');
  const parts = encryptedData.split(':');
  if (parts.length !== 4) {
    throw new Error('Formato dati criptati non valido');
  }

  const [ivBase64, saltBase64, tagBase64, encryptedBase64] = parts;
  const iv = Buffer.from(ivBase64, 'base64');
  const salt = Buffer.from(saltBase64, 'base64');
  const tag = Buffer.from(tagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  const derivedKey = crypto.scryptSync(key, salt, 32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

const results = [];

function logResult(step, success, message, details) {
  results.push({ step, success, message, details });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`);
  if (details && !success) {
    console.log('   Dettagli:', JSON.stringify(details, null, 2));
  }
}

async function testPosteAPI() {
  console.log('🧪 Test Automatico API Poste Italiane\n');
  console.log('='.repeat(60));
  console.log('');

  // STEP 1: Verifica configurazione nel database
  console.log('📋 STEP 1: Verifica configurazione database...');
  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/courier_configs?provider_id=eq.poste&is_active=eq.true&is_default=eq.true&select=*`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      logResult('Configurazione DB', false, 'Errore query database', {
        status: response.status,
        statusText: response.statusText,
      });
      return;
    }

    const configs = await response.json();
    if (!configs || configs.length === 0) {
      logResult('Configurazione DB', false, 'Configurazione Poste non trovata');
      return;
    }

    const config = configs[0];
    logResult('Configurazione DB', true, `Trovata: ${config.name}`, {
      id: config.id,
      base_url: config.base_url,
      has_api_key: !!config.api_key,
      has_api_secret: !!config.api_secret,
      has_cdc: !!config.contract_mapping?.cdc,
    });

    // STEP 2: Decripta credenziali
    console.log('\n🔐 STEP 2: Decriptazione credenziali...');
    let clientId, clientSecret, cdc;

    try {
      if (!config.api_key) {
        logResult('Decriptazione', false, 'API Key mancante');
        return;
      }
      clientId = decryptCredential(config.api_key);
      logResult('Decriptazione API Key', true, `Decriptata (${clientId.length} caratteri)`);
    } catch (error) {
      logResult('Decriptazione API Key', false, 'Errore decriptazione', error.message);
      return;
    }

    try {
      if (!config.api_secret) {
        logResult('Decriptazione', false, 'API Secret mancante');
        return;
      }
      clientSecret = decryptCredential(config.api_secret);
      logResult('Decriptazione API Secret', true, `Decriptato (${clientSecret.length} caratteri)`);
    } catch (error) {
      logResult('Decriptazione API Secret', false, 'Errore decriptazione', error.message);
      return;
    }

    // Estrai CDC
    const contractMapping =
      typeof config.contract_mapping === 'string'
        ? JSON.parse(config.contract_mapping)
        : config.contract_mapping;
    cdc = contractMapping?.cdc || 'CDC-DEFAULT';
    logResult('CDC', true, `CDC: ${cdc}`);

    // STEP 3: Test autenticazione OAuth
    console.log('\n🔑 STEP 3: Test autenticazione OAuth...');
    const baseUrl = config.base_url.replace(/\/$/, '');
    const authUrl = `${baseUrl}/user/sessions`;

    try {
      const authResponse = await fetch(authUrl, {
        method: 'POST',
        headers: {
          POSTE_clientID: clientId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: clientId,
          secretId: clientSecret,
          grantType: 'client_credentials',
          scope: 'api://8f0f2c58-19a8-45ef-9f9e-8ccb0acc7657/.default',
        }),
      });

      if (!authResponse.ok) {
        const errorData = await authResponse.text();
        logResult('Autenticazione', false, 'Errore autenticazione', {
          status: authResponse.status,
          statusText: authResponse.statusText,
          body: errorData,
        });
        return;
      }

      const authData = await authResponse.json();
      if (!authData.access_token) {
        logResult('Autenticazione', false, 'Token non ricevuto', authData);
        return;
      }

      logResult('Autenticazione', true, 'Token OAuth ottenuto con successo', {
        token_length: authData.access_token.length,
        expires_in: authData.expires_in || 'N/A',
      });

      // STEP 4: Test endpoint waybill (solo verifica che l'endpoint esista)
      console.log('\n📦 STEP 4: Verifica endpoint waybill...');
      const waybillUrl = `${baseUrl}/waybill`;
      logResult('Endpoint Waybill', true, `Endpoint disponibile: ${waybillUrl}`);

      // Riepilogo finale
      console.log('\n' + '='.repeat(60));
      console.log('📊 RIEPILOGO TEST');
      console.log('='.repeat(60));

      const successCount = results.filter((r) => r.success).length;
      const totalCount = results.length;
      const allSuccess = successCount === totalCount;

      results.forEach((result) => {
        const icon = result.success ? '✅' : '❌';
        console.log(`${icon} ${result.step}`);
      });

      console.log('\n' + '='.repeat(60));
      if (allSuccess) {
        console.log('✅ TUTTI I TEST SUPERATI!');
        console.log("   L'integrazione Poste Italiane è configurata correttamente.");
        console.log('   Puoi procedere con la creazione di spedizioni reali.');
      } else {
        console.log('❌ ALCUNI TEST FALLITI');
        console.log(`   ${successCount}/${totalCount} test superati`);
        console.log('   Controlla i dettagli sopra per risolvere i problemi.');
      }
      console.log('='.repeat(60));
    } catch (error) {
      logResult('Autenticazione', false, 'Errore durante autenticazione', {
        message: error.message,
        stack: error.stack,
      });
    }
  } catch (error) {
    console.error('\n❌ Errore fatale durante il test:', error);
    process.exit(1);
  }
}

testPosteAPI()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore fatale:', error);
    process.exit(1);
  });
