import {
  getFiscalContext,
  getFiscalDeadlines,
  getPendingCOD,
  getShipmentsByPeriod,
} from "@/lib/agent/fiscal-data";
import * as supabaseServer from "@/lib/supabase-server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Supabase client
vi.mock("@/lib/supabase-server", () => ({
  createServerActionClient: vi.fn(),
}));

describe("Fiscal Data Module", () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    vi.mocked(supabaseServer.createServerActionClient).mockReturnValue(
      mockSupabaseClient
    );
  });

  describe("getFiscalDeadlines", () => {
    it("returns Italian fiscal calendar deadlines", () => {
      const deadlines = getFiscalDeadlines();

      expect(deadlines).toBeInstanceOf(Array);
      expect(deadlines.length).toBeGreaterThan(0);

      // Check structure of first deadline
      const firstDeadline = deadlines[0];
      expect(firstDeadline).toHaveProperty("date");
      expect(firstDeadline).toHaveProperty("description");
      expect(firstDeadline).toHaveProperty("type");
    });

    it("includes F24 deadlines", () => {
      const deadlines = getFiscalDeadlines();
      const f24Deadlines = deadlines.filter((d) => d.type === "F24");

      expect(f24Deadlines.length).toBeGreaterThan(0);
      expect(f24Deadlines[0].description).toContain("F24");
    });

    it("includes LIPE deadlines", () => {
      const deadlines = getFiscalDeadlines();
      const lipeDeadlines = deadlines.filter((d) => d.type === "LIPE");

      expect(lipeDeadlines.length).toBeGreaterThan(0);
    });

    it("uses current year for all deadlines", () => {
      const currentYear = new Date().getFullYear();
      const deadlines = getFiscalDeadlines();

      deadlines.forEach((deadline) => {
        expect(deadline.date).toContain(currentYear.toString());
      });
    });
  });

  describe("getShipmentsByPeriod", () => {
    const mockShipments = [
      {
        id: "1",
        created_at: "2026-01-10",
        status: "delivered",
        total_price: 10.5,
        courier_cost: 7.2,
        margin: 3.3,
        cash_on_delivery: false,
        cod_status: null,
        user_id: "user-123",
      },
      {
        id: "2",
        created_at: "2026-01-12",
        status: "in_transit",
        total_price: 15.0,
        courier_cost: 10.0,
        margin: 5.0,
        cash_on_delivery: true,
        cod_status: "pending",
        user_id: "user-123",
      },
    ];

    it("fetches shipments for standard user", async () => {
      // Mock che supporta chaining multiplo: .eq("deleted", false).eq("user_id", userId)
      const createQueryBuilder = () => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
        };
        // L'ultimo .eq() deve restituire una Promise quando viene await
        // Usiamo un contatore per distinguere le chiamate
        let eqCallCount = 0;
        builder.eq = vi.fn(function (column: string, value: any) {
          eqCallCount++;
          // Se è la seconda chiamata a .eq() (user_id), restituisci Promise
          if (eqCallCount === 2) {
            return Promise.resolve({
              data: mockShipments,
              error: null,
            });
          }
          // Altrimenti restituisci this per il chaining
          return this;
        });
        return builder;
      };

      mockSupabaseClient.from = vi.fn().mockReturnValue(createQueryBuilder());

      const result = await getShipmentsByPeriod(
        "user-123",
        "user",
        "2026-01-01",
        "2026-01-31"
      );

      expect(result).toEqual(mockShipments);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("shipments");
    });

    it("filters by user_id for standard user", async () => {
      let eqCalls: Array<[string, any]> = [];
      
      const createQueryBuilder = () => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
        };
        let eqCallCount = 0;
        builder.eq = vi.fn(function (column: string, value: any) {
          eqCalls.push([column, value]);
          eqCallCount++;
          // Seconda chiamata (user_id) restituisce Promise
          if (eqCallCount === 2) {
            return Promise.resolve({
              data: mockShipments,
              error: null,
            });
          }
          return this;
        });
        return builder;
      };

      mockSupabaseClient.from = vi.fn().mockReturnValue(createQueryBuilder());

      await getShipmentsByPeriod(
        "user-123",
        "user",
        "2026-01-01",
        "2026-01-31"
      );

      // Verifica che .eq() sia stato chiamato con user_id
      const userEqCall = eqCalls.find(([col]) => col === "user_id");
      expect(userEqCall).toBeDefined();
      expect(userEqCall?.[1]).toBe("user-123");
    });

    it("includes sub-users for reseller role", async () => {
      // Mock sub-users query
      const subUsersQuery = {
        data: [{ id: "sub-user-1" }, { id: "sub-user-2" }],
        error: null,
      };

      let inCallArgs: any = null;

      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue(subUsersQuery),
          };
        }
        // Per shipments: supporta chaining .eq("deleted", false).in("user_id", ...)
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn(function (column: string, values: any[]) {
            inCallArgs = [column, values];
            return Promise.resolve({
              data: mockShipments,
              error: null,
            });
          }),
        };
        return builder;
      });

      await getShipmentsByPeriod(
        "reseller-123",
        "reseller",
        "2026-01-01",
        "2026-01-31"
      );

      expect(inCallArgs).toBeDefined();
      expect(inCallArgs[0]).toBe("user_id");
      expect(inCallArgs[1]).toEqual([
        "reseller-123",
        "sub-user-1",
        "sub-user-2",
      ]);
    });

    it("throws error on database failure", async () => {
      const createQueryBuilder = () => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
        };
        let eqCallCount = 0;
        builder.eq = vi.fn(function (column: string, value: any) {
          eqCallCount++;
          // Seconda chiamata (user_id) restituisce errore
          if (eqCallCount === 2) {
            return Promise.resolve({
              data: null,
              error: { message: "Database error" },
            });
          }
          return this;
        });
        return builder;
      };

      mockSupabaseClient.from = vi.fn().mockReturnValue(createQueryBuilder());

      await expect(
        getShipmentsByPeriod("user-123", "user", "2026-01-01", "2026-01-31")
      ).rejects.toThrow("Errore recupero spedizioni: Database error");
    });
  });

  describe("getPendingCOD", () => {
    // ⚠️ Il codice usa cash_on_delivery_amount, non cash_on_delivery
    const mockCODShipments = [
      {
        id: "1",
        created_at: "2026-01-10",
        cash_on_delivery_amount: 50.0,
        cod_status: "pending",
        user_id: "user-123",
      },
      {
        id: "2",
        created_at: "2026-01-12",
        cash_on_delivery_amount: 75.5,
        cod_status: "collected",
        user_id: "user-123",
      },
    ];
    
    // Risultato mappato atteso (dopo il mapping nel codice)
    const expectedMappedCODShipments = [
      {
        id: "1",
        created_at: "2026-01-10",
        cash_on_delivery: 50.0,
        cod_status: "pending",
        user_id: "user-123",
      },
      {
        id: "2",
        created_at: "2026-01-12",
        cash_on_delivery: 75.5,
        cod_status: "collected",
        user_id: "user-123",
      },
    ];

    it("fetches pending COD shipments", async () => {
      // getPendingCOD fa: .select().eq("cash_on_delivery", true).neq().eq("deleted", false).eq("user_id", userId)
      // Quindi TRE chiamate a .eq(): cash_on_delivery, deleted, user_id
      const createQueryBuilder = () => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
        };
        let eqCallCount = 0;
        builder.eq = vi.fn(function (column: string, value: any) {
          eqCallCount++;
          // Terza chiamata a .eq() (user_id) restituisce Promise
          if (eqCallCount === 3) {
            return Promise.resolve({
              data: mockCODShipments,
              error: null,
            });
          }
          // Prime due chiamate restituiscono this per il chaining
          return this;
        });
        return builder;
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(createQueryBuilder());

      const result = await getPendingCOD("user-123", "user");

      expect(result).toEqual(expectedMappedCODShipments);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("shipments");
    });

    it("filters by cash_on_delivery = true", async () => {
      const eqMock = vi.fn().mockReturnThis();
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({ data: mockCODShipments, error: null }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockBuilder);

      await getPendingCOD("user-123", "user");

      expect(eqMock).toHaveBeenCalledWith("cash_on_delivery", true);
    });

    it("excludes paid COD shipments", async () => {
      const neqMock = vi.fn().mockReturnThis();
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: neqMock,
        is: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({ data: mockCODShipments, error: null }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockBuilder);

      await getPendingCOD("user-123", "user");

      expect(neqMock).toHaveBeenCalledWith("cod_status", "paid");
    });

    it("throws error on database failure", async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({ data: null, error: { message: "COD query failed" } }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockBuilder);

      await expect(getPendingCOD("user-123", "user")).rejects.toThrow(
        "Errore recupero COD: COD query failed"
      );
    });
  });

  describe("getFiscalContext", () => {
    it("returns complete fiscal context structure", async () => {
      // Mock all database calls
      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wallet_balance: "1500.50" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext("user-123", "user");

      expect(context).toHaveProperty("userId");
      expect(context).toHaveProperty("role");
      expect(context).toHaveProperty("period");
      expect(context).toHaveProperty("wallet");
      expect(context).toHaveProperty("shipmentsSummary");
      expect(context).toHaveProperty("pending_cod_count");
      expect(context).toHaveProperty("pending_cod_value");
      expect(context).toHaveProperty("deadlines");
    });

    it("calculates shipments summary correctly", async () => {
      const mockShipments = [
        { margin: 10.5, total_price: 50.0 },
        { margin: 5.0, total_price: 25.0 },
        { margin: 8.3, total_price: 40.0 },
      ];

      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wallet_balance: "100.00" },
              error: null,
            }),
          };
        }
        if (tableName === "shipments") {
          // We need to distinguish between getShipmentsByPeriod and getPendingCOD calls
          // One way is to check if 'cod_status' was selected or filtered.
          // Since we can't easily statefully switch based on call order in a shared builder without complex logic,
          // we'll make a builder that returns data for both if they were combined, OR simpler:
          // Just return mock data that satisfies the aggregator.

          return {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockReturnThis(),
            then: (resolve: any) => {
              // If we are being awaited, we return data.
              // But how do we distinguish?
              // getShipmentsByPeriod calls: .gte().lte().is().eq()
              // getPendingCOD calls: .select().eq().neq().is().eq()

              // For this test "calculates shipments summary correctly", we want shipmentsCount to be from mockShipments.
              // And COD to be whatever (empty is fine).
              // But the code calls BOTH.

              // If we just return mockShipments for ALL queries, `getPendingCOD` will try to reduce them.
              // But `getPendingCOD` expects `cash_on_delivery` field. mockShipments has `total_price` and `margin`.
              // It might not have `cash_on_delivery`.

              // Let's assume the first await is shipments, second is COD.
              // But `then` is a property, not a spy we can easily count calls on separate instances if we return new objects?
              // No, we return a new object every time `from` is called.

              // `from` is a spy.
              const callCount = mockSupabaseClient.from.mock.calls.length;
              // callCount 1 = Shipments
              // callCount 2 = COD
              // callCount 3 = Users (but that's handled by if tableName === users)

              // Wait, `from` is called inside `getShipmentsByPeriod` (call 1)
              // Then inside `getPendingCOD` (call 2)

              // Since we are INSIDE the `from` mock implementation:
              // The `from` implementation is called. We return a builder.
              // That builder is awaited.

              // We can't easily know WHICH call index we are serving inside `then` because `then` is called later.
              // BUT we can use the closure variable `callCount` derived from `mockSupabaseClient.from.mock.calls.length` AT THE TIME OF CREATION?
              // No, `from` is called immediately.

              // Let's use a simple counter external to the return object.
              // Or just inspect the usage?
              // Providing distinct data for shipments vs COD is safer.

              // But wait, the original test logic (lines 362-369) tried to do this with `chain.eq`.
              // "First call returns shipments, second call returns empty COD"
              // It assumed `eq` was the trigger.

              // Let's try to return a builder that returns mockShipments first, then empty list.
              // But we need to coordinate across `from` calls.
              // `vi.fn` implementation runs for each call.

              // If this is the FIRST call to 'shipments' -> return shipments data.
              // If second -> return COD data.

              if (
                mockSupabaseClient.from.mock.calls.filter(
                  (c: any) => c[0] === "shipments"
                ).length === 1
              ) {
                return resolve({ data: mockShipments, error: null });
              } else {
                return resolve({ data: [], error: null });
              }
            },
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext("user-123", "user");

      expect(context.shipmentsSummary.count).toBe(3);
      expect(context.shipmentsSummary.total_margin).toBe(23.8);
      expect(context.shipmentsSummary.total_revenue).toBe(115.0);
    });

    it("includes wallet balance from user data", async () => {
      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wallet_balance: "2500.75" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext("user-123", "user");

      expect(context.wallet.balance).toBe(2500.75);
    });

    it("returns only next 3 upcoming deadlines", async () => {
      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wallet_balance: "100" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext("user-123", "user");

      expect(context.deadlines.length).toBeLessThanOrEqual(3);
      // All deadlines should be in the future
      const today = new Date().toISOString().split("T")[0];
      context.deadlines.forEach((deadline) => {
        expect(deadline.date >= today).toBe(true);
      });
    });

    it("handles wallet balance fetch error gracefully", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === "users") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            then: (resolve: any, reject: any) =>
              reject(new Error("User not found")),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext("user-123", "user");

      // Should default to 0 and continue execution
      expect(context.wallet.balance).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});
