'use client';

import type { PlatformFeeHistoryEntry } from '@/lib/services/pricing/platform-fee';

interface FeeHistoryTableProps {
  history: PlatformFeeHistoryEntry[];
}

/**
 * Tabella storico modifiche platform fee.
 * Mostra chi ha modificato, quando, e i valori precedente/nuovo.
 */
export function FeeHistoryTable({ history }: FeeHistoryTableProps) {
  // Formatta data in italiano
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('it-IT', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  // Formatta fee
  const formatFee = (value: number | null) => {
    if (value === null) return 'Default';
    return `€${value.toFixed(2)}`;
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <p>Nessuna modifica registrata</p>
        <p className="text-sm mt-1">Le modifiche alla fee verranno tracciate qui</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Data
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precedente
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nuova
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Modificato da
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Note
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {history.map((entry) => (
            <tr key={entry.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {formatDate(entry.changedAt)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {formatFee(entry.oldFee)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                {formatFee(entry.newFee)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {entry.changedByName ||
                  entry.changedByEmail ||
                  entry.changedBy.substring(0, 8) + '...'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px]">
                {entry.notes ? (
                  <span className="truncate block" title={entry.notes}>
                    {entry.notes.length > 40 ? entry.notes.substring(0, 40) + '...' : entry.notes}
                  </span>
                ) : (
                  <span className="text-gray-400 italic">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
