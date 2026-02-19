'use client';

import { useState, useEffect } from 'react';
import {
  Truck,
  RefreshCw,
  Clock,
  Package,
  Star,
  AlertCircle,
  Check,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShipmentWizard, type CarrierData } from '../ShipmentWizardContext';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface QuoteResult {
  id: string;
  carrier: string;
  carrierCode: string;
  contractCode: string;
  carrierLogo?: string;
  service: string;
  price: number;
  originalPrice?: number;
  deliveryDays: string;
  deliveryDate?: string;
  features: string[];
  recommended?: boolean;
  configId?: string;
  supplierPrice?: number;
  vatMode?: 'included' | 'excluded';
  vatRate?: number;
}

export function CarrierStep() {
  const { data, setCarrier, validateStep } = useShipmentWizard();
  const validation = validateStep('carrier');

  const [quotes, setQuotes] = useState<QuoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  // Reliability score per corriere (carrier_code → score 0-100)
  const [reliability, setReliability] = useState<Record<string, number>>({});

  // Calcola il peso totale (usando nomi italiani dal context)
  const totalWeight = data.packages.reduce((sum, pkg) => sum + pkg.peso, 0);
  const totalPackages = data.packages.length;

  // Fetch quotes quando il componente monta
  useEffect(() => {
    fetchQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchQuotes = async () => {
    setLoading(true);
    setError(null);

    try {
      // Calcola peso totale e peso volumetrico per tutti i colli
      const totalWeight = data.packages.reduce((sum, pkg) => sum + pkg.peso, 0);
      const totalVolumetricWeight = data.packages.reduce((sum, pkg) => {
        const volumetric = (pkg.lunghezza * pkg.larghezza * pkg.altezza) / 5000;
        return sum + volumetric;
      }, 0);
      // Peso tassabile: il maggiore tra peso reale e volumetrico
      const chargeableWeight = Math.max(totalWeight, totalVolumetricWeight);

      // Prepara i dati per l'API /api/quotes/db (formato flat atteso dall'API)
      const quoteRequest = {
        weight: chargeableWeight,
        zip: data.destinatario.cap,
        province: data.destinatario.provincia,
        city: data.destinatario.citta,
        services: data.services.serviziAccessori || [],
        insuranceValue: data.services.assicurazioneEnabled ? data.services.assicurazioneValue : 0,
        codValue: data.services.contrassegnoEnabled ? data.services.contrassegnoAmount : 0,
        dimensions: data.packages.map((pkg) => ({
          length: pkg.lunghezza,
          width: pkg.larghezza,
          height: pkg.altezza,
        })),
      };

      const response = await fetch('/api/quotes/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteRequest),
      });

      if (!response.ok) {
        throw new Error('Errore nel recupero dei preventivi');
      }

      const result = await response.json();

      // L'API restituisce { success, rates, details }
      // Mappa i rates nel formato QuoteResult
      const rates = result.rates || [];
      const mappedQuotes: QuoteResult[] = rates.map((rate: any, index: number) => {
        // Estrai nome corriere dal carrierCode (es. "gls" -> "GLS")
        const carrierName = (rate.carrierCode || '').toUpperCase();
        const contractCode = rate.contractCode || rate.carrierCode || '';

        return {
          id: rate._priceListId || `quote-${index}`,
          carrier: carrierName,
          carrierCode: carrierName,
          contractCode: contractCode,
          carrierLogo: undefined,
          service: contractCode.includes('express') ? 'Express' : 'Standard',
          price: parseFloat(rate.total_price) || 0,
          originalPrice: parseFloat(rate.weight_price) || undefined, // Costo fornitore come prezzo originale
          deliveryDays: '2-3 giorni',
          deliveryDate: undefined,
          features: ['Tracking'],
          recommended: index === 0,
          configId: rate._configId,
          supplierPrice: parseFloat(rate.weight_price) || parseFloat(rate.base_price) || 0,
          vatMode: rate.vat_mode as 'included' | 'excluded' | undefined,
          vatRate: parseFloat(rate.vat_rate) || undefined,
        };
      });

      setQuotes(mappedQuotes);

      // Fetch reliability score in parallelo (non bloccante)
      if (data.destinatario.citta && data.destinatario.provincia) {
        fetch(
          `/api/corrieri/reliability?citta=${encodeURIComponent(data.destinatario.citta)}&provincia=${encodeURIComponent(data.destinatario.provincia)}`
        )
          .then((res) => (res.ok ? res.json() : null))
          .then((result) => {
            if (result?.success && Array.isArray(result.data)) {
              const scores: Record<string, number> = {};
              result.data.forEach((perf: { corriere: string; reliabilityScore: number }) => {
                scores[perf.corriere.toUpperCase()] = perf.reliabilityScore;
              });
              setReliability(scores);
            }
          })
          .catch(() => {
            /* Silenzioso: reliability e' un nice-to-have */
          });
      }

      // Se c'è già una selezione precedente, verificala
      if (data.carrier?.carrierCode) {
        const stillValid = mappedQuotes.find((q) => q.carrierCode === data.carrier?.carrierCode);
        if (!stillValid) {
          setCarrier(null);
          setSelectedQuoteId(null);
        } else {
          setSelectedQuoteId(stillValid.id);
        }
      }
    } catch (err: any) {
      console.error('Errore fetch quotes:', err);
      setError(err.message || 'Errore nel caricamento dei preventivi');

      // Mock quotes per demo/sviluppo
      setQuotes([
        {
          id: 'mock-1',
          carrier: 'BRT',
          carrierCode: 'BRT',
          contractCode: 'brt-standard',
          service: 'Express',
          price: 8.5,
          deliveryDays: '1-2 giorni',
          features: ['Tracking', 'Assicurazione base'],
          recommended: true,
        },
        {
          id: 'mock-2',
          carrier: 'GLS',
          carrierCode: 'GLS',
          contractCode: 'gls-standard',
          service: 'Standard',
          price: 6.9,
          deliveryDays: '2-3 giorni',
          features: ['Tracking'],
        },
        {
          id: 'mock-3',
          carrier: 'Poste Italiane',
          carrierCode: 'POSTE',
          contractCode: 'postedeliverybusiness-standard',
          service: 'Crono Express',
          price: 9.2,
          deliveryDays: '1-2 giorni',
          features: ['Tracking', 'Ritiro a domicilio'],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuote = (quote: QuoteResult) => {
    setSelectedQuoteId(quote.id);
    const carrierData: CarrierData = {
      carrierCode: quote.carrierCode,
      contractCode: quote.contractCode,
      displayName: `${quote.carrier} - ${quote.service}`,
      configId: quote.configId,
      finalPrice: quote.price,
      supplierPrice: quote.supplierPrice,
      vatMode: quote.vatMode,
      vatRate: quote.vatRate,
    };
    setCarrier(carrierData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
          <Truck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Scegli Corriere</h2>
          <p className="text-sm text-gray-500">Confronta i preventivi e seleziona il servizio</p>
        </div>
      </div>

      {/* Riepilogo Spedizione */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Da:</span>
            <p className="font-medium">
              {data.mittente.citta}, {data.mittente.cap}
            </p>
          </div>
          <div>
            <span className="text-gray-500">A:</span>
            <p className="font-medium">
              {data.destinatario.citta}, {data.destinatario.cap}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Colli:</span>
            <p className="font-medium">{totalPackages}</p>
          </div>
          <div>
            <span className="text-gray-500">Peso totale:</span>
            <p className="font-medium">{totalWeight.toFixed(1)} kg</p>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={fetchQuotes} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
          Aggiorna Preventivi
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-600 font-medium">Caricamento preventivi...</p>
          <p className="text-sm text-gray-500">Stiamo confrontando le migliori tariffe</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-800">Attenzione</p>
              <p className="text-sm text-yellow-700 mt-1">{error}</p>
              <p className="text-sm text-yellow-600 mt-2">
                Mostrando preventivi di esempio per continuare.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quotes List */}
      {!loading && quotes.length > 0 && (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <button
              key={quote.id}
              type="button"
              onClick={() => handleSelectQuote(quote)}
              className={cn(
                'w-full text-left p-4 rounded-xl border-2 transition-all',
                selectedQuoteId === quote.id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Checkbox/Selection indicator */}
                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                      selectedQuoteId === quote.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    )}
                  >
                    {selectedQuoteId === quote.id && <Check className="w-4 h-4 text-white" />}
                  </div>

                  {/* Carrier Info */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{quote.carrier}</span>
                      {quote.recommended && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          <Star className="w-3 h-3" />
                          Consigliato
                        </span>
                      )}
                      {reliability[quote.carrierCode] !== undefined &&
                        reliability[quote.carrierCode] > 0 && (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                              reliability[quote.carrierCode] >= 80
                                ? 'bg-emerald-100 text-emerald-700'
                                : reliability[quote.carrierCode] >= 60
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            )}
                          >
                            <TrendingUp className="w-3 h-3" />
                            {reliability[quote.carrierCode]}% zona
                          </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600">{quote.service}</p>
                  </div>
                </div>

                {/* Price & Delivery */}
                <div className="text-right">
                  <div className="flex items-baseline gap-2">
                    {quote.originalPrice && quote.originalPrice > quote.price && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatCurrency(quote.originalPrice)}
                      </span>
                    )}
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(quote.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 justify-end mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    {quote.deliveryDays}
                  </div>
                </div>
              </div>

              {/* Features */}
              {quote.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                  {quote.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                    >
                      <Package className="w-3 h-3" />
                      {feature}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No quotes */}
      {!loading && quotes.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Nessun preventivo disponibile</p>
          <p className="text-sm text-gray-500 mt-1">Verifica i dati inseriti e riprova</p>
          <Button type="button" variant="outline" size="sm" onClick={fetchQuotes} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Riprova
          </Button>
        </div>
      )}

      {/* Selection Summary */}
      {data.carrier && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">Corriere selezionato</p>
              <p className="text-lg font-semibold text-blue-900">{data.carrier.displayName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-600">Totale</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(data.carrier.finalPrice || 0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Validation errors */}
      {!validation.isValid && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
            {validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
