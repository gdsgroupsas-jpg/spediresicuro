/**
 * Pagina: Lista Spedizioni
 * 
 * Dashboard premium per visualizzare e gestire tutte le spedizioni.
 * Design ispirato a Stripe, Linear, Flexport - moderno, pulito, professionale.
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Download, X, FileText, FileSpreadsheet, File, Trash2 } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { ExportService } from '@/lib/adapters/export';

// Interfaccia per una spedizione
interface Spedizione {
  id: string;
  mittente: {
    nome: string;
    indirizzo?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
    telefono?: string;
    email?: string;
  };
  destinatario: {
    nome: string;
    indirizzo?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
    telefono?: string;
    email?: string;
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
  
  // Filtri e ricerca
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Modale eliminazione
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [spedizioneToDelete, setSpedizioneToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Handler elimina spedizione
  const handleDeleteClick = (id: string) => {
    setSpedizioneToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!spedizioneToDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/spedizioni?id=${spedizioneToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'eliminazione');
      }

      // Rimuovi dalla lista locale
      setSpedizioni((prev) => prev.filter((s) => s.id !== spedizioneToDelete));

      // Chiudi modale
      setShowDeleteModal(false);
      setSpedizioneToDelete(null);
    } catch (error) {
      console.error('Errore eliminazione:', error);
      alert('Errore durante l\'eliminazione della spedizione');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSpedizioneToDelete(null);
  };

  // Filtra spedizioni
  const filteredSpedizioni = useMemo(() => {
    let filtered = [...spedizioni];

    // Filtro per ricerca
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.destinatario?.nome?.toLowerCase().includes(query) ||
          s.mittente?.nome?.toLowerCase().includes(query) ||
          s.tracking?.toLowerCase().includes(query) ||
          s.destinatario?.citta?.toLowerCase().includes(query) ||
          s.destinatario?.provincia?.toLowerCase().includes(query)
      );
    }

    // Filtro per status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((s) => (s.status || 'in_preparazione') === statusFilter);
    }

    // Filtro per data
    if (dateFilter !== 'all') {
      if (dateFilter === 'custom') {
        // Filtro personalizzato con range
        filtered = filtered.filter((s) => {
          const date = new Date(s.createdAt);
          const from = customDateFrom ? new Date(customDateFrom) : null;
          const to = customDateTo ? new Date(customDateTo) : null;

          if (from && to) {
            return date >= from && date <= new Date(to.getTime() + 86400000); // +1 giorno per includere tutto il giorno "to"
          } else if (from) {
            return date >= from;
          } else if (to) {
            return date <= new Date(to.getTime() + 86400000);
          }
          return true;
        });
      } else {
        // Filtri predefiniti
        const now = new Date();
        const today = new Date(now.setHours(0, 0, 0, 0));
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        filtered = filtered.filter((s) => {
          const date = new Date(s.createdAt);
          switch (dateFilter) {
            case 'today':
              return date >= today;
            case 'week':
              return date >= weekAgo;
            case 'month':
              return date >= monthAgo;
            default:
              return true;
          }
        });
      }
    }

    // Filtro per corriere
    if (courierFilter !== 'all') {
      filtered = filtered.filter((s) => (s.corriere || '').toLowerCase() === courierFilter.toLowerCase());
    }

    return filtered;
  }, [spedizioni, searchQuery, statusFilter, dateFilter, courierFilter]);

  // Export multiplo usando ExportService
  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (filteredSpedizioni.length === 0) {
      alert('Nessuna spedizione da esportare');
      return;
    }

    setIsExporting(true);
    try {
      // Converti formato spedizioni per ExportService
      const shipmentsForExport = filteredSpedizioni.map((s) => ({
        tracking_number: s.tracking || s.id,
        created_at: s.createdAt,
        status: s.status || 'in_preparazione',
        courier_name: s.corriere || '',
        recipient_name: s.destinatario?.nome || '',
        recipient_address: s.destinatario?.indirizzo || '',
        recipient_city: s.destinatario?.citta || '',
        recipient_province: s.destinatario?.provincia || '',
        recipient_zip: s.destinatario?.cap || '',
        recipient_phone: s.destinatario?.telefono || '',
        recipient_email: s.destinatario?.email || '',
        sender_name: s.mittente?.nome || '',
        sender_address: s.mittente?.indirizzo || '',
        sender_city: s.mittente?.citta || '',
        sender_province: s.mittente?.provincia || '',
        sender_zip: s.mittente?.cap || '',
        weight: s.peso || 0,
        service_type: s.tipoSpedizione || 'standard',
        total_price: s.prezzoFinale || 0,
      }));

      const result = await ExportService.exportShipments(shipmentsForExport, format);

      // Crea blob e scarica
      // Converti Buffer in formato compatibile con Blob
      const blobData = typeof result.data === 'string'
        ? result.data
        : new Uint8Array(result.data);
      const blob = new Blob([blobData], { type: result.mimeType });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', result.filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore export:', error);
      alert(`Errore durante l'export: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    } finally {
      setIsExporting(false);
    }
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
            <div className="flex items-center gap-3">
              {filteredSpedizioni.length > 0 && (
                <div className="relative group">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    disabled={isExporting}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    {isExporting ? 'Esportazione...' : 'Esporta'}
                  </button>
                  {showFilters && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <button
                        onClick={() => {
                          handleExport('csv');
                          setShowFilters(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span>Esporta CSV</span>
                      </button>
                      <button
                        onClick={() => {
                          handleExport('xlsx');
                          setShowFilters(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-gray-600" />
                        <span>Esporta XLSX</span>
                      </button>
                      <button
                        onClick={() => {
                          handleExport('pdf');
                          setShowFilters(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <File className="w-4 h-4 text-gray-600" />
                        <span>Esporta PDF</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
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
            </div>
          }
        />

        {/* Filtri e Ricerca */}
        {!isLoading && !error && spedizioni.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Ricerca */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Cerca per destinatario, tracking, città..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro Status */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                >
                  <option value="all">Tutti gli status</option>
                  <option value="in_preparazione">In Preparazione</option>
                  <option value="in_transito">In Transito</option>
                  <option value="consegnata">Consegnata</option>
                  <option value="eccezione">Eccezione</option>
                  <option value="annullata">Annullata</option>
                </select>
              </div>

              {/* Filtro Corriere */}
              <div>
                <select
                  value={courierFilter}
                  onChange={(e) => setCourierFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                >
                  <option value="all">Tutti i corrieri</option>
                  <option value="GLS">GLS</option>
                  <option value="BRT">BRT</option>
                  <option value="DHL">DHL</option>
                  <option value="UPS">UPS</option>
                  <option value="SDA">SDA</option>
                  <option value="POSTE">Poste Italiane</option>
                </select>
              </div>

              {/* Filtro Data */}
              <div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                >
                  <option value="all">Tutte le date</option>
                  <option value="today">Oggi</option>
                  <option value="week">Ultima settimana</option>
                  <option value="month">Ultimo mese</option>
                  <option value="custom">Range personalizzato</option>
                </select>
              </div>
            </div>

            {/* Date Range Personalizzato */}
            {dateFilter === 'custom' && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Inizio
                  </label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data Fine
                  </label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Risultati filtri */}
            {(searchQuery || statusFilter !== 'all' || dateFilter !== 'all') && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando <span className="font-medium text-gray-900">{filteredSpedizioni.length}</span> di{' '}
                  <span className="font-medium text-gray-900">{spedizioni.length}</span> spedizioni
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDateFilter('all');
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Reset filtri
                </button>
              </div>
            )}
          </div>
        )}

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
          {!isLoading && !error && filteredSpedizioni.length > 0 && (
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
                  {filteredSpedizioni.map((spedizione) => (
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
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(spedizione.id);
                            }}
                            className="text-gray-400 hover:text-red-600 focus:outline-none transition-colors"
                            title="Elimina spedizione"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Empty State per filtri */}
        {!isLoading && !error && spedizioni.length > 0 && filteredSpedizioni.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nessun risultato trovato
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Prova a modificare i filtri di ricerca
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDateFilter('all');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
              Reset filtri
            </button>
          </div>
        )}

        {/* Footer Stats */}
        {!isLoading && !error && filteredSpedizioni.length > 0 && (
          <div className="mt-6 text-sm text-gray-600 text-center">
            Mostrando <span className="font-medium text-gray-900">{filteredSpedizioni.length}</span> di{' '}
            <span className="font-medium text-gray-900">{spedizioni.length}</span>{' '}
            {spedizioni.length === 1 ? 'spedizione' : 'spedizioni'}
          </div>
        )}

        {/* Modale Conferma Eliminazione */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Elimina Spedizione</h3>
                  <p className="text-sm text-gray-600">Questa azione non può essere annullata</p>
                </div>
              </div>

              {/* Body */}
              <p className="text-sm text-gray-700 mb-6">
                Sei sicuro di voler eliminare questa spedizione? I dati saranno archiviati ma non visibili nella lista.
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={cancelDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Eliminazione...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Elimina
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

