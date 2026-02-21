'use client';

/**
 * Timeline di negoziazione verticale
 *
 * Mostra la storia completa del preventivo:
 * eventi lifecycle, revisioni, cambio stato, note.
 */

import type { NegotiationTimelineEntry, CommercialQuoteEventType } from '@/types/commercial-quotes';
import {
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  RefreshCw,
  Send,
  UserPlus,
  XCircle,
  AlertTriangle,
  Bell,
  Edit3,
} from 'lucide-react';

// Configurazione colori e icone per tipo evento
const EVENT_CONFIG: Record<
  CommercialQuoteEventType,
  { color: string; bgColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  created: { color: 'text-green-600', bgColor: 'bg-green-100', Icon: FileText },
  updated: { color: 'text-gray-500', bgColor: 'bg-gray-100', Icon: Edit3 },
  sent: { color: 'text-blue-600', bgColor: 'bg-blue-100', Icon: Send },
  viewed: { color: 'text-cyan-600', bgColor: 'bg-cyan-100', Icon: Mail },
  revised: { color: 'text-purple-600', bgColor: 'bg-purple-100', Icon: RefreshCw },
  accepted: { color: 'text-green-600', bgColor: 'bg-green-100', Icon: CheckCircle2 },
  rejected: { color: 'text-red-600', bgColor: 'bg-red-100', Icon: XCircle },
  expired: { color: 'text-red-500', bgColor: 'bg-red-50', Icon: AlertTriangle },
  reminder_sent: { color: 'text-amber-600', bgColor: 'bg-amber-100', Icon: Bell },
  renewed: { color: 'text-indigo-600', bgColor: 'bg-indigo-100', Icon: RefreshCw },
  converted: { color: 'text-emerald-600', bgColor: 'bg-emerald-100', Icon: UserPlus },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface NegotiationTimelineProps {
  entries: NegotiationTimelineEntry[];
  isLoading?: boolean;
}

export function NegotiationTimeline({ entries, isLoading = false }: NegotiationTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-500">
        <Clock className="h-8 w-8 mx-auto text-gray-300 mb-2" />
        Nessun evento registrato
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Linea verticale di connessione */}
      <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {entries.map((entry, idx) => {
          const config = EVENT_CONFIG[entry.event_type] || EVENT_CONFIG.updated;
          const { Icon } = config;
          const isLast = idx === entries.length - 1;

          return (
            <div key={entry.id} className="relative flex gap-3">
              {/* Dot con icona */}
              <div
                className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}
              >
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>

              {/* Contenuto */}
              <div className={`flex-1 ${isLast ? '' : 'pb-2'}`}>
                <div className="flex items-baseline gap-2">
                  <span className={`text-sm font-medium ${config.color}`}>{entry.event_label}</span>
                  <span className="text-xs text-gray-400">{formatDateTime(entry.created_at)}</span>
                </div>

                {entry.actor_name && (
                  <p className="text-xs text-gray-500 mt-0.5">di {entry.actor_name}</p>
                )}

                {/* Note */}
                {entry.notes && (
                  <div className="mt-1.5 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
                    <p className="text-xs text-gray-600 italic">&ldquo;{entry.notes}&rdquo;</p>
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
