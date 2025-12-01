/**
 * AI Routing Advisor Component
 * 
 * Componente che mostra suggerimenti AI per il routing ottimale
 * basato su reliability score e performance reali
 */

'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, Zap, X, Sparkles } from 'lucide-react';
import { RoutingSuggestion } from '@/types/corrieri';

interface AIRoutingAdvisorProps {
  citta: string;
  provincia: string;
  corriereScelto: string;
  prezzoCorriereScelto: number;
  onAcceptSuggestion?: (corriere: string) => void;
  onDismiss?: () => void;
}

export default function AIRoutingAdvisor({
  citta,
  provincia,
  corriereScelto,
  prezzoCorriereScelto,
  onAcceptSuggestion,
  onDismiss,
}: AIRoutingAdvisorProps) {
  const [suggestion, setSuggestion] = useState<RoutingSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!citta || !provincia || !corriereScelto || isDismissed) return;

    async function fetchSuggestion() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/corrieri/reliability', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            citta,
            provincia,
            corriereScelto,
            prezzoCorriereScelto,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.data) {
            setSuggestion(result.data);
          }
        }
      } catch (error) {
        console.error('Errore caricamento suggerimento:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSuggestion();
  }, [citta, provincia, corriereScelto, prezzoCorriereScelto, isDismissed]);

  // Mostra loading anche se non c'è ancora suggerimento
  if (isDismissed) {
    return null;
  }

  // Mostra sempre il componente in loading o con suggerimento
  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-blue-400 rounded-full animate-pulse"></div>
          <div className="flex-1">
            <div className="h-5 bg-blue-200 rounded w-3/4 mb-2 animate-pulse"></div>
            <div className="h-4 bg-blue-100 rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-700">
          Analisi in corso... Stiamo valutando i migliori corrieri per questa destinazione
        </p>
      </div>
    );
  }

  // Se non c'è suggerimento ma ci sono i dati, mostra un messaggio informativo
  if (!suggestion) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-gray-400" />
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              Compila i dati della spedizione per vedere il suggerimento intelligente del corriere
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getRiskColor = (rischio: string) => {
    switch (rischio) {
      case 'alto':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'medio':
        return 'bg-amber-50 border-amber-200 text-amber-900';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getRiskIcon = (rischio: string) => {
    switch (rischio) {
      case 'alto':
        return <AlertTriangle className="w-5 h-5" />;
      case 'medio':
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <CheckCircle className="w-5 h-5" />;
    }
  };

  return (
    <div
      className={`${getRiskColor(
        suggestion.rischioRitardo
      )} border-2 rounded-xl p-5 shadow-lg relative`}
    >
      {/* Close Button */}
      {onDismiss && (
        <button
          onClick={() => {
            setIsDismissed(true);
            onDismiss();
          }}
          className="absolute top-3 right-3 p-1 hover:bg-black/10 rounded-md transition-colors"
          aria-label="Chiudi"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 mt-0.5">
          {getRiskIcon(suggestion.rischioRitardo)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4" />
            <h3 className="font-bold text-sm uppercase tracking-wide">
              Consiglio AI Routing
            </h3>
          </div>
          <p className="text-sm leading-relaxed">{suggestion.motivo}</p>
        </div>
      </div>

      {/* Details */}
      <div className="bg-white/50 rounded-lg p-4 mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Corriere Consigliato:</span>
          <span className="font-bold">{suggestion.corriereConsigliato}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Reliability Score:</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                style={{ width: `${suggestion.reliabilityScore}%` }}
              />
            </div>
            <span className="font-bold text-sm">{suggestion.reliabilityScore}%</span>
          </div>
        </div>
        {suggestion.differenzaPrezzo && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Differenza Prezzo:</span>
            <span
              className={`font-bold ${
                suggestion.differenzaPrezzo > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {suggestion.differenzaPrezzo > 0 ? '+' : ''}
              {suggestion.differenzaPrezzo.toFixed(2)}€
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {onAcceptSuggestion && (
          <button
            onClick={() => {
              onAcceptSuggestion(suggestion.corriereConsigliato);
              setIsDismissed(true);
            }}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-lg hover:shadow-lg transition-all transform hover:scale-105"
          >
            Accetta Suggerimento
          </button>
        )}
        <button
          onClick={() => setIsDismissed(true)}
          className="px-4 py-2 bg-white/50 hover:bg-white/70 font-medium rounded-lg transition-colors"
        >
          Mantieni Scelta
        </button>
      </div>
    </div>
  );
}

