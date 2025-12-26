/**
 * E2E Test: Happy Path - Nuova Spedizione (SENZA LOGIN)
 * 
 * ⚠️ VERSIONE SEMPLIFICATA: Assume che l'utente sia già loggato
 * 
 * Per usare questo test:
 * 1. Avvia il server: npm run dev
 * 2. Fai login manualmente nel browser con test@example.com / testpassword123
 * 3. Esegui questo test in un altro terminale
 * 
 * Oppure modifica il layout del dashboard per permettere bypass in test mode.
 */

import { test, expect } from '@playwright/test';

test.describe('Nuova Spedizione - Happy Path (No Auth)', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock di tutte le chiamate API esterne
    await page.route('**/api/geo/search*', async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get('q') || '';
      
      let results: Array<{ city: string; province: string; cap: string; caps: string[]; displayText: string }> = [];
      if (query.toLowerCase().includes('milan')) {
        results = [{
          city: 'Milano',
          province: 'MI',
          cap: '20100',
          caps: ['20100', '20121', '20122'],
          displayText: 'Milano (MI) - 20100',
        }];
      } else if (query.toLowerCase().includes('rom')) {
        results = [{
          city: 'Roma',
          province: 'RM',
          cap: '00100',
          caps: ['00100', '00118', '00119'],
          displayText: 'Roma (RM) - 00100',
        }];
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(results),
      });
    });

    await page.route('**/api/spedizioni', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'test-shipment-123',
              tracking: 'GLSTEST123456',
              status: 'pending',
              createdAt: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test.skip('Crea nuova spedizione con successo (richiede login manuale)', async ({ page }) => {
    // ⚠️ QUESTO TEST RICHIEDE LOGIN MANUALE PRIMA
    // 1. Avvia: npm run dev
    // 2. Fai login manualmente con test@example.com / testpassword123
    // 3. Poi esegui questo test
    
    test.setTimeout(60000);
    
    // Naviga direttamente (assume che tu sia già loggato)
    await page.goto('/dashboard/spedizioni/nuova', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Se c'è redirect al login, il test fallisce
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      throw new Error('❌ Devi fare login manualmente prima di eseguire questo test!');
    }

    // Verifica che la pagina sia caricata
    await expect(page.getByText('Nuova Spedizione', { exact: false })).toBeVisible({ 
      timeout: 15000 
    });

    // Compila form MITTENTE
    await page.getByPlaceholder(/Mario Rossi/i).first().fill('Mario Rossi');
    await page.getByPlaceholder(/Via Roma/i).first().fill('Via Roma 123');
    
    const mittenteCityInput = page.getByPlaceholder('Cerca città...').first();
    await expect(mittenteCityInput).toBeVisible({ timeout: 5000 });
    await mittenteCityInput.fill('Milano');
    await page.waitForTimeout(1500);
    await page.locator('[role="option"]').first().click().catch(() => {
      page.keyboard.press('ArrowDown');
      page.keyboard.press('Enter');
    });
    await page.waitForTimeout(500);
    
    await page.getByPlaceholder(/\+39.*123/i).first().fill('+39 123 456 7890');
    await page.getByPlaceholder(/email@esempio/i).first().fill('mittente@test.it');

    // Compila form DESTINATARIO
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    
    const destinatarioInputs = page.getByPlaceholder(/Luigi Verdi|Mario Rossi/i);
    if (await destinatarioInputs.count() >= 2) {
      await destinatarioInputs.nth(1).fill('Luigi Verdi');
    }
    
    const destinatarioIndirizzoInputs = page.getByPlaceholder(/Via Milano|Via Roma/i);
    if (await destinatarioIndirizzoInputs.count() >= 2) {
      await destinatarioIndirizzoInputs.nth(1).fill('Via Milano 456');
    }
    
    const destinatarioCityInputs = page.getByPlaceholder('Cerca città...');
    if (await destinatarioCityInputs.count() >= 2) {
      await destinatarioCityInputs.nth(1).fill('Roma');
      await page.waitForTimeout(1500);
      await page.locator('[role="option"]').first().click().catch(() => {
        page.keyboard.press('ArrowDown');
        page.keyboard.press('Enter');
      });
    }
    await page.waitForTimeout(500);
    
    const telefonoInputs = page.locator('input[type="tel"]');
    if (await telefonoInputs.count() >= 2) {
      await telefonoInputs.nth(1).fill('+39 098 765 4321');
    }
    
    const emailInputs = page.locator('input[type="email"]');
    if (await emailInputs.count() >= 2) {
      await emailInputs.nth(1).fill('destinatario@test.it');
    }

    // Compila DETTAGLI PACCO
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(500);
    
    const pesoInput = page.locator('input[type="number"]').first();
    await pesoInput.fill('2.5');
    await page.waitForTimeout(300);

    // Seleziona CORRIERE
    const corriereButton = page.getByRole('button', { name: /^GLS$/i }).first();
    if (await corriereButton.count() > 0) {
      await corriereButton.click();
      await page.waitForTimeout(500);
    }

    // Clicca "Genera Spedizione"
    const submitButton = page.getByRole('button', { name: /Genera Spedizione/i });
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    
    // Attendi che il form sia completo
    let isDisabled = await submitButton.isDisabled();
    let retries = 0;
    while (isDisabled && retries < 10) {
      await page.waitForTimeout(1000);
      isDisabled = await submitButton.isDisabled();
      retries++;
    }

    await submitButton.click();

    // Attendi successo
    await Promise.race([
      expect(page.getByText(/Spedizione creata|successo|Tracking Number/i)).toBeVisible({ timeout: 20000 }),
      page.waitForURL('**/dashboard/spedizioni', { timeout: 20000 }),
    ]);

    // Verifica finale
    const finalUrl = page.url();
    const hasSuccessMessage = await page.getByText(/Spedizione creata|successo|Tracking Number/i).count() > 0;
    const isOnListPage = finalUrl.includes('/dashboard/spedizioni') && !finalUrl.includes('/nuova');

    expect(isOnListPage || hasSuccessMessage).toBeTruthy();
  });
});

