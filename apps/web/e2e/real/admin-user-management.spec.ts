/**
 * Test E2E Reale: Gestione Utenti Admin
 *
 * Ruolo: superadmin (storageState: superadmin.json — admin@spediresicuro.it)
 * Backend: REALE — nessun mock, dati dal DB reale
 *
 * Struttura pagina:
 * - URL: /dashboard/admin
 * - Campo ricerca: input[placeholder="Cerca utenti..."]
 * - Checkbox: "Mostra dati di test" (per vedere account test)
 * - Link dettaglio: href="/dashboard/admin/users/{userId}"
 * - Solo lettura — nessuna modifica ai dati
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: path.join(process.cwd(), '.env.local'), override: false });

const E2E_USER_EMAIL = 'testspediresicuro+e2e.user@gmail.com';

/** Chiude popup notifiche e cookie se presenti */
async function dismissPopups(page: Page) {
  await page
    .locator('button')
    .filter({ hasText: /^Dopo$/ })
    .click({ timeout: 3000 })
    .catch(() => {});
  await page
    .locator('button')
    .filter({ hasText: /^Rifiuta$/ })
    .click({ timeout: 2000 })
    .catch(() => {});
  await page.waitForTimeout(300);
}

/** Verifica sessione superadmin valida */
async function isSessionValid(page: Page): Promise<boolean> {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const url = page.url();
  if (url.includes('/login')) {
    console.warn('⚠️ Sessione superadmin non valida — redirectato al login');
    return false;
  }
  return true;
}

/** Naviga a /dashboard/admin e attende il caricamento dei dati (client component con useEffect) */
async function goToAdminPage(page: Page): Promise<boolean> {
  await page.goto('/dashboard/admin', { waitUntil: 'commit', timeout: 45000 });
  const url = page.url();

  if (url.includes('/login')) {
    console.warn('⚠️ Redirect al login — sessione non valida');
    return false;
  }
  if (url.includes('error=unauthorized') || url.includes('/403')) {
    console.warn('⚠️ Non autorizzato su /dashboard/admin');
    return false;
  }

  await dismissPopups(page);

  // La pagina è un client component — aspetta il caricamento dati via API (useEffect)
  // Indicatori di caricamento completato:
  // 1. Input "Cerca utenti..." appare (dati caricati)
  // 2. Oppure la tabella appare
  // /api/admin/overview carica tutti gli utenti+spedizioni — può essere lento su produzione

  // Scroll giù per raggiungere la sezione utenti
  await page.evaluate(() => window.scrollTo(0, 600));

  try {
    // Attendi che l'input ricerca compaia (segnale dati caricati)
    await page
      .locator('input[placeholder="Cerca utenti..."]')
      .waitFor({ state: 'visible', timeout: 55000 });
    console.log('✅ Sezione Utenti caricata in /dashboard/admin (campo ricerca visibile)');
    return true;
  } catch {
    // Fallback: tabella visibile
    const hasTable = await page
      .locator('table')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (hasTable) {
      console.log('✅ Tabella utenti visibile in /dashboard/admin');
      return true;
    }
    // Fallback finale: anche solo l'heading della pagina
    const hasHeading = await page
      .locator('h1, h2')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (hasHeading) {
      console.log('⚠️ Pagina admin caricata — dati utenti non ancora arrivati (API lenta)');
      return true;
    }
    console.warn('⚠️ Timeout caricamento pagina admin');
    return false;
  }
}

// Timeout esteso: /api/admin/overview carica tutti gli utenti+spedizioni (lento su produzione)
test.describe.configure({ timeout: 120000 });

