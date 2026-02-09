/**
 * TrackingToast — Toast ricco per aggiornamenti tracking real-time
 *
 * Card glassmorphism con:
 * - Barra colore laterale (stato)
 * - Icona stato + tracking number mono
 * - Carrier badge
 * - Link "Vedi dettagli"
 *
 * Uso con Sonner: toast.custom((t) => <TrackingToast ... onDismiss={() => toast.dismiss(t)} />)
 */

'use client';

import {
  Package,
  Truck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Archive,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mappa colori per status (stessa di TrackingModal)
const STATUS_BAR_COLORS: Record<string, string> = {
  delivered: 'bg-emerald-500',
  in_transit: 'bg-blue-500',
  out_for_delivery: 'bg-orange-500',
  at_destination: 'bg-purple-500',
  in_giacenza: 'bg-amber-500',
  exception: 'bg-red-500',
  created: 'bg-gray-400',
  pending_pickup: 'bg-yellow-500',
  picked_up: 'bg-blue-400',
  returned: 'bg-orange-500',
  cancelled: 'bg-red-500',
  unknown: 'bg-gray-300',
};

// Icone per status
const STATUS_ICON_MAP: Record<string, React.ReactNode> = {
  delivered: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
  in_transit: <Truck className="w-5 h-5 text-blue-500" />,
  out_for_delivery: <Truck className="w-5 h-5 text-orange-500" />,
  at_destination: <MapPin className="w-5 h-5 text-purple-500" />,
  in_giacenza: <Archive className="w-5 h-5 text-amber-500" />,
  exception: <AlertCircle className="w-5 h-5 text-red-500" />,
  created: <Package className="w-5 h-5 text-gray-500" />,
  pending_pickup: <Clock className="w-5 h-5 text-yellow-500" />,
  picked_up: <Package className="w-5 h-5 text-blue-500" />,
  returned: <AlertCircle className="w-5 h-5 text-orange-500" />,
  cancelled: <X className="w-5 h-5 text-red-500" />,
  unknown: <Clock className="w-5 h-5 text-gray-400" />,
};

// Label italiane per status
const STATUS_LABEL_MAP: Record<string, string> = {
  delivered: 'Consegnato',
  in_transit: 'In Transito',
  out_for_delivery: 'In Consegna',
  at_destination: 'Arrivato a Destinazione',
  in_giacenza: 'In Giacenza',
  exception: 'Eccezione',
  created: 'Creato',
  pending_pickup: 'In Attesa Ritiro',
  picked_up: 'Ritirato',
  returned: 'Reso',
  cancelled: 'Annullato',
  unknown: 'Sconosciuto',
};

export interface TrackingToastProps {
  trackingNumber: string;
  status: string;
  carrier?: string;
  message?: string;
  onViewDetails?: () => void;
  onDismiss?: () => void;
}

export function TrackingToast({
  trackingNumber,
  status,
  carrier,
  message,
  onViewDetails,
  onDismiss,
}: TrackingToastProps) {
  const barColor = STATUS_BAR_COLORS[status] || STATUS_BAR_COLORS.unknown;
  const icon = STATUS_ICON_MAP[status] || STATUS_ICON_MAP.unknown;
  const label = STATUS_LABEL_MAP[status] || status;

  return (
    <div
      className={cn(
        'relative flex overflow-hidden rounded-xl shadow-lg border',
        'bg-white/95 backdrop-blur-md border-gray-200/80',
        'w-[360px] max-w-[90vw]',
        'animate-in slide-in-from-right-5 fade-in-0 duration-300'
      )}
    >
      {/* Barra colore laterale */}
      <div className={cn('w-1.5 flex-shrink-0', barColor)} />

      {/* Contenuto */}
      <div className="flex-1 p-3">
        <div className="flex items-start gap-3">
          {/* Icona stato */}
          <div className="flex-shrink-0 mt-0.5">{icon}</div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Stato + carrier */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900">{label}</span>
              {carrier && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 rounded">
                  {carrier}
                </span>
              )}
            </div>

            {/* Tracking number */}
            <p className="text-xs font-mono text-gray-600 mb-1 truncate">{trackingNumber}</p>

            {/* Messaggio opzionale */}
            {message && <p className="text-xs text-gray-500 line-clamp-2">{message}</p>}

            {/* Link vedi dettagli */}
            {onViewDetails && (
              <button
                onClick={onViewDetails}
                className="inline-flex items-center gap-0.5 mt-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Vedi dettagli
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Chiudi */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
