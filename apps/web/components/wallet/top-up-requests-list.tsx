'use client';

/**
 * TopUpRequestsList - Mostra le richieste di ricarica dell'utente
 *
 * Visualizza stato (in attesa, approvata, rifiutata) con badge colorati
 * e dettagli rilevanti (importo richiesto, importo approvato, note admin).
 */

import { getMyTopUpRequests } from '@/app/actions/wallet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, FileText, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TopUpRequest {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  approved_amount: number | null;
  admin_notes: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'In attesa', color: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50' },
  manual_review: {
    label: 'In revisione',
    color: 'bg-orange-900/40 text-orange-300 border-orange-700/50',
  },
  approved: { label: 'Approvata', color: 'bg-green-900/40 text-green-300 border-green-700/50' },
  rejected: { label: 'Rifiutata', color: 'bg-red-900/40 text-red-300 border-red-700/50' },
};

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

export function TopUpRequestsList() {
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const result = await getMyTopUpRequests();
      if (result.success && result.requests) {
        setRequests(result.requests);
      }
    } catch (error) {
      console.error('Errore caricamento richieste:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Non mostrare nulla se non ci sono richieste
  if (!isLoading && requests.length === 0) return null;

  const pendingCount = requests.filter(
    (r) => r.status === 'pending' || r.status === 'manual_review'
  ).length;

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header cliccabile */}
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-900/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100">Le mie richieste di ricarica</h3>
              <p className="text-xs text-gray-400">
                {pendingCount > 0
                  ? `${pendingCount} in attesa di approvazione`
                  : 'Tutte le richieste processate'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge className="bg-amber-600 text-white border-0">{pendingCount}</Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </button>

        {/* Contenuto espandibile */}
        <div
          className={cn(
            'grid transition-all duration-200 ease-in-out',
            isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0 mt-0'
          )}
        >
          <div className="overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((req) => {
                  const statusConfig = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  return (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-gray-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-gray-100">
                            Ricarica {formatCurrency(req.amount)}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn('text-xs border', statusConfig.color)}
                          >
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400">{formatDate(req.created_at)}</p>
                        {req.status === 'approved' && req.approved_amount != null && (
                          <p className="text-xs text-green-400 mt-0.5">
                            Accreditato: {formatCurrency(req.approved_amount)}
                          </p>
                        )}
                        {req.status === 'rejected' && req.admin_notes && (
                          <p className="text-xs text-red-400 mt-0.5">Motivo: {req.admin_notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
