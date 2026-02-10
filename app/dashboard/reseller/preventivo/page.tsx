/**
 * Dashboard Reseller: Preventivatore Commerciale
 *
 * Modulo per generazione preventivi PDF brandizzati
 * verso nuovi clienti azienda. Due tab:
 * - "I Miei Preventivi": pipeline con filtri e azioni
 * - "Nuovo Preventivo": form creazione + anteprima matrice
 */

'use client';

import DashboardNav from '@/components/dashboard-nav';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QuoteForm } from '@/components/commercial-quotes/quote-form';
import { QuotePipeline } from '@/components/commercial-quotes/quote-pipeline';
import { QuoteDetailDialog } from '@/components/commercial-quotes/quote-detail-dialog';
import { ConvertDialog } from '@/components/commercial-quotes/convert-dialog';
import {
  sendCommercialQuoteAction,
  getCommercialQuoteByIdAction,
  renewExpiredQuoteAction,
} from '@/actions/commercial-quotes';
import dynamic from 'next/dynamic';
const QuoteAnalytics = dynamic(
  () => import('@/components/commercial-quotes/quote-analytics').then((mod) => mod.QuoteAnalytics),
  { ssr: false, loading: () => <div className="animate-pulse bg-gray-100 rounded-xl h-64" /> }
);
import { BarChart3, FileText, PlusCircle } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

export default function PreventivoPage() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Dialog state
  const [detailQuoteId, setDetailQuoteId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [convertQuoteId, setConvertQuoteId] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertQuoteData, setConvertQuoteData] = useState<{
    company?: string;
    email?: string | null;
    phone?: string | null;
  }>({});

  const refresh = useCallback(() => {
    setRefreshTrigger((p) => p + 1);
  }, []);

  const handleQuoteCreated = () => {
    setActiveTab('pipeline');
    refresh();
  };

  const handleViewQuote = (quoteId: string) => {
    setDetailQuoteId(quoteId);
    setDetailOpen(true);
  };

  const handleSendQuote = async (quoteId: string) => {
    const result = await sendCommercialQuoteAction(quoteId);
    if (result.success) {
      toast.success('Preventivo inviato');
      refresh();
    } else {
      toast.error(result.error || 'Errore invio');
    }
  };

  const handleCreateRevision = (quoteId: string) => {
    setDetailQuoteId(quoteId);
    setDetailOpen(true);
  };

  const handleConvertQuote = async (quoteId: string) => {
    // Carica dati quote per pre-compilare il form
    const result = await getCommercialQuoteByIdAction(quoteId);
    if (result.success && result.data) {
      const q = result.data.quote;
      setConvertQuoteData({
        company: q.prospect_company,
        email: q.prospect_email,
        phone: q.prospect_phone,
      });
    }
    setConvertQuoteId(quoteId);
    setConvertOpen(true);
  };

  const handleRenewQuote = async (quoteId: string) => {
    const result = await renewExpiredQuoteAction({ expired_quote_id: quoteId });
    if (result.success) {
      toast.success('Preventivo rinnovato come nuova bozza');
      refresh();
    } else {
      toast.error(result.error || 'Errore rinnovo');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Preventivatore Commerciale"
        subtitle="Genera preventivi PDF brandizzati per nuovi clienti"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="pipeline" className="gap-1.5">
              <FileText className="h-4 w-4" />I Miei Preventivi
            </TabsTrigger>
            <TabsTrigger value="new" className="gap-1.5">
              <PlusCircle className="h-4 w-4" />
              Nuovo Preventivo
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Analisi
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline">
            <QuotePipeline
              onViewQuote={handleViewQuote}
              onCreateRevision={handleCreateRevision}
              onConvertQuote={handleConvertQuote}
              onRenewQuote={handleRenewQuote}
              refreshTrigger={refreshTrigger}
            />
          </TabsContent>

          <TabsContent value="new">
            <div className="max-w-2xl mx-auto">
              <QuoteForm onQuoteCreated={handleQuoteCreated} />
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <QuoteAnalytics refreshTrigger={refreshTrigger} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <QuoteDetailDialog
        quoteId={detailQuoteId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSend={handleSendQuote}
        onCreateRevision={handleCreateRevision}
        onConvertQuote={handleConvertQuote}
        onRenewQuote={handleRenewQuote}
      />

      <ConvertDialog
        quoteId={convertQuoteId}
        prospectCompany={convertQuoteData.company}
        prospectEmail={convertQuoteData.email}
        prospectPhone={convertQuoteData.phone}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={() => {
          setConvertOpen(false);
          refresh();
        }}
      />
    </div>
  );
}
