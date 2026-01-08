/**
 * Intelligent Quote Comparator - Enterprise-Grade Component
 * 
 * Preventivatore intelligente che:
 * 1. Si attiva automaticamente quando dati completi (zona, peso, misure)
 * 2. Chiama tutti i contract code in parallelo
 * 3. Mostra solo contratti con risultati validi (nasconde se API non supporta destinazione)
 * 4. Vista Card e Tabella con switch
 * 5. Progresso globale + stato per singolo contratto
 * 6. Gestione accessori dinamica (solo se presenti nel listino cliente)
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, RefreshCw, Grid3x3, List, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
// Rimuoviamo useQuoteRequest per gestire chiamate parallele manualmente

interface IntelligentQuoteComparatorProps {
  couriers: Array<{
    displayName: string;
    courierName: string;
    contractCode?: string;
  }>;
  weight: number;
  zip?: string;
  province?: string;
  city?: string;
  services?: string[];
  insuranceValue?: number;
  codValue?: number;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
  onQuoteReceived?: (courier: string, contractCode: string, quote: any) => void;
  onContractSelected?: (courier: string, contractCode: string) => void;
}

type ViewMode = 'card' | 'table';

interface QuoteResult {
  courier: string;
  courierName: string;
  contractCode: string;
  success: boolean;
  rates?: any[];
  error?: string;
  cached?: boolean;
  cacheAge?: number;
  loading: boolean;
}

export function IntelligentQuoteComparator({
  couriers,
  weight,
  zip,
  province,
  city,
  services = [],
  insuranceValue = 0,
  codValue = 0,
  dimensions,
  onQuoteReceived,
  onContractSelected,
}: IntelligentQuoteComparatorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [quotes, setQuotes] = useState<Map<string, QuoteResult>>(new Map());
  const [isCalculating, setIsCalculating] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Verifica se dati sono completi per attivare preventivatore
  const isDataComplete = useMemo(() => {
    return (
      weight > 0 &&
      !!zip &&
      !!province &&
      dimensions?.length &&
      dimensions?.width &&
      dimensions?.height
    );
  }, [weight, zip, province, dimensions]);

  // Chiamata automatica quando dati completi
  useEffect(() => {
    if (!isDataComplete || couriers.length === 0) {
      return;
    }

    // Reset stato
    setQuotes(new Map());
    setCompletedCount(0);
    setTotalCount(couriers.length);
    setIsCalculating(true);

    // Chiama tutti i contratti in parallelo
    const fetchAllQuotes = async () => {
      const promises = couriers.map(async (courier) => {
        const key = `${courier.displayName}::${courier.contractCode || 'default'}`;
        
        // Inizializza stato loading
        setQuotes((prev) => {
          const next = new Map(prev);
          next.set(key, {
            courier: courier.displayName,
            courierName: courier.courierName,
            contractCode: courier.contractCode || 'default',
            success: false,
            loading: true,
          });
          return next;
        });

        try {
          // Chiamata API diretta
          const response = await fetch('/api/quotes/realtime', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courier: courier.courierName,
              contractCode: courier.contractCode,
              weight,
              zip,
              province,
              services,
              insuranceValue,
              codValue,
            }),
          });

          const result = await response.json();

          // Aggiorna stato con risultato
          setQuotes((prev) => {
            const next = new Map(prev);
            const existing = next.get(key) || {
              courier: courier.displayName,
              courierName: courier.courierName,
              contractCode: courier.contractCode || 'default',
              success: false,
              loading: false,
            };

            next.set(key, {
              ...existing,
              success: result?.success || false,
              rates: result?.rates || [],
              error: result?.error,
              cached: result?.cached,
              cacheAge: result?.cacheAge,
              loading: false,
            });

            return next;
          });

          // Notifica callback
          if (result?.success && result.rates && result.rates.length > 0 && onQuoteReceived) {
            onQuoteReceived(courier.displayName, courier.contractCode || 'default', result);
          }

          setCompletedCount((prev) => prev + 1);
        } catch (error: any) {
          // Aggiorna stato con errore
          setQuotes((prev) => {
            const next = new Map(prev);
            const existing = next.get(key) || {
              courier: courier.displayName,
              courierName: courier.courierName,
              contractCode: courier.contractCode || 'default',
              success: false,
              loading: false,
            };

            next.set(key, {
              ...existing,
              success: false,
              error: error.message || 'Errore sconosciuto',
              loading: false,
            });

            return next;
          });

          setCompletedCount((prev) => prev + 1);
        }
      });

      await Promise.allSettled(promises);
      setIsCalculating(false);
    };

    fetchAllQuotes();
  }, [isDataComplete, couriers, weight, zip, province, services, insuranceValue, codValue, requestQuote, onQuoteReceived]);

  // Filtra solo contratti con risultati validi
  const validQuotes = useMemo(() => {
    return Array.from(quotes.values()).filter(
      (quote) => quote.success && quote.rates && quote.rates.length > 0
    );
  }, [quotes]);

  // Progresso calcolo
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (!isDataComplete) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-yellow-800">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-medium">
            Completa tutti i campi (zona geografica, peso, misure) per attivare il preventivatore intelligente
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con switch vista e progresso */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Preventivatore Intelligente</h3>
          
          {/* Switch vista */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'card'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid3x3 className="w-4 h-4 inline mr-1" />
              Card
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4 inline mr-1" />
              Tabella
            </button>
          </div>
        </div>

        {/* Progresso globale */}
        {isCalculating && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                {completedCount}/{totalCount} contratti verificati
              </span>
            </div>
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF9500] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Risultati */}
      {validQuotes.length === 0 && !isCalculating && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Nessun contratto disponibile per questa destinazione</p>
          <p className="text-sm text-gray-500 mt-1">
            Verifica che i dati inseriti siano corretti o che i contratti supportino questa destinazione
          </p>
        </div>
      )}

      {/* Vista Card */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {validQuotes.map((quote) => (
            <QuoteCard
              key={`${quote.courier}::${quote.contractCode}`}
              quote={quote}
              onSelect={() => onContractSelected?.(quote.courier, quote.contractCode)}
            />
          ))}
        </div>
      )}

      {/* Vista Tabella */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Corriere
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Contratto
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Costo Fornitore
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Prezzo Vendita
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Azione
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {validQuotes.map((quote) => (
                <QuoteTableRow
                  key={`${quote.courier}::${quote.contractCode}`}
                  quote={quote}
                  onSelect={() => onContractSelected?.(quote.courier, quote.contractCode)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Componente Card singola
function QuoteCard({ quote, onSelect }: { quote: QuoteResult; onSelect: () => void }) {
  const bestRate = quote.rates?.[0];
  const totalPrice = bestRate ? parseFloat(bestRate.total_price || '0') : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#FF9500] hover:shadow-md transition-all cursor-pointer" onClick={onSelect}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{quote.courier}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{quote.contractCode}</p>
        </div>
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      </div>

      {quote.cached && quote.cacheAge !== undefined && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <Clock className="w-3 h-3" />
            <span>Da cache ({quote.cacheAge}s fa)</span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Costo Fornitore:</span>
          <span className="font-semibold text-gray-900">€{totalPrice.toFixed(2)}</span>
        </div>
        
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm font-medium text-gray-700">Prezzo Vendita:</span>
          <span className="text-lg font-bold text-[#FF9500]">€{totalPrice.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

// Componente Riga Tabella
function QuoteTableRow({ quote, onSelect }: { quote: QuoteResult; onSelect: () => void }) {
  const bestRate = quote.rates?.[0];
  const totalPrice = bestRate ? parseFloat(bestRate.total_price || '0') : 0;

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{quote.courier}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-gray-500">{quote.contractCode}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-semibold text-gray-900">€{totalPrice.toFixed(2)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-lg font-bold text-[#FF9500]">€{totalPrice.toFixed(2)}</span>
      </td>
      <td className="px-4 py-3 text-center">
        {quote.cached ? (
          <div className="inline-flex items-center gap-1 text-xs text-blue-600">
            <Clock className="w-3 h-3" />
            <span>Cache</span>
          </div>
        ) : (
          <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={onSelect}
          className="px-3 py-1.5 bg-[#FF9500] text-white rounded-md text-sm font-medium hover:bg-[#FF8500] transition-colors"
        >
          Seleziona
        </button>
      </td>
    </tr>
  );
}
