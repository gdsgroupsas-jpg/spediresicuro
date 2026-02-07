'use client';

/**
 * Dialog dettaglio preventivo commerciale
 *
 * Mostra matrice, clausole, timeline revisioni, bottoni azione.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MatrixPreview } from './matrix-preview';
import { NegotiationTimeline } from './negotiation-timeline';
import {
  getCommercialQuoteByIdAction,
  getQuoteNegotiationTimelineAction,
} from '@/actions/commercial-quotes';
import type {
  CommercialQuote,
  CommercialQuoteStatus,
  NegotiationTimelineEntry,
} from '@/types/commercial-quotes';
import {
  Building2,
  Calendar,
  Clock,
  Download,
  FileText,
  GitBranch,
  Loader2,
  Mail,
  MailCheck,
  Phone,
  RefreshCw,
  Send,
  Tag,
  TrendingUp,
  User,
  UserPlus,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const STATUS_LABELS: Record<
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

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface QuoteDetailDialogProps {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend?: (quoteId: string) => void;
  onCreateRevision?: (quoteId: string) => void;
  onConvertQuote?: (quoteId: string) => void;
  onRenewQuote?: (quoteId: string) => void;
}

export function QuoteDetailDialog({
  quoteId,
  open,
  onOpenChange,
  onSend,
  onCreateRevision,
  onConvertQuote,
  onRenewQuote,
}: QuoteDetailDialogProps) {
  const [quote, setQuote] = useState<CommercialQuote | null>(null);
  const [revisions, setRevisions] = useState<CommercialQuote[]>([]);
  const [timeline, setTimeline] = useState<NegotiationTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  useEffect(() => {
    if (quoteId && open) {
      setIsLoading(true);
      setIsTimelineLoading(true);

      getCommercialQuoteByIdAction(quoteId)
        .then((result) => {
          if (result.success && result.data) {
            setQuote(result.data.quote);
            setRevisions(result.data.revisions);
          }
        })
        .finally(() => setIsLoading(false));

      getQuoteNegotiationTimelineAction(quoteId)
        .then((result) => {
          if (result.success && result.data) {
            setTimeline(result.data);
          }
        })
        .finally(() => setIsTimelineLoading(false));
    }
  }, [quoteId, open]);

  if (!open) return null;

  const statusConfig = quote ? STATUS_LABELS[quote.status] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} size="large">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {quote ? `Preventivo: ${quote.prospect_company}` : 'Dettaglio Preventivo'}
            {statusConfig && (
              <Badge variant={statusConfig.variant} className="ml-2">
                {statusConfig.label}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogBody>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : quote ? (
            <div className="space-y-6">
              {/* Info prospect */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                    <Building2 className="h-4 w-4" /> Prospect
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                    <div className="font-medium text-gray-900">{quote.prospect_company}</div>
                    {quote.prospect_contact_name && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <User className="h-3.5 w-3.5" /> {quote.prospect_contact_name}
                      </div>
                    )}
                    {quote.prospect_email && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Mail className="h-3.5 w-3.5" /> {quote.prospect_email}
                      </div>
                    )}
                    {quote.prospect_phone && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Phone className="h-3.5 w-3.5" /> {quote.prospect_phone}
                      </div>
                    )}
                    {quote.prospect_sector && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Tag className="h-3.5 w-3.5" /> {quote.prospect_sector}
                      </div>
                    )}
                    {quote.prospect_estimated_volume && (
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <TrendingUp className="h-3.5 w-3.5" /> ~{quote.prospect_estimated_volume}{' '}
                        sped./mese
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> Dettagli
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Corriere</span>
                      <span className="font-medium">
                        {quote.price_matrix?.carrier_display_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Margine</span>
                      <span className="font-medium">{quote.margin_percent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Validit\u00E0</span>
                      <span className="font-medium">{quote.validity_days} giorni</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Revisione</span>
                      <span className="font-medium">v{quote.revision}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Creato</span>
                      <span className="font-medium">{formatDate(quote.created_at)}</span>
                    </div>
                    {quote.sent_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Inviato</span>
                        <span className="font-medium">{formatDate(quote.sent_at)}</span>
                      </div>
                    )}
                    {quote.expires_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Scadenza</span>
                        <span className="font-medium">{formatDate(quote.expires_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Matrice prezzi */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Matrice Prezzi</h3>
                <div className="border rounded-lg overflow-hidden">
                  <MatrixPreview matrix={quote.price_matrix} />
                </div>
              </div>

              {/* Clausole */}
              {quote.clauses && quote.clauses.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Clausole</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <ul className="space-y-1 text-sm text-gray-700">
                      {quote.clauses.map((clause, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">&bull;</span>
                          <span>
                            <strong>{clause.title}:</strong> {clause.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Indicatore email inviata */}
              {quote.sent_at && quote.prospect_email && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-sm">
                  <MailCheck className="h-4 w-4 text-blue-600" />
                  <span className="text-blue-800">Email inviata a {quote.prospect_email}</span>
                </div>
              )}

              {/* Timeline revisioni (compatto) */}
              {revisions.length > 1 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                    <GitBranch className="h-4 w-4" /> Revisioni ({revisions.length})
                  </h3>
                  <div className="space-y-2">
                    {revisions.map((rev) => (
                      <div
                        key={rev.id}
                        className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                          rev.id === quote.id ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Rev. {rev.revision}</span>
                          <Badge variant={STATUS_LABELS[rev.status].variant} className="text-xs">
                            {STATUS_LABELS[rev.status].label}
                          </Badge>
                          {rev.id === quote.id && (
                            <span className="text-xs text-blue-600">(corrente)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 text-xs">
                          <span>Margine: {rev.margin_percent}%</span>
                          <span>{formatDate(rev.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline negoziazione */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Timeline
                </h3>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                  <NegotiationTimeline entries={timeline} isLoading={isTimelineLoading} />
                </div>
              </div>

              {/* Note risposta */}
              {quote.response_notes && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Note risposta</h3>
                  <p className="text-sm text-gray-600">{quote.response_notes}</p>
                </div>
              )}

              {/* Conversione effettuata */}
              {quote.converted_user_id && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-green-600" />
                  <span className="text-sm text-green-800 font-medium">
                    Cliente creato con successo
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Preventivo non trovato</div>
          )}
        </DialogBody>

        {quote && (
          <DialogFooter>
            <div className="flex items-center gap-2 w-full justify-between">
              <Button
                variant="outline"
                onClick={() => window.open(`/api/commercial-quotes/${quote.id}/pdf`, '_blank')}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>

              <div className="flex gap-2">
                {(quote.status === 'draft' || quote.status === 'negotiating') && onSend && (
                  <Button
                    onClick={() => {
                      onSend(quote.id);
                      onOpenChange(false);
                    }}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Invia
                  </Button>
                )}
                {(quote.status === 'sent' || quote.status === 'negotiating') &&
                  onCreateRevision && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        onCreateRevision(quote.id);
                        onOpenChange(false);
                      }}
                    >
                      <GitBranch className="h-4 w-4 mr-1" />
                      Nuova Revisione
                    </Button>
                  )}
                {quote.status === 'accepted' && !quote.converted_user_id && onConvertQuote && (
                  <Button
                    onClick={() => {
                      onConvertQuote(quote.id);
                      onOpenChange(false);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Converti in Cliente
                  </Button>
                )}
                {quote.status === 'expired' && onRenewQuote && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onRenewQuote(quote.id);
                      onOpenChange(false);
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Rinnova
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
