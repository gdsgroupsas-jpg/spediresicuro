/**
 * Unit Tests: Invoice Webhook Authentication Fix
 *
 * Verifica che il webhook Stripe possa generare fatture senza autenticazione.
 *
 * @module tests/unit/invoice-webhook-auth.test
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock requireSafeAuth per simulare webhook (no auth)
vi.mock("@/lib/safe-auth", () => ({
  requireSafeAuth: vi.fn(() => {
    throw new Error("UNAUTHORIZED: No user session");
  }),
}));

describe("Invoice Webhook Authentication Fix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dovrebbe fallire se generateInvoiceFromRechargesAction viene chiamata senza auth", async () => {
    // Simula chiamata da webhook (no auth)
    const { generateInvoiceFromRechargesAction } = await import(
      "@/actions/invoice-recharges"
    );

    const result = await generateInvoiceFromRechargesAction({
      userId: "test-user-id",
      transactionIds: ["tx-1"],
    });

    // Dovrebbe fallire perché richiede autenticazione
    expect(result.success).toBe(false);
    expect(result.error).toContain("UNAUTHORIZED: No user session");
  });

  it("dovrebbe permettere generateAutomaticInvoiceForStripeRecharge senza auth", async () => {
    // Questa funzione NON dovrebbe chiamare requireSafeAuth
    // (usa internalGenerateInvoiceFromRecharges)
    const { generateAutomaticInvoiceForStripeRecharge } = await import(
      "@/actions/invoice-recharges"
    );

    // Mock supabaseAdmin per evitare chiamate reali
    vi.mock("@/lib/db/client", () => ({
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: null,
                  error: { message: "Transaction not found" },
                })),
              })),
            })),
          })),
        })),
      },
    }));

    const result = await generateAutomaticInvoiceForStripeRecharge("tx-1");

    // Non dovrebbe fallire per autenticazione (ma per transazione non trovata)
    expect(result.success).toBe(false);
    expect(result.error).toContain("Transazione non trovata");
    // NON dovrebbe contenere "UNAUTHORIZED" o "Non autenticato"
    expect(result.error).not.toContain("UNAUTHORIZED");
    expect(result.error).not.toContain("Non autenticato");
  });
});
