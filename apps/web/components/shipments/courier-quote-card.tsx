/**
 * Courier Quote Card - Enterprise-Grade Component
 *
 * Mostra corriere con:
 * - Quote real-time al click
 * - Loading states (skeleton loader)
 * - Retry button su errore
 * - Ottimistic update (mostra stima mentre carica)
 * - Cache indicator
 */

'use client';

import { useState, useEffect } from 'react';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useQuoteRequest } from '@/hooks/useQuoteRequest';
import type { QuoteRequestParams } from '@/hooks/useQuoteRequest';

interface CourierQuoteCardProps {
  courier: {
    displayName: string;
    courierName: string;
    contractCode?: string;
  };
  weight: number;
  zip?: string;
  province?: string;
  services?: string[];
  insuranceValue?: number;
  codValue?: number;
  onQuoteReceived?: (courier: string, quote: any) => void;
  estimatedPrice?: number; // Prezzo stimato da listino (per ottimistic update)
}

export function CourierQuoteCard({
  courier,
  weight,
  zip,
  province,
  services = [],
  insuranceValue = 0,
  codValue = 0,
  onQuoteReceived,
  estimatedPrice,
}: CourierQuoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [quoteRequested, setQuoteRequested] = useState(false);

  const { requestQuote, loading, error, lastResult, cancelPending } = useQuoteRequest({
    debounceMs: 500,
    maxConcurrent: 3,
    retryAttempts: 2,
  });

  // Richiedi quote quando si espande
  useEffect(() => {
    if (isExpanded && !quoteRequested && weight > 0 && zip) {
      setQuoteRequested(true);
      handleRequestQuote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, quoteRequested, weight, zip]);

  // Notifica quote ricevuta
  useEffect(() => {
    if (lastResult?.success && lastResult.rates && onQuoteReceived) {
      onQuoteReceived(courier.displayName, lastResult);
    }
  }, [lastResult, courier.displayName, onQuoteReceived]);

  const handleRequestQuote = async () => {
    try {
      const params: QuoteRequestParams = {
        courier: courier.courierName,
        contractCode: courier.contractCode,
        weight,
        zip,
        province,
        services,
        insuranceValue,
        codValue,
      };

      await requestQuote(params);
    } catch (err) {
      console.error('Errore richiesta quote:', err);
    }
  };

  const handleRetry = () => {
    setQuoteRequested(false);
    cancelPending();
    handleRequestQuote();
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && !quoteRequested) {
      setQuoteRequested(true);
      handleRequestQuote();
    }
  };

  // Skeleton loader
  if (loading && !lastResult) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 bg-gray-200 rounded w-24"></div>
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  // Stato: Disponibile (non ancora richiesto)
  if (!isExpanded && !quoteRequested) {
    return (
      <button
        onClick={handleToggle}
        className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-[#FF9500] hover:shadow-md transition-all text-left"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{courier.displayName}</h3>
            {estimatedPrice && (
              <p className="text-sm text-gray-500 mt-1">Stima: €{estimatedPrice.toFixed(2)}</p>
            )}
          </div>
          <div className="text-sm text-gray-400">Clicca per preventivo</div>
        </div>
      </button>
    );
  }

  // Stato: Caricamento
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#FF9500] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{courier.displayName}</h3>
          <Loader2 className="w-5 h-5 animate-spin text-[#FF9500]" />
        </div>

        {/* Ottimistic update: mostra stima mentre carica */}
        {estimatedPrice && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Clock className="w-4 h-4" />
              <span>Prezzo stimato: €{estimatedPrice.toFixed(2)}</span>
              <span className="text-xs bg-blue-100 px-2 py-0.5 rounded">Stimato</span>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-500">Caricamento prezzo reale...</div>
      </div>
    );
  }

  // Stato: Errore
  if (error && !lastResult?.success) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{courier.displayName}</h3>
          <AlertCircle className="w-5 h-5 text-red-500" />
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm text-red-700 mb-2">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-800"
          >
            <RefreshCw className="w-4 h-4" />
            Riprova
          </button>
        </div>

        {estimatedPrice && (
          <div className="text-sm text-gray-500">Prezzo stimato: €{estimatedPrice.toFixed(2)}</div>
        )}
      </div>
    );
  }

  // Stato: Successo
  if (lastResult?.success && lastResult.rates) {
    const bestRate = lastResult.rates[0]; // Prendi il primo (migliore)
    const isCached = lastResult.cached;
    const cacheAge = lastResult.cacheAge;

    return (
      <div className="bg-white rounded-xl border border-green-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">{courier.displayName}</h3>
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        </div>

        {/* Cache indicator */}
        {isCached && cacheAge !== undefined && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
            <div className="flex items-center gap-2 text-xs text-blue-700">
              <Clock className="w-3 h-3" />
              <span>Da cache ({cacheAge}s fa)</span>
            </div>
          </div>
        )}

        {/* Quote details */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Costo Fornitore:</span>
            <span className="font-semibold text-gray-900">
              €{parseFloat(bestRate.total_price || '0').toFixed(2)}
            </span>
          </div>

          {/* Prezzo vendita (da calcolare con margine listino) */}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-medium text-gray-700">Prezzo Vendita:</span>
            <span className="text-lg font-bold text-[#FF9500]">
              €{parseFloat(bestRate.total_price || '0').toFixed(2)}
            </span>
          </div>
        </div>

        {/* Servizi accessori */}
        {bestRate.services_price && parseFloat(bestRate.services_price) > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            Servizi: €{parseFloat(bestRate.services_price).toFixed(2)}
          </div>
        )}
      </div>
    );
  }

  // Stato: Nessun risultato
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{courier.displayName}</h3>
        <span className="text-sm text-gray-400">Nessun preventivo disponibile</span>
      </div>
    </div>
  );
}
