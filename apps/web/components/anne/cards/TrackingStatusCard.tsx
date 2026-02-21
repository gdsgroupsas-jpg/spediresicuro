'use client';

import {
  Package,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react';

/** Tracking data passato dal support worker via agentState */
export interface TrackingCardData {
  trackingNumber: string;
  courier: string;
  status: 'in_transit' | 'delivered' | 'pending' | 'exception' | 'unknown';
  lastUpdate?: string;
  lastLocation?: string;
  estimatedDelivery?: string;
}

interface TrackingStatusCardProps {
  data: TrackingCardData;
  onTrackingClick?: (trackingNumber: string) => void;
}

const STATUS_CONFIG: Record<
  TrackingCardData['status'],
  { label: string; icon: typeof Package; bgColor: string; textColor: string }
> = {
  pending: { label: 'In attesa', icon: Clock, bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
  in_transit: {
    label: 'In transito',
    icon: Truck,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-600',
  },
  delivered: {
    label: 'Consegnato',
    icon: CheckCircle2,
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
  },
  exception: {
    label: 'Anomalia',
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-600',
  },
  unknown: {
    label: 'Sconosciuto',
    icon: Package,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-500',
  },
};

export function TrackingStatusCard({ data, onTrackingClick }: TrackingStatusCardProps) {
  const config = STATUS_CONFIG[data.status] || STATUS_CONFIG.unknown;
  const StatusIcon = config.icon;

  return (
    <div className="bg-white rounded-xl border border-purple-200 shadow-sm overflow-hidden max-w-[320px]">
      {/* Header with status */}
      <div className={`px-4 py-3 flex items-center justify-between ${config.bgColor}`}>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${config.textColor}`} />
          <span className={`text-sm font-semibold ${config.textColor}`}>{config.label}</span>
        </div>
        <span className="text-xs text-gray-500">{data.courier}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Tracking number */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Tracking</span>
          <button
            onClick={() => onTrackingClick?.(data.trackingNumber)}
            className="text-xs font-mono text-purple-600 hover:text-purple-800 flex items-center gap-1"
          >
            {data.trackingNumber}
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Last location */}
        {data.lastLocation && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Posizione</span>
            <span className="text-xs text-gray-700 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-gray-400" />
              {data.lastLocation}
            </span>
          </div>
        )}

        {/* Last update */}
        {data.lastUpdate && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Ultimo aggiornamento</span>
            <span className="text-xs text-gray-700">{data.lastUpdate}</span>
          </div>
        )}

        {/* ETA */}
        {data.estimatedDelivery && data.status !== 'delivered' && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Consegna stimata</span>
            <span className="text-xs font-medium text-gray-900">{data.estimatedDelivery}</span>
          </div>
        )}
      </div>
    </div>
  );
}
