/**
 * Helper per autenticazione nei test E2E
 *
 * Questo helper bypassa il login UI e crea direttamente una sessione valida
 * Supporta diversi ruoli: user, admin, reseller, superadmin
 */

import { Page } from "@playwright/test";

/**
 * User roles disponibili per i test
 */
export type TestUserRole = "user" | "admin" | "reseller" | "superadmin" | "byoc";

/**
 * ✅ UNIFIED AUTH HELPER: Autentica l'utente di test con ruolo specifico
 *
 * Questo metodo:
 * 1. Mocka l'API /api/auth/session per restituire una sessione valida
 * 2. Aggiunge un cookie di sessione (se necessario)
 * 3. Mocka API secondarie (dati-cliente, user/info)
 *
 * @param page - Playwright Page object
 * @param role - Ruolo utente (user, admin, reseller, superadmin, byoc)
 */
export async function authenticateAs(page: Page, role: TestUserRole = "user") {
  const testEmail = `test-${role}@example.com`;
  const userId = `test-user-${role}-id`;

  // Determina account_type e is_reseller in base al ruolo
  const accountTypeMap: Record<TestUserRole, string> = {
    user: "user",
    admin: "admin",
    reseller: "reseller",
    superadmin: "superadmin",
    byoc: "byoc",
  };

  const isResellerMap: Record<TestUserRole, boolean> = {
    user: false,
    admin: false,
    reseller: true,
    superadmin: true,
    byoc: false,
  };

  // Mock completo dell'API session di NextAuth
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: userId,
          email: testEmail,
          name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)} User`,
          role: role === "user" ? "user" : "admin",
          account_type: accountTypeMap[role],
          is_reseller: isResellerMap[role],
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

  // Mock dell'API user/info (usata da molte pagine per verificare permessi)
  await page.route("**/api/user/info", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: userId,
          email: testEmail,
          name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)} User`,
          account_type: accountTypeMap[role],
          is_reseller: isResellerMap[role],
        },
      }),
    });
  });

  console.log(`✅ Sessione mockata per utente di test: ${testEmail} (${role})`);
}

/**
 * LEGACY: Manteniamo authenticateTestUser per retrocompatibilità
 * @deprecated Usa authenticateAs(page, 'superadmin') invece
 */
export async function authenticateTestUser(page: Page) {
  return authenticateAs(page, "superadmin");
}
