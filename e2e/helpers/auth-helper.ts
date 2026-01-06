/**
 * Helper per autenticazione nei test E2E
 *
 * Questo helper bypassa il login UI e crea direttamente una sessione valida
 */

import { Page } from "@playwright/test";

/**
 * Autentica l'utente di test bypassando il login UI
 *
 * Questo metodo:
 * 1. Mocka l'API /api/auth/session per restituire una sessione valida
 * 2. Aggiunge un cookie di sessione (se necessario)
 * 3. Naviga direttamente alla pagina protetta
 */
export async function authenticateTestUser(page: Page) {
  const testEmail = process.env.TEST_USER_EMAIL || "test@example.com";

  // Mock completo dell'API session di NextAuth
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "00000000-0000-0000-0000-000000000000",
          email: testEmail,
          name: "Test User E2E",
          role: "user",
          account_type: "superadmin",
          is_reseller: true,
        },
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
  });

  // Mock dell'API dati-cliente (la pagina di login la chiama)
  await page.route("**/api/user/dati-cliente", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        datiCliente: {
          datiCompletati: true,
        },
      }),
    });
  });

  // Aggiungi cookie di sessione (NextAuth potrebbe richiederlo)
  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: "test-session-token-" + Date.now(),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  console.log("✅ Sessione mockata per utente di test:", testEmail);
}
