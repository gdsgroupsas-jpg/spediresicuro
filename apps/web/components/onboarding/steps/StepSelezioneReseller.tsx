'use client';

/**
 * Step: Selezione Reseller Parent (Solo SuperAdmin)
 *
 * Permette al superadmin di selezionare a quale reseller
 * assegnare il nuovo cliente
 */

import { useState, useEffect } from 'react';
import { Store, Search, Loader2, AlertCircle } from 'lucide-react';
import { useWizard } from '../WizardContext';
import type { AvailableReseller } from '../types';

interface StepSelezioneResellerProps {
  onLoadResellers?: () => Promise<AvailableReseller[]>;
}

export function StepSelezioneReseller({ onLoadResellers }: StepSelezioneResellerProps) {
  const { selectedResellerId, setSelectedResellerId, errors, clearError } = useWizard();
  const [resellers, setResellers] = useState<AvailableReseller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadResellers() {
      if (!onLoadResellers) {
        setLoadError('Funzione di caricamento reseller non disponibile');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await onLoadResellers();
        setResellers(data);
      } catch (error) {
        console.error('Errore caricamento reseller:', error);
        setLoadError('Impossibile caricare la lista dei reseller');
      } finally {
        setIsLoading(false);
      }
    }

    loadResellers();
  }, [onLoadResellers]);

  const filteredResellers = resellers.filter((r) => {
    const query = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(query) ||
      r.email.toLowerCase().includes(query) ||
      r.company_name?.toLowerCase().includes(query)
    );
  });

  const handleSelect = (resellerId: string) => {
    setSelectedResellerId(resellerId);
    if (errors['selectedReseller']) clearError('selectedReseller');
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Seleziona Reseller</h2>
        <p className="text-gray-400">Scegli il reseller a cui assegnare il nuovo cliente</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#FACC15] animate-spin mb-4" />
          <p className="text-gray-400">Caricamento reseller...</p>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-red-400">{loadError}</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca reseller..."
              className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FACC15]"
            />
          </div>

          {errors['selectedReseller'] && (
            <p className="mb-4 text-sm text-red-400 text-center">{errors['selectedReseller']}</p>
          )}

          {/* Reseller List */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {filteredResellers.length === 0 ? (
              <div className="text-center py-8">
                <Store className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">
                  {searchQuery ? 'Nessun reseller trovato' : 'Nessun reseller disponibile'}
                </p>
              </div>
            ) : (
              filteredResellers.map((reseller) => (
                <button
                  key={reseller.id}
                  type="button"
                  onClick={() => handleSelect(reseller.id)}
                  className={`
                    w-full p-4 rounded-xl border-2 transition-all duration-200 text-left
                    flex items-center gap-4
                    ${
                      selectedResellerId === reseller.id
                        ? 'border-[#FACC15] bg-[#FACC15]/10'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
                    }
                  `}
                >
                  <div
                    className={`
                      w-12 h-12 rounded-xl flex items-center justify-center
                      ${
                        selectedResellerId === reseller.id
                          ? 'bg-[#FACC15] text-black'
                          : 'bg-gray-700 text-gray-400'
                      }
                    `}
                  >
                    <Store className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold truncate ${
                        selectedResellerId === reseller.id ? 'text-[#FACC15]' : 'text-gray-200'
                      }`}
                    >
                      {reseller.name}
                    </p>
                    <p className="text-sm text-gray-400 truncate">{reseller.email}</p>
                    {reseller.company_name && (
                      <p className="text-xs text-gray-500 truncate">{reseller.company_name}</p>
                    )}
                  </div>
                  {selectedResellerId === reseller.id && (
                    <div className="w-6 h-6 bg-[#FACC15] rounded-full flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-black"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Info */}
          <div className="mt-6 bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
            <p className="text-sm text-blue-300">
              Il cliente sara creato sotto il reseller selezionato e potra accedere ai listini
              configurati da quel reseller.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
