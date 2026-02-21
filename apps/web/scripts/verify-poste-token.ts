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
  if (!encryptedData.includes(':')) return encryptedData;
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
// --- END SECURITY UTILS ---

// --- INLINED ADAPTER FOR TESTING ---
class PosteAdapter {
  protected credentials: any;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(credentials: any) {
    this.credentials = credentials;
    this.credentials.base_url = this.credentials.base_url.replace(/\/$/, '');
  }

  // THIS IS THE COPIED LOGIC FROM THE REFACTOR
  public async getAuthToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry - 300000) {
      return this.token;
    }

    // 1. Sanitize Credentials (aggressive trim + remove spaces)
    const sanitizedClientId = (this.credentials.client_id || '').trim().replace(/\s+/g, '');
    const sanitizedSecretId = (this.credentials.client_secret || '').trim().replace(/\s+/g, '');

    // 2. Logging for Debug (Safe)
    console.log('[Poste Auth] Attempting authentication...');
    console.log('[Poste Auth] ClientID Length:', sanitizedClientId.length);
    console.log('[Poste Auth] SecretID Length:', sanitizedSecretId.length);
    console.log('[Poste Auth] Preview ClientID:', sanitizedClientId.substring(0, 5) + '...');

    try {
      // 3. Endpoint
      const baseUrl = this.credentials.base_url.replace(/\/$/, '');
      const authUrl = `${baseUrl}/user/sessions`;

      console.log('[Poste Auth] Endpoint:', authUrl);

      // 4. Request
      const response = await axios.post(
        authUrl,
        {
          clientId: sanitizedClientId,
          secretId: sanitizedSecretId,
          grantType: 'client_credentials',
          scope: 'default',
        },
        {
          headers: {
            POSTE_clientID: sanitizedClientId,
            'Content-Type': 'application/json',
          },
        }
      );

      // 5. Check & Store
      if (response.data && response.data.access_token) {
        console.log('[Poste Auth] ✅ Access Token Received');
        this.token = response.data.access_token;
        this.tokenExpiry = Date.now() + (response.data.expires_in || 3599) * 1000;
        return this.token!;
      } else {
        console.error('[Poste Auth] ❌ No access_token in response body:', response.data);
        throw new Error('No access_token received from Poste API');
      }
    } catch (error: any) {
      console.error('[Poste Auth] ❌ Auth Failed');

      const status = error.response?.status;
      const data = error.response?.data;
      const errorMessage = data?.error_description || data?.error || error.message;

      console.error('[Poste Auth] Status:', status);
      console.error('[Poste Auth] Error Details:', JSON.stringify(data, null, 2));

      if (errorMessage && errorMessage.includes('AADSTS700016')) {
        throw new Error(
          `POSTE ERROR: Client ID non trovato nel tenant (AADSTS700016). Verifica credenziali PDB. Dettagli: ${errorMessage}`
        );
      }

      throw new Error(`Authentication failed (${status}): ${errorMessage}`);
    }
  }
}
// --- END ADAPTER ---

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

if (isMock) {
  console.warn('⚠️  WARNING: Running with MOCK env vars.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTokenLogic() {
  console.log('🧪 Starting Token Logic Verification...');

  // 2. Get Config
  const { data: config, error } = await supabase
    .from('courier_configs')
    .select('*')
    .eq('provider_id', 'poste')
    .eq('is_active', true)
    .eq('is_default', true)
    .single();

  if (error || !config) {
    console.error('❌ Config fetch failed');
    // Use Mock logic if allowed? No, we need real logic check.
    // But if we are in mock mode, use mock creds to test THE SANITIZATION
    if (isMock) {
      console.log('⚠️ Using MOCK credentials for logic test');
      const adapter = new PosteAdapter({
        client_id: '  mock-id-with-spaces  ', // TEST SANITIZATION
        client_secret: 'mock-secret',
        base_url: 'https://mock.poste.it',
      });
      // We can't actually call network in mock unless we mock axios.
      // But we can verify the santization via log observation if we run it.
      // Let's just try to run it and expect network failure but correct logs.
      try {
        await adapter.getAuthToken();
      } catch (e) {}
      return;
    }
    return;
  }

  // 3. Decrypt
  const clientId = config.api_key ? decryptCredential(config.api_key) : '';
  const clientSecret = config.api_secret ? decryptCredential(config.api_secret) : '';

  if (!clientId || !clientSecret) {
    console.error('❌ Credentials missing or failed decryption');
    return;
  }

  console.log(`ℹ️ Credentials loaded. ClientID: ${clientId.substring(0, 4)}...`);

  const credentials = {
    client_id: clientId,
    client_secret: clientSecret,
    base_url: config.base_url,
    cost_center_code: 'TEST-CDC',
  } as any;

  const adapter = new PosteAdapter(credentials);

  console.log('\n🔄 Calling adapter.getAuthToken()... check console logs for [Poste Auth]');
  try {
    await adapter.getAuthToken();
    console.log('\n✅ Token Retrieval Successful!');
  } catch (e: any) {
    console.log('\n❌ Token Retrieval Failed:', e.message);
  }
}

verifyTokenLogic();
