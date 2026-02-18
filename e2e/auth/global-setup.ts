/**
 * Global Setup Playwright — Login Reale
 *
 * Esegue login una sola volta con credenziali reali e salva
 * il cookie di sessione (authjs.session-token) in un file JSON.
 * Tutti i test lo riusano via storageState → nessun login ripetuto.
 *
 * File di sessione: e2e/auth/.auth/reseller.json (gitignored)
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

// Carica .env.local (non viene letto automaticamente da globalSetup)
loadEnv({ path: path.join(process.cwd(), '.env.local'), override: false });

const AUTH_FILE = path.join(__dirname, '.auth', 'reseller.json');

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3000';

  const email = process.env.E2E_RESELLER_EMAIL || 'testspediresicuro+postaexpress@gmail.com';
  const password = process.env.E2E_RESELLER_PASSWORD || '';

  // Crea cartella .auth se non esiste
  const authDir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  if (!password) {
    console.warn('⚠️ E2E_RESELLER_PASSWORD non impostata — skip global setup login');
    // Crea file vuoto per evitare ENOENT (i test reseller verranno skippati per mancata sessione)
    if (!fs.existsSync(AUTH_FILE)) {
      fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    }
    return;
  }

  // Se il file di sessione esiste, controlla se è valido e recente (< 25 giorni)
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const content = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      const hasCookies = Array.isArray(content.cookies) && content.cookies.length > 0;
      const stat = fs.statSync(AUTH_FILE);
      const ageMs = Date.now() - stat.mtimeMs;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const ageHours = Math.round(ageMs / (1000 * 60 * 60));

      if (hasCookies && ageDays < 25) {
        console.log(`✅ Sessione reseller riusata (${ageHours}h fa)`);
        return;
      }
      if (!hasCookies) {
        console.log('🔄 Sessione vuota (fallback precedente) — rinnovo login...');
      } else {
        console.log(`🔄 Sessione scaduta (${Math.round(ageDays)} giorni) — rinnovo login...`);
      }
    } catch {
      console.log('🔄 File sessione corrotto — rinnovo login...');
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`🔐 Login E2E come: ${email} su ${baseURL}`);

  try {
    // Vai alla pagina login
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Attendi che il form sia renderizzato (React hydration)
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.waitForTimeout(500);

    // Compila form
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    // Premi Enter per sottomettere il form (più affidabile del click sul bottone)
    await page.press('input[type="password"]', 'Enter');

    // Attendi navigazione al dashboard — timeout generoso per NextAuth + DB + warm up
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });

    console.log(`✅ Login OK → ${page.url()}`);

    // Salva state (cookies + localStorage)
    await context.storageState({ path: AUTH_FILE });
    console.log(`✅ Sessione salvata: ${AUTH_FILE}`);
  } catch (err) {
    console.error('❌ Global setup login fallito:', err);
    // Salva stato vuoto per evitare ENOENT nei test (che gestiranno il fallback)
    const emptyState = { cookies: [], origins: [] };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(emptyState));
    console.warn('⚠️ Salvato stato vuoto — i test useranno login individuale come fallback');
  } finally {
    await context.close();
    await browser.close();
  }
}
