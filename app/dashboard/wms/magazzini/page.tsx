'use client';

/**
 * WMS: Gestione Magazzini & Giacenze
 *
 * Lista magazzini, giacenze per magazzino, movimenti stock.
 * Azione carico/scarico/rettifica via dialog.
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
  Warehouse,
  Package,
  Plus,
  Loader2,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ChevronDown,
} from 'lucide-react';

interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  type: string;
  city?: string;
  active: boolean;
}

interface InventoryItem {
  id: string;
  quantity_available: number;
  quantity_reserved: number;
  quantity_on_order: number;
  reorder_point: number;
  product?: { id: string; sku: string; name: string };
  warehouse?: { id: string; code: string; name: string };
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  notes?: string;
  movement_date: string;
  product?: { id: string; sku: string; name: string };
  warehouse?: { id: string; code: string; name: string };
}

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  inbound: 'Carico',
  outbound: 'Scarico',
  adjustment: 'Rettifica',
  transfer: 'Trasferimento',
};

const MOVEMENT_TYPE_COLOR: Record<string, string> = {
  inbound: 'bg-green-100 text-green-700',
  outbound: 'bg-red-100 text-red-700',
  adjustment: 'bg-yellow-100 text-yellow-700',
  transfer: 'bg-blue-100 text-blue-700',
};

export default function MagazziniPage() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.workspace_id;

  // Tabs: warehouses | inventory | movements
  const [tab, setTab] = useState<'warehouses' | 'inventory' | 'movements'>('inventory');
  const [loading, setLoading] = useState(true);

  // Warehouses
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');

  // Inventory
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [invOffset, setInvOffset] = useState(0);

  // Movements
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movTotal, setMovTotal] = useState(0);
  const [movOffset, setMovOffset] = useState(0);

  // Stock update dialog
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [stockForm, setStockForm] = useState({
    product_id: '',
    warehouse_id: '',
    quantity: '',
    type: 'inbound' as 'inbound' | 'outbound' | 'adjustment',
    notes: '',
  });
  const [savingStock, setSavingStock] = useState(false);

  // Create warehouse dialog
  const [showWHDialog, setShowWHDialog] = useState(false);
  const [whForm, setWhForm] = useState({ code: '', name: '', type: 'standard', city: '' });
  const [savingWH, setSavingWH] = useState(false);

  const LIMIT = 50;

  // ─── Fetch warehouses ───

  const fetchWarehouses = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/warehouses`);
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.warehouses || []);
      }
    } catch {
      // Silenzioso
    }
  }, [workspaceId]);

  // ─── Fetch inventory ───

  const fetchInventory = useCallback(
    async (warehouseId?: string, newOffset = 0) => {
      if (!workspaceId) return;
      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('limit', LIMIT.toString());
        params.set('offset', newOffset.toString());
        if (warehouseId) params.set('warehouse_id', warehouseId);

        const res = await fetch(`/api/workspaces/${workspaceId}/inventory?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (newOffset > 0) {
            setInventory((prev) => [...prev, ...data.inventory]);
          } else {
            setInventory(data.inventory || []);
          }
          setInvTotal(data.total || 0);
        }
      } catch {
        // Silenzioso
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  // ─── Fetch movements ───

  const fetchMovements = useCallback(
    async (warehouseId?: string, newOffset = 0) => {
      if (!workspaceId) return;
      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('view', 'movements');
        params.set('limit', LIMIT.toString());
        params.set('offset', newOffset.toString());
        if (warehouseId) params.set('warehouse_id', warehouseId);

        const res = await fetch(`/api/workspaces/${workspaceId}/inventory?${params}`);
        if (res.ok) {
          const data = await res.json();
          if (newOffset > 0) {
            setMovements((prev) => [...prev, ...data.movements]);
          } else {
            setMovements(data.movements || []);
          }
          setMovTotal(data.total || 0);
        }
      } catch {
        // Silenzioso
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  // ─── Effects ───

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    if (tab === 'inventory') {
      setInvOffset(0);
      fetchInventory(selectedWarehouse, 0);
    } else if (tab === 'movements') {
      setMovOffset(0);
      fetchMovements(selectedWarehouse, 0);
    } else {
      setLoading(false);
    }
  }, [tab, selectedWarehouse, fetchInventory, fetchMovements]);

  // ─── Stock update ───

  const handleStockUpdate = async () => {
    if (!workspaceId) return;
    setSavingStock(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: stockForm.product_id,
          warehouse_id: stockForm.warehouse_id,
          quantity: parseFloat(stockForm.quantity),
          type: stockForm.type,
          notes: stockForm.notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore aggiornamento stock');
      }

      setShowStockDialog(false);
      setStockForm({ product_id: '', warehouse_id: '', quantity: '', type: 'inbound', notes: '' });
      fetchInventory(selectedWarehouse, 0);
      fetchMovements(selectedWarehouse, 0);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingStock(false);
    }
  };

  // ─── Create warehouse ───

  const handleCreateWarehouse = async () => {
    if (!workspaceId) return;
    setSavingWH(true);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/warehouses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(whForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore creazione magazzino');
      }

      setShowWHDialog(false);
      setWhForm({ code: '', name: '', type: 'standard', city: '' });
      fetchWarehouses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingWH(false);
    }
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Magazzini & Giacenze</h1>
            <p className="text-sm text-gray-500 mt-1">{warehouses.length} magazzini attivi</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowWHDialog(true)}>
              <Warehouse className="h-4 w-4 mr-1.5" />
              Nuovo Magazzino
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => setShowStockDialog(true)}
            >
              <ArrowUpDown className="h-4 w-4 mr-1.5" />
              Movimento Stock
            </Button>
          </div>
        </div>

        {/* Tabs + Warehouse filter */}
        <Card className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-1">
              {(['inventory', 'movements', 'warehouses'] as const).map((t) => (
                <Button
                  key={t}
                  variant={tab === t ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTab(t)}
                  className={tab === t ? 'bg-orange-500 text-white hover:bg-orange-600' : ''}
                >
                  {t === 'inventory' ? 'Giacenze' : t === 'movements' ? 'Movimenti' : 'Magazzini'}
                </Button>
              ))}
            </div>
            {tab !== 'warehouses' && (
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="px-3 py-1.5 border rounded-md text-sm bg-white"
              >
                <option value="">Tutti i magazzini</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </Card>

        {/* Tab content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : tab === 'warehouses' ? (
          /* Warehouses list */
          warehouses.length === 0 ? (
            <Card className="p-12 text-center">
              <Warehouse className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nessun magazzino configurato</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowWHDialog(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Crea il primo magazzino
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouses.map((w) => (
                <Card key={w.id} className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-blue-100">
                      <Warehouse className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">{w.code}</p>
                      <p className="font-medium">{w.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {w.type}
                    </Badge>
                    {w.city && <span className="text-xs text-gray-500">{w.city}</span>}
                  </div>
                </Card>
              ))}
            </div>
          )
        ) : tab === 'inventory' ? (
          /* Inventory table */
          inventory.length === 0 ? (
            <Card className="p-12 text-center">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nessuna giacenza registrata</p>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Prodotto</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Magazzino</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">
                        Disponibile
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Riservato</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">In Ordine</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">
                        Punto Riordino
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inventory.map((inv) => {
                      const isLow =
                        inv.reorder_point > 0 && inv.quantity_available <= inv.reorder_point;
                      return (
                        <tr
                          key={inv.id}
                          className={`hover:bg-gray-50/50 ${isLow ? 'bg-red-50/30' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs text-gray-500">{inv.product?.sku}</p>
                            <p className="text-sm">{inv.product?.name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {inv.warehouse?.code}
                            </Badge>
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-medium ${isLow ? 'text-red-600' : ''}`}
                          >
                            {inv.quantity_available}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">
                            {inv.quantity_reserved}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">
                            {inv.quantity_on_order}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500">
                            {inv.reorder_point}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              {inventory.length < invTotal && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newOffset = invOffset + LIMIT;
                      setInvOffset(newOffset);
                      fetchInventory(selectedWarehouse, newOffset);
                    }}
                  >
                    <ChevronDown className="h-4 w-4 mr-1.5" />
                    Carica altri
                  </Button>
                </div>
              )}
            </>
          )
        ) : /* Movements table */
        movements.length === 0 ? (
          <Card className="p-12 text-center">
            <ArrowUpDown className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nessun movimento registrato</p>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Prodotto</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Magazzino</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">
                      Quantit&agrave;
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(m.movement_date).toLocaleString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={MOVEMENT_TYPE_COLOR[m.type] || 'bg-gray-100 text-gray-600'}
                        >
                          {MOVEMENT_TYPE_LABEL[m.type] || m.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{m.product?.sku}</span>
                        <span className="text-gray-500 ml-1.5">{m.product?.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {m.warehouse?.code}
                        </Badge>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono font-medium ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}
                      >
                        {m.quantity > 0 ? '+' : ''}
                        {m.quantity}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">
                        {m.notes || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {movements.length < movTotal && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    const newOffset = movOffset + LIMIT;
                    setMovOffset(newOffset);
                    fetchMovements(selectedWarehouse, newOffset);
                  }}
                >
                  <ChevronDown className="h-4 w-4 mr-1.5" />
                  Carica altri
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── Stock Update Dialog ─── */}
      <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Movimento Stock</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600">Tipo movimento</label>
              <select
                value={stockForm.type}
                onChange={(e) => setStockForm({ ...stockForm, type: e.target.value as any })}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white"
              >
                <option value="inbound">Carico (+)</option>
                <option value="outbound">Scarico (-)</option>
                <option value="adjustment">Rettifica</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Magazzino</label>
              <select
                value={stockForm.warehouse_id}
                onChange={(e) => setStockForm({ ...stockForm, warehouse_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white"
              >
                <option value="">Seleziona magazzino...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">ID Prodotto (UUID)</label>
              <Input
                value={stockForm.product_id}
                onChange={(e) => setStockForm({ ...stockForm, product_id: e.target.value })}
                placeholder="UUID del prodotto"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Quantit&agrave;</label>
              <Input
                type="number"
                value={stockForm.quantity}
                onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                placeholder="es: 10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Note</label>
              <Input
                value={stockForm.notes}
                onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                placeholder="Note opzionali"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStockDialog(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleStockUpdate}
              disabled={
                savingStock ||
                !stockForm.product_id ||
                !stockForm.warehouse_id ||
                !stockForm.quantity
              }
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {savingStock ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Conferma Movimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Warehouse Dialog ─── */}
      <Dialog open={showWHDialog} onOpenChange={setShowWHDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Magazzino</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Codice *</label>
                <Input
                  value={whForm.code}
                  onChange={(e) => setWhForm({ ...whForm, code: e.target.value })}
                  placeholder="MAG01"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Tipo</label>
                <select
                  value={whForm.type}
                  onChange={(e) => setWhForm({ ...whForm, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                >
                  <option value="standard">Standard</option>
                  <option value="transit">Transito</option>
                  <option value="returns">Resi</option>
                  <option value="dropship">Dropship</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Nome *</label>
              <Input
                value={whForm.name}
                onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                placeholder="Magazzino Principale"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Citt&agrave;</label>
              <Input
                value={whForm.city}
                onChange={(e) => setWhForm({ ...whForm, city: e.target.value })}
                placeholder="es: Milano"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWHDialog(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleCreateWarehouse}
              disabled={savingWH || !whForm.code.trim() || !whForm.name.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {savingWH ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Crea Magazzino
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
