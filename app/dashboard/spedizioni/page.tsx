/**
 * Pagina: Lista Spedizioni
 * 
 * Dashboard premium per visualizzare e gestire tutte le spedizioni.
 * Design ispirato a Stripe, Linear, Flexport - moderno, pulito, professionale.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardNav from '@/components/dashboard-nav';

// Interfaccia per una spedizione
interface Spedizione {
  id: string;
  mittente: {
    nome: string;
    citta?: string;
    provincia?: string;
  };
  destinatario: {
    nome: string;
    citta?: string;
    provincia?: string;
  };
  peso: number;
  tipoSpedizione: string;
  prezzoFinale: number;
  createdAt: string;
  // Campi opzionali per tracking e status
  tracking?: string;
  status?: 'in_preparazione' | 'in_transito' | 'consegnata' | 'eccezione' | 'annullata';
  corriere?: string;
}

// Componente Badge Status
function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    in_preparazione: {
      label: 'In Preparazione',
      className: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    in_transito: {
      label: 'In Transito',
      className: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    consegnata: {
      label: 'Consegnata',
      className: 'bg-green-50 text-green-700 border-green-200',
    },
    eccezione: {
      label: 'Eccezione',
      className: 'bg-red-50 text-red-700 border-red-200',
    },
    annullata: {
      label: 'Annullata',
      className: 'bg-gray-50 text-gray-700 border-gray-200',
    },
  };

  const config = statusConfig[status] || {
    label: status || 'Sconosciuto',
    className: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export default function ListaSpedizioniPage() {
  const router = useRouter();
  const [spedizioni, setSpedizioni] = useState<Spedizione[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carica le spedizioni
  useEffect(() => {
    async function fetchSpedizioni() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/spedizioni');
        
        if (!response.ok) {
          throw new Error('Errore nel caricamento delle spedizioni');
        }

        const result = await response.json();
        setSpedizioni(result.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        console.error('Errore caricamento spedizioni:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSpedizioni();
  }, []);

  // Formatta data
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  // Formatta prezzo
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  // Handler per visualizzare dettagli
  const handleViewDetails = (id: string) => {
    router.push(`/dashboard/spedizioni/${id}`);
  };

  // Handler per tracking esterno
  const handleTrack = (tracking: string) => {
    // In futuro: integrazione con API corrieri
    window.open(`https://tracking.example.com/${tracking}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Lista Spedizioni"
          subtitle="Gestisci e monitora tutte le tue spedizioni in tempo reale"
          showBackButton={true}
          actions={
            <Link
              href="/dashboard/spedizioni/nuova"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FF9500] focus:ring-offset-2 transition-all transform hover:scale-105"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Nuova Spedizione
            </Link>
          }
        />

        {/* Main Content Card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Loading State */}
          {isLoading && (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-sm text-gray-600">Caricamento spedizioni...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && spedizioni.length === 0 && (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nessuna spedizione trovata
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Crea la tua prima spedizione per iniziare
              </p>
              <Link
                href="/dashboard/spedizioni/nuova"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Crea Spedizione
              </Link>
            </div>
          )}

          {/* Table */}
          {!isLoading && !error && spedizioni.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Destinatario
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Tracking
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Tipo
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Peso
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Data
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Prezzo
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {spedizioni.map((spedizione) => (
                    <tr
                      key={spedizione.id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(spedizione.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {spedizione.destinatario?.nome || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {spedizione.destinatario?.citta && spedizione.destinatario?.provincia
                              ? `${spedizione.destinatario.citta}, ${spedizione.destinatario.provincia}`
                              : ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {spedizione.tracking ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTrack(spedizione.tracking!);
                            }}
                            className="text-sm font-mono text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
                          >
                            {spedizione.tracking}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge
                          status={spedizione.status || 'in_preparazione'}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">
                          {spedizione.tipoSpedizione || 'standard'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {spedizione.peso ? `${spedizione.peso} kg` : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {formatDate(spedizione.createdAt)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-gray-900">
                          {spedizione.prezzoFinale > 0
                            ? formatPrice(spedizione.prezzoFinale)
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(spedizione.id);
                            }}
                            className="text-gray-400 hover:text-blue-600 focus:outline-none transition-colors"
                            title="Visualizza dettagli"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          {spedizione.tracking && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTrack(spedizione.tracking!);
                              }}
                              className="text-gray-400 hover:text-indigo-600 focus:outline-none transition-colors"
                              title="Traccia spedizione"
                            >
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Stats (opzionale) */}
        {!isLoading && !error && spedizioni.length > 0 && (
          <div className="mt-6 text-sm text-gray-600 text-center">
            Mostrando <span className="font-medium text-gray-900">{spedizioni.length}</span>{' '}
            {spedizioni.length === 1 ? 'spedizione' : 'spedizioni'}
          </div>
        )}
      </div>
    </div>
  );
}

