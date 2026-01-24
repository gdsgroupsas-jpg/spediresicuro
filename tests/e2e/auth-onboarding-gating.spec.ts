/**
 * E2E Test: Registrazione + Autenticazione (mock) + Onboarding gating
 *
 * Flusso coperto:
 * 1) Registrazione UI (con validazioni client-side)
 * 2) Autenticazione simulata (sessione NextAuth mockata)
 * 3) Post-auth: limitazioni quando profilo non completato
 * 4) Completamento dati cliente e sblocco funzioni principali
 */

import { test, expect } from '@playwright/test';

type TestState = {
  isAuthenticated: boolean;
  profileComplete: boolean;
  email: string;
};

async function mockAuthSession(page: any, state: TestState) {
  await page.route('**/api/auth/session', async (route: any) => {
    if (!state.isAuthenticated) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'null',
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'e2e-user-id',
          email: state.email,
          name: 'E2E User',
          role: 'user',
        },
        expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    });
  });
}

async function mockUserProfile(page: any, state: TestState) {
  await page.route('**/api/user/dati-cliente', async (route: any) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          datiCliente: {
            datiCompletati: state.profileComplete,
          },
        }),
      });
      return;
    }

    if (method === 'POST') {
      state.profileComplete = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Dati cliente salvati con successo',
          datiCliente: {
            datiCompletati: true,
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

async function mockDashboardApis(page: any) {
  await page.route('**/api/user/settings', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ role: 'user' }),
    });
  });

  await page.route('**/api/user/info', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'e2e-user-id',
          role: 'user',
          account_type: 'user',
        },
      }),
    });
  });

  await page.route('**/api/features/check*', async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hasAccess: false }),
    });
  });

  await page.route('**/api/spedizioni**', async (route: any) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'e2e-shipment-1',
            mittente: {
              nome: 'Mittente Test',
              indirizzo: 'Via Roma 1',
              citta: 'Roma',
              provincia: 'RM',
              cap: '00100',
            },
            destinatario: {
              nome: 'Destinatario Test',
              indirizzo: 'Via Milano 2',
              citta: 'Milano',
              provincia: 'MI',
              cap: '20100',
            },
            peso: 1.2,
            tipoSpedizione: 'standard',
            prezzoFinale: 5.5,
            createdAt: new Date().toISOString(),
            status: 'in_preparazione',
            tracking: 'TRK-E2E-123',
          },
        ],
      }),
    });
  });
}

async function closeBlockingOverlays(page: any) {
  const buttons = ['Rifiuta', 'Accetta Tutti', 'Dopo', 'Chiudi'];

  for (const label of buttons) {
    const btn = page.getByRole('button', { name: label });
    if (
      await btn
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await btn.first().click({ force: true });
      await page.waitForTimeout(300);
    }
  }
}

async function fillIfEmpty(locator: any, value: string) {
  const current = await locator.inputValue().catch(() => '');
  if (!current || current.trim().length === 0) {
    await locator.fill(value);
  }
}

test.describe('Registrazione + Onboarding gating', () => {
  test('Completa flusso registrazione/autenticazione/gating/sblocco', async ({ page }) => {
    test.setTimeout(120000);

    const state: TestState = {
      isAuthenticated: false,
      profileComplete: false,
      email: `e2e-${Date.now()}@spediresicuro.it`,
    };

    await page.setExtraHTTPHeaders({
      'x-test-mode': 'playwright',
    });

    await page.context().clearCookies();
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await mockAuthSession(page, state);
    await mockUserProfile(page, state);
    await mockDashboardApis(page);

    await page.route('**/api/auth/register', async (route: any) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'email_confirmation_required',
          email: state.email,
        }),
      });
    });

    // STEP 1: Registrazione UI + validazioni
    const nameInput = page.getByPlaceholder('Mario Rossi');
    const registerToggle = page.getByRole('button', { name: 'Registrati' }).first();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('heading', { name: /Accedi al Dashboard|Crea il tuo Account/i })
      ).toBeVisible();
      await closeBlockingOverlays(page);
      await registerToggle.click({ force: true });
      if (await nameInput.isVisible().catch(() => false)) {
        break;
      }
      await page.waitForTimeout(500);
      await registerToggle.click({ force: true });
      if (await nameInput.isVisible().catch(() => false)) {
        break;
      }
    }

    await expect(nameInput).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('Mario Rossi').fill('E2E User');
    await page.getByPlaceholder('email@esempio.it').fill(state.email);
    await page.getByPlaceholder('Minimo 8 caratteri').fill('TestPassword123!');
    await page.getByPlaceholder('Ripeti la password').fill('Mismatch123!');
    await page.getByRole('button', { name: 'Registrati' }).last().click();
    await expect(page.getByText(/Le password non corrispondono/i)).toBeVisible();

    await page.getByPlaceholder('Ripeti la password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Registrati' }).last().click();
    await expect(page.getByText(/Ti abbiamo inviato una email di conferma/i)).toBeVisible();

    // STEP 2: Autenticazione simulata (sessione NextAuth mockata)
    state.isAuthenticated = true;
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(/Completa il profilo per sbloccare le funzioni principali/i)
    ).toBeVisible();

    // STEP 3: Verifica limitazioni profilo incompleto
    await page.goto('/dashboard/spedizioni', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Profilo incompleto/i)).toBeVisible();

    await expect(page.getByRole('button', { name: 'Importa Ordini' })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Esporta/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Nuova Spedizione' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Registra Reso' })).toBeDisabled();

    // STEP 4: Completa dati cliente
    await page.goto('/dashboard/dati-cliente', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="nome"]', { timeout: 10000 });

    await fillIfEmpty(page.locator('input[name="nome"]'), 'Mario');
    await fillIfEmpty(page.locator('input[name="cognome"]'), 'Rossi');
    await fillIfEmpty(page.locator('input[name="codiceFiscale"]'), 'RSSMRA80A01H501U');
    await fillIfEmpty(page.locator('input[name="telefono"]'), '3331234567');
    await fillIfEmpty(page.locator('input[name="indirizzo"]'), 'Via Roma 10');
    await fillIfEmpty(page.locator('input[name="citta"]'), 'Roma');
    await fillIfEmpty(page.locator('input[name="provincia"]'), 'RM');
    await fillIfEmpty(page.locator('input[name="cap"]'), '00100');

    await closeBlockingOverlays(page);
    await page
      .getByRole('button', { name: /Salva e Completa Registrazione/i })
      .click({ force: true });
    await Promise.race([
      expect(page.getByText(/Dati salvati con successo/i)).toBeVisible({ timeout: 10000 }),
      page.waitForURL('**/dashboard', { timeout: 10000 }),
    ]);

    // STEP 5: Funzioni sbloccate
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(/Completa il profilo per sbloccare le funzioni principali/i)
    ).toHaveCount(0);

    await page.goto('/dashboard/spedizioni', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Importa Ordini' })).toBeEnabled();
    await expect(page.getByRole('button', { name: /Esporta/i })).toBeEnabled();
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Nuova Spedizione' }).first()
    ).toBeVisible();
  });
});
