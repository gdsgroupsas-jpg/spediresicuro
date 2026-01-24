'use client';

/**
 * Export Fiscal Dialog
 *
 * Dialog per esportare il report fiscale in CSV o Excel.
 */

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { MonthlyFiscalSummary } from '@/types/reseller-fiscal';
import { exportFiscalCSV, exportFiscalExcel } from '../_utils/export-fiscal-utils';

interface ExportFiscalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: MonthlyFiscalSummary | null;
}

export function ExportFiscalDialog({ isOpen, onClose, data }: ExportFiscalDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'excel' | null>(null);

  if (!isOpen) return null;

  const handleExport = async (type: 'csv' | 'excel') => {
    if (!data) {
      toast.error('Nessun dato da esportare');
      return;
    }

    if (data.clients.length === 0) {
      toast.error('Nessuna spedizione nel periodo selezionato');
      return;
    }

    setIsExporting(true);
    setExportType(type);

    try {
      // Piccolo delay per UX
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (type === 'csv') {
        exportFiscalCSV(data);
        toast.success('Report CSV scaricato');
      } else {
        exportFiscalExcel(data);
        toast.success('Report Excel scaricato');
      }
      onClose();
    } catch (error) {
      console.error('Errore export:', error);
      toast.error("Errore durante l'esportazione");
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Esporta Report Fiscale</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info periodo */}
        {data && (
          <p className="mb-6 text-sm text-gray-600">
            Periodo: <strong>{data.period.label}</strong>
            {' - '}
            {data.total_shipments} spedizioni, {data.clients.length} clienti
          </p>
        )}

        {/* Export buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting && exportType === 'csv' ? (
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            ) : (
              <FileText className="h-6 w-6 text-green-600" />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">Esporta CSV</p>
              <p className="text-sm text-gray-500">
                Formato compatibile con Excel, per il commercialista
              </p>
            </div>
            <Download className="h-5 w-5 text-gray-400" />
          </button>

          <button
            onClick={() => handleExport('excel')}
            disabled={isExporting}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isExporting && exportType === 'excel' ? (
              <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            ) : (
              <FileSpreadsheet className="h-6 w-6 text-blue-600" />
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900">Esporta Excel</p>
              <p className="text-sm text-gray-500">
                Multi-sheet: Riepilogo, Per Cliente, Dettaglio
              </p>
            </div>
            <Download className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}
