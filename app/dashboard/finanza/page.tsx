'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp, AlertTriangle, ShieldCheck,
  PieChart, Activity, Zap, MessageSquare, AlertCircle
} from 'lucide-react';
import { getMyFiscalData } from '@/app/actions/fiscal';
import type { FiscalContext } from '@/lib/agent/fiscal-data.types';
import { FiscalErrorBoundary } from './_components/fiscal-error-boundary';
import { AIChatDialog } from './_components/ai-chat-dialog';
import { toast } from 'sonner';

function FinanceControlRoomContent() {
  const [aiMessage, setAiMessage] = useState("Sto analizzando i flussi di cassa in tempo reale...");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [fiscalContext, setFiscalContext] = useState<FiscalContext | null>(null);

  // Real data from server
  const [stats, setStats] = useState({
      revenue: 0,
      margin: 0,
      projection: 0,
      roi: 22.8,
      tax_risk: "LOW" as const,
      next_deadline: "Caricamento..."
  });

  useEffect(() => {
    // Caricamento dati reali via Server Action
    const fetchData = async () => {
        try {
            setError(null);
            const data = await getMyFiscalData();
            setFiscalContext(data);

            // Map data to state stats
            if (data && data.shipmentsSummary) {
                const nextDeadline = data.deadlines?.[0];
                const deadlineText = nextDeadline
                  ? `${new Date(nextDeadline.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} - ${nextDeadline.type}`
                  : "Nessuna scadenza";

                setStats({
                    revenue: data.shipmentsSummary.total_revenue,
                    margin: data.shipmentsSummary.total_margin,
                    projection: data.shipmentsSummary.total_revenue * 1.1,
                    roi: data.shipmentsSummary.total_revenue > 0
                      ? (data.shipmentsSummary.total_margin / data.shipmentsSummary.total_revenue) * 100
                      : 0,
                    tax_risk: "LOW",
                    next_deadline: deadlineText
                });

                // Generate AI insight based on real data
                const marginPercent = data.shipmentsSummary.total_revenue > 0
                  ? (data.shipmentsSummary.total_margin / data.shipmentsSummary.total_revenue) * 100
                  : 0;

                let insight = `Analisi completata. `;
                if (marginPercent > 20) {
                    insight += `Margine eccellente (${marginPercent.toFixed(1)}%). `;
                } else if (marginPercent > 15) {
                    insight += `Margine buono (${marginPercent.toFixed(1)}%). `;
                } else if (marginPercent > 10) {
                    insight += `Margine nella media (${marginPercent.toFixed(1)}%). `;
                } else {
                    insight += `Attenzione: margine basso (${marginPercent.toFixed(1)}%). `;
                }

                if (data.pending_cod_count > 0) {
                    insight += `Hai ${data.pending_cod_count} contrassegni pendenti (€${data.pending_cod_value.toFixed(2)}).`;
                } else {
                    insight += `Nessuna criticità rilevata.`;
                }

                setAiMessage(insight);
            }
        } catch (e: any) {
            console.error("Failed to fetch fiscal data", e);
            const errorMessage = e?.message || "Errore nel caricamento dei dati";
            setError(errorMessage);
            toast.error('Errore', {
              description: errorMessage
            });
        } finally {
            setIsLoading(false);
        }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-10 font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Header Futuristico */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                Finance Control Room
            </h1>
            <p className="text-slate-400 mt-2 text-lg">AI-Powered CFO View • SpedireSicuro Intelligence</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-800/50 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700">
            <div className="relative">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
            </div>
            <span className="text-sm font-medium text-green-400">SYSTEM OPERATIONAL</span>
        </div>
      </div>

      {/* ANNE BRAIN INTERFACE */}
      <div className="mb-12 relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative bg-slate-800 rounded-2xl p-6 border border-slate-700 flex items-start gap-6">
            <div className="bg-indigo-600/20 p-4 rounded-xl border border-indigo-500/30">
                <Zap className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="flex-1">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-1">ANNE INSIGHT</h3>
                {isLoading ? (
                    <div className="h-6 w-2/3 bg-slate-700 rounded animate-pulse"></div>
                ) : (
                    <p className="text-xl md:text-2xl font-light text-slate-100 leading-relaxed">
                        &quot;{aiMessage}&quot;
                    </p>
                )}
            </div>
            <button
                onClick={() => setIsChatOpen(true)}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-900/50 flex items-center gap-2"
                aria-label="Apri chat con ANNE"
            >
                <MessageSquare className="w-4 h-4" /> Chiedi Dettagli
            </button>
        </div>
      </div>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* KPI 1: Profitto */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div>
                   <p className="text-slate-400 text-sm font-medium">MARGINE NETTO (Mese)</p>
                   <h2 className="text-3xl font-bold text-white mt-1">€ {stats.margin.toLocaleString('it-IT')}</h2>
                </div>
                <div className="bg-green-500/10 p-2 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
            </div>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-full w-[75%]"></div>
            </div>
            <p className="text-green-400 text-xs mt-3 font-medium flex items-center gap-1">
                <Zap className="w-3 h-3" /> Target Mensile Raggiunto al 75%
            </p>
        </div>

        {/* KPI 2: Proiezione AI */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-bl-full"></div>
            <div className="flex justify-between items-start mb-4">
                <div>
                   <p className="text-slate-400 text-sm font-medium">PROIEZIONE CHIUSURA</p>
                   <h2 className="text-3xl font-bold text-purple-200 mt-1">€ {stats.projection.toLocaleString('it-IT')}</h2>
                </div>
                <div className="bg-purple-500/10 p-2 rounded-lg">
                    <Activity className="w-6 h-6 text-purple-400" />
                </div>
            </div>
             <p className="text-slate-400 text-sm leading-relaxed">
                Basato sul trend attuale, chiuderai il mese con un <span className="text-white font-bold">+9%</span> rispetto a prev.
            </p>
        </div>

        {/* KPI 3: Rischio / Scadenze */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 p-6 rounded-2xl hover:bg-slate-800 transition-colors border-l-4 border-l-yellow-500">
             <div className="flex justify-between items-start mb-4">
                <div>
                   <p className="text-slate-400 text-sm font-medium">NEXT DEADLINE</p>
                   <h2 className="text-2xl font-bold text-white mt-1">{stats.next_deadline}</h2>
                </div>
                <div className="bg-yellow-500/10 p-2 rounded-lg">
                    <AlertTriangle className="w-6 h-6 text-yellow-500" />
                </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
                 <button className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium text-white transition-colors">
                    Dettagli
                 </button>
                 <button className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-xs font-medium text-white transition-colors">
                    Paga Ora
                 </button>
            </div>
        </div>
      </div>

      {/* DETTAGLIO ANALYTICS (Placeholder per grafico complesso) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 min-h-[300px]">
            <h3 className="text-lg font-semibold text-white mb-6">Analisi Ricavi vs Costi</h3>
            {/* Mock Chart Visual */}
            <div className="flex items-end gap-2 h-48 mt-8 justify-between px-4">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="w-full bg-slate-700/50 rounded-t-lg relative group">
                        <div style={{ height: `${h}%` }} className="absolute bottom-0 w-full bg-indigo-500/80 rounded-t-lg group-hover:bg-indigo-400 transition-all"></div>
                        <div style={{ height: `${h-20}%` }} className="absolute bottom-0 w-full bg-blue-500/40 rounded-t-lg"></div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-4 px-2">
                <span>Lun</span><span>Mar</span><span>Mer</span><span>Gio</span><span>Ven</span><span>Sab</span><span>Dom</span>
            </div>
         </div>

         <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Fiscal Health Check</h3>
            <div className="space-y-4">
                {[
                    { label: "Dichiarazione IVA", status: "Ready", color: "text-green-400" },
                    { label: "Plafond Export", status: "82% Utilizzato", color: "text-yellow-400" },
                    { label: "Rischio Controlli", status: "Basso", color: "text-blue-400" },
                    { label: "Regime Forfettario", status: "In Soglia", color: "text-green-400" }
                ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl hover:bg-slate-700/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className={`w-5 h-5 ${item.color}`} />
                            <span className="text-slate-300 font-medium">{item.label}</span>
                        </div>
                        <span className={`text-sm font-bold ${item.color}`}>{item.status}</span>
                    </div>
                ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-700">
                <button className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-xl flex items-center justify-center gap-2 transition-all">
                    <PieChart className="w-4 h-4" /> Vedi Report Completo
                </button>
            </div>
         </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="fixed bottom-6 right-6 bg-red-500/10 border border-red-500/30 backdrop-blur-md rounded-xl p-4 max-w-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Errore di caricamento</p>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Dialog */}
      <AIChatDialog
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        fiscalContext={fiscalContext || undefined}
      />
    </div>
  );
}

export default function FinanceControlRoom() {
  return (
    <FiscalErrorBoundary>
      <FinanceControlRoomContent />
    </FiscalErrorBoundary>
  );
}
