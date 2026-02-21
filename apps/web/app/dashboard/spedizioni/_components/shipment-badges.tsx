import { ArrowLeftRight } from 'lucide-react';

export function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    in_preparazione: {
      label: 'In Preparazione',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    in_transito: {
      label: 'In Transito',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    consegnata: {
      label: 'Consegnata',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    eccezione: {
      label: 'Eccezione',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    annullata: {
      label: 'Annullata',
      className: 'bg-gray-50 text-gray-700 border-gray-200',
    },
  };

  const config = statusConfig[status] || {
    label: status || 'Sconosciuto',
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function ImportedBadge({
  imported,
  verified,
  platform,
}: {
  imported?: boolean;
  verified?: boolean;
  platform?: string;
}) {
  if (!imported) return null;

  return (
    <div className="flex items-center gap-1">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
          verified
            ? 'bg-green-50 text-green-700 border-green-300'
            : 'bg-purple-50 text-purple-700 border-purple-300'
        }`}
        title={
          verified
            ? 'Ordine verificato e pronto per export'
            : 'Ordine importato - Verifica richiesta'
        }
      >
        {verified ? '✓ Verificato' : 'Importato'}
      </span>
      {platform && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
          {platform}
        </span>
      )}
    </div>
  );
}

export function ReturnBadge({
  isReturn,
  returnStatus,
}: {
  isReturn?: boolean;
  returnStatus?: string;
}) {
  if (!isReturn) return null;

  const statusConfig: Record<string, { label: string; className: string }> = {
    requested: {
      label: 'Reso Richiesto',
      className: 'bg-orange-50 text-orange-700 border-orange-300',
    },
    processing: {
      label: 'Reso in Elaborazione',
      className: 'bg-blue-50 text-blue-700 border-blue-300',
    },
    completed: {
      label: 'Reso Completato',
      className: 'bg-green-50 text-green-700 border-green-300',
    },
    cancelled: {
      label: 'Reso Annullato',
      className: 'bg-gray-50 text-gray-700 border-gray-300',
    },
  };

  const config =
    returnStatus && statusConfig[returnStatus]
      ? statusConfig[returnStatus]
      : {
          label: 'Reso',
          className: 'bg-purple-50 text-purple-700 border-purple-300',
        };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${config.className}`}
      title="Questa e una spedizione di reso"
    >
      <ArrowLeftRight className="w-3 h-3 mr-1" />
      {config.label}
    </span>
  );
}
