/**
 * Pagina: Spedizioni Cancellate
 *
 * Visualizza tutte le spedizioni cancellate (soft delete) con tracciabilità completa
 * - User normale: vede solo le proprie
 * - Reseller: vede le proprie + quelle dei suoi user
 * - Admin: vede tutte
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { DataTableSkeleton } from '@/components/shared/data-table-skeleton';
import {
  Search,
  Filter,
  Trash2,
  User,
  Calendar,
  Package,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';

interface SpedizioneCancellata {
  id: string;
  tracking_number?: string;
  ldv?: string;
  sender_name?: string;
  recipient_name?: string;
  recipient_city?: string;
  recipient_province?: string;
  carrier?: string;
  status?: string;
  total_cost?: number;
  created_at?: string;
  deleted_at?: string;
  deleted_by_user_id?: string;
  deleted_by_user_email?: string;
  user_id?: string;
  // Campi per reseller
  created_by_user_email?: string;
}

export default function SpedizioniCancellatePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [spedizioni, setSpedizioni] = useState<SpedizioneCancellata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  // Carica le spedizioni cancellate
  useEffect(() => {
    async function fetchSpedizioniCancellate() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/spedizioni/cancellate?page=${page}&limit=${limit}`);

        if (!response.ok) {
          throw new Error('Errore nel caricamento delle spedizioni cancellate');
        }

        const result = await response.json();
        setSpedizioni(result.data || []);
        setTotalCount(result.count || 0);
        setTotalPages(result.totalPages || 1);
        setError(null);
      } catch (err: any) {
        console.error('Errore caricamento spedizioni cancellate:', err);
        setError(err.message || 'Errore nel caricamento');
        setSpedizioni([]);
      } finally {
        setIsLoading(false);
      }
    }

    if (session?.user?.email) {
      fetchSpedizioniCancellate();
    }
  }, [session, page]);

  // Filtra spedizioni in base alla ricerca
  const filteredSpedizioni = useMemo(() => {
    if (!searchQuery.trim()) return spedizioni;

    const query = searchQuery.toLowerCase();
    return spedizioni.filter(
      (s) =>
        s.tracking_number?.toLowerCase().includes(query) ||
        s.ldv?.toLowerCase().includes(query) ||
        s.sender_name?.toLowerCase().includes(query) ||
        s.recipient_name?.toLowerCase().includes(query) ||
        s.recipient_city?.toLowerCase().includes(query) ||
        s.deleted_by_user_email?.toLowerCase().includes(query)
    );
  }, [spedizioni, searchQuery]);

  // Formatta data
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Formatta prezzo
  const formatPrice = (price?: number) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardNav
        title="Spedizioni Cancellate"
        subtitle="Tracciabilità completa delle spedizioni eliminate"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Spedizioni', href: '/dashboard/spedizioni' },
          { label: 'Cancellate', href: '/dashboard/spedizioni/cancellate' },
        ]}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Header con statistiche */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 rounded-xl">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Spedizioni Cancellate</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {totalCount} spedizioni eliminate totali
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/spedizioni"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna alle Spedizioni
            </Link>
          </div>

          {/* Barra ricerca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Cerca per tracking, mittente, destinatario, email cancellatore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Lista spedizioni cancellate */}
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <DataTableSkeleton rows={5} columns={5} />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6">
            <div className="flex items-center gap-3 text-red-600">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        ) : filteredSpedizioni.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg font-medium">
              Nessuna spedizione cancellata trovata
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {searchQuery
                ? 'Prova a modificare i filtri di ricerca'
                : 'Non ci sono spedizioni eliminate'}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Tracking / LDV
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Destinatario
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Corriere
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Costo
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Creata il
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Cancellata il
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Cancellata da
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSpedizioni.map((spedizione) => (
                      <tr key={spedizione.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {spedizione.tracking_number || spedizione.ldv || 'N/A'}
                              </div>
                              {spedizione.tracking_number &&
                                spedizione.ldv &&
                                spedizione.tracking_number !== spedizione.ldv && (
                                  <div className="text-xs text-gray-500">LDV: {spedizione.ldv}</div>
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {spedizione.recipient_name || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {spedizione.recipient_city}
                            {spedizione.recipient_province
                              ? ` (${spedizione.recipient_province})`
                              : ''}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {spedizione.carrier || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPrice(spedizione.total_cost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(spedizione.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(spedizione.deleted_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="text-sm text-gray-900">
                                {spedizione.deleted_by_user_email || 'N/A'}
                              </div>
                              {spedizione.created_by_user_email &&
                                spedizione.created_by_user_email !==
                                  spedizione.deleted_by_user_email && (
                                  <div className="text-xs text-gray-500">
                                    Creata da: {spedizione.created_by_user_email}
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Paginazione */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} di{' '}
                  {totalCount} spedizioni
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Precedente
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Successiva
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
