'use client';

/**
 * Shipment Detail Table
 *
 * Tabella dettaglio spedizioni per drill-down cliente.
 */

import type { FiscalShipmentLine } from '@/types/reseller-fiscal';

interface ShipmentDetailTableProps {
  shipments: FiscalShipmentLine[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function ShipmentDetailTable({ shipments }: ShipmentDetailTableProps) {
  if (shipments.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-500">Nessuna spedizione</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-100">
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Data</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tracking</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Destinatario</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Corriere</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Lordo</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Netto</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">IVA</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Margine</th>
          </tr>
        </thead>
        <tbody>
          {shipments.map((shipment) => (
            <tr key={shipment.shipment_id} className="border-b border-gray-100 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 text-gray-600">
                {formatDate(shipment.date)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-900">
                {shipment.tracking_number}
              </td>
              <td className="px-3 py-2 text-gray-600">
                <div>
                  <span className="text-gray-900">{shipment.recipient_name}</span>
                  <span className="ml-1 text-gray-400">({shipment.recipient_city})</span>
                </div>
              </td>
              <td className="px-3 py-2 text-gray-600">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {shipment.courier_name}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-900">
                {formatCurrency(shipment.gross_amount)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-gray-600">
                {formatCurrency(shipment.net_amount)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-gray-500">
                {formatCurrency(shipment.vat_amount)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-green-600">
                {shipment.margin_amount !== null ? formatCurrency(shipment.margin_amount) : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
