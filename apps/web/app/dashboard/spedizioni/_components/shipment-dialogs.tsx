import ImportOrders from '@/components/import/import-orders';
import { AlertCircle, CheckCircle2, Trash2 } from 'lucide-react';

export interface ImportResult {
  success: number;
  errors: string[];
}

interface ImportOrdersModalProps {
  open: boolean;
  onImportComplete: (successCount: number, errors: string[]) => void | Promise<void>;
  onCancel: () => void;
}

export function ImportOrdersModal({ open, onImportComplete, onCancel }: ImportOrdersModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-8">
        <ImportOrders onImportComplete={onImportComplete} onCancel={onCancel} />
      </div>
    </div>
  );
}

interface ImportResultModalProps {
  result: ImportResult | null;
  onClose: () => void;
}

export function ImportResultModal({ result, onClose }: ImportResultModalProps) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
              result.errors.length === 0 ? 'bg-green-100' : 'bg-yellow-100'
            }`}
          >
            {result.errors.length === 0 ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : (
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Importazione Completata</h3>
            <p className="text-sm text-gray-600">{result.success} ordini importati con successo</p>
          </div>
        </div>

        {result.errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="text-sm font-semibold text-red-900 mb-2">
              Errori ({result.errors.length}):
            </h4>
            <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
              {result.errors.map((error, index) => (
                <li key={index}>- {error}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg hover:shadow-lg transition-all"
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  open: boolean;
  shipmentCount: number;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  open,
  shipmentCount,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {shipmentCount > 0 ? `Elimina ${shipmentCount} Spedizioni` : 'Elimina Spedizione'}
            </h3>
            <p className="text-sm text-gray-600">Questa azione non puo essere annullata</p>
          </div>
        </div>

        <div className="mb-6">
          {shipmentCount > 0 ? (
            <div>
              <p className="text-sm text-gray-700 mb-3">
                Sei sicuro di voler eliminare{' '}
                <strong className="text-red-600">{shipmentCount} spedizioni selezionate</strong>?
              </p>
              <p className="text-xs text-gray-600">
                I dati saranno archiviati ma non visibili nella lista.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              Sei sicuro di voler eliminare questa spedizione? I dati saranno archiviati ma non
              visibili nella lista.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Eliminazione...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Elimina
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
