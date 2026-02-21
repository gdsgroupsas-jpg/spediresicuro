'use client';

/**
 * Anteprima matrice prezzi di un preventivo commerciale
 *
 * Tabella peso x zona con prezzi formattati.
 */

import type { PriceMatrixSnapshot } from '@/types/commercial-quotes';

interface MatrixPreviewProps {
  matrix: PriceMatrixSnapshot;
  compact?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function MatrixPreview({ matrix, compact = false }: MatrixPreviewProps) {
  if (!matrix || !matrix.zones || !matrix.weight_ranges || !matrix.prices) {
    return <div className="text-sm text-gray-500 italic p-4">Matrice prezzi non disponibile</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-800 text-white">
            <th className={`text-left font-medium ${compact ? 'px-2 py-1.5' : 'px-4 py-2'}`}>
              Peso
            </th>
            {matrix.zones.map((zone) => (
              <th
                key={zone}
                className={`text-center font-medium ${compact ? 'px-2 py-1.5' : 'px-4 py-2'}`}
              >
                {zone}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {matrix.weight_ranges.map((range, rowIdx) => (
            <tr key={range.label} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className={`font-medium text-gray-700 ${compact ? 'px-2 py-1' : 'px-4 py-2'}`}>
                {range.label}
              </td>
              {matrix.zones.map((_, colIdx) => {
                const price = matrix.prices[rowIdx]?.[colIdx];
                return (
                  <td
                    key={colIdx}
                    className={`text-center ${compact ? 'px-2 py-1' : 'px-4 py-2'} ${
                      price && price > 0 ? 'text-gray-900' : 'text-gray-400'
                    }`}
                  >
                    {price && price > 0 ? formatCurrency(price) : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Info matrice */}
      <div className="flex items-center justify-between mt-2 px-1 text-xs text-gray-500">
        <span>
          {matrix.vat_mode === 'excluded' ? 'IVA esclusa' : 'IVA inclusa'} ({matrix.vat_rate}%)
        </span>
        <span>Corriere: {matrix.carrier_display_name}</span>
      </div>
    </div>
  );
}
