/**
 * Tipi condivisi per Admin Dashboard
 */

export interface AdminStats {
  // Utenti
  totalUsers: number;
  adminUsers: number;
  regularUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;

  // Spedizioni
  totalShipments: number;
  shipmentsToday: number;
  shipmentsThisWeek: number;
  shipmentsThisMonth: number;

  // Status spedizioni
  shipmentsPending: number;
  shipmentsInTransit: number;
  shipmentsDelivered: number;
  shipmentsFailed: number;

  // Fatturato
  totalRevenue: number;
  revenueToday: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
}
