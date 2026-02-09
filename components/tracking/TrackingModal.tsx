/**
 * TrackingModal — Modal live per tracking spedizioni
 *
 * Features:
 * - Tracking data real-time via Supabase Realtime (webhook → DB → Realtime → UI)
 * - Timeline animata con transizioni fluide
 * - Barra progresso lifecycle (Creato → Consegnato)
 * - Indicatore "LIVE" pulsante quando connesso
 * - Refresh manuale, copia tracking, link corriere
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  RefreshCw,
  ExternalLink,
  Package,
  Truck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Loader2,
  Archive,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeTracking, type RealtimeTrackingEvent } from '@/hooks/useRealtimeTracking';
import { TrackingProgressBar } from './TrackingProgressBar';

// Types
interface TrackingEvent {
  id?: string;
  event_date: string;
  status: string;
  status_normalized: string;
  location: string | null;
}

interface TrackingData {
  success: boolean;
  tracking_number: string;
  carrier?: string;
  current_status: string;
  current_status_normalized: string;
  last_update: string | null;
  events: TrackingEvent[];
  is_delivered: boolean;
  carrier_links?: Record<string, string>;
  error?: string;
}

export interface TrackingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  trackingNumber?: string;
  carrier?: string;
}

// Status icon mapping
const STATUS_ICONS: Record<string, React.ReactNode> = {
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

// Status colors per timeline
const STATUS_COLORS: Record<string, string> = {
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

// Status labels in italiano
const STATUS_LABELS: Record<string, string> = {
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
  error: 'Errore',
};

export function TrackingModal({
  open,
  onOpenChange,
  shipmentId,
  trackingNumber: initialTrackingNumber,
  carrier: initialCarrier,
}: TrackingModalProps) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEventFlash, setNewEventFlash] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Real-time tracking: nuovi eventi appaiono live
  const { isConnected } = useRealtimeTracking({
    shipmentId,
    enabled: open,
    onNewEvent: (event: RealtimeTrackingEvent) => {
      // Aggiungi l'evento in cima alla lista senza re-fetch
      setTrackingData((prev) => {
        if (!prev) return prev;

        const newEvent: TrackingEvent = {
          id: event.id,
          event_date: event.event_date,
          status: event.status,
          status_normalized: event.status_normalized,
          location: event.location,
        };

        // Evita duplicati
        const exists = prev.events.some(
          (e) => e.event_date === newEvent.event_date && e.status === newEvent.status
        );
        if (exists) return prev;

        const updatedEvents = [newEvent, ...prev.events];

        return {
          ...prev,
          events: updatedEvents,
          current_status: newEvent.status,
          current_status_normalized: newEvent.status_normalized,
          is_delivered: newEvent.status_normalized === 'delivered',
          last_update: new Date().toISOString(),
        };
      });

      // Flash animazione per il nuovo evento
      setNewEventFlash(event.id);
      setTimeout(() => setNewEventFlash(null), 2000);
    },
  });

  // Fetch tracking data
  const fetchTracking = useCallback(
    async (forceRefresh = false) => {
      if (!shipmentId) return;

      try {
        if (forceRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const url = `/api/tracking/${shipmentId}${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Errore nel recupero tracking');
        }

        setTrackingData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [shipmentId]
  );

  // Fetch on open
  useEffect(() => {
    if (open && shipmentId) {
      fetchTracking();
    }
  }, [open, shipmentId, fetchTracking]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  // Copy tracking number
  const handleCopy = async () => {
    const trackingNum = trackingData?.tracking_number || initialTrackingNumber;
    if (!trackingNum) return;

    try {
      await navigator.clipboard.writeText(trackingNum);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying:', err);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!open) return null;

  const trackingNumber = trackingData?.tracking_number || initialTrackingNumber || '';
  const carrier = trackingData?.carrier || initialCarrier || '';
  const currentStatus = trackingData?.current_status_normalized || 'unknown';
  const isDelivered = trackingData?.is_delivered || false;
  const events = trackingData?.events || [];
  const carrierLinks = trackingData?.carrier_links || {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col',
          'animate-in fade-in-0 zoom-in-95 duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-500',
                isDelivered ? 'bg-emerald-100' : 'bg-blue-100'
              )}
            >
              {STATUS_ICONS[currentStatus] || STATUS_ICONS.unknown}
            </div>
            <div>
              <h2 id="tracking-modal-title" className="text-lg font-bold text-gray-900">
                Tracking Spedizione
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-sm text-gray-500">
                  {STATUS_LABELS[currentStatus] || 'Caricamento...'}
                </p>
                {/* Indicatore LIVE */}
                {isConnected && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                    <Radio className="w-2.5 h-2.5 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              onClick={() => fetchTracking(true)}
              disabled={refreshing}
              className={cn(
                'p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
                refreshing && 'animate-spin',
                isConnected && 'opacity-50'
              )}
              title={isConnected ? 'Aggiornamento automatico attivo' : 'Aggiorna tracking'}
            >
              <RefreshCw className="w-5 h-5" />
            </button>

            {/* Close Button */}
            <button
              ref={closeButtonRef}
              onClick={() => onOpenChange(false)}
              className={cn(
                'p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100',
                'transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400'
              )}
              aria-label="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        {trackingData && !loading && (
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <TrackingProgressBar currentStatus={currentStatus} compact />
          </div>
        )}

        {/* Tracking Number */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tracking Number
              </p>
              <p className="text-lg font-mono font-bold text-gray-900">{trackingNumber || '—'}</p>
            </div>
            <div className="flex items-center gap-2">
              {trackingNumber && (
                <button
                  onClick={handleCopy}
                  className={cn(
                    'p-2 rounded-lg transition-all duration-200',
                    copied
                      ? 'bg-emerald-100 text-emerald-600 scale-110'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  )}
                  title={copied ? 'Copiato!' : 'Copia'}
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
              {carrier && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                  {carrier.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500">Caricamento tracking...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
              <p className="text-gray-700 font-medium mb-2">Errore</p>
              <p className="text-gray-500 text-sm text-center">{error}</p>
              <button
                onClick={() => fetchTracking(true)}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Riprova
              </button>
            </div>
          )}

          {/* Timeline */}
          {!loading && !error && events.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Cronologia Eventi
              </h3>
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />

                {/* Events */}
                <div className="space-y-4">
                  {events.map((event, index) => {
                    const isNew = event.id === newEventFlash;
                    return (
                      <div
                        key={event.id || `${event.event_date}-${event.status}`}
                        className={cn(
                          'relative flex gap-4 transition-all duration-500',
                          isNew && 'animate-in slide-in-from-top-2 fade-in-0 duration-500'
                        )}
                      >
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            'relative z-10 w-8 h-8 rounded-full flex items-center justify-center bg-white',
                            index === 0 && 'ring-4 ring-white'
                          )}
                        >
                          <div
                            className={cn(
                              'rounded-full transition-all duration-500',
                              index === 0
                                ? cn(
                                    'w-3 h-3',
                                    STATUS_COLORS[event.status_normalized] || STATUS_COLORS.unknown,
                                    isNew && 'w-4 h-4 ring-4 ring-blue-200'
                                  )
                                : 'w-3 h-3 bg-gray-300'
                            )}
                          />
                        </div>

                        {/* Event content */}
                        <div className="flex-1 pb-4">
                          <div
                            className={cn(
                              'p-3 rounded-lg transition-all duration-500',
                              index === 0 ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50',
                              isNew &&
                                'ring-2 ring-blue-300 bg-blue-50 shadow-md shadow-blue-500/10'
                            )}
                          >
                            <p
                              className={cn(
                                'font-medium',
                                index === 0 ? 'text-blue-900' : 'text-gray-700'
                              )}
                            >
                              {event.status}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                              <span>{formatDate(event.event_date)}</span>
                              {event.location && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {event.location}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* No Events */}
          {!loading && !error && events.length === 0 && trackingData && (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-gray-500">Nessun evento tracking disponibile</p>
              <p className="text-gray-400 text-sm mt-1">
                La spedizione potrebbe non essere ancora partita
              </p>
            </div>
          )}
        </div>

        {/* Footer - Carrier Links */}
        {Object.keys(carrierLinks).length > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Traccia sul sito del corriere
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(carrierLinks).map(([name, url]) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium',
                    'bg-white border border-gray-200 text-gray-700',
                    'hover:bg-gray-50 hover:border-gray-300 transition-colors'
                  )}
                >
                  {name.toUpperCase()}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Last Update + Live indicator */}
        <div className="px-4 py-2 bg-gray-100 text-center flex items-center justify-center gap-2">
          {isConnected && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
          <p className="text-xs text-gray-500">
            {isConnected
              ? 'Aggiornamento automatico attivo'
              : trackingData?.last_update
                ? `Ultimo aggiornamento: ${formatDate(trackingData.last_update)}`
                : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export default TrackingModal;
