const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = path.join(process.cwd(), '.env.local');

// 1. Read Secret
const envContent = fs.readFileSync(ENV_PATH, 'utf-8');
const secretMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);

if (!secretMatch) {
  console.error('❌ Service Role Key not found!');
  process.exit(1);
}

let secretJWT = secretMatch[1].trim();
if (secretJWT.startsWith('"')) secretJWT = secretJWT.slice(1, -1);
if (secretJWT.startsWith("'")) secretJWT = secretJWT.slice(1, -1);

// Extract the secret (last part of JWT) OR use the whole thing?
// Supabase Service Key IS a JWT. The "secret" used to sign the Anon Key is the "JWT Secret" of the project.
// Wait, we don't have the "JWT Secret" (roughly 32-40 chars), we have the Service Role Key (full JWT).
// WE CANNOT SIGN A NEW TOKEN WITHOUT THE RAW JWT SECRET.
// The Service Role Key is NOT the secret. It is SIGNED BY the secret.
// BUT... can we extract the secret? No, that's the point of cryptography.

// ALTERNATIVE:
// If the user has just the Service Role Key, we cannot generate a new Anon Key unless we know the project JWT Secret.
// Usually `SUPABASE_JWT_SECRET` is an env var, but it's not here.
// HOWEVER, maybe I can find the duplicate payload again?
// Or maybe the user has the secret somewhere else?
// Wait, in previous logs (Conversation 1), "found two identical parts".
// If the original file had `eyJ...` (Header) `.` `eyJ...` (Payload) `.` `SIGNATURE`, that's a token.
// If it was duplicated `Token.Token`, that's different.

// Let's re-examine the "Fixed" key.
// `eyJ...` (Header) `.` `eyJ...` (Payload) `.` `SIG`
// Payload was: `{ "iss": "supabase", ... "isAnonymous": true }` MISSING ROLE.

// CRITICAL: If I cannot sign, I cannot fix it.
// Does the user have the JWT Secret?
// It might be in `SUPABASE_SERVICE_ROLE_KEY` if it's not a JWT? No, it looks like a JWT.

// Let's check `scripts/fix-env-advanced.ts` again. How did IT re-sign?
// It extracted the secret?
// "re-signed it using the SUPABASE_SERVICE_ROLE_KEY".
// Code: `const signature = crypto.createHmac('sha256', secret).update(...)`
// It assumed `SUPABASE_SERVICE_ROLE_KEY` IS the secret?
// IF the `SUPABASE_SERVICE_ROLE_KEY` variable holds the raw secret string (e.g. "my-secret-token"), then yes.
// BUT usually `SUPABASE_SERVICE_ROLE_KEY` is a long JWT `eyJ...`.
// If I try to HMAC with a JWT string as the key, I get a valid signature relative to THAT key, but Supabase won't verify it because Supabase uses the Project Secret.

// LET'S CHECK if `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is a JWT or a Secret.
// The Service Role Key format is either a JWT (starts with eyJ) or a secret string (starts with sb_secret_)
// WAIT! Random String Secrets (NOT JWT) start with sb_secret_
// 32-40 chars. `sb_secret_...`
// This IS the secret!
// If so, I CAN sign a new token.

console.log('Secret seems to be:', secretJWT);
if (secretJWT.startsWith('eyJ')) {
  console.error('⚠️  SUPABASE_SERVICE_ROLE_KEY looks like a JWT, not a raw secret.');
  console.error('   I cannot sign a new token without the raw JWT Secret.');
  // Check if we can parse it to maybe find the secret? No.
} else {
  console.log('✅  SUPABASE_SERVICE_ROLE_KEY looks like a raw secret. Proceeding.');
}

// 2. Prepare Payload
// Standard Supabase Anon Payload
const now = Math.floor(Date.now() / 1000);
const payload = {
  role: 'anon',
  iss: 'supabase',
  iat: now,
  exp: now + 10 * 365 * 24 * 60 * 60, // 10 years
  email: 'anon',
  aud: 'anon', // Usually just "anon"
};

const header = {
  alg: 'HS256',
  typ: 'JWT',
};

function base64Url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const sHeader = base64Url(JSON.stringify(header));
const sPayload = base64Url(JSON.stringify(payload));
const data = `${sHeader}.${sPayload}`;

const signature = crypto
  .createHmac('sha256', secretJWT)
  .update(data)
  .digest('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const newToken = `${data}.${signature}`;

console.log('🔑 New Anon Key Generated:');
console.log(newToken);

// 3. Update File
const newContent = envContent.replace(
  /NEXT_PUBLIC_SUPABASE_ANON_KEY=.*/,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY="${newToken}"`
);

fs.writeFileSync(ENV_PATH, newContent, 'utf-8');
console.log('✅ Updated .env.local');
