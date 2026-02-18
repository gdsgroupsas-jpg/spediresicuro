/**
 * Global Setup Playwright — Login Reale Multi-Account
 *
 * Esegue login una sola volta per ogni account e salva il cookie di sessione.
 * Tutti i test riusano via storageState → nessun login ripetuto.
 *
 * File di sessione:
 *   e2e/auth/.auth/reseller.json  — reseller (pre-esistente)
 *   e2e/auth/.auth/user.json      — utente normale
 *   e2e/auth/.auth/admin.json     — amministratore
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

// Carica .env.local (non viene letto automaticamente da globalSetup)
loadEnv({ path: path.join(process.cwd(), '.env.local'), override: false });

interface AccountConfig {
  name: string;
  authFile: string;
  email: string;
  password: string;
}

const AUTH_DIR = path.join(__dirname, '.auth');

const ACCOUNTS: AccountConfig[] = [
  {
    name: 'reseller',
    authFile: path.join(AUTH_DIR, 'reseller.json'),
    email: process.env.E2E_RESELLER_EMAIL || 'testspediresicuro+postaexpress@gmail.com',
    password: process.env.E2E_RESELLER_PASSWORD || '',
  },
  {
    name: 'user',
    authFile: path.join(AUTH_DIR, 'user.json'),
    email: process.env.E2E_USER_EMAIL || 'testspediresicuro+e2e.user@gmail.com',
    password: process.env.E2E_USER_PASSWORD || '',
  },
  {
    name: 'admin',
    authFile: path.join(AUTH_DIR, 'admin.json'),
    email: process.env.E2E_ADMIN_EMAIL || 'testspediresicuro+e2e.admin@gmail.com',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  },
  {
    // Superadmin reale di produzione — accesso completo a tutte le sezioni
    name: 'superadmin',
    authFile: path.join(AUTH_DIR, 'superadmin.json'),
    email: process.env.E2E_SUPERADMIN_EMAIL || 'admin@spediresicuro.it',
    password: process.env.E2E_SUPERADMIN_PASSWORD || '',
  },
];

/** Verifica se il file di sessione è valido e recente (< 25 giorni) */
function isSessionValid(authFile: string): { valid: boolean; reason?: string } {
  if (!fs.existsSync(authFile)) {
    return { valid: false, reason: 'file non esiste' };
  }
  try {
    const content = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
    const hasCookies = Array.isArray(content.cookies) && content.cookies.length > 0;
    if (!hasCookies) {
      return { valid: false, reason: 'sessione vuota (fallback precedente)' };
    }
    const stat = fs.statSync(authFile);
    const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
    const ageHours = Math.round((Date.now() - stat.mtimeMs) / (1000 * 60 * 60));
    if (ageDays >= 25) {
      return { valid: false, reason: `scaduta (${Math.round(ageDays)} giorni)` };
    }
    return { valid: true, reason: `${ageHours}h fa` };
  } catch {
    return { valid: false, reason: 'file corrotto' };
  }
}

/** Esegue login per un account e salva la sessione */
async function loginAccount(account: AccountConfig, baseURL: string): Promise<void> {
  const { name, authFile, email, password } = account;

  if (!password) {
    console.warn(`⚠️ Password ${name} non impostata — skip login`);
    if (!fs.existsSync(authFile)) {
      fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    }
    return;
  }

  const sessionCheck = isSessionValid(authFile);
  if (sessionCheck.valid) {
    console.log(`✅ Sessione ${name} riusata (${sessionCheck.reason})`);
    return;
  }
  console.log(`🔄 Rinnovo sessione ${name}: ${sessionCheck.reason}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`🔐 Login E2E come: ${email} su ${baseURL}`);

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.waitForTimeout(500);

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.press('input[type="password"]', 'Enter');

    // Attendi navigazione al dashboard — timeout generoso per NextAuth + DB + warm up
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });

    console.log(`✅ Login ${name} OK → ${page.url()}`);
    await context.storageState({ path: authFile });
    console.log(`✅ Sessione ${name} salvata: ${authFile}`);
  } catch (err) {
    console.error(`❌ Login ${name} fallito:`, err);
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }));
    console.warn(`⚠️ Sessione ${name} vuota salvata — i test useranno fallback`);
  } finally {
    await context.close();
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';

  // Crea cartella .auth se non esiste
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  // Login sequenziale per tutti gli account (evita conflitti browser)
  for (const account of ACCOUNTS) {
    await loginAccount(account, baseURL);
  }
}
