/**
 * Client Component: UI Resi
 *
 * Gestisce UI, filtri, search e realtime updates.
 * Riceve dati iniziali come props dal Server Component.
 */

'use client';

import { useState, useEffect } from 'react';
import { RotateCcw, Search, Package, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useRealtimeShipments } from '@/hooks/useRealtimeShipments';

export interface ReturnShipment {
  id: string;
  tracking_number: string;
  ldv: string;
  original_tracking: string;
  return_reason: string;
  status: string;
  created_at: string;
  recipient_name: string;
  recipient_city: string;
}

interface ResiUIProps {
  initialReturns: ReturnShipment[];
  userId: string | null;
}

export default function ResiUI({ initialReturns, userId }: ResiUIProps) {
  const [returns, setReturns] = useState<ReturnShipment[]>(initialReturns);
  const [searchTerm, setSearchTerm] = useState('');

  // Realtime updates (solo delta, non query iniziali)
  useRealtimeShipments({
    userId: userId || '',
    enabled: !!userId,
    onInsert: (newShipment: any) => {
      // Aggiungi solo se è un reso
      if (newShipment.is_return === true && newShipment.deleted !== true) {
        setReturns((prev) => [newShipment as ReturnShipment, ...prev]);
      }
    },
    onUpdate: (updatedShipment: any) => {
      // Aggiorna solo se è un reso
      if (updatedShipment.is_return === true && updatedShipment.deleted !== true) {
        setReturns((prev) =>
          prev.map((r) => (r.id === updatedShipment.id ? (updatedShipment as ReturnShipment) : r))
        );
      } else {
        // Rimuovi se non è più un reso o è stato eliminato
        setReturns((prev) => prev.filter((r) => r.id !== updatedShipment.id));
      }
    },
    onDelete: (shipmentId: string) => {
      setReturns((prev) => prev.filter((r) => r.id !== shipmentId));
    },
  });

  const filteredReturns = returns.filter((ret) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      ret.tracking_number?.toLowerCase().includes(term) ||
      ret.ldv?.toLowerCase().includes(term) ||
      ret.original_tracking?.toLowerCase().includes(term) ||
      ret.recipient_name?.toLowerCase().includes(term)
    );
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header con ricerca */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <RotateCcw className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Resi</h1>
            <p className="text-sm text-gray-500">{filteredReturns.length} resi trovati</p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cerca per tracking, LDV..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Lista resi */}
      {filteredReturns.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun reso trovato</h3>
          <p className="text-gray-500">Non ci sono resi registrati al momento.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tracking Reso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tracking Originale
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destinatario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {ret.tracking_number || 'N/A'}
                      </div>
                      {ret.ldv && <div className="text-xs text-gray-500">LDV: {ret.ldv}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ret.original_tracking || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{ret.return_reason || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ret.recipient_name || 'N/A'}</div>
                      {ret.recipient_city && (
                        <div className="text-xs text-gray-500">{ret.recipient_city}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(ret.status)}
                        <span className="text-sm text-gray-900 capitalize">
                          {ret.status || 'processing'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ret.created_at).toLocaleDateString('it-IT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
