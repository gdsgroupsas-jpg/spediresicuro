/**
 * One-shot ANNE V3 test runner:
 * - rileva/avvia il dev server
 * - login admin automatico
 * - esegue suite o singolo caso
 * - spegne il dev server se avviato dallo script
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const explicitUrl = argv[0] && argv[0].startsWith('http') ? argv[0] : null;

function normalizeSuiteArgs(rawArgs) {
  const args = explicitUrl ? rawArgs.slice(1) : [...rawArgs];
  if (args.length === 1 && !args[0].startsWith('--')) {
    return ['--case', args[0]];
  }
  return args;
}

const suiteArgs = normalizeSuiteArgs(argv);

function normalizeUrl(url) {
  return String(url || '').replace(/\/$/, '');
}

function portFromUrl(raw) {
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (parsed.port) return parsed.port;
    if (parsed.protocol === 'http:') return '80';
    if (parsed.protocol === 'https:') return '443';
    return '';
  } catch {
    return '';
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

function discoverDownloadsEnvFiles() {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) return [];
  const downloadsDir = path.join(home, 'Downloads');
  if (!fs.existsSync(downloadsDir)) return [];

  const candidates = fs
    .readdirSync(downloadsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      const lower = name.toLowerCase();
      return (
        lower === '.env' ||
        lower === '.env.local' ||
        lower.includes('env') ||
        lower.endsWith('.env') ||
        lower.endsWith('.txt')
      );
    })
    .slice(0, 60)
    .map((name) => path.join(downloadsDir, name));

  return candidates;
}

function resolveRuntimeEnv() {
  const cwd = process.cwd();
  const repoRoot = path.resolve(cwd, '..', '..');
  const explicitEnvFile = process.env.ANNE_ENV_FILE ? path.resolve(process.env.ANNE_ENV_FILE) : '';

  const candidates = unique([
    explicitEnvFile,
    path.resolve(cwd, '.env.local'),
    path.resolve(cwd, '.env'),
    path.resolve(repoRoot, '.env.local'),
    path.resolve(repoRoot, '.env'),
    ...discoverDownloadsEnvFiles(),
  ]);

  const mergedFromFiles = {};
  const loadedFiles = [];

  for (const file of candidates) {
    if (!file || !fs.existsSync(file)) continue;
    const parsed = parseEnvFile(file);
    const hasUsefulKeys =
      parsed.NEXT_PUBLIC_SUPABASE_URL ||
      parsed.SUPABASE_URL ||
      parsed.SUPABASE_SERVICE_ROLE_KEY ||
      parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      parsed.E2E_ADMIN_EMAIL ||
      parsed.TEST_ANNE_ADMIN_EMAIL;

    if (!hasUsefulKeys) continue;
    loadedFiles.push(file);
    for (const [key, value] of Object.entries(parsed)) {
      if (mergedFromFiles[key] === undefined || mergedFromFiles[key] === '') {
        mergedFromFiles[key] = value;
      }
    }
  }

  return {
    runtimeEnv: {
      ...mergedFromFiles,
      ...process.env,
    },
    loadedFiles,
  };
}

const { runtimeEnv, loadedFiles } = resolveRuntimeEnv();
const nextAuthUrl = runtimeEnv.NEXTAUTH_URL || '';
const appUrl = runtimeEnv.NEXT_PUBLIC_APP_URL || '';
const envBase = runtimeEnv.TEST_ANNE_BASE_URL || nextAuthUrl || appUrl || '';
const inferredPort =
  portFromUrl(explicitUrl) ||
  portFromUrl(envBase) ||
  portFromUrl(nextAuthUrl) ||
  portFromUrl(appUrl);
const envPort = runtimeEnv.WEB_PORT || runtimeEnv.PORT || inferredPort || '3000';

const baseCandidates = unique([
  explicitUrl,
  envBase,
  `http://localhost:${envPort}`,
  'http://localhost:3000',
]).map(normalizeUrl);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerUp(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(baseUrl, { method: 'GET', signal: controller.signal });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function findReachableBaseUrl(candidates) {
  for (const url of candidates) {
    if (await isServerUp(url)) return url;
  }
  return null;
}

async function waitAnyServerReady(candidates, timeoutMs = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = await findReachableBaseUrl(candidates);
    if (found) return found;
    await sleep(2000);
  }
  return null;
}

function resolveSupabaseConfig(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  return { url: normalizeUrl(url), key: String(key || '').trim() };
}

async function verifySupabaseConnectivity(env) {
  const config = resolveSupabaseConfig(env);
  if (!config.url || !config.key) {
    throw new Error(
      'Config Supabase mancante. Richiesti NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL) e una key valida.'
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${config.url}/rest/v1/`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
      },
    });

    if (response.status === 401 || response.status === 403 || response.status >= 500) {
      throw new Error(`Supabase REST check fallita (HTTP ${response.status}).`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'errore sconosciuto';
    throw new Error(`Connessione Supabase non valida: ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
}

function spawnDevServer() {
  const proc =
    process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev'], {
          cwd: process.cwd(),
          stdio: 'ignore',
          detached: false,
          env: runtimeEnv,
          windowsHide: true,
        })
      : spawn('npm', ['run', 'dev'], {
          cwd: process.cwd(),
          stdio: 'ignore',
          detached: false,
          env: runtimeEnv,
        });

  return { proc };
}

function stopProcessTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve();

    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      killer.on('close', () => resolve());
      killer.on('error', () => resolve());
      return;
    }

    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        // ignore
      }
    }
    resolve();
  });
}

function getCookieFromResponse(res) {
  const setCookie =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie().join(', ')
      : res.headers.get('set-cookie');
  if (!setCookie) return null;
  const parts = Array.isArray(setCookie) ? setCookie : setCookie.split(/,\s*(?=[A-Za-z0-9_.-]+=)/);
  return parts.map((c) => c.split(';')[0].trim()).join('; ');
}

function hasSessionCookie(cookieHeader) {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:__Secure-)?(?:authjs|next-auth)\.session-token=/.test(cookieHeader);
}

async function hasAuthenticatedSession(baseUrl, cookieHeader) {
  try {
    const res = await fetch(`${baseUrl}/api/auth/session`, {
      method: 'GET',
      headers: cookieHeader ? { Cookie: cookieHeader } : {},
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return Boolean(data && data.user);
  } catch {
    return false;
  }
}

async function loginWithCredentials(baseUrl, email, password) {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`, { method: 'GET' });
  const csrfCookie = getCookieFromResponse(csrfRes) || '';
  const csrfData = await csrfRes.json().catch(() => ({}));
  const csrfToken = csrfData?.csrfToken ?? csrfData?.token ?? '';

  const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(csrfCookie ? { Cookie: csrfCookie } : {}),
    },
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
  if (cookie) {
    const merged = [csrfCookie, cookie].filter(Boolean).join('; ');
    if (hasSessionCookie(merged)) return merged;
  }

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
        headers: { Cookie: [csrfCookie, getCookieFromResponse(res)].filter(Boolean).join('; ') },
      }
    );
    const merged = [csrfCookie, getCookieFromResponse(redirectRes), getCookieFromResponse(res)]
      .filter(Boolean)
      .join('; ');
    return hasSessionCookie(merged) ? merged : null;
  }

  return null;
}

async function runSuite(baseUrl, authCookie) {
  const py = process.platform === 'win32' ? 'py' : 'python3';
  const args = ['tests/anne/scripts/e2e_v3_suite.py', baseUrl, ...suiteArgs];

  return await new Promise((resolve) => {
    const child = spawn(py, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...runtimeEnv,
        AUTH_COOKIE: authCookie,
        TEST_ANNE_BASE_URL: baseUrl,
      },
    });

    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function main() {
  let startedByScript = false;
  let devProc = null;
  let exitCode = 1;

  if (loadedFiles.length > 0) {
    console.log('Env caricati da:', loadedFiles.join(', '));
  }

  console.log('Verifica connessione Supabase in corso...');
  await verifySupabaseConnectivity(runtimeEnv);
  console.log('Connessione Supabase OK.');

  let activeBaseUrl = await findReachableBaseUrl(baseCandidates);

  try {
    if (!activeBaseUrl) {
      console.log('Server non raggiungibile, avvio dev server in background...');
      const started = spawnDevServer();
      devProc = started.proc;
      startedByScript = true;

      const ready = await waitAnyServerReady(baseCandidates, 180000);
      if (!ready) {
        console.error('Dev server non pronto entro timeout.');
        return 1;
      }
      activeBaseUrl = ready;
      console.log('Dev server pronto su', activeBaseUrl);
    } else {
      console.log('Server gia attivo su', activeBaseUrl);
    }

    let authCookie = runtimeEnv.AUTH_COOKIE || '';

    if (!authCookie?.trim()) {
      const email = runtimeEnv.E2E_ADMIN_EMAIL || runtimeEnv.TEST_ANNE_ADMIN_EMAIL;
      const password = runtimeEnv.E2E_ADMIN_PASSWORD || runtimeEnv.TEST_ANNE_ADMIN_PASSWORD;

      if (!email || !password) {
        console.error(
          'Servono AUTH_COOKIE oppure E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD nel file env.'
        );
        return 1;
      }

      console.log('Login admin in corso...');
      authCookie = await loginWithCredentials(activeBaseUrl, email, password);
      if (!authCookie?.trim()) {
        console.error('Login fallito: cookie non ottenuto.');
        return 1;
      }
      const hasSession = await hasAuthenticatedSession(activeBaseUrl, authCookie);
      if (!hasSession) {
        console.error('Login fallito: sessione non valida.');
        return 1;
      }
      console.log('Login OK.');
    } else {
      console.log('AUTH_COOKIE gia presente, login saltato.');
    }

    exitCode = await runSuite(activeBaseUrl, authCookie);
    return exitCode;
  } finally {
    if (startedByScript && devProc && !devProc.killed) {
      await stopProcessTree(devProc.pid);
    }
    process.exitCode = exitCode;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
