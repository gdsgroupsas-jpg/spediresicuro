'use client';

/**
 * WMS: Ordini Fornitore (Purchase Orders)
 *
 * Lista ordini, creazione, cambio stato.
 */

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import DashboardNav from '@/components/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText,
  Plus,
  Loader2,
  ChevronDown,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Package,
} from 'lucide-react';

interface PurchaseOrder {
  id: string;
  order_number: string;
  status: string;
  order_date: string;
  expected_delivery_date?: string;
  received_date?: string;
  supplier?: { id: string; name: string; code?: string };
  subtotal: number;
  total: number;
  notes?: string;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
  code?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Bozza', color: 'bg-gray-100 text-gray-600', icon: Clock },
  confirmed: { label: 'Confermato', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  shipped: { label: 'Spedito', color: 'bg-purple-100 text-purple-700', icon: Truck },
  partial: { label: 'Parziale', color: 'bg-yellow-100 text-yellow-700', icon: Package },
  received: { label: 'Ricevuto', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Annullato', color: 'bg-red-100 text-red-600', icon: XCircle },
};

const LIMIT = 50;

export default function OrdiniFornitore() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.workspace_id;

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [offset, setOffset] = useState(0);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    supplier_id: '',
    order_number: '',
    expected_delivery_date: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Status update
  const [statusOrder, setStatusOrder] = useState<PurchaseOrder | null>(null);
  const [newStatus, setNewStatus] = useState('');

  // ─── Fetch ───

  const fetchOrders = useCallback(
    async (status?: string, newOffset = 0) => {
      if (!workspaceId) return;
      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('limit', LIMIT.toString());
        params.set('offset', newOffset.toString());
        if (status) params.set('status', status);

        const res = await fetch(`/api/workspaces/${workspaceId}/purchase-orders?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (newOffset > 0) {
            setOrders((prev) => [...prev, ...data.orders]);
          } else {
            setOrders(data.orders || []);
          }
          setTotal(data.total || 0);
        }
      } catch {
        // Silenzioso
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  const fetchSuppliers = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/suppliers`);
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch {
      // Silenzioso
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchOrders(filterStatus, 0);
    fetchSuppliers();
  }, [fetchOrders, fetchSuppliers, filterStatus]);

  // ─── Create order ───

  const handleCreate = async () => {
    if (!workspaceId) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: createForm.supplier_id,
          order_number: createForm.order_number.trim(),
          expected_delivery_date: createForm.expected_delivery_date || undefined,
          notes: createForm.notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore creazione ordine');
      }

      setShowCreate(false);
      setCreateForm({ supplier_id: '', order_number: '', expected_delivery_date: '', notes: '' });
      setOffset(0);
      fetchOrders(filterStatus, 0);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Update status ───

  const handleStatusUpdate = async () => {
    if (!workspaceId || !statusOrder || !newStatus) return;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/purchase-orders/${statusOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore aggiornamento stato');
      }

      setStatusOrder(null);
      setNewStatus('');
      fetchOrders(filterStatus, 0);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ─── Render ───

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <DashboardNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <p className="text-gray-500">Seleziona un workspace.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ordini Fornitore</h1>
            <p className="text-sm text-gray-500 mt-1">{total} ordini totali</p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Nuovo Ordine
          </Button>
        </div>

        {/* Filter bar */}
        <Card className="p-3">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filterStatus === '' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                setFilterStatus('');
                setOffset(0);
              }}
              className={filterStatus === '' ? 'bg-orange-500 text-white hover:bg-orange-600' : ''}
            >
              Tutti
            </Button>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <Button
                key={key}
                variant={filterStatus === key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  setFilterStatus(key);
                  setOffset(0);
                }}
                className={
                  filterStatus === key ? 'bg-orange-500 text-white hover:bg-orange-600' : ''
                }
              >
                {cfg.label}
              </Button>
            ))}
          </div>
        </Card>

        {/* Orders table */}
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : orders.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nessun ordine fornitore trovato</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Crea il primo ordine
            </Button>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">N. Ordine</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fornitore</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Consegna Prevista
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Totale</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => {
                    const cfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.draft;
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono font-medium">{o.order_number}</td>
                        <td className="px-4 py-3">{o.supplier?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge className={cfg.color}>{cfg.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(o.order_date).toLocaleDateString('it-IT')}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {o.expected_delivery_date
                            ? new Date(o.expected_delivery_date).toLocaleDateString('it-IT')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency(o.total)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setStatusOrder(o);
                              setNewStatus('');
                            }}
                          >
                            Cambia stato
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>

            {orders.length < total && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    const newOffset = offset + LIMIT;
                    setOffset(newOffset);
                    fetchOrders(filterStatus, newOffset);
                  }}
                >
                  <ChevronDown className="h-4 w-4 mr-1.5" />
                  Carica altri ({total - orders.length} rimanenti)
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── Create Order Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Ordine Fornitore</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600">Fornitore *</label>
              <select
                value={createForm.supplier_id}
                onChange={(e) => setCreateForm({ ...createForm, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white"
              >
                <option value="">Seleziona fornitore...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `${s.code} — ` : ''}
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Numero Ordine *</label>
              <Input
                value={createForm.order_number}
                onChange={(e) => setCreateForm({ ...createForm, order_number: e.target.value })}
                placeholder="es: PO-2026-001"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Data Consegna Prevista</label>
              <Input
                type="date"
                value={createForm.expected_delivery_date}
                onChange={(e) =>
                  setCreateForm({ ...createForm, expected_delivery_date: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Note</label>
              <Input
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                placeholder="Note opzionali"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !createForm.supplier_id || !createForm.order_number.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Crea Ordine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Status Update Dialog ─── */}
      <Dialog open={!!statusOrder} onOpenChange={(open) => !open && setStatusOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambia Stato Ordine</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-gray-600">
              Ordine <strong>{statusOrder?.order_number}</strong> — stato attuale:{' '}
              <Badge className={STATUS_CONFIG[statusOrder?.status || 'draft']?.color}>
                {STATUS_CONFIG[statusOrder?.status || 'draft']?.label}
              </Badge>
            </p>
            <div>
              <label className="text-xs font-medium text-gray-600">Nuovo stato</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white"
              >
                <option value="">Seleziona...</option>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOrder(null)}>
              Annulla
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={!newStatus || newStatus === statusOrder?.status}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Aggiorna Stato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
