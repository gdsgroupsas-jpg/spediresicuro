'use client';

/**
 * WMS: Gestione Prodotti
 *
 * CRUD prodotti con ricerca, filtro categoria/tipo, paginazione.
 * Pattern da rubrica page (table + mobile cards + dialog CRUD).
 */

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import DashboardNav from '@/components/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Package, Plus, Search, Pencil, Trash2, Loader2, ChevronDown, X } from 'lucide-react';
import type { Product, ProductType } from '@/types/products';
import { toast } from 'sonner';

// ─── Form State ───

interface ProductForm {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  category: string;
  type: ProductType;
  weight: string;
  length: string;
  width: string;
  height: string;
  cost_price: string;
  sale_price: string;
  raee_amount: string;
  eco_contribution: string;
  active: boolean;
}

const emptyForm: ProductForm = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category: '',
  type: 'physical',
  weight: '',
  length: '',
  width: '',
  height: '',
  cost_price: '',
  sale_price: '',
  raee_amount: '',
  eco_contribution: '',
  active: true,
};

const TYPE_OPTIONS: { id: ProductType; label: string }[] = [
  { id: 'physical', label: 'Fisico' },
  { id: 'digital', label: 'Digitale' },
  { id: 'service', label: 'Servizio' },
  { id: 'dropshipping', label: 'Dropshipping' },
];

const LIMIT = 50;

// ─── Component ───

export default function ProdottiPage() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.workspace_id;

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [offset, setOffset] = useState(0);

  // Dialog state
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);

  // ─── Fetch ───

  const fetchProducts = useCallback(
    async (searchQuery?: string, typeFilter?: string, newOffset = 0) => {
      if (!workspaceId) return;
      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('limit', LIMIT.toString());
        params.set('offset', newOffset.toString());
        if (searchQuery) params.set('search', searchQuery);
        if (typeFilter) params.set('type', typeFilter);

        const res = await fetch(`/api/workspaces/${workspaceId}/products?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (newOffset > 0) {
          setProducts((prev) => [...prev, ...data.products]);
        } else {
          setProducts(data.products);
        }
        setTotal(data.total);
      } catch {
        // Errore silenzioso
      } finally {
        setLoading(false);
      }
    },
    [workspaceId]
  );

  // Caricamento iniziale + cambio filtro tipo
  useEffect(() => {
    fetchProducts(search, filterType, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProducts, filterType]);

  // ─── Debounce search ───

  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(
      setTimeout(() => {
        setOffset(0);
        fetchProducts(value, filterType, 0);
      }, 300)
    );
  };

  // ─── CRUD ───

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      category: product.category || '',
      type: product.type,
      weight: product.weight?.toString() || '',
      length: product.length?.toString() || '',
      width: product.width?.toString() || '',
      height: product.height?.toString() || '',
      cost_price: product.cost_price?.toString() || '',
      sale_price: product.sale_price?.toString() || '',
      raee_amount: product.raee_amount?.toString() || '',
      eco_contribution: product.eco_contribution?.toString() || '',
      active: product.active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);

    try {
      const payload: any = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        barcode: form.barcode.trim() || undefined,
        description: form.description.trim() || undefined,
        category: form.category.trim() || undefined,
        type: form.type,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        length: form.length ? parseFloat(form.length) : undefined,
        width: form.width ? parseFloat(form.width) : undefined,
        height: form.height ? parseFloat(form.height) : undefined,
        cost_price: form.cost_price ? parseFloat(form.cost_price) : undefined,
        sale_price: form.sale_price ? parseFloat(form.sale_price) : undefined,
        raee_amount: form.raee_amount ? parseFloat(form.raee_amount) : undefined,
        eco_contribution: form.eco_contribution ? parseFloat(form.eco_contribution) : undefined,
        active: form.active,
      };

      let res: Response;
      if (editingProduct) {
        res = await fetch(`/api/workspaces/${workspaceId}/products/${editingProduct.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/workspaces/${workspaceId}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore salvataggio');
      }

      setShowForm(false);
      setOffset(0);
      fetchProducts(search, filterType, 0);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || !deleteConfirm) return;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/products/${deleteConfirm.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore eliminazione');
      }

      setDeleteConfirm(null);
      setOffset(0);
      fetchProducts(search, filterType, 0);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ─── Render ───

  const formatCurrency = (v?: number) =>
    v != null
      ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v)
      : '—';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <DashboardNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Prodotti</h1>
            <p className="text-sm text-gray-500 mt-1">{total} prodotti in catalogo</p>
          </div>
          <Button onClick={openCreate} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="h-4 w-4 mr-1.5" />
            Nuovo Prodotto
          </Button>
        </div>

        {/* Search + Filter bar */}
        <Card className="p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cerca per SKU, nome o barcode..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch('');
                    fetchProducts('', filterType, 0);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 border rounded-md text-sm bg-white"
            >
              <option value="">Tutti i tipi</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Products Table */}
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          </div>
        ) : products.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nessun prodotto trovato</p>
            <Button onClick={openCreate} variant="outline" className="mt-4">
              <Plus className="h-4 w-4 mr-1.5" />
              Aggiungi il primo prodotto
            </Button>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Categoria</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Costo</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Vendita</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Stato</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono text-xs font-medium">{p.sku}</td>
                        <td className="px-4 py-3">{p.name}</td>
                        <td className="px-4 py-3 text-gray-500">{p.category || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs capitalize">
                            {p.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency(p.cost_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency(p.sale_price)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge
                            className={
                              p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            }
                          >
                            {p.active ? 'Attivo' : 'Inattivo'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(p)}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {products.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-xs text-gray-500">{p.sku}</p>
                      <p className="font-medium mt-0.5">{p.name}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {p.type}
                        </Badge>
                        <Badge
                          className={
                            p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }
                        >
                          {p.active ? 'Attivo' : 'Inattivo'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Costo: {formatCurrency(p.cost_price)}</p>
                      <p className="text-xs text-gray-500">
                        Vendita: {formatCurrency(p.sale_price)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(p)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Load more */}
            {products.length < total && (
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    const newOffset = offset + LIMIT;
                    setOffset(newOffset);
                    fetchProducts(search, filterType, newOffset);
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-1.5" />
                  )}
                  Carica altri ({total - products.length} rimanenti)
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── Create/Edit Dialog ─── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">SKU *</label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="SKU-001"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Barcode</label>
                <Input
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  placeholder="EAN/UPC"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Nome *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome prodotto"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Descrizione</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Categoria</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Elettronica"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ProductType })}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Peso (kg)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">L (cm)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.length}
                  onChange={(e) => setForm({ ...form, length: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">W (cm)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.width}
                  onChange={(e) => setForm({ ...form, width: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">H (cm)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Prezzo Costo</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => setForm({ ...form, cost_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Prezzo Vendita</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.sale_price}
                  onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">RAEE</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.raee_amount}
                  onChange={(e) => setForm({ ...form, raee_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Eco-contributo</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.eco_contribution}
                  onChange={(e) => setForm({ ...form, eco_contribution: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="active" className="text-sm">
                Prodotto attivo
              </label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.sku.trim() || !form.name.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingProduct ? 'Salva Modifiche' : 'Crea Prodotto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare il prodotto?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare <strong>{deleteConfirm?.name}</strong> ({deleteConfirm?.sku}).
              Questa azione non è reversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
