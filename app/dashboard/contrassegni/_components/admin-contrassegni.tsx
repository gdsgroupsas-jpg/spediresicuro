/**
 * Client Component: Admin Contrassegni (COD Management)
 *
 * Due tab:
 * - Tab 1: Lista Contrassegni (tabella con filtri completi, selezione, crea distinte)
 * - Tab 2: Distinte Contrassegni (upload file, file caricati, distinte, pagamenti)
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  Search,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Euro,
  Printer,
  Trash2,
  FileDown,
  Plus,
  X,
  Calendar,
  AlertTriangle,
  Eye,
  EyeOff,
  MessageSquare,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---- Tipi ----

interface CodItem {
  id: string;
  ldv: string;
  rif_mittente: string | null;
  contrassegno: number;
  pagato: number;
  destinatario: string | null;
  note: string | null;
  data_ldv: string | null;
  shipment_id: string | null;
  client_id: string | null;
  distinta_id: string | null;
  status: string;
  created_at: string;
  shipments: {
    tracking_number: string;
    status: string;
    recipient_name: string;
    user_id: string;
  } | null;
  cod_distinte: {
    number: number;
    status: string;
  } | null;
}

interface CodFile {
  id: string;
  filename: string;
  carrier: string;
  uploaded_at: string;
  total_rows: number;
  processed_rows: number;
  total_cod_file: number;
  total_cod_system: number;
  total_cod_to_pay: number;
  total_cod_paid: number;
  errors: number;
}

interface CodDistinta {
  id: string;
  number: number;
  client_id: string;
  client_name: string;
  created_at: string;
  total_initial: number;
  total_reimbursed: number;
  payment_method: string | null;
  status: string;
  payment_date: string | null;
}

interface ParserOption {
  id: string;
  label: string;
  description: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface CodDispute {
  id: string;
  cod_item_id: string | null;
  cod_file_id: string | null;
  type: string;
  status: string;
  expected_amount: number | null;
  actual_amount: number | null;
  difference: number | null;
  ldv: string | null;
  description: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface DisputeStats {
  open: number;
  resolved: number;
  ignored: number;
  totalDifference: number;
}

// ---- Componente principale ----

export default function AdminContrassegni() {
  const [activeTab, setActiveTab] = useState('lista');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="lista">
            <DollarSign className="w-4 h-4 mr-1.5" />
            Lista Contrassegni
          </TabsTrigger>
          <TabsTrigger value="distinte">
            <FileSpreadsheet className="w-4 h-4 mr-1.5" />
            Distinte Contrassegni
          </TabsTrigger>
          <TabsTrigger value="disputes">
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            Dispute Center
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <ListaContrassegniTab />
        </TabsContent>
        <TabsContent value="distinte">
          <DistinteContrassegniTab />
        </TabsContent>
        <TabsContent value="disputes">
          <DisputeCenterTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Tab 1: Lista Contrassegni ----

interface ForecastData {
  avgPaymentDays: number;
  globalTotal: number;
  nearestPaymentDate: string | null;
  clientCount: number;
  forecasts: Array<{
    clientId: string;
    clientName: string;
    totalPending: number;
    itemCount: number;
    distinteCount: number;
    estimatedPaymentDate: string;
  }>;
}

function ListaContrassegniTab() {
  const [items, setItems] = useState<CodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [showForecast, setShowForecast] = useState(false);

  // Carica lista clienti per il filtro select
  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch('/api/cod/clients');
        const data = await res.json();
        if (data.success) setClients(data.clients);
      } catch {
        // Ignora errore clienti
      }
    }
    fetchClients();
  }, []);

  // Carica forecast
  useEffect(() => {
    async function fetchForecast() {
      try {
        const res = await fetch('/api/cod/forecast');
        const data = await res.json();
        if (data.success) setForecast(data);
      } catch {
        // Ignora errore forecast
      }
    }
    fetchForecast();
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterClientId) params.set('client_id', filterClientId);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('page', String(page));
      params.set('limit', '50');

      const res = await fetch(`/api/cod/items?${params}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Errore caricamento contrassegni:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterClientId, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(
      (i) =>
        i.ldv.toLowerCase().includes(term) ||
        i.destinatario?.toLowerCase().includes(term) ||
        i.rif_mittente?.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const handleCreaDistinte = async () => {
    if (selectedIds.size === 0) return;
    setCreating(true);
    try {
      const res = await fetch('/api/cod/distinte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Distinte create: ${data.totalCreated}`);
        setSelectedIds(new Set());
        fetchItems();
      } else {
        toast.error(`Errore: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'rimborsato':
        return <Badge variant="success">Rimborsato</Badge>;
      case 'assegnato':
        return <Badge variant="warning">Assegnato</Badge>;
      default:
        return <Badge variant="secondary">In attesa</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Forecast */}
      {forecast && forecast.globalTotal > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg shadow-sm border border-orange-200">
          <button
            onClick={() => setShowForecast(!showForecast)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <Euro className="w-5 h-5 text-orange-600" />
              <div>
                <span className="text-sm font-semibold text-gray-900">
                  Previsione Rimborsi: {formatEuro(forecast.globalTotal)}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  {forecast.clientCount} client{forecast.clientCount !== 1 ? 'i' : 'e'}
                  {forecast.nearestPaymentDate && (
                    <>
                      {' '}
                      &middot; prossimo:{' '}
                      {new Date(forecast.nearestPaymentDate).toLocaleDateString('it-IT')}
                    </>
                  )}
                </span>
              </div>
            </div>
            <span className="text-xs text-gray-400">{showForecast ? 'Nascondi' : 'Dettagli'}</span>
          </button>
          {showForecast && (
            <div className="px-4 pb-4">
              <div className="text-xs text-gray-500 mb-2">
                Media storica pagamento: <strong>{forecast.avgPaymentDays} giorni</strong> dalla
                creazione distinta
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="text-left py-1 pr-4">Cliente</th>
                      <th className="text-right py-1 pr-4">Da Rimborsare</th>
                      <th className="text-right py-1 pr-4">Items</th>
                      <th className="text-right py-1 pr-4">Distinte</th>
                      <th className="text-right py-1">Previsto Entro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.forecasts.map((f) => (
                      <tr key={f.clientId} className="border-t border-orange-100">
                        <td className="py-1.5 pr-4 font-medium text-gray-900">{f.clientName}</td>
                        <td className="py-1.5 pr-4 text-right font-semibold text-orange-700">
                          {formatEuro(f.totalPending)}
                        </td>
                        <td className="py-1.5 pr-4 text-right text-gray-600">{f.itemCount}</td>
                        <td className="py-1.5 pr-4 text-right text-gray-600">{f.distinteCount}</td>
                        <td className="py-1.5 text-right text-gray-600">
                          {new Date(f.estimatedPaymentDate).toLocaleDateString('it-IT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col gap-4">
          {/* Riga 1: Ricerca + Stato COD */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cerca per LDV, mittente, destinatario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Stato contrassegno: Tutti</option>
              <option value="in_attesa">In attesa</option>
              <option value="assegnato">Assegnato</option>
              <option value="rimborsato">Rimborsato</option>
            </select>
          </div>
          {/* Riga 2: Cliente + Data range */}
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={filterClientId}
              onChange={(e) => {
                setFilterClientId(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Cliente: Tutti</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                placeholder="Da"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                placeholder="A"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Azioni selezione */}
      {selectedIds.size > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-orange-800">
            {selectedIds.size} contrassegn{selectedIds.size === 1 ? 'o' : 'i'} selezionat
            {selectedIds.size === 1 ? 'o' : 'i'}
          </span>
          <button
            onClick={handleCreaDistinte}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {creating ? 'Creazione...' : 'Crea Distinte'}
          </button>
        </div>
      )}

      {/* Tabella */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500">Caricamento...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun contrassegno</h3>
          <p className="text-gray-500">Carica un file contrassegni dalla tab Distinte.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === filteredItems.length && filteredItems.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    N.Spedizione
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Mittente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Destinatario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Contrassegno
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stato spedizione
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    N.Distinta
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stato COD
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Aggiornamento
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={cn('hover:bg-gray-50', selectedIds.has(item.id) && 'bg-orange-50')}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{item.ldv}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.rif_mittente || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{item.destinatario || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {item.data_ldv ? new Date(item.data_ldv).toLocaleDateString('it-IT') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      <span className="inline-flex items-center gap-1">
                        <Euro className="w-3 h-3" />
                        {item.pagato?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.shipments ? (
                        <Badge
                          variant={item.shipments.status === 'delivered' ? 'success' : 'secondary'}
                        >
                          {item.shipments.status === 'delivered'
                            ? 'Consegnata'
                            : item.shipments.status}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.cod_distinte ? `#${item.cod_distinte.number}` : '-'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleDateString('it-IT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginazione */}
          {total > 50 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-700">
                Pagina {page} di {Math.ceil(total / 50)} ({total} totali)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Precedente
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / 50)}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Successiva
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Tab 2: Distinte Contrassegni ----

function DistinteContrassegniTab() {
  const [files, setFiles] = useState<CodFile[]>([]);
  const [distinte, setDistinte] = useState<CodDistinta[]>([]);
  const [parsers, setParsers] = useState<ParserOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload state
  const [selectedParser, setSelectedParser] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Dialog pagamento
  const [payDialog, setPayDialog] = useState<CodDistinta | null>(null);
  const [payMethod, setPayMethod] = useState('');
  const [paying, setPaying] = useState(false);

  // Dialog conferma eliminazione
  const [deleteDialog, setDeleteDialog] = useState<CodDistinta | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, distinteRes, parsersRes] = await Promise.all([
        fetch('/api/cod/files'),
        fetch('/api/cod/distinte'),
        fetch('/api/cod/parsers'),
      ]);
      const [filesData, distinteData, parsersData] = await Promise.all([
        filesRes.json(),
        distinteRes.json(),
        parsersRes.json(),
      ]);

      if (filesData.success) setFiles(filesData.files);
      if (distinteData.success) setDistinte(distinteData.distinte);
      if (parsersData.success) {
        setParsers(parsersData.parsers);
        if (parsersData.parsers.length > 0 && !selectedParser) {
          setSelectedParser(parsersData.parsers[0].id);
        }
      }
    } catch (err) {
      console.error('Errore caricamento dati:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async () => {
    if (!uploadFile || !selectedParser) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('carrier', selectedParser);

      const res = await fetch('/api/cod/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        toast.success(`File caricato: ${data.totalRows} righe, ${data.processedRows} matchate`, {
          description: data.errors.length > 0 ? `${data.errors.length} errori` : undefined,
        });
        // Alert discrepanza importo file vs sistema
        if (data.discrepancy?.alert) {
          toast.warning(
            `Discrepanza importi rilevata: differenza di €${data.discrepancy.difference.toFixed(2)}`,
            {
              description: `File: €${data.discrepancy.fileTotalCod.toFixed(2)} — Sistema: €${data.discrepancy.systemTotalCod.toFixed(2)}`,
              duration: 10000,
            }
          );
        }
        setUploadFile(null);
        fetchData();
      } else {
        toast.error(`Errore: ${data.error}`, {
          description: (data.details || []).slice(0, 3).join(', '),
        });
      }
    } catch (err: any) {
      toast.error(`Errore upload: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setUploadFile(file);
  };

  const handlePayDistinta = async () => {
    if (!payDialog || !payMethod) return;
    setPaying(true);
    try {
      const res = await fetch('/api/cod/distinte', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: payDialog.id, payment_method: payMethod }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Distinta #${payDialog.number} segnata come pagata`);
        setPayDialog(null);
        setPayMethod('');
        fetchData();
      } else {
        toast.error(`Errore: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteDistinta = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cod/distinte?id=${deleteDialog.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Distinta #${deleteDialog.number} eliminata`);
        setDeleteDialog(null);
        fetchData();
      } else {
        toast.error(`Errore: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleExportExcel = async (distinta: CodDistinta) => {
    try {
      const res = await fetch(`/api/cod/distinte/export?id=${distinta.id}`);
      if (!res.ok) {
        toast.error('Errore export');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `distinta_${distinta.number}_${distinta.client_name.replace(/\s+/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel scaricato');
    } catch (err: any) {
      toast.error(`Errore export: ${err.message}`);
    }
  };

  const handlePrintDistinta = (distinta: CodDistinta) => {
    // Apri finestra di stampa con dettagli distinta
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Distinta #${distinta.number}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}
      th{background:#f5f5f5}h1{font-size:18px}
      .meta{color:#666;font-size:14px;margin:4px 0}</style></head><body>
      <h1>Distinta Contrassegno #${distinta.number}</h1>
      <p class="meta">Cliente: ${distinta.client_name}</p>
      <p class="meta">Data: ${new Date(distinta.created_at).toLocaleDateString('it-IT')}</p>
      <p class="meta">Totale: ${formatEuro(distinta.total_initial)}</p>
      <p class="meta">Stato: ${distinta.status === 'pagata' ? 'Pagata' : 'In lavorazione'}</p>
      ${distinta.payment_method ? `<p class="meta">Metodo: ${distinta.payment_method}</p>` : ''}
      ${distinta.payment_date ? `<p class="meta">Data pagamento: ${new Date(distinta.payment_date).toLocaleDateString('it-IT')}</p>` : ''}
      <script>window.print();window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <p className="text-gray-500">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sezione Upload */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Carica file contrassegni</h3>
        <div className="flex flex-col sm:flex-row gap-4">
          <select
            value={selectedParser}
            onChange={(e) => setSelectedParser(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
          >
            {parsers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
              dragOver ? 'border-orange-500 bg-orange-50' : 'border-gray-300 hover:border-gray-400'
            )}
            onClick={() => document.getElementById('cod-file-input')?.click()}
          >
            {uploadFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-orange-600" />
                <span className="text-sm font-medium text-gray-900">{uploadFile.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadFile(null);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-gray-500">
                <Upload className="w-5 h-5" />
                <span className="text-sm">Trascina un file Excel/CSV o clicca per selezionare</span>
              </div>
            )}
            <input
              id="cod-file-input"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setUploadFile(f);
                e.target.value = '';
              }}
            />
          </div>

          <button
            onClick={handleUpload}
            disabled={!uploadFile || !selectedParser || uploading}
            className="inline-flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Caricamento...' : 'Carica'}
          </button>
        </div>
      </div>

      {/* Tabella file caricati */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">File caricati</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    File
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Righe
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Processate
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    COD file
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    COD sistema
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    COD da pagare
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    COD pagato
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Errori
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{f.filename}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(f.uploaded_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{f.total_rows}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {f.processed_rows}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatEuro(f.total_cod_file)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatEuro(f.total_cod_system)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatEuro(f.total_cod_to_pay)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                      {formatEuro(f.total_cod_paid)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {f.errors > 0 ? (
                        <Badge variant="error">{f.errors}</Badge>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabella Distinte */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Distinte contrassegni</h3>
        </div>
        {distinte.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p>Nessuna distinta. Seleziona contrassegni dalla tab Lista e crea distinte.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Nr
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data creazione
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Totale iniziale
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Totale rimborsati
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Metodo pagamento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data pagamento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {distinte.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">#{d.number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{d.client_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(d.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatEuro(d.total_initial)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {formatEuro(d.total_reimbursed)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                      {d.payment_method || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {d.status === 'pagata' ? (
                        <Badge variant="success">Pagata</Badge>
                      ) : (
                        <Badge variant="warning">In lavorazione</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {d.payment_date ? new Date(d.payment_date).toLocaleDateString('it-IT') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {d.status !== 'pagata' && (
                          <button
                            onClick={() => {
                              setPayDialog(d);
                              setPayMethod('');
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Segna come pagata"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintDistinta(d)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                          title="Stampa"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExportExcel(d)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Esporta Excel"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteDialog(d)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                          title="Elimina"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Dialog Conferma Pagamento */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent onClose={() => setPayDialog(null)}>
          <DialogHeader>
            <DialogTitle>Conferma pagamento distinta</DialogTitle>
            <DialogDescription>
              Distinta #{payDialog?.number} - {payDialog?.client_name}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Totale distinta:</span>
                  <span className="font-semibold">{formatEuro(payDialog?.total_initial || 0)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo pagamento
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Seleziona...</option>
                  <option value="assegno">Assegno</option>
                  <option value="sepa">SEPA</option>
                  <option value="contanti">Contanti</option>
                  <option value="compensata">Compensata</option>
                </select>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <button
              onClick={() => setPayDialog(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Chiudi
            </button>
            <button
              onClick={handlePayDistinta}
              disabled={!payMethod || paying}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {paying ? 'Conferma...' : 'Conferma'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Conferma Eliminazione */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent onClose={() => setDeleteDialog(null)}>
          <DialogHeader>
            <DialogTitle>Elimina distinta</DialogTitle>
            <DialogDescription>
              Vuoi eliminare la distinta #{deleteDialog?.number} di {deleteDialog?.client_name}? I
              contrassegni torneranno disponibili.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteDialog(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annulla
            </button>
            <button
              onClick={handleDeleteDistinta}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? 'Eliminazione...' : 'Elimina'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Tab 3: Dispute Center ----

function DisputeCenterTab() {
  const [disputes, setDisputes] = useState<CodDispute[]>([]);
  const [stats, setStats] = useState<DisputeStats>({
    open: 0,
    resolved: 0,
    ignored: 0,
    totalDifference: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('aperta');
  const [resolveDialog, setResolveDialog] = useState<CodDispute | null>(null);
  const [resolveAction, setResolveAction] = useState<'risolta' | 'ignorata'>('risolta');
  const [resolveNote, setResolveNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/cod/disputes?${params}`);
      const data = await res.json();
      if (data.success) {
        setDisputes(data.disputes);
        setStats(data.stats);
      }
    } catch (err: any) {
      toast.error(`Errore caricamento disputes: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleResolve = async () => {
    if (!resolveDialog) return;
    setResolving(true);
    try {
      const res = await fetch('/api/cod/disputes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resolveDialog.id,
          status: resolveAction,
          resolution_note: resolveNote || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(resolveAction === 'risolta' ? 'Dispute risolta' : 'Dispute ignorata');
        setResolveDialog(null);
        setResolveNote('');
        fetchDisputes();
      } else {
        toast.error(data.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResolving(false);
    }
  };

  const typeLabel: Record<string, string> = {
    importo_diverso: 'Importo Diverso',
    non_trovato: 'Non Trovato',
    duplicato: 'Duplicato',
    altro: 'Altro',
  };

  const typeBadgeColor: Record<string, string> = {
    importo_diverso: 'bg-yellow-100 text-yellow-800',
    non_trovato: 'bg-red-100 text-red-800',
    duplicato: 'bg-purple-100 text-purple-800',
    altro: 'bg-gray-100 text-gray-800',
  };

  const statusBadgeColor: Record<string, string> = {
    aperta: 'bg-red-100 text-red-800',
    risolta: 'bg-green-100 text-green-800',
    ignorata: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
          <p className="text-sm text-gray-600">Aperte</p>
          <p className="text-2xl font-bold text-red-600">{stats.open}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
          <p className="text-sm text-gray-600">Differenza Totale</p>
          <p className="text-2xl font-bold text-yellow-600">{formatEuro(stats.totalDifference)}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
          <p className="text-sm text-gray-600">Risolte</p>
          <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-400">
          <p className="text-sm text-gray-600">Ignorate</p>
          <p className="text-2xl font-bold text-gray-600">{stats.ignored}</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex gap-2">
          {['aperta', 'risolta', 'ignorata', ''].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filterStatus === s
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {s === ''
                ? 'Tutte'
                : s === 'aperta'
                  ? 'Aperte'
                  : s === 'risolta'
                    ? 'Risolte'
                    : 'Ignorate'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabella */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
          Caricamento...
        </div>
      ) : disputes.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessuna dispute</h3>
          <p className="text-gray-500">
            {filterStatus === 'aperta'
              ? 'Nessuna discrepanza aperta da risolvere.'
              : 'Nessuna dispute trovata per i filtri selezionati.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    LDV
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Atteso
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Effettivo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Differenza
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stato
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {disputes.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">{d.ldv || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                          typeBadgeColor[d.type] || 'bg-gray-100 text-gray-800'
                        )}
                      >
                        {typeLabel[d.type] || d.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {d.expected_amount != null ? formatEuro(d.expected_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {d.actual_amount != null ? formatEuro(d.actual_amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold">
                      {d.difference != null ? (
                        <span
                          className={
                            d.difference > 0
                              ? 'text-green-600'
                              : d.difference < 0
                                ? 'text-red-600'
                                : 'text-gray-500'
                          }
                        >
                          {d.difference > 0 ? '+' : ''}
                          {formatEuro(d.difference)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                          statusBadgeColor[d.status] || 'bg-gray-100 text-gray-800'
                        )}
                      >
                        {d.status === 'aperta'
                          ? 'Aperta'
                          : d.status === 'risolta'
                            ? 'Risolta'
                            : 'Ignorata'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(d.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3">
                      {d.status === 'aperta' ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setResolveDialog(d);
                              setResolveAction('risolta');
                              setResolveNote('');
                            }}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Risolvi"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setResolveDialog(d);
                              setResolveAction('ignorata');
                              setResolveNote('');
                            }}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                            title="Ignora"
                          >
                            <EyeOff className="w-4 h-4" />
                          </button>
                        </div>
                      ) : d.resolution_note ? (
                        <button
                          onClick={() => toast.info(d.resolution_note || '')}
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                          title="Vedi nota"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={!!resolveDialog} onOpenChange={(open) => !open && setResolveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveAction === 'risolta' ? 'Risolvi Dispute' : 'Ignora Dispute'}
            </DialogTitle>
            <DialogDescription>
              {resolveDialog?.description || `LDV: ${resolveDialog?.ldv || '-'}`}
              {resolveDialog?.difference != null && (
                <span className="block mt-1 font-semibold">
                  Differenza: {formatEuro(resolveDialog.difference)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nota di risoluzione (opzionale)
              </label>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder={
                  resolveAction === 'risolta' ? 'Come è stata risolta...' : 'Motivo per ignorare...'
                }
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <button
              onClick={() => setResolveDialog(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annulla
            </button>
            <button
              onClick={handleResolve}
              disabled={resolving}
              className={cn(
                'px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50',
                resolveAction === 'risolta'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gray-600 hover:bg-gray-700'
              )}
            >
              {resolving ? 'Elaborazione...' : resolveAction === 'risolta' ? 'Risolvi' : 'Ignora'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Helpers ----

function formatEuro(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}
