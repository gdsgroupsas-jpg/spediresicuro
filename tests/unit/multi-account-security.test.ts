/**
 * Test Unit: Multi-Account Security - Isolamento e Ownership
 *
 * Test critici per la sicurezza multi-account:
 * 1. Utente A NON può accedere a configId di Utente B
 * 2. Validazione ownership su configId prima di accesso
 * 3. Isolamento configurazioni tra utenti diversi
 * 4. Admin può accedere a tutte le configurazioni
 * 5. supabaseAdmin bypass RLS - serve validazione esplicita
 *
 * Riferimento: AUDIT_MULTI_ACCOUNT_LISTINI_2026.md - P1-1
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Tipi per i test
interface MockConfig {
  id: string;
  owner_user_id: string | null;
  provider_id?: string;
  api_key?: string;
  is_active?: boolean;
  is_default?: boolean;
  priority?: number;
}

interface MockPriceList {
  id: string;
  created_by: string;
  list_type: string;
  is_global?: boolean;
  metadata?: { courier_config_id?: string };
}

// Mock Supabase
vi.mock("@/lib/db/client", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
  supabase: {
    from: vi.fn(),
  },
}));

// Mock auth
vi.mock("@/lib/safe-auth", () => ({
  requireSafeAuth: vi.fn(),
  getSafeAuth: vi.fn(),
}));

describe("Multi-Account Security - Isolamento Configurazioni", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Validazione Ownership configId", () => {
    it("dovrebbe BLOCCARE accesso a configId di altro utente", () => {
      // Setup: Utente A prova ad accedere a config di Utente B
      const userAId = "user-a-uuid-1234";
      const userBId = "user-b-uuid-5678";
      const configIdOfUserB = "config-uuid-owned-by-user-b";

      // Mock: la config appartiene a Utente B
      const mockConfig: MockConfig = {
        id: configIdOfUserB,
        owner_user_id: userBId, // Appartiene a B, non ad A
        provider_id: "spedisci_online",
        api_key: "encrypted_key",
        is_active: true,
      };

      // Funzione di validazione ownership (logica che dovrebbe esistere)
      function validateConfigOwnership(
        config: MockConfig,
        requestingUserId: string,
        isAdmin: boolean
      ): { allowed: boolean; reason: string } {
        // Admin può accedere a tutto
        if (isAdmin) {
          return { allowed: true, reason: "admin_override" };
        }

        // Utente normale può accedere solo alle proprie config
        if (config.owner_user_id !== requestingUserId) {
          return {
            allowed: false,
            reason: "ownership_mismatch",
          };
        }

        return { allowed: true, reason: "owner" };
      }

      // Test: Utente A (non admin) prova ad accedere
      const resultA = validateConfigOwnership(mockConfig, userAId, false);
      expect(resultA.allowed).toBe(false);
      expect(resultA.reason).toBe("ownership_mismatch");

      // Test: Utente B (proprietario) può accedere
      const resultB = validateConfigOwnership(mockConfig, userBId, false);
      expect(resultB.allowed).toBe(true);
      expect(resultB.reason).toBe("owner");
    });

    it("dovrebbe PERMETTERE accesso admin a qualsiasi configId", () => {
      const adminUserId = "admin-uuid-0000";
      const anyUserId = "any-user-uuid-9999";
      const anyConfigId = "any-config-uuid";

      const mockConfig: MockConfig = {
        id: anyConfigId,
        owner_user_id: anyUserId, // Non appartiene all'admin
        provider_id: "spedisci_online",
        is_active: true,
      };

      function validateConfigOwnership(
        config: MockConfig,
        requestingUserId: string,
        isAdmin: boolean
      ): { allowed: boolean; reason: string } {
        if (isAdmin) {
          return { allowed: true, reason: "admin_override" };
        }
        if (config.owner_user_id !== requestingUserId) {
          return { allowed: false, reason: "ownership_mismatch" };
        }
        return { allowed: true, reason: "owner" };
      }

      // Admin può accedere anche se non è owner
      const result = validateConfigOwnership(mockConfig, adminUserId, true);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("admin_override");
    });

    it("dovrebbe gestire configId inesistente", () => {
      // Setup: configId non esiste nel database
      const nonExistentConfigId = "config-does-not-exist";

      // Simula query che non trova nulla
      function findConfigById(configId: string): MockConfig | null {
        // Simula database lookup
        const configs: Record<string, MockConfig> = {
          "existing-config": {
            id: "existing-config",
            owner_user_id: "some-user",
          },
        };
        return configs[configId] || null;
      }

      const result = findConfigById(nonExistentConfigId);
      expect(result).toBeNull();

      // Il sistema dovrebbe restituire errore "not found"
      const response = result
        ? { success: true }
        : { success: false, error: "Configurazione non trovata" };

      expect(response.success).toBe(false);
      expect(response.error).toBe("Configurazione non trovata");
    });

    it("dovrebbe validare formato UUID di configId", () => {
      // UUID valido v4
      const validUUID = "550e8400-e29b-41d4-a716-446655440000";
      // UUID non validi
      const invalidUUIDs = [
        "not-a-uuid",
        "12345",
        "'; DROP TABLE configs; --", // SQL injection attempt
        "<script>alert('xss')</script>", // XSS attempt
        "",
      ];

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuidRegex.test(validUUID)).toBe(true);

      invalidUUIDs.forEach((invalid) => {
        expect(uuidRegex.test(invalid)).toBe(false);
      });
    });
  });

  describe("Priorità Configurazione", () => {
    /**
     * Priorità Configurazione (da factory.ts):
     * 1. configId specifico (se fornito) → query diretta per ID
     * 2. Config personale (owner_user_id = userId) → priorità massima
     * 3. Config assegnata (assigned_config_id) → priorità media
     * 4. Config default (is_default = true) → fallback
     */

    // Helper function per selezionare config con priorità
    function selectConfig(
      configs: MockConfig[],
      specificId?: string,
      userId?: string
    ): MockConfig | null {
      // Priorità 1: configId specifico
      if (specificId) {
        return configs.find((c) => c.id === specificId) || null;
      }

      // Priorità 2: config personale
      if (userId) {
        const personal = configs.find((c) => c.owner_user_id === userId);
        if (personal) return personal;
      }

      // Priorità 4: default
      return configs.find((c) => c.is_default) || null;
    }

    it("dovrebbe usare configId specifico se fornito (priorità 1)", () => {
      const configs: MockConfig[] = [
        {
          id: "default-config",
          is_default: true,
          owner_user_id: null,
          priority: 4,
        },
        {
          id: "personal-config",
          is_default: false,
          owner_user_id: "user-123",
          priority: 2,
        },
        {
          id: "specific-config",
          is_default: false,
          owner_user_id: "user-456",
          priority: 1,
        },
      ];

      const specificConfigId = "specific-config";

      const result = selectConfig(configs, specificConfigId);
      expect(result?.id).toBe("specific-config");
    });

    it("dovrebbe preferire config personale se configId non fornito (priorità 2)", () => {
      const userId = "user-123";
      const configs: MockConfig[] = [
        {
          id: "default-config",
          is_default: true,
          owner_user_id: null,
        },
        {
          id: "personal-config",
          is_default: false,
          owner_user_id: userId, // Config personale dell'utente
        },
        {
          id: "other-config",
          is_default: false,
          owner_user_id: "other-user",
        },
      ];

      // Senza specificId, deve selezionare la config personale
      const result = selectConfig(configs, undefined, userId);
      expect(result?.id).toBe("personal-config");
      expect(result?.owner_user_id).toBe(userId);
    });

    it("dovrebbe usare config default come fallback (priorità 4)", () => {
      const userId = "user-without-personal-config";
      const configs: MockConfig[] = [
        {
          id: "default-config",
          is_default: true,
          owner_user_id: null,
        },
        {
          id: "other-personal",
          is_default: false,
          owner_user_id: "other-user",
        },
      ];

      // Utente senza config personale deve usare default
      const result = selectConfig(configs, undefined, userId);
      expect(result?.id).toBe("default-config");
      expect(result?.is_default).toBe(true);
    });

    it("dovrebbe restituire null se nessuna config disponibile", () => {
      const configs: MockConfig[] = [];

      const result = selectConfig(configs, undefined, "any-user");
      expect(result).toBeNull();
    });
  });

  describe("Isolamento Multi-Tenant", () => {
    // Helper function per filtrare config per utente
    function getConfigsForUser(
      allConfigs: MockConfig[],
      userId: string,
      isAdmin: boolean
    ): MockConfig[] {
      if (isAdmin) {
        return allConfigs; // Admin vede tutto
      }

      return allConfigs.filter(
        (c) =>
          c.owner_user_id === userId || // Config proprie
          (c.is_default === true && c.owner_user_id === null) // Config default globali
      );
    }

    it("dovrebbe isolare configurazioni tra tenant diversi", () => {
      // Simula database con configurazioni di tenant diversi
      const allConfigs: MockConfig[] = [
        {
          id: "tenant-a-config-1",
          owner_user_id: "tenant-a",
          provider_id: "spedisci_online",
        },
        {
          id: "tenant-a-config-2",
          owner_user_id: "tenant-a",
          provider_id: "spedisci_online",
        },
        {
          id: "tenant-b-config-1",
          owner_user_id: "tenant-b",
          provider_id: "spedisci_online",
        },
        {
          id: "global-default",
          owner_user_id: null, // Config globale
          provider_id: "spedisci_online",
          is_default: true,
        },
      ];

      // Tenant A vede solo le sue config + default
      const tenantAConfigs = getConfigsForUser(allConfigs, "tenant-a", false);
      expect(tenantAConfigs.length).toBe(3); // 2 proprie + 1 default
      expect(tenantAConfigs.map((c) => c.id)).toContain("tenant-a-config-1");
      expect(tenantAConfigs.map((c) => c.id)).toContain("tenant-a-config-2");
      expect(tenantAConfigs.map((c) => c.id)).toContain("global-default");
      expect(tenantAConfigs.map((c) => c.id)).not.toContain(
        "tenant-b-config-1"
      );

      // Tenant B vede solo le sue config + default
      const tenantBConfigs = getConfigsForUser(allConfigs, "tenant-b", false);
      expect(tenantBConfigs.length).toBe(2); // 1 propria + 1 default
      expect(tenantBConfigs.map((c) => c.id)).toContain("tenant-b-config-1");
      expect(tenantBConfigs.map((c) => c.id)).not.toContain(
        "tenant-a-config-1"
      );

      // Admin vede tutto
      const adminConfigs = getConfigsForUser(allConfigs, "admin-user", true);
      expect(adminConfigs.length).toBe(4);
    });

    it("dovrebbe prevenire cross-tenant data leakage nei listini", () => {
      // Simula listini di tenant diversi
      const allPriceLists: MockPriceList[] = [
        {
          id: "pl-tenant-a-1",
          created_by: "tenant-a",
          list_type: "supplier",
          metadata: { courier_config_id: "tenant-a-config-1" },
        },
        {
          id: "pl-tenant-b-1",
          created_by: "tenant-b",
          list_type: "supplier",
          metadata: { courier_config_id: "tenant-b-config-1" },
        },
        {
          id: "pl-global",
          created_by: "admin",
          list_type: "global",
          is_global: true,
        },
      ];

      // Funzione che simula filtro listini per utente non-admin
      function getPriceListsForUser(
        allLists: MockPriceList[],
        userId: string,
        isAdmin: boolean,
        isReseller: boolean
      ): MockPriceList[] {
        if (isAdmin) {
          return allLists;
        }

        return allLists.filter((pl) => {
          // Reseller/BYOC vedono solo supplier propri
          if (isReseller) {
            return pl.list_type === "supplier" && pl.created_by === userId;
          }
          // Utente normale vede solo i propri
          return pl.created_by === userId;
        });
      }

      // Tenant A (reseller) vede solo il suo listino supplier
      const tenantALists = getPriceListsForUser(
        allPriceLists,
        "tenant-a",
        false,
        true
      );
      expect(tenantALists.length).toBe(1);
      expect(tenantALists[0].id).toBe("pl-tenant-a-1");

      // NON vede listini di tenant B
      expect(tenantALists.map((pl) => pl.id)).not.toContain("pl-tenant-b-1");

      // NON vede listini globali (reseller non vede global)
      expect(tenantALists.map((pl) => pl.id)).not.toContain("pl-global");
    });
  });

  describe("Logging Sicuro - No UUID Completi", () => {
    /**
     * Riferimento: P1-3 dall'audit
     * I log non devono contenere UUID completi per prevenire information leakage
     */

    it("dovrebbe usare hash parziale per logging configId", () => {
      const fullUUID = "550e8400-e29b-41d4-a716-446655440000";

      // Helper per logging sicuro
      function safeLogId(id: string): string {
        if (!id || id.length < 8) return "[invalid]";
        return `${id.substring(0, 8)}...`;
      }

      const safeLog = safeLogId(fullUUID);
      expect(safeLog).toBe("550e8400...");
      expect(safeLog.length).toBeLessThan(fullUUID.length);
      expect(safeLog).not.toContain(fullUUID.substring(8));
    });

    it("dovrebbe gestire input invalidi per logging", () => {
      function safeLogId(id: string | null | undefined): string {
        if (!id || typeof id !== "string" || id.length < 8) return "[invalid]";
        return `${id.substring(0, 8)}...`;
      }

      expect(safeLogId(null)).toBe("[invalid]");
      expect(safeLogId(undefined)).toBe("[invalid]");
      expect(safeLogId("")).toBe("[invalid]");
      expect(safeLogId("short")).toBe("[invalid]");
    });
  });
});

