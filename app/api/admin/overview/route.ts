/**
 * API Route: Admin Overview (God View)
 *
 * Restituisce statistiche globali e dati completi per la dashboard admin:
 * - Tutti gli utenti
 * - Tutte le spedizioni
 * - Statistiche globali
 *
 * ⚠️ SOLO PER ADMIN: Verifica che l'utente sia admin prima di restituire i dati
 */

import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line
import { auth } from "@/lib/auth-config";
import { findUserByEmail } from "@/lib/database";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";
import { createUserMap, isTestShipment } from "@/lib/utils/test-data-detection";
import type { AdminStats } from "@/types/admin";

// Forza rendering dinamico (usa headers, session, ecc.)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // 2. Verifica che l'utente sia admin o superadmin
    let userAccountType: string | null = null;
    let userRole: string | null = null;

    if (isSupabaseConfigured()) {
      const { data: supabaseUser, error: userError } = await supabaseAdmin
        .from("users")
        .select("role, account_type")
        .eq("email", session.user.email)
        .single();

      if (!userError && supabaseUser) {
        userAccountType = supabaseUser.account_type;
        userRole = supabaseUser.role;
      }
    } else {
      const user = await findUserByEmail(session.user.email);
      if (user) {
        userRole = user.role || null;
        userAccountType = (user as any).account_type || null;
      }
    }

    // Superadmin e admin hanno sempre accesso
    const isAuthorized =
      userAccountType === "superadmin" ||
      userAccountType === "admin" ||
      userRole === "admin";

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error:
            "Accesso negato. Solo gli admin e superadmin possono accedere a questa risorsa.",
        },
        { status: 403 }
      );
    }

    // 3. Carica tutti gli utenti
    let allUsers: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        let usersError: any = null;
        let users: any[] | null = null;

        const usersResponse = await supabaseAdmin
          .from("users")
          .select(
            "id, email, name, role, account_type, is_reseller, reseller_role, parent_user_id, provider, created_at, updated_at, assigned_config_id"
          )
          .order("created_at", { ascending: false });

        usersError = usersResponse.error;
        users = usersResponse.data;

        if (usersError) {
          const fallbackResponse = await supabaseAdmin
            .from("users")
            .select(
              "id, email, name, role, account_type, is_reseller, reseller_role, parent_user_id, provider, created_at, updated_at"
            )
            .order("created_at", { ascending: false });

          usersError = fallbackResponse.error;
          users = fallbackResponse.data;
        }

        if (usersError) {
          const minimalResponse = await supabaseAdmin
            .from("users")
            .select("id, email, name, role, account_type, created_at, updated_at")
            .order("created_at", { ascending: false });

          usersError = minimalResponse.error;
          users = minimalResponse.data;
        }

        if (!usersError && users) {
          // Carica conteggio assegnazioni listini per tutti gli utenti
          const { data: assignmentCounts } = await supabaseAdmin
            .from("price_list_assignments")
            .select("user_id")
            .is("revoked_at", null);

          // Crea mappa user_id -> count
          const countsMap = new Map<string, number>();
          assignmentCounts?.forEach((a) => {
            countsMap.set(a.user_id, (countsMap.get(a.user_id) || 0) + 1);
          });

          // Aggiungi count a ogni user
          allUsers = users.map((user) => ({
            ...user,
            price_lists_count: countsMap.get(user.id) || 0,
          }));
        } else if (usersError) {
          console.error("Errore caricamento utenti (users):", usersError);
        }
      } catch (error) {
        console.error("Errore caricamento utenti:", error);
      }
    }

    // 4. Carica tutte le spedizioni (senza filtri user_id)
    let allShipments: any[] = [];
    if (isSupabaseConfigured()) {
      try {
        const { data: shipments, error: shipmentsError } = await supabaseAdmin
          .from("shipments")
          .select("*")
          .or("deleted.is.null,deleted.eq.false")
          .is("deleted_at", null)
          .not("status", "in", "(cancelled,deleted)")
          .order("created_at", { ascending: false })
          .limit(1000); // Limita a 1000 per performance

        if (!shipmentsError && shipments) {
          allShipments = shipments;
        }
      } catch (error) {
        console.error("Errore caricamento spedizioni:", error);
      }
    }

    // 5. Calcola statistiche globali
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const userStats: Pick<
      AdminStats,
      | "totalUsers"
      | "adminUsers"
      | "regularUsers"
      | "newUsersToday"
      | "newUsersThisWeek"
      | "newUsersThisMonth"
    > = {
      totalUsers: allUsers.length,
      adminUsers: allUsers.filter((u) => u.role === "admin").length,
      regularUsers: allUsers.filter((u) => u.role === "user").length,
      newUsersToday: allUsers.filter((u) => {
        const created = new Date(u.created_at);
        return created >= today;
      }).length,
      newUsersThisWeek: allUsers.filter((u) => {
        const created = new Date(u.created_at);
        return created >= weekAgo;
      }).length,
      newUsersThisMonth: allUsers.filter((u) => {
        const created = new Date(u.created_at);
        return created >= monthAgo;
      }).length,
    };

    const mapShipmentStatsRow = (
      row: any
    ): Pick<
      AdminStats,
      | "totalShipments"
      | "shipmentsToday"
      | "shipmentsThisWeek"
      | "shipmentsThisMonth"
      | "shipmentsPending"
      | "shipmentsInTransit"
      | "shipmentsDelivered"
      | "shipmentsFailed"
      | "totalRevenue"
      | "revenueToday"
      | "revenueThisWeek"
      | "revenueThisMonth"
    > => ({
      totalShipments: Number(row.total_shipments) || 0,
      shipmentsToday: Number(row.shipments_today) || 0,
      shipmentsThisWeek: Number(row.shipments_this_week) || 0,
      shipmentsThisMonth: Number(row.shipments_this_month) || 0,
      shipmentsPending: Number(row.shipments_pending) || 0,
      shipmentsInTransit: Number(row.shipments_in_transit) || 0,
      shipmentsDelivered: Number(row.shipments_delivered) || 0,
      shipmentsFailed: Number(row.shipments_failed) || 0,
      totalRevenue: Number(row.total_revenue) || 0,
      revenueToday: Number(row.revenue_today) || 0,
      revenueThisWeek: Number(row.revenue_this_week) || 0,
      revenueThisMonth: Number(row.revenue_this_month) || 0,
    });

    let stats: AdminStats;
    let productionStats: AdminStats;

    if (isSupabaseConfigured()) {
      const { data: rawStats, error: statsError } = await supabaseAdmin.rpc(
        "get_admin_overview_stats",
        { include_test: true }
      );
      const { data: rawProductionStats, error: productionError } =
        await supabaseAdmin.rpc("get_admin_overview_stats", {
          include_test: false,
        });

      if (!statsError && !productionError && rawStats && rawProductionStats) {
        stats = {
          ...userStats,
          ...mapShipmentStatsRow(rawStats[0]),
        };
        productionStats = {
          ...userStats,
          ...mapShipmentStatsRow(rawProductionStats[0]),
        };
      } else {
        console.error(
          "Errore RPC get_admin_overview_stats:",
          statsError || productionError
        );
        const userMap = createUserMap(allUsers);
        const baseShipments = allShipments.filter((s: any) => {
          if (s.deleted === true || s.deleted_at) return false;
          if (s.status === "cancelled" || s.status === "deleted") return false;
          return true;
        });
        const productionShipments = baseShipments.filter(
          (s: any) => !isTestShipment(s, userMap)
        );
        const computeShipmentStats = (shipments: any[]) => ({
          totalShipments: shipments.length,
          shipmentsToday: shipments.filter((s: any) => {
            const date = new Date(s.created_at);
            return date >= today;
          }).length,
          shipmentsThisWeek: shipments.filter((s: any) => {
            const date = new Date(s.created_at);
            return date >= weekAgo;
          }).length,
          shipmentsThisMonth: shipments.filter((s: any) => {
            const date = new Date(s.created_at);
            return date >= monthAgo;
          }).length,
          shipmentsPending: shipments.filter(
            (s: any) => s.status === "pending" || s.status === "draft"
          ).length,
          shipmentsInTransit: shipments.filter(
            (s: any) => s.status === "in_transit" || s.status === "shipped"
          ).length,
          shipmentsDelivered: shipments.filter(
            (s: any) => s.status === "delivered"
          ).length,
          shipmentsFailed: shipments.filter((s: any) => s.status === "failed")
            .length,
          totalRevenue: shipments.reduce(
            (sum: number, s: any) => sum + (parseFloat(s.final_price || 0) || 0),
            0
          ),
          revenueToday: shipments
            .filter((s: any) => {
              const date = new Date(s.created_at);
              return date >= today;
            })
            .reduce(
              (sum: number, s: any) =>
                sum + (parseFloat(s.final_price || 0) || 0),
              0
            ),
          revenueThisWeek: shipments
            .filter((s: any) => {
              const date = new Date(s.created_at);
              return date >= weekAgo;
            })
            .reduce(
              (sum: number, s: any) =>
                sum + (parseFloat(s.final_price || 0) || 0),
              0
            ),
          revenueThisMonth: shipments
            .filter((s: any) => {
              const date = new Date(s.created_at);
              return date >= monthAgo;
            })
            .reduce(
              (sum: number, s: any) =>
                sum + (parseFloat(s.final_price || 0) || 0),
              0
            ),
        });

        stats = { ...userStats, ...computeShipmentStats(baseShipments) };
        productionStats = {
          ...userStats,
          ...computeShipmentStats(productionShipments),
        };
      }
    } else {
      const userMap = createUserMap(allUsers);
      const baseShipments = allShipments.filter((s: any) => {
        if (s.deleted === true || s.deleted_at) return false;
        if (s.status === "cancelled" || s.status === "deleted") return false;
        return true;
      });
      const productionShipments = baseShipments.filter(
        (s: any) => !isTestShipment(s, userMap)
      );
      const computeShipmentStats = (shipments: any[]) => ({
        totalShipments: shipments.length,
        shipmentsToday: shipments.filter((s: any) => {
          const date = new Date(s.created_at);
          return date >= today;
        }).length,
        shipmentsThisWeek: shipments.filter((s: any) => {
          const date = new Date(s.created_at);
          return date >= weekAgo;
        }).length,
        shipmentsThisMonth: shipments.filter((s: any) => {
          const date = new Date(s.created_at);
          return date >= monthAgo;
        }).length,
        shipmentsPending: shipments.filter(
          (s: any) => s.status === "pending" || s.status === "draft"
        ).length,
        shipmentsInTransit: shipments.filter(
          (s: any) => s.status === "in_transit" || s.status === "shipped"
        ).length,
        shipmentsDelivered: shipments.filter(
          (s: any) => s.status === "delivered"
        ).length,
        shipmentsFailed: shipments.filter((s: any) => s.status === "failed")
          .length,
        totalRevenue: shipments.reduce(
          (sum: number, s: any) => sum + (parseFloat(s.final_price || 0) || 0),
          0
        ),
        revenueToday: shipments
          .filter((s: any) => {
            const date = new Date(s.created_at);
            return date >= today;
          })
          .reduce(
            (sum: number, s: any) => sum + (parseFloat(s.final_price || 0) || 0),
            0
          ),
        revenueThisWeek: shipments
          .filter((s: any) => {
            const date = new Date(s.created_at);
            return date >= weekAgo;
          })
          .reduce(
            (sum: number, s: any) => sum + (parseFloat(s.final_price || 0) || 0),
            0
          ),
        revenueThisMonth: shipments
          .filter((s: any) => {
            const date = new Date(s.created_at);
            return date >= monthAgo;
          })
          .reduce(
            (sum: number, s: any) => sum + (parseFloat(s.final_price || 0) || 0),
            0
          ),
      });

      stats = { ...userStats, ...computeShipmentStats(baseShipments) };
      productionStats = {
        ...userStats,
        ...computeShipmentStats(productionShipments),
      };
    }

    return NextResponse.json({
      success: true,
      stats,
      productionStats,
      users: allUsers,
      shipments: allShipments.slice(0, 100), // Limita a 100 per la risposta
      totalShipments: stats.totalShipments,
    });
  } catch (error: any) {
    console.error("Errore API admin overview:", error);
    return NextResponse.json(
      { error: "Errore durante il caricamento dei dati admin" },
      { status: 500 }
    );
  }
}
