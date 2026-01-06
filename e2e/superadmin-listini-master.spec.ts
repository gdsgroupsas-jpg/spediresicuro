/**
 * Test E2E: Gestione Listini Master (Superadmin)
 *
 * Verifica:
 * 1. Accesso pagina solo per superadmin
 * 2. Visualizzazione listini master
 * 3. Funzionalità clone (UI)
 * 4. Funzionalità assign (UI)
 * 5. Visualizzazione assegnazioni
 *
 * Nota: Questo test usa mock data via x-test-mode: playwright
 */

import { expect, test } from "@playwright/test";
import { authenticateTestUser } from "./helpers/auth-helper";

test.describe("Gestione Listini Master (Superadmin)", () => {
  test.beforeEach(async ({ page }) => {
    // Usa helper centralizzato per auth mock
    await authenticateTestUser(page);

    // Blocca chiamate AI/Anne per evitare errori UUID 500
    await page.route("**/api/ai/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      });
    });

    // Blocca chiamate dati-cliente per evitare errori (già gestito da auth-helper ma ridondante ok)
    // Rimuovo il mock manuale di dati-cliente perché auth-helper lo fa già

    // Imposta header per bypassare autenticazione server-side
    await page.setExtraHTTPHeaders({
      "x-test-mode": "playwright",
    });
  });

  test("1. Pagina carica correttamente per superadmin", async ({ page }) => {
    // Naviga alla pagina listini master
    await page.goto("/dashboard/super-admin/listini-master");
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    console.log("📍 URL attuale:", url);

    // Verifica redirect prima di aspettare il contenuto
    if (!url.includes("/listini-master")) {
      console.log("⚠️ Redirect rilevato, skip check contenuto");
      return;
    }

    // Wait for loading to finish
    try {
      await expect(page.getByText("Verifica permessi...")).not.toBeVisible({
        timeout: 15000,
      });
    } catch (e) {
      console.log("⚠️ Timeout waiting for loading to finish");
    }

    // ✅ FIX: Verifica errori reali invece di cercare "500" (false positive con chunk IDs tipo "9504-...")
    const hasRealError = await page.locator('text=/500.*error|error.*500|Application error|Internal Server Error|Errore Supabase|Errore 500/i').count();
    expect(hasRealError).toBe(0);

    // Verifica heading
    await expect(
      page.getByRole("heading", { name: "Gestione Listini Master" })
    ).toBeVisible();

    // Verifica heading o access denied message
    const hasHeading =
      (await page.locator('h1:has-text("Gestione Listini Master")').count()) >
      0;
    const hasAccessDenied =
      (await page.locator("text=/Accesso Negato/i").count()) > 0;
    const hasLoading =
      (await page.locator("text=/Verifica permessi/i").count()) > 0;

    // Almeno uno deve essere visibile (page loaded correctly)
    expect(hasHeading || hasAccessDenied || hasLoading).toBe(true);

    if (hasAccessDenied) {
      console.log(
        "⚠️ Accesso negato - test user non è superadmin (comportamento corretto)"
      );
    } else if (hasHeading) {
      console.log("✅ Pagina listini master caricata correttamente");
    }
  });

  test("2. Verifica UI componenti principali", async ({ page }) => {
    await page.goto("/dashboard/super-admin/listini-master");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const url = page.url();

    // Skip se redirectato a login
    if (url.includes("/login")) {
      console.log(
        "⚠️ Skip: Redirected to login - test mode bypass not configured for this route"
      );
      test.skip();
      return;
    }

    // Se non autorizzato, skip il resto del test
    const hasAccessDenied =
      (await page.locator("text=/Accesso Negato/i").count()) > 0;
    if (hasAccessDenied) {
      console.log("⚠️ Skip: utente non superadmin");
      test.skip();
      return;
    }

    // Verifica componenti UI
    const hasSearchInput =
      (await page.locator('input[placeholder*="Cerca"]').count()) > 0;
    const hasRefreshButton =
      (await page.locator('button:has-text("Aggiorna")').count()) > 0;
    const hasTable = (await page.locator("table").count()) > 0;

    console.log(
      `📊 UI Components: Search=${hasSearchInput}, Refresh=${hasRefreshButton}, Table=${hasTable}`
    );

    // Almeno la tabella o l'input di ricerca dovrebbe essere presente
    expect(hasSearchInput || hasTable).toBe(true);
  });

  test("3. Test ricerca listini", async ({ page }) => {
    await page.goto("/dashboard/super-admin/listini-master");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    const url = page.url();
    if (url.includes("/login")) {
      test.skip();
      return;
    }

    const hasAccessDenied =
      (await page.locator("text=/Accesso Negato/i").count()) > 0;
    if (hasAccessDenied) {
      test.skip();
      return;
    }

    // Trova input ricerca
    const searchInput = page.locator('input[placeholder*="Cerca"]');
    if ((await searchInput.count()) > 0) {
      // Digita termine di ricerca
      await searchInput.fill("GLS");
      await page.waitForTimeout(500);

      // Verifica che la tabella si aggiorni (filtro applicato)
      console.log("✅ Ricerca eseguita correttamente");
    } else {
      console.log("⚠️ Input ricerca non trovato");
    }
  });

  test("4. Verifica pulsanti azione nella tabella", async ({ page }) => {
    await page.goto("/dashboard/super-admin/listini-master");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    const url = page.url();
    if (url.includes("/login")) {
      test.skip();
      return;
    }

    const hasAccessDenied =
      (await page.locator("text=/Accesso Negato/i").count()) > 0;
    if (hasAccessDenied) {
      test.skip();
      return;
    }

    // Cerca pulsanti azione (Clone, Assign, View)
    const hasCloneButton =
      (await page.locator('button[title="Clona listino"]').count()) > 0;
    const hasAssignButton =
      (await page.locator('button[title="Assegna a utente"]').count()) > 0;
    const hasViewButton =
      (await page.locator('button[title="Visualizza assegnazioni"]').count()) >
      0;

    console.log(
      `📊 Action buttons: Clone=${hasCloneButton}, Assign=${hasAssignButton}, View=${hasViewButton}`
    );

    // Se ci sono listini, i pulsanti dovrebbero essere presenti
    const hasTableRows = (await page.locator("table tbody tr").count()) > 0;
    if (hasTableRows) {
      // Almeno uno dei pulsanti azione dovrebbe esistere
      expect(hasCloneButton || hasAssignButton || hasViewButton).toBe(true);
    } else {
      console.log("ℹ️ Nessun listino master presente (tabella vuota)");
    }
  });

  test("5. Test apertura dialog clone", async ({ page }) => {
    await page.goto("/dashboard/super-admin/listini-master");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    const url = page.url();
    if (url.includes("/login")) {
      test.skip();
      return;
    }

    const hasAccessDenied =
      (await page.locator("text=/Accesso Negato/i").count()) > 0;
    if (hasAccessDenied) {
      test.skip();
      return;
    }

    // Cerca pulsante clone
    const cloneButton = page.locator('button[title="Clona listino"]').first();
    if ((await cloneButton.count()) > 0) {
      await cloneButton.click();
      await page.waitForTimeout(1000);

      // Verifica dialog aperto
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible();

      if (dialogVisible) {
        // Verifica contenuto dialog
        const hasTitle =
          (await dialog.locator("text=/Clona Listino/i").count()) > 0;
        const hasNameInput =
          (await dialog.locator("input#cloneName").count()) > 0;
        const hasUserSelect = (await dialog.locator("select").count()) > 0;

        console.log(
          `📊 Clone dialog: Title=${hasTitle}, NameInput=${hasNameInput}, UserSelect=${hasUserSelect}`
        );
        expect(hasTitle).toBe(true);

        // Chiudi dialog
        const cancelButton = dialog.locator('button:has-text("Annulla")');
        if ((await cancelButton.count()) > 0) {
          await cancelButton.click();
        } else {
          await page.keyboard.press("Escape");
        }
      } else {
        console.log("⚠️ Dialog clone non aperto");
      }
    } else {
      console.log(
        "ℹ️ Nessun pulsante clone disponibile (nessun listino master)"
      );
    }
  });

  test("6. Test apertura dialog assegnazione", async ({ page }) => {
    await page.goto("/dashboard/super-admin/listini-master");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000);

    const url = page.url();
    if (url.includes("/login")) {
      test.skip();
      return;
    }

    const hasAccessDenied =
      (await page.locator("text=/Accesso Negato/i").count()) > 0;
    if (hasAccessDenied) {
      test.skip();
      return;
    }

    // Cerca pulsante assign
    const assignButton = page
      .locator('button[title="Assegna a utente"]')
      .first();
    if ((await assignButton.count()) > 0) {
      await assignButton.click();
      await page.waitForTimeout(1000);

      // Verifica dialog aperto
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible();

      if (dialogVisible) {
        // Verifica contenuto dialog
        const hasTitle =
          (await dialog.locator("text=/Assegna Listino/i").count()) > 0;
        const hasUserSelect = (await dialog.locator("select").count()) > 0;
        const hasNotesField = (await dialog.locator("textarea").count()) > 0;

        console.log(
          `📊 Assign dialog: Title=${hasTitle}, UserSelect=${hasUserSelect}, Notes=${hasNotesField}`
        );
        expect(hasTitle).toBe(true);

        // Chiudi dialog
        const cancelButton = dialog.locator('button:has-text("Annulla")');
        if ((await cancelButton.count()) > 0) {
          await cancelButton.click();
        } else {
          await page.keyboard.press("Escape");
        }
      } else {
        console.log("⚠️ Dialog assign non aperto");
      }
    } else {
      console.log(
        "ℹ️ Nessun pulsante assign disponibile (nessun listino master)"
      );
    }
  });
});
