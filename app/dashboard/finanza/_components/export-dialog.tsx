'use client';

import { useState } from 'react';
import { X, Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import type { FiscalContext } from '@/lib/agent/fiscal-data.types';
import { toast } from 'sonner';
import { exportToPDF, exportToExcel } from '../_utils/export-utils';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalContext?: FiscalContext;
}

export function ExportDialog({
  isOpen,
  onClose,
  fiscalContext,
}: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'pdf' | 'excel' | null>(null);

  const handleExport = async (type: 'pdf' | 'excel') => {
    if (!fiscalContext) {
      toast.error('Nessun dato disponibile per l\'esportazione');
      return;
    }

    setIsExporting(true);
    setExportType(type);

    try {
      if (type === 'pdf') {
        await exportToPDF(fiscalContext);
        toast.success('Report PDF scaricato con successo');
      } else {
        await exportToExcel(fiscalContext);
        toast.success('Report Excel scaricato con successo');
      }
      onClose();
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Errore durante l\'esportazione', {
        description: error.message || 'Riprova più tardi',
      });
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="bg-green-600/20 p-2 rounded-lg border border-green-500/30">
              <Download className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Esporta Report</h2>
              <p className="text-sm text-slate-400">
                Scarica i dati fiscali
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Chiudi dialog"
            disabled={isExporting}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-slate-300 leading-relaxed">
            Scegli il formato per esportare il report fiscale completo con
            margini, ricavi, COD e scadenze.
          </p>

          {/* Export Options */}
          <div className="space-y-3">
            {/* PDF Option */}
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              className="w-full p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-xl transition-all flex items-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="bg-red-600/20 p-3 rounded-lg border border-red-500/30 group-hover:bg-red-600/30 transition-colors">
                <FileText className="w-6 h-6 text-red-400" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-white">Report PDF</h3>
                <p className="text-xs text-slate-400">
                  Formato professionale per stampa e condivisione
                </p>
              </div>
              {isExporting && exportType === 'pdf' && (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              )}
            </button>

            {/* Excel Option */}
            <button
              onClick={() => handleExport('excel')}
              disabled={isExporting}
              className="w-full p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-xl transition-all flex items-center gap-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="bg-green-600/20 p-3 rounded-lg border border-green-500/30 group-hover:bg-green-600/30 transition-colors">
                <FileSpreadsheet className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-white">Foglio Excel</h3>
                <p className="text-xs text-slate-400">
                  Formato editabile per analisi e calcoli
                </p>
              </div>
              {isExporting && exportType === 'excel' && (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              )}
            </button>
          </div>

          {/* Info */}
          <div className="bg-slate-900/50 rounded-xl p-4 mt-6">
            <p className="text-xs text-slate-400 leading-relaxed">
              💡 <strong>Tip:</strong> I report includono tutti i dati del
              periodo selezionato con grafici e analisi dettagliate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
