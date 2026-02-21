'use client';

/**
 * Pipeline preventivi commerciali - Tab "I Miei Preventivi"
 *
 * Tabella con filtri per stato, badge colorati, azioni per riga.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  getCommercialQuotesAction,
  getQuotePipelineStatsAction,
  sendCommercialQuoteAction,
  updateQuoteStatusAction,
  deleteCommercialQuoteDraftAction,
  renewExpiredQuoteAction,
} from '@/actions/commercial-quotes';
import { StatusChangeDialog } from './status-change-dialog';
import type {
  CommercialQuote,
  CommercialQuoteStatus,
  QuotePipelineStats,
} from '@/types/commercial-quotes';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

// Badge colori per stato
const STATUS_CONFIG: Record<
  CommercialQuoteStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'error' }
> = {
  draft: { label: 'Bozza', variant: 'secondary' },
  sent: { label: 'Inviato', variant: 'default' },
  negotiating: { label: 'In trattativa', variant: 'warning' },
  accepted: { label: 'Accettato', variant: 'success' },
  rejected: { label: 'Rifiutato', variant: 'error' },
  expired: { label: 'Scaduto', variant: 'secondary' },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface QuotePipelineProps {
  onViewQuote?: (quoteId: string) => void;
  onCreateRevision?: (quoteId: string) => void;
  onConvertQuote?: (quoteId: string) => void;
  onRenewQuote?: (quoteId: string) => void;
  refreshTrigger?: number;
}

export function QuotePipeline({
  onViewQuote,
  onCreateRevision,
  onConvertQuote,
  onRenewQuote,
  refreshTrigger = 0,
}: QuotePipelineProps) {
  const [quotes, setQuotes] = useState<CommercialQuote[]>([]);
  const [stats, setStats] = useState<QuotePipelineStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<CommercialQuoteStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Status change dialog state
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogTarget, setStatusDialogTarget] = useState<CommercialQuoteStatus | null>(null);
  const [statusDialogQuoteId, setStatusDialogQuoteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [quotesResult, statsResult] = await Promise.all([
        getCommercialQuotesAction({
          status: filterStatus || undefined,
          search: searchQuery || undefined,
        }),
        getQuotePipelineStatsAction(),
      ]);

      if (quotesResult.success && quotesResult.data) {
        setQuotes(quotesResult.data.quotes);
      }
      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Errore caricamento:', error);
      toast.error('Errore caricamento preventivi');
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleSend = async (quoteId: string) => {
    setActionLoading(quoteId);
    try {
      const result = await sendCommercialQuoteAction(quoteId);
      if (result.success) {
        toast.success('Preventivo inviato con successo');
        loadData();
      } else {
        toast.error(result.error || 'Errore invio');
      }
    } catch {
      toast.error('Errore imprevisto');
    } finally {
      setActionLoading(null);
    }
  };

  const openStatusDialog = (quoteId: string, newStatus: CommercialQuoteStatus) => {
    setStatusDialogQuoteId(quoteId);
    setStatusDialogTarget(newStatus);
    setStatusDialogOpen(true);
  };

  const handleStatusChangeConfirm = async (notes: string) => {
    if (!statusDialogQuoteId || !statusDialogTarget) return;
    setActionLoading(statusDialogQuoteId);
    try {
      const result = await updateQuoteStatusAction(
        statusDialogQuoteId,
        statusDialogTarget,
        notes || undefined
      );
      if (result.success) {
        toast.success(`Stato aggiornato a "${STATUS_CONFIG[statusDialogTarget].label}"`);
        loadData();
      } else {
        toast.error(result.error || 'Errore aggiornamento');
      }
    } catch {
      toast.error('Errore imprevisto');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRenew = async (quoteId: string) => {
    if (onRenewQuote) {
      onRenewQuote(quoteId);
      return;
    }
    setActionLoading(quoteId);
    try {
      const result = await renewExpiredQuoteAction({ expired_quote_id: quoteId });
      if (result.success) {
        toast.success('Preventivo rinnovato come nuova bozza');
        loadData();
      } else {
        toast.error(result.error || 'Errore rinnovo');
      }
    } catch {
      toast.error('Errore imprevisto');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (quoteId: string) => {
    if (!confirm('Eliminare questa bozza?')) return;
    setActionLoading(quoteId);
    try {
      const result = await deleteCommercialQuoteDraftAction(quoteId);
      if (result.success) {
        toast.success('Bozza eliminata');
        loadData();
      } else {
        toast.error(result.error || 'Errore eliminazione');
      }
    } catch {
      toast.error('Errore imprevisto');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadPdf = (quoteId: string) => {
    window.open(`/api/commercial-quotes/${quoteId}/pdf`, '_blank');
  };

  // Calcola prezzo medio dalla matrice
  const getAveragePrice = (q: CommercialQuote): string => {
    if (!q.price_matrix?.prices?.length) return '-';
    const allPrices = q.price_matrix.prices.flat().filter((p) => p > 0);
    if (allPrices.length === 0) return '-';
    const avg = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    return formatCurrency(avg);
  };

  // Helper: giorni rimanenti alla scadenza
  const getDaysLeft = (q: CommercialQuote): number | null => {
    if (!q.expires_at) return null;
    if (q.status !== 'sent' && q.status !== 'negotiating') return null;
    const now = new Date();
    const expires = new Date(q.expires_at);
    return Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {(
            Object.entries(STATUS_CONFIG) as [
              CommercialQuoteStatus,
              (typeof STATUS_CONFIG)[CommercialQuoteStatus],
            ][]
          ).map(([status, config]) => (
            <div
              key={status}
              className={`cursor-pointer transition-shadow hover:shadow-md rounded-lg ${
                filterStatus === status ? 'ring-2 ring-gray-400' : ''
              }`}
              onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
            >
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {stats[status as keyof QuotePipelineStats] as number}
                  </div>
                  <Badge variant={config.variant} className="mt-1">
                    {config.label}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          ))}
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-700">
                {(stats.conversion_rate * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Conv. Rate</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtri */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per azienda, email..."
            className="pl-9"
          />
        </div>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as CommercialQuoteStatus | '')}
          className="w-40"
        >
          <option value="">Tutti</option>
          {Object.entries(STATUS_CONFIG).map(([value, config]) => (
            <option key={value} value={value}>
              {config.label}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={loadData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Tabella */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <FileText className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm">Nessun preventivo trovato</p>
              <p className="text-xs mt-1">
                Crea il tuo primo preventivo dalla tab &quot;Nuovo Preventivo&quot;
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Azienda
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Corriere
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Margine
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Prezzo medio
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Rev.
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Stato
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Data
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotes.map((q) => {
                    const statusConfig = STATUS_CONFIG[q.status];
                    const isActionLoading = actionLoading === q.id;

                    return (
                      <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-sm">
                            {q.prospect_company}
                          </div>
                          {q.prospect_contact_name && (
                            <div className="text-xs text-gray-500">{q.prospect_contact_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {q.price_matrix?.carrier_display_name || q.carrier_code}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {q.margin_percent}%
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {getAveragePrice(q)}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500">
                          {q.revision > 1 ? `v${q.revision}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                          {(() => {
                            const daysLeft = getDaysLeft(q);
                            if (daysLeft === null) return null;
                            if (daysLeft <= 0) {
                              return (
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                  <span className="text-xs text-red-600 font-medium">Scaduto</span>
                                </div>
                              );
                            }
                            if (daysLeft <= 7) {
                              return (
                                <div className="flex items-center justify-center gap-1 mt-1">
                                  <Clock className="h-3 w-3 text-amber-500" />
                                  <span className="text-xs text-amber-600 font-medium">
                                    Scade tra {daysLeft}g
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500">
                          {formatDate(q.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isActionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                {/* Visualizza */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onViewQuote?.(q.id)}
                                  title="Visualizza"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>

                                {/* PDF */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadPdf(q.id)}
                                  title="Scarica PDF"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>

                                {/* Invia (solo draft/negotiating) */}
                                {(q.status === 'draft' || q.status === 'negotiating') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSend(q.id)}
                                    title="Invia"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* In trattativa (solo sent) */}
                                {q.status === 'sent' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openStatusDialog(q.id, 'negotiating')}
                                    title="In trattativa"
                                    className="text-amber-600 hover:text-amber-700"
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* Accetta / Rifiuta (solo sent/negotiating) */}
                                {(q.status === 'sent' || q.status === 'negotiating') && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openStatusDialog(q.id, 'accepted')}
                                      title="Segna come accettato"
                                      className="text-green-600 hover:text-green-700"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openStatusDialog(q.id, 'rejected')}
                                      title="Segna come rifiutato"
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}

                                {/* Revisione (sent/negotiating) */}
                                {(q.status === 'sent' || q.status === 'negotiating') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onCreateRevision?.(q.id)}
                                    title="Crea revisione"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* Converti (solo accepted) */}
                                {q.status === 'accepted' && !q.converted_user_id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onConvertQuote?.(q.id)}
                                    title="Converti in cliente"
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <UserPlus className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* Rinnova (solo expired) */}
                                {q.status === 'expired' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRenew(q.id)}
                                    title="Rinnova preventivo"
                                    className="text-indigo-600 hover:text-indigo-700"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* Elimina (solo draft) */}
                                {q.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(q.id)}
                                    title="Elimina bozza"
                                    className="text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Change Dialog */}
      <StatusChangeDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        targetStatus={statusDialogTarget}
        onConfirm={handleStatusChangeConfirm}
      />
    </div>
  );
}
