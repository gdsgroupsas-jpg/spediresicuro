'use client';

/**
 * Step Listino - Selezione listino prezzi per il cliente
 *
 * ✨ SICUREZZA:
 * - Mostra SOLO i listini di proprietà del reseller/admin
 * - Usa RPC get_user_owned_price_lists con ownership filtering
 * - Step opzionale: il cliente può essere creato senza listino
 */

import { useEffect, useState } from 'react';
import { FileText, Check, Loader2, AlertCircle, Info } from 'lucide-react';
import { useWizard } from '../WizardContext';
import type { AssignablePriceList } from '../types';

interface StepListinoProps {
  /** Listini pre-caricati (opzionale) */
  availablePriceLists?: AssignablePriceList[];
  /** Callback per caricare listini on-demand */
  onLoadPriceLists?: () => Promise<AssignablePriceList[]>;
}

export function StepListino({ availablePriceLists, onLoadPriceLists }: StepListinoProps) {
  const { selectedPriceListId, setSelectedPriceListId, mode } = useWizard();

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

  const isResellerMode = mode === 'reseller';
  const isAdminMode = mode === 'admin';

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Listino Prezzi</h2>
        <p className="text-gray-400">
          {isResellerMode
            ? 'Assegna un listino personalizzato al tuo cliente (opzionale)'
            : 'Seleziona un listino prezzi per questo utente (opzionale)'}
        </p>
      </div>

      {/* Info box */}
      <div className="max-w-2xl mx-auto mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">Step opzionale</p>
          <p className="text-blue-300">
            Puoi saltare questo passaggio. Il cliente potrà comunque utilizzare i listini
            predefiniti del sistema. Assegnare un listino personalizzato permette di applicare
            prezzi e margini specifici.
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#FACC15] animate-spin" />
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
            Non hai ancora creato listini personalizzati. Puoi continuare senza assegnare un
            listino: il cliente utilizzerà i prezzi predefiniti.
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
                  ? 'border-[#FACC15] bg-[#FACC15]/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }
            `}
          >
            <div
              className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${
                  selectedPriceListId === null
                    ? 'bg-[#FACC15] text-black'
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
                  ${selectedPriceListId === null ? 'text-[#FACC15]' : 'text-gray-200'}
                `}
              >
                Nessun listino
              </h3>
              <p className="text-sm text-gray-400">Usa i listini predefiniti del sistema</p>
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
                      ? 'border-[#FACC15] bg-[#FACC15]/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }
                `}
              >
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${
                      selectedPriceListId === priceList.id
                        ? 'bg-[#FACC15] text-black'
                        : 'bg-gray-700 text-gray-400'
                    }
                  `}
                >
                  {selectedPriceListId === priceList.id ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <FileText className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <h3
                    className={`
                      font-semibold
                      ${selectedPriceListId === priceList.id ? 'text-[#FACC15]' : 'text-gray-200'}
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
