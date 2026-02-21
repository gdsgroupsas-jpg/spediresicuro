import { useMemo } from 'react';
import type { Spedizione } from '../types';

interface UseFilteredShipmentsParams {
  shipments: Spedizione[];
  searchQuery: string;
  statusFilter: string;
  dateFilter: string;
  courierFilter: string;
  returnFilter: string;
  workspaceFilter: string;
  customDateFrom: string;
  customDateTo: string;
}

export function useFilteredShipments({
  shipments,
  searchQuery,
  statusFilter,
  dateFilter,
  courierFilter,
  returnFilter,
  workspaceFilter,
  customDateFrom,
  customDateTo,
}: UseFilteredShipmentsParams) {
  return useMemo(() => {
    let filtered = [...shipments];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (shipment) =>
          shipment.destinatario?.nome?.toLowerCase().includes(query) ||
          shipment.mittente?.nome?.toLowerCase().includes(query) ||
          shipment.tracking?.toLowerCase().includes(query) ||
          shipment.destinatario?.citta?.toLowerCase().includes(query) ||
          shipment.destinatario?.provincia?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (shipment) => (shipment.status || 'in_preparazione') === statusFilter
      );
    }

    if (dateFilter !== 'all') {
      if (dateFilter === 'custom') {
        filtered = filtered.filter((shipment) => {
          const date = new Date(shipment.createdAt);
          const from = customDateFrom ? new Date(customDateFrom) : null;
          const to = customDateTo ? new Date(customDateTo) : null;

          if (from && to) {
            return date >= from && date <= new Date(to.getTime() + 86400000);
          }
          if (from) {
            return date >= from;
          }
          if (to) {
            return date <= new Date(to.getTime() + 86400000);
          }
          return true;
        });
      } else {
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        filtered = filtered.filter((shipment) => {
          const date = new Date(shipment.createdAt);
          switch (dateFilter) {
            case 'today':
              return date >= today;
            case 'week':
              return date >= weekAgo;
            case 'month':
              return date >= monthAgo;
            default:
              return true;
          }
        });
      }
    }

    if (courierFilter !== 'all') {
      filtered = filtered.filter(
        (shipment) => (shipment.corriere || '').toLowerCase() === courierFilter.toLowerCase()
      );
    }

    if (returnFilter === 'returns') {
      filtered = filtered.filter((shipment: any) => shipment.is_return === true);
    } else if (returnFilter === 'no-returns') {
      filtered = filtered.filter(
        (shipment: any) => !shipment.is_return || shipment.is_return === false
      );
    }

    if (workspaceFilter !== 'all') {
      filtered = filtered.filter((shipment) => shipment.workspaces?.id === workspaceFilter);
    }

    return filtered;
  }, [
    shipments,
    searchQuery,
    statusFilter,
    dateFilter,
    courierFilter,
    returnFilter,
    workspaceFilter,
    customDateFrom,
    customDateTo,
  ]);
}
