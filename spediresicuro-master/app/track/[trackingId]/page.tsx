/**
 * Branded Tracking Page - SpedireSicuro
 * 
 * Pagina di tracking per clienti finali con:
 * - Design ottimizzato per conversioni (CRO)
 * - Upsell integrato
 * - Neuromarketing principles
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
  Gift,
  Sparkles,
  HelpCircle,
  ArrowRight,
  X,
} from 'lucide-react';
import { LogoHorizontal } from '@/components/logo';

// Mock Tracking Data
interface TrackingEvent {
  date: string;
  time: string;
  status: string;
  location: string;
  description: string;
}

interface TrackingData {
  trackingId: string;
  status: 'in_transit' | 'delivered' | 'exception' | 'out_for_delivery';
  estimated_delivery: string;
  current_location: string;
  recipient_name: string;
  history: TrackingEvent[];
  upsell_product?: {
    name: string;
    image: string;
    discount_code: string;
    discount_percent: number;
    expires_in?: number; // minuti rimanenti
  };
}

// Mock data generator
function getMockTrackingData(trackingId: string): TrackingData {
  // Usa un hash del trackingId per avere status consistenti
  const hash = trackingId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const statuses: TrackingData['status'][] = ['in_transit', 'delivered', 'exception', 'out_for_delivery'];
  const randomStatus = statuses[hash % statuses.length] || 'in_transit';

  return {
    trackingId,
    status: randomStatus,
    estimated_delivery: 'Domani, 14:00 - 18:00',
    current_location: 'Hub Milano Mecenate',
    recipient_name: 'Mario Rossi',
    history: [
      {
        date: '2024-01-15',
        time: '08:30',
        status: 'delivered',
        location: 'Milano',
        description: 'Pacco consegnato al destinatario',
      },
      {
        date: '2024-01-15',
        time: '06:15',
        status: 'out_for_delivery',
        location: 'Hub Milano Mecenate',
        description: 'In consegna',
      },
      {
        date: '2024-01-14',
        time: '22:45',
        status: 'in_transit',
        location: 'Hub Milano Mecenate',
        description: 'Arrivato al centro di smistamento',
      },
      {
        date: '2024-01-14',
        time: '18:20',
        status: 'in_transit',
        location: 'Hub Bologna',
        description: 'In transito verso destinazione',
      },
      {
        date: '2024-01-14',
        time: '10:00',
        status: 'in_transit',
        location: 'Roma',
        description: 'Pacco ritirato dal mittente',
      },
    ],
    upsell_product: {
      name: 'Pacchetto Premium Spedizioni',
      image: '/placeholder-product.jpg',
      discount_code: 'TRACK20',
      discount_percent: 20,
      expires_in: 45, // minuti
    },
  };
}

// Status Badge Component
function StatusBadge({ status }: { status: TrackingData['status'] }) {
  const configs = {
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
    exception: {
      label: 'Eccezione',
      className: 'bg-gradient-to-r from-red-500 to-rose-600',
      icon: AlertCircle,
      pulse: false,
    },
  };

  const config = configs[status] || configs.in_transit;
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
function TrackingTimeline({ history }: { history: TrackingEvent[] }) {
  return (
    <div className="relative">
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
      <div className="space-y-6">
        {history.map((event, index) => {
          const isActive = index === 0;
          const isPast = index > 0;

          return (
            <div key={index} className="relative flex items-start gap-4">
              {/* Dot */}
              <div
                className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] shadow-lg shadow-[#FF9500]/50'
                    : isPast
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FFD700] to-[#FF9500] animate-ping opacity-75" />
                )}
                {event.status === 'delivered' ? (
                  <CheckCircle2 className="w-6 h-6 text-white" />
                ) : event.status === 'out_for_delivery' ? (
                  <Truck className="w-6 h-6 text-white" />
                ) : (
                  <Package className="w-6 h-6 text-white" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-gray-900">{event.description}</div>
                  <div className="text-xs text-gray-500">
                    {event.date} • {event.time}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Countdown Timer Component
function CountdownTimer({ minutes }: { minutes: number }) {
  const [timeLeft, setTimeLeft] = useState(minutes * 60);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
      <Clock className="w-4 h-4" />
      <span>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}

// Upsell Card Component
function UpsellCard({
  product,
  onDismiss,
}: {
  product: NonNullable<TrackingData['upsell_product']>;
  onDismiss: () => void;
}) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="relative bg-gradient-to-br from-[#FFD700]/10 via-[#FF9500]/10 to-orange-50 border-2 border-[#FF9500]/30 rounded-2xl p-6 shadow-xl overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23FF9500' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Close Button */}
      <button
        onClick={() => {
          setIsDismissed(true);
          onDismiss();
        }}
        className="absolute top-4 right-4 p-1.5 hover:bg-black/10 rounded-lg transition-colors z-10"
        aria-label="Chiudi"
      >
        <X className="w-5 h-5 text-gray-600" />
      </button>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-gradient-to-r from-[#FFD700] to-[#FF9500] rounded-lg">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Sorpresa per te! 🎁</h3>
            <p className="text-sm text-gray-600">Mentre aspetti il tuo pacco...</p>
          </div>
        </div>

        {/* Offer */}
        <div className="bg-white rounded-xl p-4 mb-4 border border-[#FF9500]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Sconto Esclusivo</span>
            {product.expires_in && <CountdownTimer minutes={product.expires_in} />}
          </div>
          <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FF9500] mb-1">
            {product.discount_percent}% OFF
          </div>
          <p className="text-sm text-gray-600">
            Sul tuo prossimo ordine con codice: <span className="font-mono font-bold text-[#FF9500]">{product.discount_code}</span>
          </p>
        </div>

        {/* Product Image Placeholder */}
        <div className="bg-white rounded-xl p-8 mb-4 border border-gray-200 flex items-center justify-center">
          <div className="text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">{product.name}</p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => {
            // In produzione: redirect a pagina checkout con codice sconto
            window.location.href = `/preventivo?discount=${product.discount_code}`;
          }}
          className="w-full px-6 py-4 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          Sblocca Sconto Ora
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* FOMO Badge */}
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-200">
            ⚡ Offerta limitata
          </span>
        </div>
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const params = useParams();
  const trackingId = (params?.trackingId as string) || '';
  
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [upsellDismissed, setUpsellDismissed] = useState(false);

  useEffect(() => {
    // Simula fetch API
    if (!trackingId || trackingId.trim() === '') {
      setIsLoading(false);
      setTrackingData(null);
      return;
    }

    const timer = setTimeout(() => {
      try {
        const data = getMockTrackingData(trackingId);
        setTrackingData(data);
      } catch (error) {
        console.error('Errore caricamento tracking:', error);
        setTrackingData(null);
      } finally {
        setIsLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
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

  if (!trackingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Spedizione non trovata</h1>
          <p className="text-gray-600 mb-6">
            Il codice di tracciamento <span className="font-mono font-bold">{trackingId}</span> non è stato trovato.
          </p>
          <Link
            href="/contatti"
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
          >
            Contatta Supporto
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-cyan-50/20">
      {/* Simplified Header */}
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
        {/* Tracking ID */}
        <div className="text-center mb-6">
          <p className="text-sm text-gray-500 mb-1">Codice di Tracciamento</p>
          <p className="text-lg font-mono font-bold text-gray-900">{trackingId}</p>
        </div>

        {/* Zone A: Status Badge */}
        <div className="mb-6">
          <StatusBadge status={trackingData.status} />
        </div>

        {/* Estimated Delivery */}
        {trackingData.status !== 'delivered' && (
          <div className="bg-white rounded-xl p-6 mb-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Consegna Stimata</p>
                <p className="text-2xl font-bold text-gray-900">{trackingData.estimated_delivery}</p>
              </div>
            </div>
          </div>
        )}

        {/* Current Location */}
        <div className="bg-white rounded-xl p-4 mb-6 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#FF9500]" />
            <div>
              <p className="text-sm text-gray-600">Posizione Attuale</p>
              <p className="font-semibold text-gray-900">{trackingData.current_location}</p>
            </div>
          </div>
        </div>

        {/* Zone C: Upsell Card (High Visibility) */}
        {trackingData.upsell_product && !upsellDismissed && (
          <div className="mb-8">
            <UpsellCard
              product={trackingData.upsell_product}
              onDismiss={() => setUpsellDismissed(true)}
            />
          </div>
        )}

        {/* Zone B: Visual Timeline */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#FF9500]" />
            Cronologia Spedizione
          </h2>
          <TrackingTimeline history={trackingData.history} />
        </div>

        {/* Additional Info */}
        <div className="mt-6 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Destinatario</h3>
          <p className="text-gray-700">{trackingData.recipient_name}</p>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-sm text-gray-500 mb-2">
          Powered by <span className="font-semibold text-[#FF9500]">SpedireSicuro</span>
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
          <Link href="/contatti" className="hover:text-[#FF9500] transition-colors">
            Supporto
          </Link>
          <span>•</span>
          <Link href="/preventivi" className="hover:text-[#FF9500] transition-colors">
            Crea Spedizione
          </Link>
        </div>
      </footer>
    </div>
  );
}

