/**
 * Branded Tracking Page - SpedireSicuro
 *
 * Pagina di tracking per clienti finali con:
 * - Dati reali da API /api/public-tracking/[trackingNumber]
 * - Fallback a "non trovata" se tracking non esiste
 * - Design ottimizzato per conversioni (CRO)
 * - Mobile-first responsive
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Truck,
  Package,
  CheckCircle2,
  MapPin,
  Clock,
  AlertCircle,
  HelpCircle,
  Archive,
  RefreshCw,
} from 'lucide-react';
import { LogoHorizontal } from '@/components/logo';

// Interfacce allineate con API pubblica
interface TrackingEvent {
  date: string;
  status: string;
  status_normalized: string | null;
  location: string | null;
  description: string;
}

interface TrackingData {
  tracking_number: string;
  carrier?: string;
  current_status: string;
  current_status_normalized: string;
  is_delivered: boolean;
  last_update: string | null;
  events: TrackingEvent[];
}

// Mappa status normalizzato a configurazione UI
type NormalizedStatus =
  | 'delivered'
  | 'out_for_delivery'
  | 'in_transit'
  | 'exception'
  | 'in_giacenza'
  | 'created'
  | 'pending_pickup'
  | 'at_destination'
  | 'returned'
  | 'cancelled'
  | 'unknown';

function getStatusConfig(status: string) {
  const configs: Record<
    string,
    {
      label: string;
      className: string;
      icon: typeof CheckCircle2;
      pulse: boolean;
    }
  > = {
    delivered: {
      label: 'Consegnato',
      className: 'bg-gradient-to-r from-green-500 to-emerald-600',
      icon: CheckCircle2,
      pulse: false,
    },
    out_for_delivery: {
      label: 'In Consegna',
      className: 'bg-gradient-to-r from-[#FFD700] to-[#FF9500]',
      icon: Truck,
      pulse: true,
    },
    in_transit: {
      label: 'In Transito',
      className: 'bg-gradient-to-r from-blue-500 to-cyan-600',
      icon: Package,
      pulse: false,
    },
    at_destination: {
      label: 'Arrivata in Sede',
      className: 'bg-gradient-to-r from-blue-600 to-indigo-600',
      icon: MapPin,
      pulse: false,
    },
    exception: {
      label: 'Eccezione',
      className: 'bg-gradient-to-r from-red-500 to-rose-600',
      icon: AlertCircle,
      pulse: false,
    },
    in_giacenza: {
      label: 'In Giacenza',
      className: 'bg-gradient-to-r from-amber-500 to-orange-600',
      icon: Archive,
      pulse: true,
    },
    created: {
      label: 'Spedizione Generata',
      className: 'bg-gradient-to-r from-gray-500 to-gray-600',
      icon: Package,
      pulse: false,
    },
    pending_pickup: {
      label: 'In Attesa di Ritiro',
      className: 'bg-gradient-to-r from-purple-500 to-violet-600',
      icon: Clock,
      pulse: true,
    },
    returned: {
      label: 'Reso',
      className: 'bg-gradient-to-r from-red-600 to-red-700',
      icon: AlertCircle,
      pulse: false,
    },
    cancelled: {
      label: 'Annullata',
      className: 'bg-gradient-to-r from-gray-600 to-gray-700',
      icon: AlertCircle,
      pulse: false,
    },
  };

  return (
    configs[status] || {
      label: 'In Transito',
      className: 'bg-gradient-to-r from-blue-500 to-cyan-600',
      icon: Package,
      pulse: false,
    }
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div
      className={`${config.className} text-white px-8 py-6 rounded-2xl shadow-2xl ${
        config.pulse ? 'animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-center gap-4">
        <Icon className="w-10 h-10" />
        <div>
          <div className="text-sm font-medium opacity-90 mb-1">Stato Spedizione</div>
          <div className="text-3xl font-bold">{config.label}</div>
        </div>
      </div>
    </div>
  );
}

// Timeline Component
function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
      <div className="space-y-6">
        {events.map((event, index) => {
          const isActive = index === 0;
          const statusConfig = getStatusConfig(event.status_normalized || 'in_transit');
          const Icon = statusConfig.icon;

          // Formatta data
          const eventDate = new Date(event.date);
          const dateStr = eventDate.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });
          const timeStr = eventDate.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div key={`${event.date}-${index}`} className="relative flex items-start gap-4">
              {/* Dot */}
              <div
                className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] shadow-lg shadow-[#FF9500]/50'
                    : 'bg-green-500'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FFD700] to-[#FF9500] animate-ping opacity-75" />
                )}
                <Icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-gray-900">{event.description}</div>
                  <div className="text-xs text-gray-500">
                    {dateStr} &bull; {timeStr}
                  </div>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const params = useParams();
  const trackingId = (params?.trackingId as string) || '';

  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = async () => {
    if (!trackingId || trackingId.trim() === '') {
      setIsLoading(false);
      setTrackingData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/public-tracking/${encodeURIComponent(trackingId.trim())}`);

      if (res.ok) {
        const data = await res.json();
        setTrackingData(data);
      } else if (res.status === 404) {
        setTrackingData(null);
        setError('not_found');
      } else {
        setTrackingData(null);
        setError('server_error');
      }
    } catch {
      setTrackingData(null);
      setError('network_error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [trackingId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF9500] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Caricamento informazioni spedizione...</p>
        </div>
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {error === 'not_found' ? 'Spedizione non trovata' : 'Errore di caricamento'}
          </h1>
          <p className="text-gray-600 mb-6">
            {error === 'not_found' ? (
              <>
                Il codice di tracciamento <span className="font-mono font-bold">{trackingId}</span>{' '}
                non e stato trovato.
              </>
            ) : (
              'Si e verificato un errore durante il caricamento. Riprova tra qualche istante.'
            )}
          </p>
          <div className="flex items-center justify-center gap-4">
            {error !== 'not_found' && (
              <button
                type="button"
                onClick={fetchTracking}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Riprova
              </button>
            )}
            <Link
              href="/contatti"
              className="inline-block px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-all"
            >
              Contatta Supporto
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Formatta ultimo aggiornamento
  const lastUpdateStr = trackingData.last_update
    ? new Date(trackingData.last_update).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-cyan-50/20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex-shrink-0">
              <LogoHorizontal className="h-10 w-auto" width={300} height={100} />
            </Link>
            <Link
              href="/contatti"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#FF9500] transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Hai bisogno di aiuto?</span>
              <span className="sm:hidden">Aiuto</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Tracking ID + Carrier */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-1">Codice di Tracciamento</p>
          <p className="text-lg font-mono font-bold text-gray-900">
            {trackingData.tracking_number}
          </p>
          {trackingData.carrier && (
            <p className="text-sm text-gray-500 mt-1">
              Corriere: <span className="font-medium text-gray-700">{trackingData.carrier}</span>
            </p>
          )}
        </div>

        {/* Status Badge */}
        <div className="mb-6">
          <StatusBadge status={trackingData.current_status_normalized} />
        </div>

        {/* Ultimo aggiornamento */}
        {lastUpdateStr && (
          <div className="text-center text-xs text-gray-500 mb-6">
            Ultimo aggiornamento: {lastUpdateStr}
          </div>
        )}

        {/* Timeline */}
        {trackingData.events.length > 0 ? (
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#FF9500]" />
              Cronologia Spedizione
            </h2>
            <TrackingTimeline events={trackingData.events} />
          </div>
        ) : (
          <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">Nessun evento di tracking ancora disponibile.</p>
            <p className="text-sm text-gray-500 mt-1">
              Gli aggiornamenti appariranno non appena il corriere registra movimenti.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-gray-500 mb-2">
          Powered by <span className="font-semibold text-[#FF9500]">SpedireSicuro</span>
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
          <Link href="/contatti" className="hover:text-[#FF9500] transition-colors">
            Supporto
          </Link>
          <span>&bull;</span>
          <Link href="/preventivi" className="hover:text-[#FF9500] transition-colors">
            Crea Spedizione
          </Link>
        </div>
      </footer>
    </div>
  );
}
