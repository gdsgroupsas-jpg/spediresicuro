import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';

// --- INLINED SECURITY UTILS ---
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) {
    return crypto.scryptSync('default-dev-key-change-in-production', 'salt', KEY_LENGTH);
  }
  if (envKey.length === 64) {
    return Buffer.from(envKey, 'hex');
  } else {
    return crypto.scryptSync(envKey, 'spediresicuro-salt', KEY_LENGTH);
  }
}

function decryptCredential(encryptedData: string): string {
  if (!encryptedData) return '';
  if (!encryptedData.includes(':')) {
    return encryptedData;
  }
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    if (parts.length !== 4) throw new Error('Invalid format');

    const [ivBase64, saltBase64, tagBase64, encryptedBase64] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const salt = Buffer.from(saltBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    const derivedKey = crypto.scryptSync(key, salt, KEY_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    return 'DECRYPTION_FAILED';
  }
}
// --- END INLINED SECURITY UTILS ---

// 1. Load Env
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
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
}

loadEnvFile();

const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnosis() {
  console.log(`🧪 Starting Poste Diagnosis (${isMock ? 'MOCK MODE' : 'REAL MODE'})...`);
  const logFile = path.join(process.cwd(), 'POSTE_DIAGNOSTIC_LOG.txt');
  const logs: string[] = [];

  const log = (msg: string, data?: any) => {
    const str = data ? `${msg}\n${JSON.stringify(data, null, 2)}` : msg;
    console.log(str);
    logs.push(str);
  };

  let config: any = {};
  let clientId = 'mock-client-id';
  let clientSecret = 'mock-secret';
  let token = 'mock-token';

  if (isMock) {
    log('⚠️ Environment variables missing. Using mock data for payload generation.');
    config = {
      base_url: 'https://apiw.gp.posteitaliane.it/gp/internet',
      contract_mapping: { cdc: 'CDC-TEST-123' },
    };
  } else {
    log('📋 Step 1: Getting Configuration...');
    const { data, error } = await supabase
      .from('courier_configs')
      .select('*')
      .eq('provider_id', 'poste')
      .eq('is_active', true)
      .eq('is_default', true)
      .single();

    if (error || !data) {
      log('❌ Config fetch failed, using mock defaults');
      config = {
        base_url: 'https://apiw.gp.posteitaliane.it/gp/internet',
        contract_mapping: { cdc: 'CDC-FAIL' },
      };
    } else {
      config = data;
      if (config.api_key) clientId = decryptCredential(config.api_key);
      if (config.api_secret) clientSecret = decryptCredential(config.api_secret);
    }
  }

  const cdc = config.contract_mapping?.cdc || 'CDC-DEFAULT';

  // 5. Create Waybill Payload
  log('📦 Payload that will be sent to Poste Italiane:');

  const payload = {
    costCenterCode: cdc,
    shipmentDate: new Date().toISOString(),
    waybills: [
      {
        printFormat: 'A4',
        product: 'APT000902',
        data: {
          sender: {
            nameSurname: 'SpedireSicuro Test',
            address: 'Via Roma',
            streetNumber: '1',
            zipCode: '00144',
            city: 'Roma',
            country: 'ITA1',
            province: 'RM',
            email: 'test@spediresicuro.it',
            phone: '3331234567',
          },
          receiver: {
            nameSurname: 'Mario Rossi',
            address: 'Via Milano',
            streetNumber: '10',
            zipCode: '20121',
            city: 'Milano',
            country: 'ITA1',
            province: 'MI',
            email: 'mario.rossi@example.com',
            phone: '3339876543',
          },
          content: 'Documenti',
          declared: [
            {
              weight: '1000',
              length: '20',
              width: '20',
              height: '20',
            },
          ],
        },
      },
    ],
  };

  log('JSON PAYLOAD:', payload);

  if (!isMock) {
    // Try real call if we have env
    // ... (omitted for safety if keys key decryption failed)
  }

  log('\n📧 EMAIL TEMPLATE FOR SUPPORT:');
  log('--------------------------------------------------');
  log(`Subject: Richiesta Supporto Tecnico - Errore Creazione Lettera di Vettura (CDC: ${cdc})`);
  log('');
  log('Gentile Supporto Tecnico Poste Italiane,');
  log('');
  log(`Stiamo riscontrando errori nella creazione delle Lettere di Vettura tramite API.`);
  log(`Codice Centro di Costo (CDC): ${cdc}`);
  log('');
  log('Ecco un esempio del payload JSON che stiamo inviando e che genera errore:');
  log('');
  log(JSON.stringify(payload, null, 2));
  log('');
  log('Vi preghiamo di verificare se ci sono errori nella struttura o permessi mancanti sul CDC.');
  log('');
  log('Cordiali saluti,');
  log('Team Tecnico SpedireSicuro');
  log('--------------------------------------------------');

  fs.writeFileSync(logFile, logs.join('\n\n'));
  console.log(`\n📄 Output saved to: ${logFile}`);
}

runDiagnosis();
