/**
 * Componente: Confronto Contratti per Reseller
 * 
 * Mostra tutti i contratti disponibili (API Reseller e API Master)
 * con prezzi comparativi e permette selezione manuale
 */

'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, TrendingDown, Loader2, AlertCircle } from 'lucide-react';

interface Contract {
  id: string;
  name: string;
  type: 'reseller' | 'master' | 'default';
  price: number;
  basePrice: number;
  surcharges: number;
  margin: number;
  totalCost: number;
  isBest: boolean;
  priceListId?: string;
}

interface ContractComparisonProps {
  weight: number;
  destination: {
    zip?: string;
    province?: string;
    region?: string;
    country?: string;
  };
  courierId?: string;
  serviceType?: string;
  options?: {
    declaredValue?: number;
    cashOnDelivery?: boolean;
    insurance?: boolean;
  };
  onSelectContract?: (contractId: string, contractType: 'reseller' | 'master' | 'default') => void;
  selectedContractId?: string;
}

export default function ContractComparison({
  weight,
  destination,
  courierId,
  serviceType = 'standard',
  options = {},
  onSelectContract,
  selectedContractId,
}: ContractComparisonProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bestPrice, setBestPrice] = useState<number | null>(null);
  const [bestSource, setBestSource] = useState<string | null>(null);

  // Calcola prezzi quando cambiano i parametri
  useEffect(() => {
    if (!weight || weight <= 0 || !destination?.zip) {
      setContracts([]);
      return;
    }

    async function fetchComparison() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/quotes/compare', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            weight,
            destination,
            courierId,
            serviceType,
            options,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Errore calcolo preventivo');
        }

        const data = await response.json();
        setContracts(data.contracts || []);
        setBestPrice(data.bestPrice);
        setBestSource(data.bestSource);
      } catch (err: any) {
        console.error('Errore confronto contratti:', err);
        // ⚠️ FIX: Non mostrare errore se ci sono quote valide dal preventivatore intelligente
        // Il preventivatore intelligente ha priorità, questo è solo un fallback
        setError(null); // Non mostrare errore per non confondere l'utente
        setContracts([]);
      } finally {
        setIsLoading(false);
      }
    }

    // Debounce: aspetta 500ms prima di calcolare
    const timeoutId = setTimeout(fetchComparison, 500);
    return () => clearTimeout(timeoutId);
  }, [weight, destination.zip, destination.province, courierId, serviceType, JSON.stringify(options)]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  if (isLoading) {
    return (
      <div className="pt-6 border-t border-gray-200">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Calcolo prezzi...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-6 border-t border-gray-200">
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (contracts.length === 0) {
    return null;
  }

  // Se c'è un solo contratto, non mostrare il confronto
  if (contracts.length === 1) {
    return null;
  }

  return (
    <div className="pt-6 border-t border-gray-200">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase text-gray-500 tracking-wider mb-2">
          Confronto Contratti
        </p>
        {bestSource && bestPrice && (
          <div className="text-sm text-gray-600 mb-3">
            💡 Miglior prezzo: <span className="font-semibold text-green-600">{formatPrice(bestPrice)}</span> con <span className="font-medium">{bestSource === 'reseller' ? 'API Reseller' : bestSource === 'master' ? 'API Master' : 'Contratto Standard'}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {contracts.map((contract) => {
          const isSelected = selectedContractId === contract.id;
          const isBest = contract.isBest;

          return (
            <button
              key={contract.id}
              type="button"
              onClick={() => onSelectContract?.(contract.id, contract.type)}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? 'border-orange-500 bg-orange-50 shadow-md'
                  : isBest
                  ? 'border-green-300 bg-green-50 hover:border-green-400'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{contract.name}</span>
                    {isBest && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <TrendingDown className="w-3 h-3" />
                        Migliore
                      </span>
                    )}
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Selezionato
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {contract.type === 'reseller' && 'Le tue API'}
                    {contract.type === 'master' && 'API Master (Superadmin)'}
                    {contract.type === 'default' && 'Contratto Standard'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatPrice(contract.price)}
                  </div>
                  {contracts.length > 1 && !isBest && bestPrice && (
                    <div className="text-xs text-gray-500 mt-1">
                      +{formatPrice(contract.price - bestPrice)}
                    </div>
                  )}
                </div>
              </div>

              {/* Dettagli prezzo (collassabile) */}
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600 space-y-1">
                <div className="flex justify-between">
                  <span>Base:</span>
                  <span>{formatPrice(contract.basePrice)}</span>
                </div>
                {contract.surcharges > 0 && (
                  <div className="flex justify-between">
                    <span>Sovrapprezzi:</span>
                    <span>{formatPrice(contract.surcharges)}</span>
                  </div>
                )}
                {contract.margin > 0 && (
                  <div className="flex justify-between">
                    <span>Margine:</span>
                    <span>{formatPrice(contract.margin)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Totale:</span>
                  <span>{formatPrice(contract.totalCost)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
