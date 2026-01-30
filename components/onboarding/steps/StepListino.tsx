'use client';

/**
 * Step Listino - Selezione listini prezzi per il cliente
 *
 * FEATURES:
 * - Multi-select: assegna più listini (multi-corriere)
 * - Raggruppamento per corriere
 * - Badge supplier vs custom
 * - Sicurezza: mostra SOLO i listini di proprietà del reseller/admin
 */

import { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  Check,
  Loader2,
  AlertCircle,
  Info,
  Truck,
  Square,
  CheckSquare,
} from 'lucide-react';
import { useWizard } from '../WizardContext';
import type { AssignablePriceList } from '../types';

interface StepListinoProps {
  /** Listini pre-caricati (opzionale) */
  availablePriceLists?: AssignablePriceList[];
  /** Callback per caricare listini on-demand */
  onLoadPriceLists?: () => Promise<AssignablePriceList[]>;
}

/** Raggruppa listini per corriere */
function groupByCourier(
  lists: AssignablePriceList[]
): { courierName: string; courierId: string | null; lists: AssignablePriceList[] }[] {
  const groups = new Map<
    string,
    { courierName: string; courierId: string | null; lists: AssignablePriceList[] }
  >();

  for (const pl of lists) {
    const key = pl.courier_id || '__nessun_corriere__';
    const courierName = pl.courier_name || extractCourierFromName(pl.name) || 'Altro';

    if (!groups.has(key)) {
      groups.set(key, { courierName, courierId: pl.courier_id || null, lists: [] });
    }
    groups.get(key)!.lists.push(pl);
  }

  // Sort groups alphabetically, "Altro" last
  return Array.from(groups.values()).sort((a, b) => {
    if (a.courierName === 'Altro') return 1;
    if (b.courierName === 'Altro') return -1;
    return a.courierName.localeCompare(b.courierName);
  });
}

/** Fallback: extract courier name from price list name */
function extractCourierFromName(name: string): string | null {
  const patterns = [
    { match: /\bBRT\b/i, label: 'BRT' },
    { match: /\bUPS\b/i, label: 'UPS' },
    { match: /\bPoste\b/i, label: 'Poste' },
    { match: /\bInPost\b/i, label: 'InPost' },
    { match: /\bFermopoint\b/i, label: 'Fermopoint' },
    { match: /\bGLS\b/i, label: 'GLS' },
    { match: /\bDHL\b/i, label: 'DHL' },
    { match: /\bFedEx\b/i, label: 'FedEx' },
  ];
  for (const p of patterns) {
    if (p.match.test(name)) return p.label;
  }
  return null;
}

export function StepListino({ availablePriceLists, onLoadPriceLists }: StepListinoProps) {
  const { selectedPriceListIds, togglePriceListId, clearPriceListIds, mode } = useWizard();

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

  const grouped = useMemo(() => groupByCourier(priceLists), [priceLists]);
  const isResellerMode = mode === 'reseller';
  const selectedCount = selectedPriceListIds.length;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Listino Iniziale</h2>
        <p className="text-gray-400">
          {isResellerMode
            ? 'Assegna un listino al reseller per permettergli di spedire subito'
            : 'Seleziona i listini prezzi per questo utente (opzionale)'}
        </p>
      </div>

      {/* Info box */}
      <div className="max-w-2xl mx-auto mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">Step opzionale ma consigliato</p>
          <p className="text-blue-300">
            Assegnando un listino, il reseller potra iniziare subito a creare spedizioni appena
            effettua il login. In seguito potra configurare i propri corrieri e creare listini
            personalizzati per i suoi clienti.
          </p>
        </div>
      </div>

      {/* Selection counter */}
      {selectedCount > 0 && (
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-2 bg-[#FACC15]/10 border border-[#FACC15]/30 rounded-lg">
          <span className="text-sm text-[#FACC15] font-medium">
            {selectedCount} listin{selectedCount === 1 ? 'o' : 'i'} selezionat
            {selectedCount === 1 ? 'o' : 'i'}
          </span>
          <button
            type="button"
            onClick={clearPriceListIds}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Deseleziona tutti
          </button>
        </div>
      )}

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

      {/* Grouped price lists */}
      {!isLoading && !error && grouped.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Option: No listino */}
          <button
            type="button"
            onClick={clearPriceListIds}
            className={`
              w-full p-4 rounded-xl border-2 transition-all duration-300
              flex items-center gap-4
              ${
                selectedCount === 0
                  ? 'border-[#FACC15] bg-[#FACC15]/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }
            `}
          >
            <div
              className={`
                w-10 h-10 rounded-full flex items-center justify-center
                ${selectedCount === 0 ? 'bg-[#FACC15] text-black' : 'bg-gray-700 text-gray-400'}
              `}
            >
              {selectedCount === 0 ? (
                <Check className="w-5 h-5" />
              ) : (
                <span className="text-lg font-bold">-</span>
              )}
            </div>
            <div className="flex-1 text-left">
              <h3
                className={`font-semibold ${selectedCount === 0 ? 'text-[#FACC15]' : 'text-gray-200'}`}
              >
                Nessun listino
              </h3>
              <p className="text-sm text-gray-400">
                Il reseller configurera i propri corrieri e listini
              </p>
            </div>
          </button>

          {/* Courier groups */}
          {grouped.map((group) => (
            <div key={group.courierId || group.courierName} className="space-y-2">
              {/* Group header */}
              <div className="flex items-center gap-2 px-1 pt-2">
                <Truck className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  {group.courierName}
                </h3>
                <div className="flex-1 border-t border-gray-800" />
              </div>

              {/* Price lists in this group */}
              <div className="space-y-2">
                {group.lists.map((priceList) => {
                  const isSelected = selectedPriceListIds.includes(priceList.id);
                  return (
                    <button
                      key={priceList.id}
                      type="button"
                      onClick={() => togglePriceListId(priceList.id)}
                      className={`
                        w-full p-4 rounded-xl border-2 transition-all duration-300
                        flex items-center gap-4
                        ${
                          isSelected
                            ? 'border-[#FACC15] bg-[#FACC15]/10'
                            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                        }
                      `}
                    >
                      {/* Checkbox icon */}
                      <div
                        className={`flex-shrink-0 ${isSelected ? 'text-[#FACC15]' : 'text-gray-500'}`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-6 h-6" />
                        ) : (
                          <Square className="w-6 h-6" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 text-left min-w-0">
                        <h3
                          className={`font-semibold truncate ${isSelected ? 'text-[#FACC15]' : 'text-gray-200'}`}
                        >
                          {priceList.name}
                        </h3>
                        {priceList.description && (
                          <p className="text-sm text-gray-400 line-clamp-1">
                            {priceList.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {priceList.list_type && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium ${
                                priceList.list_type === 'supplier'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : priceList.list_type === 'custom'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-gray-700 text-gray-300'
                              }`}
                            >
                              {priceList.list_type}
                            </span>
                          )}
                          {priceList.default_margin_percent !== undefined &&
                            priceList.default_margin_percent > 0 && (
                              <span className="text-xs text-gray-500">
                                Margine: {priceList.default_margin_percent}%
                              </span>
                            )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
