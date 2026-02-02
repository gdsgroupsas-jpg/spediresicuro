'use client';

import { CheckCircle2, XCircle, RefreshCw, Copy, Package } from 'lucide-react';
import type { BookingResult } from '@/lib/agent/workers/booking';

interface BookingConfirmCardProps {
  result: BookingResult;
  onCopyTracking?: (tracking: string) => void;
}

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle2,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    label: 'Prenotazione confermata',
  },
  failed: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    label: 'Prenotazione fallita',
  },
  retryable: {
    icon: RefreshCw,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    label: 'Errore temporaneo',
  },
} as const;

export function BookingConfirmCard({ result, onCopyTracking }: BookingConfirmCardProps) {
  const config = STATUS_CONFIG[result.status];
  const StatusIcon = config.icon;

  const handleCopy = () => {
    if (result.carrier_reference) {
      navigator.clipboard.writeText(result.carrier_reference).catch(() => {});
      onCopyTracking?.(result.carrier_reference);
    }
  };

  return (
    <div
      className={`bg-white rounded-xl border ${config.borderColor} shadow-sm overflow-hidden max-w-[320px]`}
    >
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-2 ${config.bgColor}`}>
        <StatusIcon className={`w-4 h-4 ${config.textColor}`} />
        <span className={`text-sm font-semibold ${config.textColor}`}>{config.label}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Message */}
        <p className="text-sm text-gray-700">{result.user_message}</p>

        {/* Tracking number (success) */}
        {result.carrier_reference && (
          <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
            <div>
              <span className="text-[10px] text-gray-500 block">Tracking</span>
              <span className="text-sm font-mono font-medium text-gray-900">
                {result.carrier_reference}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
              title="Copia tracking"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Shipment ID */}
        {result.shipment_id && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">ID Spedizione</span>
            <span className="text-xs font-mono text-gray-700">{result.shipment_id}</span>
          </div>
        )}
      </div>
    </div>
  );
}
