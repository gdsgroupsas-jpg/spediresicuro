/**
 * Tabella per visualizzare listini fornitore
 * 
 * Componente riutilizzabile per mostrare listini fornitore in formato tabella
 */

'use client';

import { Package, Edit, Trash2, Eye, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PriceList } from '@/types/listini';

interface SupplierPriceListTableProps {
  priceLists: PriceList[];
  onEdit: (priceList: PriceList) => void;
  onDelete: (priceListId: string) => void;
  onViewDetails: (priceListId: string) => void;
  isLoading?: boolean;
}

export function SupplierPriceListTable({
  priceLists,
  onEdit,
  onDelete,
  onViewDetails,
  isLoading = false,
}: SupplierPriceListTableProps) {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateString));
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-100 text-gray-700',
      active: 'bg-green-50 text-green-700',
      archived: 'bg-gray-100 text-gray-500',
    };

    const labels = {
      draft: 'Bozza',
      active: 'Attivo',
      archived: 'Archiviato',
    };

    const style = styles[status as keyof typeof styles] || styles.draft;
    const label = labels[status as keyof typeof labels] || status;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}>
        {label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-4"></div>
        <p className="text-gray-500">Caricamento listini...</p>
      </div>
    );
  }

  if (priceLists.length === 0) {
    return (
      <div className="p-16 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Nessun listino trovato</h3>
        <p className="text-gray-500 mt-1">Crea il tuo primo listino fornitore per iniziare.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            <th className="px-6 py-4 font-medium text-gray-500">Nome</th>
            <th className="px-6 py-4 font-medium text-gray-500">Corriere</th>
            <th className="px-6 py-4 font-medium text-gray-500">Versione</th>
            <th className="px-6 py-4 font-medium text-gray-500">Status</th>
            <th className="px-6 py-4 font-medium text-gray-500">Data Creazione</th>
            <th className="px-6 py-4 font-medium text-gray-500 text-right">Azioni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {priceLists.map((priceList) => (
            <tr key={priceList.id} className="hover:bg-gray-50 transition-colors group">
              <td className="px-6 py-4 font-medium text-gray-900">
                {priceList.name}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {priceList.courier?.name || priceList.courier_id || '-'}
              </td>
              <td className="px-6 py-4 text-gray-600">
                {priceList.version}
              </td>
              <td className="px-6 py-4">
                {getStatusBadge(priceList.status)}
              </td>
              <td className="px-6 py-4 text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(priceList.created_at)}
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(priceList.id)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Dettagli"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(priceList)}
                    className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                    title="Modifica"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(priceList.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Elimina"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

