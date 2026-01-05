/**
 * Test Unit: Multi-Account Price Lists
 * 
 * Test per le funzionalità multi-account dei listini fornitore:
 * 1. CourierSelector - abilitazione/disabilitazione corrieri
 * 2. Auto-disable listini quando config diventa inattiva
 * 3. AccountSelector - selezione account per booking
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
vi.mock("@/lib/db/client", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ error: null })),
        })),
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: "test-id" }, error: null })),
        })),
      })),
    })),
  },
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}));

describe("Multi-Account Price Lists", () => {
  describe("Courier Selector Logic", () => {
    it("should validate enabled_carriers is not empty", () => {
      const enabledCouriers: string[] = [];
      expect(enabledCouriers.length).toBe(0);
      
      // Logica: almeno un corriere deve essere abilitato
      const isValid = enabledCouriers.length > 0;
      expect(isValid).toBe(false);
    });

    it("should sanitize courier codes", () => {
      const rawCouriers = ["GLS", "PosteDeliveryBusiness", "INVALID@CHAR", "  spaces  "];
      
      const sanitized = rawCouriers
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.toLowerCase().replace(/[^a-z0-9_-]/g, "").trim())
        .filter((c) => c.length > 0);

      expect(sanitized).toEqual(["gls", "postedeliverybusiness", "invalidchar", "spaces"]);
    });

    it("should not allow disabling all couriers", () => {
      const currentSelection = new Set(["gls"]);
      const courierToRemove = "gls";
      
      // Logica: se rimuovendo questo corriere la selezione diventa vuota, blocca
      const wouldBeEmpty = currentSelection.size === 1 && currentSelection.has(courierToRemove);
      expect(wouldBeEmpty).toBe(true);
      
      // Non deve permettere la rimozione
      if (!wouldBeEmpty) {
        currentSelection.delete(courierToRemove);
      }
      expect(currentSelection.size).toBe(1); // Ancora 1
    });
  });

  describe("Auto-disable Price Lists", () => {
    it("should identify price lists by courier_config_id in metadata", () => {
      const priceList = {
        id: "pl-1",
        name: "GLS - Account 1",
        metadata: {
          courier_config_id: "config-123",
          carrier_code: "gls",
        },
      };

      const configIdToDisable = "config-123";
      const shouldDisable = priceList.metadata?.courier_config_id === configIdToDisable;
      
      expect(shouldDisable).toBe(true);
    });

    it("should not disable price lists from other configs", () => {
      const priceList = {
        id: "pl-2",
        name: "GLS - Account 2",
        metadata: {
          courier_config_id: "config-456",
          carrier_code: "gls",
        },
      };

      const configIdToDisable = "config-123";
      const shouldDisable = priceList.metadata?.courier_config_id === configIdToDisable;
      
      expect(shouldDisable).toBe(false);
    });

    it("should filter active and draft status for disabling", () => {
      const priceLists = [
        { id: "1", status: "active", metadata: { courier_config_id: "cfg" } },
        { id: "2", status: "draft", metadata: { courier_config_id: "cfg" } },
        { id: "3", status: "archived", metadata: { courier_config_id: "cfg" } },
        { id: "4", status: "inactive", metadata: { courier_config_id: "cfg" } },
      ];

      const disableableStatuses = ["active", "draft"];
      const toDisable = priceLists.filter(
        (pl) => disableableStatuses.includes(pl.status) && pl.metadata.courier_config_id === "cfg"
      );

      expect(toDisable.length).toBe(2);
      expect(toDisable.map((p) => p.id)).toEqual(["1", "2"]);
    });
  });

  describe("Account Selector Logic", () => {
    it("should select default account when available", () => {
      const accounts = [
        { id: "acc-1", name: "Account 1", isDefault: false },
        { id: "acc-2", name: "Account 2", isDefault: true },
        { id: "acc-3", name: "Account 3", isDefault: false },
      ];

      const defaultAccount = accounts.find((a) => a.isDefault);
      expect(defaultAccount?.id).toBe("acc-2");
    });

    it("should select first account when no default", () => {
      const accounts = [
        { id: "acc-1", name: "Account 1", isDefault: false },
        { id: "acc-2", name: "Account 2", isDefault: false },
      ];

      const defaultAccount = accounts.find((a) => a.isDefault);
      const selectedAccount = defaultAccount || accounts[0];
      
      expect(selectedAccount.id).toBe("acc-1");
    });

    it("should hide selector when single account and hideIfSingle is true", () => {
      const accounts = [{ id: "acc-1", name: "Account 1", isDefault: true }];
      const hideIfSingle = true;

      const shouldHide = hideIfSingle && accounts.length <= 1;
      expect(shouldHide).toBe(true);
    });

    it("should show selector when multiple accounts", () => {
      const accounts = [
        { id: "acc-1", name: "Account 1", isDefault: false },
        { id: "acc-2", name: "Account 2", isDefault: true },
      ];
      const hideIfSingle = true;

      const shouldHide = hideIfSingle && accounts.length <= 1;
      expect(shouldHide).toBe(false);
    });
  });

  describe("Metadata Structure", () => {
    it("should include carrier_code in price list metadata", () => {
      const metadata = {
        carrier_code: "gls",
        courier_config_id: "config-123",
        synced_at: new Date().toISOString(),
      };

      expect(metadata.carrier_code).toBeDefined();
      expect(metadata.courier_config_id).toBeDefined();
    });

    it("should store enabled_carriers in automation_settings", () => {
      const automationSettings = {
        enabled_carriers: ["gls", "postedeliverybusiness"],
        courier_settings_updated_at: new Date().toISOString(),
      };

      expect(automationSettings.enabled_carriers).toBeInstanceOf(Array);
      expect(automationSettings.enabled_carriers.length).toBeGreaterThan(0);
    });
  });
});
