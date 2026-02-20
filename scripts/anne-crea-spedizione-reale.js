/**
 * Login con account admin già impostato (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD)
 * e avvio test "crea spedizione reale". Nessun soldo reale: usa account admin di test.
 *
 * Legge .env.local per E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD.
 * Se AUTH_COOKIE è già impostato, salta il login.
 *
 * Uso (app deve essere in esecuzione):
 *   node scripts/anne-crea-spedizione-reale.js
 *   node scripts/anne-crea-spedizione-reale.js http://localhost:3000
 *
 * Output: tests/anne/output/crea_spedizione_reale_log.txt
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const BASE_URL = (
  process.argv[2] ||
  process.env.TEST_ANNE_BASE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return {};
  const content = fs.readFileSync(p, 'utf8');
  const out = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

function getCookieFromResponse(res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const parts = Array.isArray(setCookie) ? setCookie : setCookie.split(/,\s*(?=[A-Za-z0-9_-]+=)/);
  return parts.map((c) => c.split(';')[0].trim()).join('; ');
}

async function loginWithCredentials(baseUrl, email, password) {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`, { method: 'GET' });
  const csrfData = await csrfRes.json().catch(() => ({}));
  const csrfToken = csrfData?.csrfToken ?? csrfData?.token ?? '';

  const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${baseUrl}/dashboard`,
      json: 'true',
    }),
    redirect: 'manual',
  });

  const cookie = getCookieFromResponse(res);
  if (cookie) return cookie;

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  if (json?.url) {
    const redirectRes = await fetch(
      `${baseUrl}${json.url.startsWith('/') ? '' : baseUrl}${json.url}`,
      {
        redirect: 'manual',
        headers: { Cookie: res.headers.get('set-cookie') || '' },
      }
    );
    return getCookieFromResponse(redirectRes) || getCookieFromResponse(res);
  }
  return null;
}

async function main() {
  let authCookie = process.env.AUTH_COOKIE || '';

  if (!authCookie?.trim()) {
    const env = loadEnvLocal();
    const email = process.env.E2E_ADMIN_EMAIL || env.E2E_ADMIN_EMAIL || env.TEST_ANNE_ADMIN_EMAIL;
    const password =
      process.env.E2E_ADMIN_PASSWORD || env.E2E_ADMIN_PASSWORD || env.TEST_ANNE_ADMIN_PASSWORD;

    if (!email || !password) {
      console.error(
        'Account admin già impostato: imposta E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD in .env.local'
      );
      console.error('(Nessun soldo reale: usa account admin di test.)');
      process.exit(1);
    }

    console.log('Login con account admin su', BASE_URL, '...');
    try {
      authCookie = await loginWithCredentials(BASE_URL, email, password);
    } catch (e) {
      console.error('Login fallito:', e.message);
      process.exit(1);
    }

    if (!authCookie?.trim()) {
      console.error(
        "Login non ha restituito cookie. Verifica E2E_ADMIN_* e che l'app sia in esecuzione."
      );
      process.exit(1);
    }
    console.log('Login OK (account admin), avvio test crea spedizione reale...');
  } else {
    console.log('AUTH_COOKIE già impostato, avvio test...');
  }

  const py = process.platform === 'win32' ? 'py' : 'python3';
  const child = spawn(py, ['tests/anne/scripts/e2e_crea_spedizione_reale.py', BASE_URL], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      AUTH_COOKIE: authCookie,
      TEST_ANNE_BASE_URL: BASE_URL,
    },
  });

  child.on('close', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
