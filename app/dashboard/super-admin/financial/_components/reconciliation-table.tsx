'use client';

import { useState } from 'react';
import { Clock, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReconciliationPending } from '@/actions/platform-costs';

interface ReconciliationTableProps {
  items: ReconciliationPending[];
  isLoading: boolean;
  onUpdateStatus?: (
    id: string,
    status: 'matched' | 'discrepancy' | 'resolved',
    notes?: string
  ) => Promise<void>;
}

export function ReconciliationTable({
  items,
  isLoading,
  onUpdateStatus,
}: ReconciliationTableProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Riconciliazione Pendente
          </h3>
        </div>
        <div className="p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Tutto riconciliato!</p>
          <p className="text-sm text-gray-400 mt-1">Non ci sono spedizioni da verificare</p>
        </div>
      </div>
    );
  }

  const handleUpdate = async (id: string, status: 'matched' | 'discrepancy' | 'resolved') => {
    if (!onUpdateStatus) return;
    setUpdating(id);
    try {
      await onUpdateStatus(id, status);
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkMatch = async () => {
    if (!onUpdateStatus || selectedItems.size === 0) return;

    for (const id of selectedItems) {
      setUpdating(id);
      await onUpdateStatus(id, 'matched');
    }
    setSelectedItems(new Set());
    setUpdating(null);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map((item) => item.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Riconciliazione Pendente
          </h3>
          <div className="flex items-center gap-3">
            {selectedItems.size > 0 && (
              <Button
                size="sm"
                onClick={handleBulkMatch}
                className="bg-green-600 hover:bg-green-700"
                disabled={updating !== null}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Conferma {selectedItems.size} selezionati
              </Button>
            )}
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {items.length} da verificare
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedItems.size === items.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tracking
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Corriere
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Addebitato
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Costo
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Margine
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Età
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item) => (
              <tr
                key={item.id}
                className={`hover:bg-gray-50 ${selectedItems.has(item.id) ? 'bg-blue-50' : ''}`}
              >
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-900">
                      {item.shipment_tracking_number}
                    </span>
                    <a
                      href={`/dashboard/super-admin/shipments/${item.shipment_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">
                    {new Date(item.created_at).toLocaleDateString('it-IT')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-700 uppercase">
                    {item.courier_code}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-900">€{item.billed_amount.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-900">€{item.provider_cost.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span
                    className={`text-sm font-semibold ${
                      item.platform_margin < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    €{item.platform_margin.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      item.age_days > 14
                        ? 'bg-red-100 text-red-700'
                        : item.age_days > 7
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {item.age_days}gg
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      item.reconciliation_status === 'pending'
                        ? 'bg-blue-100 text-blue-700'
                        : item.reconciliation_status === 'discrepancy'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {item.reconciliation_status === 'pending'
                      ? 'Pendente'
                      : item.reconciliation_status === 'discrepancy'
                        ? 'Discrepanza'
                        : 'OK'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-green-600 hover:bg-green-50 h-8 w-8 p-0"
                      onClick={() => handleUpdate(item.id, 'matched')}
                      disabled={updating === item.id}
                      title="Confermo costo corretto"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                      onClick={() => handleUpdate(item.id, 'discrepancy')}
                      disabled={updating === item.id}
                      title="Segnala discrepanza"
                    >
                      <AlertCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
