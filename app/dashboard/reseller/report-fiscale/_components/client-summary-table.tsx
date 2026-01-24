'use client';

/**
 * Client Summary Table
 *
 * Tabella riepilogo per cliente con totali fiscali e drill-down.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, User, Building2 } from 'lucide-react';
import type { ClientFiscalSummary } from '@/types/reseller-fiscal';
import { ShipmentDetailTable } from './shipment-detail-table';

interface ClientSummaryTableProps {
  clients: ClientFiscalSummary[];
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function ClientRow({ client }: { client: ClientFiscalSummary }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayName = client.client.company_name || client.client.name || client.client.email;
  const hasCompany = !!client.client.company_name;

  return (
    <>
      <tr
        className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-4 py-3">
          <button className="text-gray-400">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {hasCompany ? (
              <Building2 className="h-4 w-4 text-gray-400" />
            ) : (
              <User className="h-4 w-4 text-gray-400" />
            )}
            <div>
              <p className="font-medium text-gray-900">{displayName}</p>
              {hasCompany && <p className="text-xs text-gray-500">{client.client.email}</p>}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{client.client.vat_number || '-'}</td>
        <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">
          {client.shipments_count}
        </td>
        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
          {formatCurrency(client.total_gross)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-gray-600">
          {formatCurrency(client.total_net)}
        </td>
        <td className="px-4 py-3 text-right text-sm text-gray-600">
          {formatCurrency(client.total_vat)}
        </td>
        <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
          {client.total_margin !== null ? formatCurrency(client.total_margin) : 'N/A'}
        </td>
        <td className="px-4 py-3 text-right text-sm text-gray-500">
          {client.avg_margin_percent !== null ? `${client.avg_margin_percent.toFixed(1)}%` : 'N/A'}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} className="bg-gray-50 p-0">
            <div className="p-4">
              <ShipmentDetailTable shipments={client.shipments} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="px-4 py-3">
            <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="mx-auto h-4 w-8 animate-pulse rounded bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="ml-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="ml-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
          </td>
          <td className="px-4 py-3">
            <div className="ml-auto h-4 w-12 animate-pulse rounded bg-gray-200" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function ClientSummaryTable({ clients, isLoading }: ClientSummaryTableProps) {
  if (!isLoading && clients.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">Nessuna spedizione trovata per il periodo selezionato</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Cliente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                P.IVA
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                Spedizioni
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Lordo
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Netto
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                IVA
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Margine
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                Margine %
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <LoadingSkeleton />
            ) : (
              clients.map((client) => <ClientRow key={client.client.id} client={client} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
