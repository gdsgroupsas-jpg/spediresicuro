/**
 * Pagina: Lista Spedizioni
 *
 * Dashboard premium per visualizzare e gestire tutte le spedizioni.
 * Design ispirato a Stripe, Linear, Flexport - moderno, pulito, professionale.
 */

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Search,
  Filter,
  Download,
  X,
  FileText,
  FileSpreadsheet,
  File,
  Trash2,
  Upload,
  CheckSquare,
  Square,
  FileDown,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Calendar,
  ArrowLeftRight,
  Package,
  Camera,
} from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { useWorkspaceUI } from '@/hooks/useWorkspaceUI';
import { ExportService } from '@/lib/adapters/export';
import {
  generateMultipleShipmentsCSV,
  downloadMultipleCSV,
} from '@/lib/generate-shipment-document';
import ImportOrders from '@/components/import/import-orders';
import { useRealtimeShipments } from '@/hooks/useRealtimeShipments';
import { featureFlags } from '@/lib/config/feature-flags';
import { useProfileCompletion } from '@/lib/hooks/use-profile-completion';
import { DataTableSkeleton } from '@/components/shared/data-table-skeleton';
import dynamic from 'next/dynamic';
import { TrackingModal, TrackingToast } from '@/components/tracking';
import { toast } from 'sonner';
import { vibrateDevice } from '@/hooks/useRealtimeShipments';

// Carica lo scanner solo quando serve (dynamic import per performance)
const ReturnScanner = dynamic(() => import('@/components/ReturnScanner'), {
  ssr: false, // Non renderizzare lato server (serve browser per camera)
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Caricamento scanner...</p>
      </div>
    </div>
  ),
});

// Scanner LDV Import (mobile-optimized con real-time)
const ScannerLDVImport = dynamic(() => import('@/components/ScannerLDVImport'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Caricamento scanner...</p>
      </div>
    </div>
  ),
});

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
    numeroCivico?: string;
    citta?: string;
    provincia?: string;
    cap?: string;
    telefono?: string;
    email?: string;
  };
  peso: number;
  dimensioni?: {
    lunghezza: number;
    larghezza: number;
    altezza: number;
  };
  tipoSpedizione: string;
  prezzoFinale: number;
  createdAt: string;
  // Campi opzionali per tracking e status
  tracking?: string;
  status?: 'in_preparazione' | 'in_transito' | 'consegnata' | 'eccezione' | 'annullata';
  corriere?: string;
  // Campi per ordini importati
  imported?: boolean;
  importSource?: string;
  importPlatform?: string;
  verified?: boolean;
  order_id?: string;
  // Campi aggiuntivi per export e import
  contrassegno?: number | string;
  assicurazione?: number | string;
  contenuto?: string;
  note?: string;
  totale_ordine?: number | string;
  rif_mittente?: string;
  rif_destinatario?: string;
  colli?: number;
  // ✨ NUOVO: VAT Semantics (ADR-001)
  vat_mode?: 'included' | 'excluded' | null;
  vat_rate?: number;
  // ✨ NUOVO: Platform fee per breakdown (0 per superadmin)
  platform_fee?: number;
  // ✨ NUOVO: Workspace info per UI gerarchica
  workspaces?: {
    id: string;
    name: string;
    type: 'platform' | 'reseller' | 'client';
  } | null;
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

// Componente Badge Importato
function ImportedBadge({
  imported,
  verified,
  platform,
}: {
  imported?: boolean;
  verified?: boolean;
  platform?: string;
}) {
  if (!imported) return null;

  return (
    <div className="flex items-center gap-1">
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
          verified
            ? 'bg-green-50 text-green-700 border-green-300'
            : 'bg-purple-50 text-purple-700 border-purple-300'
        }`}
        title={
          verified
            ? 'Ordine verificato e pronto per export'
            : 'Ordine importato - Verifica richiesta'
        }
      >
        {verified ? '✓ Verificato' : '📥 Importato'}
      </span>
      {platform && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-300">
          {platform}
        </span>
      )}
    </div>
  );
}

// Componente Badge Reso
function ReturnBadge({ isReturn, returnStatus }: { isReturn?: boolean; returnStatus?: string }) {
  if (!isReturn) return null;

  const statusConfig: Record<string, { label: string; className: string }> = {
    requested: {
      label: 'Reso Richiesto',
      className: 'bg-orange-50 text-orange-700 border-orange-300',
    },
    processing: {
      label: 'Reso in Elaborazione',
      className: 'bg-blue-50 text-blue-700 border-blue-300',
    },
    completed: {
      label: 'Reso Completato',
      className: 'bg-green-50 text-green-700 border-green-300',
    },
    cancelled: {
      label: 'Reso Annullato',
      className: 'bg-gray-50 text-gray-700 border-gray-300',
    },
  };

  const config =
    returnStatus && statusConfig[returnStatus]
      ? statusConfig[returnStatus]
      : {
          label: 'Reso',
          className: 'bg-purple-50 text-purple-700 border-purple-300',
        };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${config.className}`}
      title="Questa è una spedizione di reso"
    >
      <ArrowLeftRight className="w-3 h-3 mr-1" />
      {config.label}
    </span>
  );
}

