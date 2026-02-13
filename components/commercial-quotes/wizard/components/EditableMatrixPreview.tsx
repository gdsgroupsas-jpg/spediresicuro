'use client';

/**
 * Anteprima matrice prezzi editabile.
 *
 * Click su cella -> input number inline.
 * Enter/Blur -> salva override.
 * Escape -> annulla.
 * Celle overridden: sfondo ambra.
 */

import { useState, useRef, useEffect } from 'react';
import type { PriceMatrixSnapshot } from '@/types/commercial-quotes';

interface EditableMatrixPreviewProps {
  matrix: PriceMatrixSnapshot;
  overrides: number[][];
  overriddenCells: Set<string>;
  onCellEdit: (row: number, col: number, value: number) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function EditableMatrixPreview({
  matrix,
  overrides,
  overriddenCells,
  onCellEdit,
}: EditableMatrixPreviewProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input quando si entra in editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellClick = (row: number, col: number) => {
    const key = `${row}-${col}`;
    const currentValue = overrides[row]?.[col] ?? matrix.prices[row]?.[col] ?? 0;
    setEditingCell(key);
    setEditValue(currentValue.toFixed(2));
  };

  const handleSave = (row: number, col: number) => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onCellEdit(row, col, Math.round(parsed * 100) / 100);
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, row: number, col: number) => {
    if (e.key === 'Enter') {
      handleSave(row, col);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const overrideCount = overriddenCells.size;

  if (!matrix?.zones?.length || !matrix?.weight_ranges?.length || !matrix?.prices?.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left font-medium px-3 py-2">Peso</th>
              {matrix.zones.map((zone) => (
                <th key={zone} className="text-center font-medium px-3 py-2">
                  {zone}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {matrix.weight_ranges.map((range, rowIdx) => (
              <tr key={range.label} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="font-medium text-gray-700 px-3 py-1.5 whitespace-nowrap">
                  {range.label}
                </td>
                {matrix.zones.map((_, colIdx) => {
                  const cellKey = `${rowIdx}-${colIdx}`;
                  const isEditing = editingCell === cellKey;
                  const isOverridden = overriddenCells.has(cellKey);
                  const price = overrides[rowIdx]?.[colIdx] ?? matrix.prices[rowIdx]?.[colIdx] ?? 0;

                  return (
                    <td
                      key={colIdx}
                      className={`text-center px-1 py-1 cursor-pointer transition-colors ${
                        isOverridden ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-blue-50'
                      }`}
                      onClick={() => !isEditing && handleCellClick(rowIdx, colIdx)}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          type="number"
                          min="0"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSave(rowIdx, colIdx)}
                          onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                          className="w-20 px-1 py-0.5 text-center text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span
                          className={`${
                            isOverridden ? 'font-semibold text-amber-700' : ''
                          } ${price > 0 ? 'text-gray-900' : 'text-gray-400'}`}
                        >
                          {price > 0 ? formatCurrency(price) : '-'}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Info matrice */}
      <div className="flex items-center justify-between px-1 text-xs text-gray-500">
        <span>
          {matrix.vat_mode === 'excluded' ? 'IVA esclusa' : 'IVA inclusa'} ({matrix.vat_rate}%)
          {' \u2022 '}Clicca su un prezzo per modificarlo
        </span>
        {overrideCount > 0 && (
          <span className="text-amber-600 font-medium">{overrideCount} prezzo/i modificato/i</span>
        )}
      </div>
    </div>
  );
}
