'use client';

/**
 * Step: Listino Reseller (Solo SuperAdmin)
 *
 * Permette di assegnare un listino prezzi al nuovo reseller
 * così può iniziare subito a spedire appena accede alla piattaforma.
 */

import { useEffect, useState } from 'react';
import { FileText, Check, Loader2, AlertCircle, Info, Package } from 'lucide-react';
import { useWizard } from '../WizardContext';
import type { AssignablePriceList } from '../types';

interface StepResellerListinoProps {
  /** Listini pre-caricati (opzionale) */
  availablePriceLists?: AssignablePriceList[];
  /** Callback per caricare listini on-demand */
  onLoadPriceLists?: () => Promise<AssignablePriceList[]>;
}

export function StepResellerListino({
  availablePriceLists,
  onLoadPriceLists,
}: StepResellerListinoProps) {
  const { resellerFormData, updateResellerFormData } = useWizard();

  const [priceLists, setPriceLists] = useState<AssignablePriceList[]>(availablePriceLists || []);
  const [isLoading, setIsLoading] = useState(!availablePriceLists);
  const [error, setError] = useState<string | null>(null);

  // Carica listini se non forniti
  useEffect(() => {
    if (!availablePriceLists && onLoadPriceLists) {
      setIsLoading(true);
      onLoadPriceLists()
        .then((lists) => {
          setPriceLists(lists);
          setError(null);
        })
        .catch((err) => {
          console.error('Errore caricamento listini:', err);
          setError('Impossibile caricare i listini disponibili');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [availablePriceLists, onLoadPriceLists]);

  // Aggiorna se cambiano i listini esterni
  useEffect(() => {
    if (availablePriceLists) {
      setPriceLists(availablePriceLists);
    }
  }, [availablePriceLists]);

  const selectedPriceListId = resellerFormData.selectedPriceListId;

  const setSelectedPriceListId = (id: string | null) => {
    updateResellerFormData({ selectedPriceListId: id });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Listino Iniziale</h2>
        <p className="text-gray-400">
          Assegna un listino al reseller per permettergli di spedire subito
        </p>
      </div>

      {/* Info box */}
      <div className="max-w-2xl mx-auto mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-purple-200">
          <p className="font-medium mb-1">Step opzionale ma consigliato</p>
          <p className="text-purple-300">
            Assegnando un listino, il reseller potra iniziare subito a creare spedizioni appena
            effettua il login. In seguito potra configurare i propri corrieri e creare listini
            personalizzati per i suoi clienti.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="ml-3 text-gray-400">Caricamento listini...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="max-w-2xl mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && priceLists.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">Nessun listino disponibile</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Non ci sono listini globali disponibili. Il reseller potra comunque configurare i propri
            corrieri e creare listini personalizzati dopo il login.
          </p>
        </div>
      )}

      {/* Price lists grid */}
      {!isLoading && !error && priceLists.length > 0 && (
        <div className="max-w-3xl mx-auto">
          {/* Option: No listino */}
          <button
            type="button"
            onClick={() => setSelectedPriceListId(null)}
            className={`
              w-full p-4 mb-4 rounded-xl border-2 transition-all duration-300
              flex items-center gap-4
              ${
                selectedPriceListId === null
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }
            `}
          >
            <div
              className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${
                  selectedPriceListId === null
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }
              `}
            >
              {selectedPriceListId === null ? (
                <Check className="w-6 h-6" />
              ) : (
                <span className="text-xl font-bold">-</span>
              )}
            </div>
            <div className="flex-1 text-left">
              <h3
                className={`
                  font-semibold
                  ${selectedPriceListId === null ? 'text-purple-400' : 'text-gray-200'}
                `}
              >
                Nessun listino
              </h3>
              <p className="text-sm text-gray-400">
                Il reseller configurera i propri corrieri e listini
              </p>
            </div>
          </button>

          {/* Price lists */}
          <div className="space-y-3">
            {priceLists.map((priceList) => (
              <button
                key={priceList.id}
                type="button"
                onClick={() => setSelectedPriceListId(priceList.id)}
                className={`
                  w-full p-4 rounded-xl border-2 transition-all duration-300
                  flex items-center gap-4
                  ${
                    selectedPriceListId === priceList.id
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }
                `}
              >
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${
                      selectedPriceListId === priceList.id
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }
                  `}
                >
                  {selectedPriceListId === priceList.id ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <Package className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <h3
                    className={`
                      font-semibold
                      ${selectedPriceListId === priceList.id ? 'text-purple-400' : 'text-gray-200'}
                    `}
                  >
                    {priceList.name}
                  </h3>
                  {priceList.description && (
                    <p className="text-sm text-gray-400 line-clamp-1">{priceList.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {priceList.list_type && (
                      <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-300 rounded">
                        {priceList.list_type}
                      </span>
                    )}
                    {priceList.default_margin_percent !== undefined && (
                      <span className="text-xs text-gray-500">
                        Margine: {priceList.default_margin_percent}%
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