export default function ListaSpedizioniPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // UI adattiva per tipo workspace (Platform/Reseller vedono colonna Workspace)
  const { showWorkspaceColumn } = useWorkspaceUI();

  // Onboarding gating: verifica se profilo completato
  const { isComplete: isProfileComplete, isLoading: isProfileLoading } = useProfileCompletion();
  const profileIncomplete = !isProfileLoading && isProfileComplete === false;

  const [spedizioni, setSpedizioni] = useState<Spedizione[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time: userId e killer feature
  const [userId, setUserId] = useState<string | null>(null);
  const [hasLDVScanner, setHasLDVScanner] = useState(false);
  const [showLDVScanner, setShowLDVScanner] = useState(false);
  // ✨ NUOVO: Verifica ruolo admin/superadmin per tooltip breakdown prezzo
  const [isAdminOrSuperadmin, setIsAdminOrSuperadmin] = useState(false);

  // Filtri e ricerca
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [returnFilter, setReturnFilter] = useState<string>('all'); // 'all', 'returns', 'no-returns'
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all'); // Filtro workspace per hierarchy
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Selezione multipla per export CSV
  const [selectedShipments, setSelectedShipments] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Modale eliminazione
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [spedizioneToDelete, setSpedizioneToDelete] = useState<string | null>(null);
  const [spedizioniToDelete, setSpedizioniToDelete] = useState<Set<string>>(new Set()); // Per cancellazione multipla
  const [isDeleting, setIsDeleting] = useState(false);

  // Modale import ordini
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(
    null
  );

  // Modale scanner resi
  const [showReturnScanner, setShowReturnScanner] = useState(false);

  // Modale tracking
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingShipmentId, setTrackingShipmentId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);
  const [trackingCarrier, setTrackingCarrier] = useState<string | null>(null);

  // Menu selezione rapida per periodo
  const [showSelectMenu, setShowSelectMenu] = useState(false);

  // Ottieni userId dalla sessione
  useEffect(() => {
    async function getUserId() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/user/info');
          if (response.ok) {
            const data = await response.json();
            // API restituisce { success: true, user: { id, ... } }
            const userData = data.user || data;
            setUserId(userData.id || null);

            // ✨ NUOVO: Verifica ruolo per tooltip breakdown (SUPERADMIN, ADMIN, RESELLER)
            const role = (userData.role || '').toUpperCase();
            const accountType = (userData.account_type || '').toLowerCase();
            const canSeeBreakdown =
              role === 'ADMIN' ||
              role === 'SUPERADMIN' ||
              role === 'RESELLER' ||
              accountType === 'admin' ||
              accountType === 'superadmin' ||
              accountType === 'reseller';
            setIsAdminOrSuperadmin(canSeeBreakdown);
          }
        } catch (err) {
          console.error('Errore recupero userId:', err);
        }
      }
    }
    getUserId();
  }, [session]);

  // Verifica killer feature LDV Scanner
  useEffect(() => {
    async function checkFeature() {
      try {
        const response = await fetch('/api/features/check?feature=ldv_scanner_import');
        if (response.ok) {
          const data = await response.json();
          setHasLDVScanner(data.hasAccess || false);
        }
      } catch (err) {
        console.error('Errore verifica killer feature:', err);
        setHasLDVScanner(false);
      }
    }
    checkFeature();
  }, []);

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
        const spedizioniCaricate = result.data || [];

        // Log per debug
        console.log('📦 Spedizioni caricate:', spedizioniCaricate.length);
        console.log(
          '📥 Spedizioni importate:',
          spedizioniCaricate.filter((s: any) => s.imported).length
        );

        setSpedizioni(spedizioniCaricate);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        console.error('Errore caricamento spedizioni:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSpedizioni();
  }, []);

  // ⚠️ P0-1 FIX: Forza refresh se arriviamo da creazione spedizione
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('refresh') === 'true') {
      // Guard anti-doppia esecuzione (protezione contro StrictMode/doppio render)
      const refreshKey = 'spedizioni_refreshed';
      if (sessionStorage.getItem(refreshKey) === '1') {
        console.log('🔄 [REFRESH] Skip: già eseguito in questa sessione');
        // Rimuovi query param comunque
        window.history.replaceState({}, '', '/dashboard/spedizioni');
        return;
      }

      // Marca come in esecuzione
      sessionStorage.setItem(refreshKey, '1');

      // ✨ ENTERPRISE: Refresh ottimizzato delle spedizioni
      // Usa timestamp invece di no-store per performance migliori
      async function refreshSpedizioni() {
        try {
          setIsLoading(true);
          // ✨ Ottimizzazione: usa timestamp per bypass cache invece di no-store
          // Questo è più veloce perché il browser può ancora usare la cache per altre parti
          const timestamp = Date.now();
          const response = await fetch(`/api/spedizioni?t=${timestamp}`, {
            // Usa 'default' invece di 'no-store' per permettere cache browser per altre richieste
            cache: 'default',
            headers: {
              // Rimuoviamo header aggressivi per performance
              'Cache-Control': 'max-age=0', // Chiedi validazione ma permetti cache condizionale
            },
          });
          if (response.ok) {
            const result = await response.json();
            const spedizioniCaricate = result.data || [];
            setSpedizioni(spedizioniCaricate);
            console.log('🔄 [REFRESH] Spedizioni ricaricate dopo creazione');
          }
        } catch (err) {
          console.error('Errore refresh spedizioni:', err);
        } finally {
          setIsLoading(false);
          // Rimuovi query param per pulizia URL
          window.history.replaceState({}, '', '/dashboard/spedizioni');
          // Rimuovi guard dopo successo
          sessionStorage.removeItem(refreshKey);
        }
      }
      refreshSpedizioni();
    }
  }, []);

  // Listener Real-Time per aggiornamenti automatici (mobile → desktop)
  useRealtimeShipments({
    userId: userId || '',
    enabled: !!userId && !isLoading,
    onInsert: (shipment: any) => {
      console.log('📦 [Real-Time] Nuova spedizione importata:', shipment);

      // Verifica che non sia già nella lista
      const exists = spedizioni.some(
        (s) => s.id === shipment.id || (s as any).tracking === shipment.tracking_number
      );

      if (!exists) {
        // Aggiungi in cima alla lista
        setSpedizioni((prev) => [shipment, ...prev]);

        // Notifica utente (opzionale, puoi aggiungere toast)
        console.log('✅ Nuova spedizione aggiunta in tempo reale!');
      }
    },
    onUpdate: (shipment: any) => {
      console.log('📝 [Real-Time] Spedizione aggiornata:', shipment);

      // Rileva cambio tracking_status per mostrare toast
      const oldShipment = spedizioni.find(
        (s) => s.id === shipment.id || (s as any).tracking === shipment.tracking_number
      );
      const oldStatus = (oldShipment as any)?.tracking_status;
      const newStatus = shipment.tracking_status;

      if (oldStatus && newStatus && oldStatus !== newStatus) {
        // Vibrazione differenziata per stato
        if (newStatus === 'delivered') {
          vibrateDevice([100, 50, 100, 50, 200]); // Pattern celebrativo
        } else if (newStatus === 'in_giacenza' || newStatus === 'exception') {
          vibrateDevice([300, 100, 300]); // Pattern urgente
        } else if (newStatus === 'out_for_delivery') {
          vibrateDevice([100, 50, 100]); // Pattern informativo
        }

        // Segnala al NotificationBell di fare refetch
        window.dispatchEvent(new CustomEvent('tracking-notification'));

        // Toast ricco con TrackingToast
        toast.custom(
          (t) => (
            <TrackingToast
              trackingNumber={shipment.tracking_number || ''}
              status={newStatus}
              carrier={shipment.carrier}
              onViewDetails={() => {
                toast.dismiss(t);
                handleTrack(shipment.id, shipment.tracking_number, shipment.carrier);
              }}
              onDismiss={() => toast.dismiss(t)}
            />
          ),
          {
            duration: newStatus === 'in_giacenza' || newStatus === 'exception' ? Infinity : 8000,
            position: 'top-right',
          }
        );
      }

      // Aggiorna spedizione esistente nella lista
      setSpedizioni((prev) =>
        prev.map((s) =>
          s.id === shipment.id || (s as any).tracking === shipment.tracking_number ? shipment : s
        )
      );
    },
    onDelete: (shipmentId: string) => {
      console.log('🗑️ [Real-Time] Spedizione eliminata:', shipmentId);
      // Rimuovi dalla lista
      setSpedizioni((prev) => prev.filter((s) => s.id !== shipmentId));
    },
  });

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

  // Handler per tracking - apre modale con timeline
  const handleTrack = (shipmentId: string, tracking: string, carrier?: string) => {
    setTrackingShipmentId(shipmentId);
    setTrackingNumber(tracking);
    setTrackingCarrier(carrier || null);
    setShowTrackingModal(true);
  };

  // Handler elimina spedizione singola
  const handleDeleteClick = (id: string) => {
    setSpedizioneToDelete(id);
    setSpedizioniToDelete(new Set()); // Reset eliminazione multipla
    setShowDeleteModal(true);
  };

  // Cancella spedizioni selezionate
  const handleDeleteSelected = () => {
    if (selectedShipments.size === 0) {
      alert('Seleziona almeno una spedizione da eliminare');
      return;
    }
    setSpedizioniToDelete(selectedShipments);
    setSpedizioneToDelete(null); // Reset eliminazione singola
    setShowDeleteModal(true);
  };

  // Annulla eliminazione
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSpedizioneToDelete(null);
    setSpedizioniToDelete(new Set());
  };

  // Conferma eliminazione (singola o multipla)
  const confirmDelete = async () => {
    const idsToDelete = spedizioneToDelete ? [spedizioneToDelete] : Array.from(spedizioniToDelete);

    if (idsToDelete.length === 0) {
      console.warn('⚠️ Nessun ID da eliminare');
      return;
    }

    setIsDeleting(true);

    try {
      console.log(`🗑️ Eliminazione di ${idsToDelete.length} spedizione/i:`, idsToDelete);

      // Elimina tutte le spedizioni selezionate
      const deletePromises = idsToDelete.map(async (id) => {
        console.log(`🔄 Eliminazione spedizione: ${id}`);

        try {
          const response = await fetch(`/api/spedizioni?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          console.log(`📊 Risposta DELETE per ${id}:`, {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
          });

          if (!response.ok) {
            // Prova a leggere il messaggio di errore dalla risposta
            let errorMessage = `Errore ${response.status}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.message || errorData.error || errorMessage;
              console.error(`❌ Errore risposta per ${id}:`, errorData);
            } catch (e) {
              const errorText = await response.text();
              console.error(`❌ Errore testo risposta per ${id}:`, errorText);
              errorMessage = errorText || errorMessage;
            }

            throw new Error(
              `Errore durante l'eliminazione della spedizione ${id}: ${errorMessage}`
            );
          }

          // Verifica che la risposta sia valida
          const result = await response.json();
          console.log(`✅ Spedizione ${id} eliminata con successo:`, result);

          return { id, success: true };
        } catch (error: any) {
          console.error(`❌ Errore eliminazione spedizione ${id}:`, error);
          return { id, success: false, error: error.message };
        }
      });

      const results = await Promise.all(deletePromises);

      // Verifica se tutte le eliminazioni sono riuscite
      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        const errorMessages = failed.map((f) => `${f.id}: ${f.error}`).join('\n');
        throw new Error(
          `Errore durante l'eliminazione di ${failed.length} spedizione/i:\n${errorMessages}`
        );
      }

      // Rimuovi dalla lista locale solo le spedizioni eliminate con successo
      const successfulIds = results.filter((r) => r.success).map((r) => r.id);
      setSpedizioni((prev) => prev.filter((s) => !successfulIds.includes(s.id)));

      // Deseleziona tutte
      setSelectedShipments(new Set());
      setSelectAll(false);

      // Chiudi modale
      setShowDeleteModal(false);
      setSpedizioneToDelete(null);
      setSpedizioniToDelete(new Set());

      console.log(`✅ Eliminazione completata: ${successfulIds.length} spedizione/i eliminate`);
    } catch (error: any) {
      console.error('❌ Errore eliminazione:', error);
      alert(`Errore durante l'eliminazione delle spedizioni:\n${error.message}`);
    } finally {
      setIsDeleting(false);
    }
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
      filtered = filtered.filter(
        (s) => (s.corriere || '').toLowerCase() === courierFilter.toLowerCase()
      );
    }

    // Filtro per resi
    if (returnFilter === 'returns') {
      filtered = filtered.filter((s: any) => s.is_return === true);
    } else if (returnFilter === 'no-returns') {
      filtered = filtered.filter((s: any) => !s.is_return || s.is_return === false);
    }

    // Filtro per workspace (solo per platform/reseller)
    if (workspaceFilter !== 'all') {
      filtered = filtered.filter((s) => s.workspaces?.id === workspaceFilter);
    }

    return filtered;
  }, [
    spedizioni,
    searchQuery,
    statusFilter,
    dateFilter,
    courierFilter,
    returnFilter,
    workspaceFilter,
    customDateFrom,
    customDateTo,
  ]);

  // Gestione selezione multipla
  const handleToggleSelect = (id: string) => {
    setSelectedShipments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedShipments(new Set());
      setSelectAll(false);
    } else {
      setSelectedShipments(new Set(filteredSpedizioni.map((s) => s.id)));
      setSelectAll(true);
    }
  };

  // Sincronizza selectAll con selectedShipments
  useEffect(() => {
    if (filteredSpedizioni.length > 0) {
      const allSelected = filteredSpedizioni.every((s) => selectedShipments.has(s.id));
      setSelectAll(allSelected);
    } else {
      setSelectAll(false);
    }
  }, [selectedShipments, filteredSpedizioni]);

  // Download LDV singola
  const handleDownloadLDV = async (id: string, format: 'pdf' | 'csv' | 'xlsx' = 'pdf') => {
    try {
      const response = await fetch(`/api/spedizioni/${id}/ldv?format=${format}`);
      if (!response.ok) {
        throw new Error('Errore durante il download della LDV');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // ⚠️ FIX: Il filename viene già impostato correttamente dall'API (Content-Disposition header)
      // Non serve impostare link.download, il browser userà il filename dall'header
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Errore download LDV:', error);
      alert('Errore durante il download della LDV');
    }
  };

  // Modifica ordine importato
  const handleEditImported = (id: string) => {
    router.push(`/dashboard/spedizioni/${id}?edit=true&imported=true`);
  };

  // Funzioni selezione rapida per periodo
  const handleSelectByPeriod = (period: string) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    switch (period) {
      case 'oggi':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        break;
      case 'ieri':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
          0,
          0,
          0
        );
        endDate = new Date(
          yesterday.getFullYear(),
          yesterday.getMonth(),
          yesterday.getDate(),
          23,
          59,
          59
        );
        break;
      case '3gg':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 3);
        startDate.setHours(0, 0, 0, 0);
        break;
      case '1settimana':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case '1mese':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case '30gg':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'tutti':
        setSelectedShipments(new Set(filteredSpedizioni.map((s) => s.id)));
        setSelectAll(true);
        setShowSelectMenu(false);
        return;
      default:
        return;
    }

    // Filtra spedizioni nel periodo
    const spedizioniNelPeriodo = filteredSpedizioni.filter((s) => {
      const spedizioneDate = new Date(s.createdAt);
      return spedizioneDate >= startDate && spedizioneDate <= endDate;
    });

    setSelectedShipments(new Set(spedizioniNelPeriodo.map((s) => s.id)));
    setSelectAll(spedizioniNelPeriodo.length === filteredSpedizioni.length);
    setShowSelectMenu(false);
  };

  // Selezione per range personalizzato
  const handleSelectByCustomRange = () => {
    const startInput = prompt('Data inizio (formato: YYYY-MM-DD):');
    const endInput = prompt('Data fine (formato: YYYY-MM-DD):');

    if (!startInput || !endInput) {
      return;
    }

    try {
      const startDate = new Date(startInput);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(endInput);
      endDate.setHours(23, 59, 59, 999);

      const spedizioniNelRange = filteredSpedizioni.filter((s) => {
        const spedizioneDate = new Date(s.createdAt);
        return spedizioneDate >= startDate && spedizioneDate <= endDate;
      });

      setSelectedShipments(new Set(spedizioniNelRange.map((s) => s.id)));
      setSelectAll(spedizioniNelRange.length === filteredSpedizioni.length);
      setShowSelectMenu(false);
    } catch (error) {
      alert('Formato data non valido. Usa YYYY-MM-DD');
    }
  };

  // Chiudi menu selezione quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.select-menu-container')) {
        setShowSelectMenu(false);
      }
    };

    if (showSelectMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSelectMenu]);

  // Export CSV formato spedisci.online (solo spedizioni selezionate)
  const handleExportSpedisciOnlineCSV = async () => {
    const spedizioniToExport =
      selectedShipments.size > 0
        ? filteredSpedizioni.filter((s) => selectedShipments.has(s.id))
        : filteredSpedizioni;

    if (spedizioniToExport.length === 0) {
      alert('Seleziona almeno una spedizione da esportare');
      return;
    }

    setIsExporting(true);
    try {
      // Converti Spedizione[] a SpedizioneData[] normalizzando tutti i campi
      // ⚠️ IMPORTANTE: Mappatura completa per formato CSV spedisci.online
      const spedizioniForCSV = spedizioniToExport.map((s) => {
        // Estrai indirizzo completo (indirizzo + numero civico se separati)
        const indirizzoCompleto = s.destinatario?.indirizzo || '';
        const numeroCivico = s.destinatario?.numeroCivico || '';
        const indirizzoFinale = numeroCivico
          ? `${indirizzoCompleto}, n ${numeroCivico}`.trim()
          : indirizzoCompleto;

        return {
          tracking: s.tracking || s.id,
          mittente: {
            nome: s.mittente?.nome || '',
            indirizzo: s.mittente?.indirizzo || '',
            citta: s.mittente?.citta || '',
            provincia: s.mittente?.provincia || '',
            cap: s.mittente?.cap || '',
            telefono: s.mittente?.telefono || '',
            email: s.mittente?.email || '',
          },
          destinatario: {
            nome: s.destinatario?.nome || '',
            indirizzo: indirizzoFinale,
            citta: s.destinatario?.citta || '',
            provincia: s.destinatario?.provincia || '',
            cap: s.destinatario?.cap || '',
            telefono: s.destinatario?.telefono || '',
            email: s.destinatario?.email || '',
          },
          peso: s.peso || 0,
          dimensioni: s.dimensioni || { lunghezza: 0, larghezza: 0, altezza: 0 },
          tipoSpedizione: s.tipoSpedizione || 'standard',
          corriere: s.corriere || '',
          prezzoFinale: s.prezzoFinale || 0,
          status: s.status || 'in_preparazione',
          createdAt: s.createdAt,
          // Campi aggiuntivi per formato spedisci.online
          contrassegno: s.contrassegno || '',
          assicurazione: s.assicurazione || '',
          contenuto: s.contenuto || s.note || '',
          order_id: s.order_id || s.tracking || s.id,
          totale_ordine: s.totale_ordine || s.contrassegno || s.prezzoFinale || '',
          rif_mittente: s.rif_mittente || s.mittente?.nome || 'MITTENTE',
          rif_destinatario: s.rif_destinatario || s.destinatario?.nome || '',
          colli: s.colli || 1,
          note: s.note || '',
        };
      });

      const csvData = generateMultipleShipmentsCSV(spedizioniForCSV);
      const filename = `spedizioni_spedisci_online_${new Date().toISOString().split('T')[0]}.csv`;
      downloadMultipleCSV(csvData, filename);
    } catch (error) {
      console.error('Errore export CSV Spedisci.Online:', error);
      alert("Errore durante l'esportazione CSV Spedisci.Online");
    } finally {
      setIsExporting(false);
    }
  };

  // Export multiplo usando formato corretto per importazione
  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    const spedizioniToExport =
      selectedShipments.size > 0
        ? filteredSpedizioni.filter((s) => selectedShipments.has(s.id))
        : filteredSpedizioni;

    if (spedizioniToExport.length === 0) {
      alert('Seleziona almeno una spedizione da esportare');
      return;
    }

    setIsExporting(true);
    try {
      // Per CSV, usa il formato corretto per importazione (compatibile con Supabase)
      if (format === 'csv') {
        // Converti formato spedizioni per generateMultipleShipmentsCSV
        const spedizioniFormattate = spedizioniToExport.map((s) => ({
          destinatario: {
            nome: s.destinatario?.nome || '',
            indirizzo: s.destinatario?.indirizzo || '',
            citta: s.destinatario?.citta || '',
            provincia: s.destinatario?.provincia || '',
            cap: s.destinatario?.cap || '',
            telefono: s.destinatario?.telefono || '',
            email: s.destinatario?.email || '',
          },
          mittente: {
            nome: s.mittente?.nome || '',
            indirizzo: s.mittente?.indirizzo || '',
            citta: s.mittente?.citta || '',
            provincia: s.mittente?.provincia || '',
            cap: s.mittente?.cap || '',
            telefono: s.mittente?.telefono || '',
            email: s.mittente?.email || '',
          },
          peso: s.peso || 1,
          colli: s.colli || 1,
          contrassegno: s.contrassegno || 0,
          rif_mittente: s.rif_mittente || s.mittente?.nome || 'MITTENTE',
          rif_destinatario: s.rif_destinatario || s.destinatario?.nome || '',
          note: s.note || '',
          contenuto: s.contenuto || '',
          order_id: s.order_id || s.tracking || '',
          totale_ordine: s.totale_ordine || s.contrassegno || s.prezzoFinale || 0,
          tracking: s.tracking || '',
          dimensioni: s.dimensioni || { lunghezza: 0, larghezza: 0, altezza: 0 },
          tipoSpedizione: s.tipoSpedizione || 'standard',
          corriere: s.corriere || '',
          prezzoFinale: s.prezzoFinale || 0,
          status: s.status || 'in_preparazione',
        }));

        const csvContent = generateMultipleShipmentsCSV(spedizioniFormattate);
        const filename = `spedizioni_${new Date().toISOString().split('T')[0]}.csv`;
        downloadMultipleCSV(csvContent, filename);
      } else {
        // Per XLSX e PDF, usa ExportService
        const shipmentsForExport = spedizioniToExport.map((s) => ({
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
        const blobData =
          typeof result.data === 'string' ? result.data : new Uint8Array(result.data);
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
      }
    } catch (error) {
      console.error('Errore export:', error);
      alert(
        `Errore durante l'export: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Lista Spedizioni"
          subtitle="Gestisci e monitora tutte le tue spedizioni in tempo reale"
          showBackButton={true}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {selectedShipments.size > 0 && (
                <div className="text-sm text-gray-700 font-semibold bg-gradient-to-r from-[#FFD700]/20 to-[#FF9500]/20 px-3 py-1.5 rounded-lg border border-[#FF9500]/30">
                  {selectedShipments.size} selezionate
                </div>
              )}
              {/* Pulsante Import */}
              <button
                onClick={() => setShowImportModal(true)}
                disabled={profileIncomplete}
                title={profileIncomplete ? 'Completa il profilo per importare ordini' : undefined}
                className={`inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all ${profileIncomplete ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <FileDown className="w-4 h-4" />
                Importa Ordini
              </button>

              {/* Pulsante Cancella Selezionate */}
              {selectedShipments.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancella ({selectedShipments.size})
                </button>
              )}

              {filteredSpedizioni.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    disabled={isExporting || profileIncomplete}
                    title={profileIncomplete ? 'Completa il profilo per esportare' : undefined}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FF9500] focus:ring-offset-2 transition-all disabled:opacity-50 transform hover:scale-105 ${profileIncomplete ? 'cursor-not-allowed' : ''}`}
                  >
                    <Download className="w-4 h-4" />
                    {isExporting ? 'Esportazione...' : 'Esporta'}
                  </button>
                  {showFilters && (
                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="p-2">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
                          Formati Standard
                        </div>
                        <button
                          onClick={() => {
                            handleExport('csv');
                            setShowFilters(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 flex items-center gap-2 text-gray-900 font-medium rounded-lg transition-colors"
                        >
                          <FileText className="w-4 h-4 text-gray-600" />
                          <span>Esporta CSV</span>
                        </button>
                        <button
                          onClick={() => {
                            handleExport('xlsx');
                            setShowFilters(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 flex items-center gap-2 text-gray-900 font-medium rounded-lg transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-gray-600" />
                          <span>Esporta XLSX</span>
                        </button>
                        <button
                          onClick={() => {
                            handleExport('pdf');
                            setShowFilters(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 flex items-center gap-2 text-gray-900 font-medium rounded-lg transition-colors"
                        >
                          <File className="w-4 h-4 text-gray-600" />
                          <span>Esporta PDF</span>
                        </button>
                      </div>
                      <div className="border-t border-gray-200"></div>
                      <div className="p-2">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">
                          Importazione
                        </div>
                        <button
                          onClick={() => {
                            handleExportSpedisciOnlineCSV();
                            setShowFilters(false);
                          }}
                          className="w-full text-left px-4 py-2.5 bg-gradient-to-r from-[#FFD700]/10 to-[#FF9500]/10 hover:from-[#FFD700]/20 hover:to-[#FF9500]/20 flex items-center gap-2 text-[#FF9500] font-semibold rounded-lg transition-all border border-[#FF9500]/20"
                          title="Esporta CSV nel formato spedisci.online per importazione manuale"
                        >
                          <Upload className="w-4 h-4 text-[#FF9500]" />
                          <span>CSV Spedisci.Online</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Scanner LDV Import (solo se ha la killer feature) */}
              {hasLDVScanner && (
                <button
                  onClick={() => setShowLDVScanner(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-105"
                  title="Importa spedizione tramite scanner barcode/QR (mobile o desktop)"
                >
                  <Camera className="w-5 h-5" />
                  Scanner LDV
                </button>
              )}
              <button
                onClick={() => setShowReturnScanner(true)}
                disabled={profileIncomplete}
                className={`inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all transform hover:scale-105 ${profileIncomplete ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={
                  profileIncomplete
                    ? 'Completa il profilo per registrare resi'
                    : 'Registra un reso tramite scanner'
                }
              >
                <ArrowLeftRight className="w-5 h-5" />
                Registra Reso
              </button>
              {profileIncomplete ? (
                <div
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg shadow-sm opacity-50 cursor-not-allowed"
                  title="Completa il profilo per creare spedizioni"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Nuova Spedizione
                </div>
              ) : (
                <Link
                  href="/dashboard/spedizioni/nuova"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#FF9500] focus:ring-offset-2 transition-all transform hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Nuova Spedizione
                </Link>
              )}
            </div>
          }
        />

        {/* Banner Profilo Incompleto */}
        {profileIncomplete && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Profilo incompleto</p>
              <p className="text-sm text-amber-700">
                Le funzioni operative sono in sola lettura.{' '}
                <Link
                  href="/dashboard/dati-cliente"
                  className="underline font-medium hover:text-amber-900"
                >
                  Completa il profilo
                </Link>{' '}
                per sbloccare tutte le funzionalità.
              </p>
            </div>
          </div>
        )}

        {/* Filtri e Ricerca - Stile Premium */}
        {!isLoading && !error && spedizioni.length > 0 && (
          <div className="bg-gradient-to-br from-white via-white to-gray-50/50 backdrop-blur-xl rounded-xl border border-gray-200/60 shadow-xl p-4 mb-6">
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
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent bg-white text-gray-900 placeholder:text-gray-500 font-medium"
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
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent bg-white text-gray-900 font-medium"
                >
                  <option value="all">Tutti gli status</option>
                  <option value="in_preparazione">In Preparazione</option>
                  <option value="in_transito">In Transito</option>
                  <option value="consegnata">Consegnata</option>
                  <option value="eccezione">Eccezione</option>
                  <option value="annullata">Annullata</option>
                </select>
              </div>

              {/* Filtro Resi */}
              <div>
                <select
                  value={returnFilter}
                  onChange={(e) => setReturnFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent bg-white text-gray-900 font-medium"
                >
                  <option value="all">Tutte le spedizioni</option>
                  <option value="returns">Solo resi</option>
                  <option value="no-returns">Solo normali</option>
                </select>
              </div>

              {/* Filtro Corriere */}
              <div>
                <select
                  value={courierFilter}
                  onChange={(e) => setCourierFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent bg-white text-gray-900 font-medium"
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

              {/* Filtro Workspace (solo per Platform/Reseller) */}
              {showWorkspaceColumn && (
                <div>
                  <select
                    value={workspaceFilter}
                    onChange={(e) => setWorkspaceFilter(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent bg-white text-gray-900 font-medium"
                  >
                    <option value="all">Tutti i workspace</option>
                    {/* Estrai workspace unici dalle spedizioni */}
                    {Array.from(
                      new Map(
                        spedizioni
                          .filter((s) => s.workspaces)
                          .map((s) => [s.workspaces!.id, s.workspaces!])
                      ).values()
                    ).map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name} ({ws.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro Data */}
              <div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF9500] focus:border-transparent bg-white text-gray-900 font-medium"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Fine</label>
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
            {(searchQuery ||
              statusFilter !== 'all' ||
              dateFilter !== 'all' ||
              returnFilter !== 'all' ||
              courierFilter !== 'all' ||
              workspaceFilter !== 'all') && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Mostrando{' '}
                  <span className="font-medium text-gray-900">{filteredSpedizioni.length}</span> di{' '}
                  <span className="font-medium text-gray-900">{spedizioni.length}</span> spedizioni
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDateFilter('all');
                    setReturnFilter('all');
                    setCourierFilter('all');
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
        <div className="bg-gradient-to-br from-white via-white to-gray-50/50 backdrop-blur-xl rounded-xl border border-gray-200/60 shadow-xl overflow-hidden">
          {/* Loading State */}
          {isLoading && (
            <div className="p-6">
              <DataTableSkeleton rows={6} columns={6} />
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna spedizione trovata</h3>
              <p className="text-sm text-gray-600 mb-6">
                Crea la tua prima spedizione per iniziare
              </p>
              <Link
                href="/dashboard/spedizioni/nuova"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      <div className="flex items-center gap-2 relative select-menu-container">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center justify-center"
                          title={selectAll ? 'Deseleziona tutti' : 'Seleziona tutti'}
                        >
                          {selectAll ? (
                            <CheckSquare className="w-5 h-5 text-[#FF9500]" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => setShowSelectMenu(!showSelectMenu)}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <span>Seleziona</span>
                            <ChevronDown
                              className={`w-3 h-3 transition-transform ${showSelectMenu ? 'rotate-180' : ''}`}
                            />
                          </button>

                          {showSelectMenu && (
                            <div className="absolute left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                              <div className="p-1">
                                <button
                                  onClick={() => handleSelectByPeriod('tutti')}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-md transition-colors flex items-center gap-2"
                                >
                                  <CheckSquare className="w-4 h-4" />
                                  <span>Tutti</span>
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={() => handleSelectByPeriod('oggi')}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-md transition-colors flex items-center gap-2"
                                >
                                  <Calendar className="w-4 h-4" />
                                  <span>Oggi</span>
                                </button>
                                <button
                                  onClick={() => handleSelectByPeriod('ieri')}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-md transition-colors flex items-center gap-2"
                                >
                                  <Calendar className="w-4 h-4" />
                                  <span>Ieri</span>
                                </button>
                                <button
                                  onClick={() => handleSelectByPeriod('3gg')}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-md transition-colors flex items-center gap-2"
                                >
                                  <Calendar className="w-4 h-4" />
                                  <span>Ultimi 3 giorni</span>
                                </button>
                                <button
                                  onClick={() => handleSelectByPeriod('1settimana')}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-md transition-colors flex items-center gap-2"
                                >
                                  <Calendar className="w-4 h-4" />
                                  <span>Ultima settimana</span>
                                </button>
                                <button
                                  onClick={() => handleSelectByPeriod('1mese')}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-md transition-colors flex items-center gap-2"
                                >
                                  <Calendar className="w-4 h-4" />
                                  <span>Ultimo mese</span>
                                </button>
                                <button
                                  onClick={() => handleSelectByPeriod('30gg')}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-md transition-colors flex items-center gap-2"
                                >
                                  <Calendar className="w-4 h-4" />
                                  <span>Ultimi 30 giorni</span>
                                </button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={handleSelectByCustomRange}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-md transition-colors flex items-center gap-2 font-medium"
                                >
                                  <Calendar className="w-4 h-4" />
                                  <span>Data a piacere...</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Destinatario
                    </th>
                    {showWorkspaceColumn && (
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Workspace
                      </th>
                    )}
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
                      <td
                        className="px-6 py-4 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => handleToggleSelect(spedizione.id)}
                          className="flex items-center justify-center"
                        >
                          {selectedShipments.has(spedizione.id) ? (
                            <CheckSquare className="w-5 h-5 text-[#FF9500]" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-medium text-gray-900">
                              {spedizione.destinatario?.nome || 'N/A'}
                            </div>
                            <ImportedBadge
                              imported={spedizione.imported}
                              verified={spedizione.verified}
                              platform={spedizione.importPlatform}
                            />
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {spedizione.destinatario?.citta && spedizione.destinatario?.provincia
                              ? `${spedizione.destinatario.citta}, ${spedizione.destinatario.provincia}`
                              : ''}
                          </div>
                        </div>
                      </td>
                      {showWorkspaceColumn && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {spedizione.workspaces ? (
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  spedizione.workspaces.type === 'platform'
                                    ? 'bg-purple-100 text-purple-800'
                                    : spedizione.workspaces.type === 'reseller'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {spedizione.workspaces.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {spedizione.tracking ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTrack(spedizione.id, spedizione.tracking!, spedizione.corriere);
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={spedizione.status || 'in_preparazione'} />
                          <ReturnBadge
                            isReturn={(spedizione as any).is_return}
                            returnStatus={(spedizione as any).return_status}
                          />
                        </div>
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
                        <div className="group relative flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {spedizione.prezzoFinale > 0
                              ? formatPrice(spedizione.prezzoFinale)
                              : '—'}
                          </span>

                          {/* ✨ NUOVO: Tooltip breakdown prezzo (solo admin/superadmin con fee > 0) */}
                          {isAdminOrSuperadmin &&
                            spedizione.prezzoFinale > 0 &&
                            spedizione.platform_fee !== undefined &&
                            spedizione.platform_fee > 0 && (
                              <div
                                className="hidden group-hover:block absolute z-20 bottom-full left-0 mb-2
                                            bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg
                                            whitespace-nowrap min-w-[140px]"
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-300">Base:</span>
                                    <span>
                                      {formatPrice(
                                        spedizione.prezzoFinale - spedizione.platform_fee
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-gray-300">Fee:</span>
                                    <span>{formatPrice(spedizione.platform_fee)}</span>
                                  </div>
                                  <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between gap-4">
                                    <span className="font-semibold">Totale:</span>
                                    <span className="font-semibold">
                                      {formatPrice(spedizione.prezzoFinale)}
                                    </span>
                                  </div>
                                </div>
                                <div
                                  className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45
                                              w-2 h-2 bg-gray-900"
                                ></div>
                              </div>
                            )}

                          {/* ✨ NUOVO: Badge VAT (solo se feature flag abilitato) - ADR-001 */}
                          {featureFlags.showVATSemantics &&
                            spedizione.prezzoFinale > 0 &&
                            spedizione.vat_mode && (
                              <span className="text-xs text-gray-500 mt-0.5">
                                {spedizione.vat_mode === 'excluded'
                                  ? `+ IVA ${spedizione.vat_rate || 22}%`
                                  : 'IVA incl.'}
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {spedizione.imported && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditImported(spedizione.id);
                              }}
                              className={`p-2 rounded-lg focus:outline-none transition-all ${
                                spedizione.verified
                                  ? 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                                  : 'text-purple-500 hover:text-purple-700 hover:bg-purple-100'
                              }`}
                              title={
                                spedizione.verified
                                  ? 'Modifica ordine importato'
                                  : 'Verifica e modifica ordine'
                              }
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
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadLDV(spedizione.id, 'pdf');
                            }}
                            className="p-2 text-gray-400 hover:text-[#FF9500] hover:bg-gradient-to-r hover:from-[#FFD700]/10 hover:to-[#FF9500]/10 rounded-lg focus:outline-none transition-all"
                            title="Scarica LDV PDF"
                          >
                            <FileText className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(spedizione.id);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg focus:outline-none transition-all"
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
                                handleTrack(
                                  spedizione.id,
                                  spedizione.tracking!,
                                  spedizione.corriere
                                );
                              }}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg focus:outline-none transition-all"
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
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg focus:outline-none transition-all"
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
          <div className="bg-gradient-to-br from-white via-white to-gray-50/50 backdrop-blur-xl rounded-xl border border-gray-200/60 shadow-xl p-12 text-center">
            <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun risultato trovato</h3>
            <p className="text-sm text-gray-600 mb-6">Prova a modificare i filtri di ricerca</p>
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
            Mostrando <span className="font-medium text-gray-900">{filteredSpedizioni.length}</span>{' '}
            di <span className="font-medium text-gray-900">{spedizioni.length}</span>{' '}
            {spedizioni.length === 1 ? 'spedizione' : 'spedizioni'}
          </div>
        )}

        {/* Modale Import Ordini */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-8">
              <ImportOrders
                onImportComplete={async (successCount, errors) => {
                  setImportResult({ success: successCount, errors });

                  // ⚠️ IMPORTANTE: Ricarica immediatamente le spedizioni senza ricaricare tutta la pagina
                  try {
                    console.log('🔄 Ricaricamento spedizioni dopo import...');
                    const response = await fetch('/api/spedizioni');
                    if (response.ok) {
                      const result = await response.json();
                      const nuoveSpedizioni = result.data || [];
                      console.log('✅ Spedizioni caricate:', nuoveSpedizioni.length);
                      console.log(
                        '📥 Spedizioni importate:',
                        nuoveSpedizioni.filter((s: any) => s.imported).length
                      );
                      setSpedizioni(nuoveSpedizioni);
                    }
                  } catch (err) {
                    console.error('❌ Errore ricaricamento spedizioni:', err);
                  }

                  // Chiudi modale dopo 2 secondi se tutto ok
                  setTimeout(() => {
                    setShowImportModal(false);
                    if (errors.length === 0 && successCount > 0) {
                      setImportResult(null);
                    }
                  }, 2000);
                }}
                onCancel={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Modale Risultato Import */}
        {importResult && !showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                    importResult.errors.length === 0 ? 'bg-green-100' : 'bg-yellow-100'
                  }`}
                >
                  {importResult.errors.length === 0 ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Importazione Completata</h3>
                  <p className="text-sm text-gray-600">
                    {importResult.success} ordini importati con successo
                  </p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-red-900 mb-2">
                    Errori ({importResult.errors.length}):
                  </h4>
                  <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => {
                  setImportResult(null);
                }}
                className="w-full px-4 py-2 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-medium rounded-lg hover:shadow-lg transition-all"
              >
                Chiudi
              </button>
            </div>
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
                  <h3 className="text-lg font-semibold text-gray-900">
                    {spedizioniToDelete.size > 0
                      ? `Elimina ${spedizioniToDelete.size} Spedizioni`
                      : 'Elimina Spedizione'}
                  </h3>
                  <p className="text-sm text-gray-600">Questa azione non può essere annullata</p>
                </div>
              </div>

              {/* Body */}
              <div className="mb-6">
                {spedizioniToDelete.size > 0 ? (
                  <div>
                    <p className="text-sm text-gray-700 mb-3">
                      Sei sicuro di voler eliminare{' '}
                      <strong className="text-red-600">
                        {spedizioniToDelete.size} spedizioni selezionate
                      </strong>
                      ?
                    </p>
                    <p className="text-xs text-gray-600">
                      I dati saranno archiviati ma non visibili nella lista.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700">
                    Sei sicuro di voler eliminare questa spedizione? I dati saranno archiviati ma
                    non visibili nella lista.
                  </p>
                )}
              </div>

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

        {/* Modal Scanner Resi */}
        {showReturnScanner && (
          <ReturnScanner
            onClose={() => setShowReturnScanner(false)}
            onSuccess={(returnShipment, originalShipment) => {
              console.log('Reso registrato:', returnShipment, originalShipment);
              // Real-time aggiornerà automaticamente la lista
              // Non serve reload grazie a useRealtimeShipments
            }}
          />
        )}

        {/* Modal Scanner LDV Import (mobile/desktop real-time) */}
        {showLDVScanner && hasLDVScanner && (
          <ScannerLDVImport
            mode="import"
            onClose={() => setShowLDVScanner(false)}
            onSuccess={(shipment) => {
              console.log('✅ Spedizione importata via scanner:', shipment);
              // Real-time aggiornerà automaticamente la lista
              // La spedizione apparirà in tempo reale su tutti i dispositivi
            }}
          />
        )}

        {/* Modal Tracking Spedizione */}
        {showTrackingModal && trackingShipmentId && (
          <TrackingModal
            open={showTrackingModal}
            onOpenChange={setShowTrackingModal}
            shipmentId={trackingShipmentId}
            trackingNumber={trackingNumber || undefined}
            carrier={trackingCarrier || undefined}
          />
        )}
      </div>
    </div>
  );
}