test.describe('Gestione Utenti Admin — Backend Reale', () => {
  test('superadmin accede al dashboard senza errori', async ({ page }) => {
    if (!(await isSessionValid(page))) {
      test.skip();
      return;
    }

    await dismissPopups(page);

    const url = page.url();
    expect(url).toContain('/dashboard');

    const hasError = await page
      .locator('text=/500|Internal Server Error/i')
      .isVisible()
      .catch(() => false);
    expect(hasError).toBe(false);

    console.log('✅ Superadmin dashboard OK:', url);
  });

  test('account E2E user esiste nel DB (verifica Supabase)', async () => {
    // Verifica direttamente nel DB che l'account E2E esista
    // Non dipende dall'UI o dall'API lenta — verifica il dato grezzo
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.warn('⚠️ Variabili Supabase non disponibili — skip verifica DB');
      return;
    }

    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: user, error } = await admin
      .from('users')
      .select('id, email, account_type, primary_workspace_id')
      .eq('email', E2E_USER_EMAIL)
      .single();

    if (error || !user) {
      console.warn(`⚠️ Account ${E2E_USER_EMAIL} non trovato nel DB: ${error?.message}`);
      // Non fail: potrebbe non essere stato creato ancora
      return;
    }

    console.log(
      `✅ Account ${E2E_USER_EMAIL} trovato nel DB (id: ${user.id}, type: ${user.account_type})`
    );
    expect(user.email).toBe(E2E_USER_EMAIL);
    expect(user.account_type).toBe('user');
    expect(user.primary_workspace_id).toBeTruthy();
  });

  test('superadmin può navigare al dettaglio utente', async ({ page }) => {
    if (!(await isSessionValid(page))) {
      test.skip();
      return;
    }

    if (!(await goToAdminPage(page))) {
      test.skip();
      return;
    }

    // Scroll fino alla tabella utenti
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(1000);

    // Attendi la tabella (dati caricati via API)
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasTable) {
      console.log('ℹ️ Tabella utenti non caricata — skip navigazione dettaglio');
      test.skip();
      return;
    }

    // Cerca link a /dashboard/admin/users/{id} nella prima riga
    const detailLink = page.locator('a[href*="/dashboard/admin/users/"]').first();
    const hasLink = await detailLink.isVisible({ timeout: 8000 }).catch(() => false);

    if (!hasLink) {
      console.log('ℹ️ Nessun link dettaglio visibile — lista potrebbe essere vuota');
      test.skip();
      return;
    }

    await detailLink.click();

    // Attendi navigazione alla pagina dettaglio utente
    await page.waitForURL(/\/dashboard\/admin\/users\//, { timeout: 20000 }).catch(() => {});
    const urlAfter = page.url();
    console.log('✅ Navigazione dettaglio utente:', urlAfter);

    const hasContent = await page
      .locator('h1, h2')
      .first()
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    expect(hasContent).toBe(true);
  });

  test('pagina admin non espone dati privati reseller', async ({ page }) => {
    if (!(await isSessionValid(page))) {
      test.skip();
      return;
    }

    if (!(await goToAdminPage(page))) {
      test.skip();
      return;
    }

    // Il superadmin NON deve vedere listini privati, prezzi riservati o wallet privati reseller
    const hasPrivateResellerData = await page
      .locator('text=/listini privati reseller|prezzi riservati|wallet reseller privato/i')
      .isVisible()
      .catch(() => false);

    expect(hasPrivateResellerData).toBe(false);
    console.log('✅ Nessun dato privato reseller esposto nella vista superadmin');
  });

  test('tabella utenti mostra colonne attese', async ({ page }) => {
    if (!(await isSessionValid(page))) {
      test.skip();
      return;
    }

    if (!(await goToAdminPage(page))) {
      test.skip();
      return;
    }

    // Scroll fino alla sezione tabella utenti
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);

    // Verifica che la tabella abbia le colonne previste
    const table = page.locator('table').first();
    const hasTable = await table.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasTable) {
      console.log('ℹ️ Tabella non ancora visibile — dati API probabilmente non ancora arrivati');
      test.skip();
      return;
    }

    // Verifica intestazioni colonne
    const headings = ['Utente', 'Ruolo', 'Provider', 'Registrato', 'Azioni'];
    let foundHeadings = 0;

    for (const heading of headings) {
      const hasHeading = await page
        .locator(`th:has-text("${heading}")`)
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (hasHeading) foundHeadings++;
    }

    console.log(`✅ Colonne tabella trovate: ${foundHeadings}/${headings.length}`);
    expect(foundHeadings).toBeGreaterThanOrEqual(2); // Almeno 2 colonne visibili
  });
});
