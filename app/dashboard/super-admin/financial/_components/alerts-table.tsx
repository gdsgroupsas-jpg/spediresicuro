'use client';

import { useState } from 'react';
import { AlertTriangle, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MarginAlert } from '@/actions/platform-costs';

interface AlertsTableProps {
  alerts: MarginAlert[];
  isLoading: boolean;
  onResolve?: (
    id: string,
    status: 'matched' | 'discrepancy' | 'resolved',
    notes?: string
  ) => Promise<void>;
}

export function AlertsTable({ alerts, isLoading, onResolve }: AlertsTableProps) {
  const [resolving, setResolving] = useState<string | null>(null);

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

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Alert Margini Anomali
          </h3>
        </div>
        <div className="p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Nessun alert attivo</p>
          <p className="text-sm text-gray-400 mt-1">Tutti i margini sono nella norma</p>
        </div>
      </div>
    );
  }

  const handleResolve = async (id: string, status: 'matched' | 'discrepancy' | 'resolved') => {
    if (!onResolve) return;
    setResolving(id);
    try {
      await onResolve(id, status);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Alert Margini Anomali
          </h3>
          <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
            {alerts.length} alert
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Spedizione
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Utente
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
                Tipo Alert
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {alerts.map((alert) => (
              <tr key={alert.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-900">
                      {alert.shipment_tracking_number}
                    </span>
                    <a
                      href={`/dashboard/super-admin/shipments/${alert.shipment_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(alert.created_at).toLocaleDateString('it-IT')}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{alert.user_email}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-700 uppercase">
                    {alert.courier_code}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-900">€{alert.billed_amount.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span className="text-sm text-gray-900">€{alert.provider_cost.toFixed(2)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <span
                    className={`text-sm font-semibold ${
                      alert.platform_margin < 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    €{alert.platform_margin.toFixed(2)}
                  </span>
                  <p
                    className={`text-xs ${
                      alert.platform_margin_percent < 0 ? 'text-red-500' : 'text-green-500'
                    }`}
                  >
                    {alert.platform_margin_percent.toFixed(1)}%
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      alert.alert_type === 'negative_margin'
                        ? 'bg-red-100 text-red-700'
                        : alert.alert_type === 'low_margin'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {alert.alert_type === 'negative_margin'
                      ? 'Perdita'
                      : alert.alert_type === 'low_margin'
                        ? 'Basso'
                        : 'Anomalo'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:bg-green-50"
                      onClick={() => handleResolve(alert.id, 'resolved')}
                      disabled={resolving === alert.id}
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      OK
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleResolve(alert.id, 'discrepancy')}
                      disabled={resolving === alert.id}
                    >
                      <XCircle className="w-3 h-3 mr-1" />
                      Problema
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