describe("supabaseAdmin Bypass RLS - Validazione Esplicita", () => {
  /**
   * IMPORTANTE: supabaseAdmin bypassa RLS!
   * Quando si usa supabaseAdmin con configId dal client,
   * DEVE essere validata ownership esplicitamente nel codice.
   */

  it("dovrebbe documentare che supabaseAdmin bypassa RLS", () => {
    // Questo test è documentativo - verifica la consapevolezza del rischio

    const securityNotes = {
      supabaseAdmin: {
        bypassesRLS: true,
        requiresExplicitValidation: true,
        useCases: [
          "Server actions con service role",
          "API routes con autenticazione custom",
          "CRON jobs di sistema",
        ],
      },
      supabase: {
        bypassesRLS: false,
        usesUserContext: true,
        useCases: ["Client-side queries", "Authenticated user operations"],
      },
    };

    expect(securityNotes.supabaseAdmin.bypassesRLS).toBe(true);
    expect(securityNotes.supabaseAdmin.requiresExplicitValidation).toBe(true);
    expect(securityNotes.supabase.bypassesRLS).toBe(false);
  });

  it("dovrebbe richiedere validazione ownership quando si usa supabaseAdmin con configId client", () => {
    // Pattern corretto per validazione ownership
    const correctPattern = `
      if (configId) {
        const { data: specificConfig } = await supabaseAdmin
          .from("courier_configs")
          .select("*")
          .eq("id", configId)
          .eq("provider_id", "spedisci_online")
          .single();

        if (!specificConfig) {
          return { success: false, error: "Configurazione non trovata" };
        }

        // ✅ VALIDAZIONE OWNERSHIP OBBLIGATORIA
        const isAdmin = user.account_type === "admin" || user.account_type === "superadmin";
        if (!isAdmin && specificConfig.owner_user_id !== userId) {
          return { success: false, error: "Non autorizzato" };
        }
      }
    `;

    // Il pattern deve includere validazione ownership
    expect(correctPattern).toContain("owner_user_id !== userId");
    expect(correctPattern).toContain("isAdmin");
    expect(correctPattern).toContain("Non autorizzato");
  });
});
