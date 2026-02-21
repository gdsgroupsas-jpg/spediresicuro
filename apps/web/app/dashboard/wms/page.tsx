'use client';

/**
 * Dashboard WMS — Panoramica magazzino
 *
 * Overview con: stock value, prodotti sotto-scorta, movimenti recenti
 */

import { useCallback, useEffect, useState } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import DashboardNav from '@/components/dashboard-nav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  Warehouse,
  TrendingDown,
  ArrowUpDown,
  Loader2,
  AlertTriangle,
  Plus,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface StockValue {
  cost_value: number;
  retail_value: number;
}

interface LowStockItem {
  id: string;
  quantity_available: number;
  reorder_point: number;
  product?: { id: string; sku: string; name: string };
  warehouse?: { id: string; code: string; name: string };
}

interface Movement {
  id: string;
  type: string;
  quantity: number;
  movement_date: string;
  product?: { id: string; sku: string; name: string };
  warehouse?: { id: string; code: string; name: string };
}

export default function WMSDashboardPage() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.workspace_id;

  const [loading, setLoading] = useState(true);
  const [stockValue, setStockValue] = useState<StockValue>({ cost_value: 0, retail_value: 0 });
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [recentMovements, setRecentMovements] = useState<Movement[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [warehouseCount, setWarehouseCount] = useState(0);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    try {
      const [valueRes, lowStockRes, movementsRes, productsRes, warehousesRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/inventory?view=value`),
        fetch(`/api/workspaces/${workspaceId}/inventory?view=low-stock`),
        fetch(`/api/workspaces/${workspaceId}/inventory?view=movements&limit=10`),
        fetch(`/api/workspaces/${workspaceId}/products?limit=1`),
        fetch(`/api/workspaces/${workspaceId}/warehouses`),
      ]);

      if (valueRes.ok) {
        const data = await valueRes.json();
        setStockValue(data);
      }

      if (lowStockRes.ok) {
        const data = await lowStockRes.json();
        setLowStockItems(data.products || []);
      }

      if (movementsRes.ok) {
        const data = await movementsRes.json();
        setRecentMovements(data.movements || []);
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProductCount(data.total || 0);
      }

      if (warehousesRes.ok) {
        const data = await warehousesRes.json();
        setWarehouseCount(data.warehouses?.length || 0);
      }
    } catch {
      // Errori gestiti silenziosamente, i componenti mostrano dati vuoti
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <DashboardNav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <p className="text-gray-500">Seleziona un workspace per visualizzare il magazzino.</p>
        </main>
      </div>
    );
  }

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);

  const movementTypeLabel: Record<string, string> = {
    inbound: 'Carico',
    outbound: 'Scarico',
    adjustment: 'Rettifica',
    transfer: 'Trasferimento',
    reservation: 'Prenotazione',
    release: 'Rilascio',
  };

  const movementTypeColor: Record<string, string> = {
    inbound: 'bg-green-100 text-green-700',
    outbound: 'bg-red-100 text-red-700',
    adjustment: 'bg-yellow-100 text-yellow-700',
    transfer: 'bg-blue-100 text-blue-700',
    reservation: 'bg-purple-100 text-purple-700',
    release: 'bg-cyan-100 text-cyan-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Magazzino</h1>
            <p className="text-sm text-gray-500 mt-1">
              Panoramica WMS — prodotti, giacenze, ordini
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/wms/prodotti">
              <Button variant="outline" size="sm">
                <Package className="h-4 w-4 mr-1.5" />
                Prodotti
              </Button>
            </Link>
            <Link href="/dashboard/wms/ordini-fornitore">
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                <Plus className="h-4 w-4 mr-1.5" />
                Ordine Fornitore
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Prodotti</p>
                    <p className="text-xl font-bold">{productCount}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Warehouse className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Magazzini</p>
                    <p className="text-xl font-bold">{warehouseCount}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <TrendingDown className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Valore Stock (Costo)</p>
                    <p className="text-xl font-bold">{formatCurrency(stockValue.cost_value)}</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <ArrowUpDown className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Valore Stock (Vendita)</p>
                    <p className="text-xl font-bold">{formatCurrency(stockValue.retail_value)}</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Sotto-scorta Alert */}
            {lowStockItems.length > 0 && (
              <Card className="p-4 border-orange-200 bg-orange-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <h2 className="font-semibold text-orange-800">
                    Prodotti sotto-scorta ({lowStockItems.length})
                  </h2>
                </div>
                <div className="space-y-2">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{item.product?.sku}</span>
                        <span className="text-gray-500 ml-2">{item.product?.name}</span>
                        {item.warehouse && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {item.warehouse.code}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-red-600 font-medium">{item.quantity_available}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className="text-gray-500">{item.reorder_point}</span>
                      </div>
                    </div>
                  ))}
                  {lowStockItems.length > 5 && (
                    <Link
                      href="/dashboard/wms/magazzini"
                      className="text-orange-600 text-sm font-medium flex items-center gap-1 hover:underline"
                    >
                      Vedi tutti <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </Card>
            )}

            {/* Movimenti recenti */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-800">Movimenti Recenti</h2>
                <Link href="/dashboard/wms/magazzini">
                  <Button variant="ghost" size="sm">
                    Vedi tutti <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </Link>
              </div>

              {recentMovements.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">
                  Nessun movimento registrato
                </p>
              ) : (
                <div className="space-y-2">
                  {recentMovements.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge className={movementTypeColor[m.type] || 'bg-gray-100 text-gray-600'}>
                          {movementTypeLabel[m.type] || m.type}
                        </Badge>
                        <span className="font-medium">{m.product?.sku}</span>
                        <span className="text-gray-500">{m.product?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-mono font-medium ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {m.quantity > 0 ? '+' : ''}
                          {m.quantity}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {new Date(m.movement_date).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
