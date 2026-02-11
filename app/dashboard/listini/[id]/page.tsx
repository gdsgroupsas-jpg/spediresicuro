/**
 * Pagina Dettaglio Listino
 *
 * Visualizza e modifica listino completo con:
 * - Editor regole PriceRule
 * - Caricamento tariffe
 * - Preview calcolo prezzi
 * - Audit trail
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Save,
  Upload,
  Plus,
  Trash2,
  Edit,
  Eye,
  Calculator,
  FileText,
  Sparkles,
  Settings,
  RefreshCw,
  Package,
  X,
  Copy,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import DashboardNav from '@/components/dashboard-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  getPriceListByIdAction,
  updatePriceListAction,
  getPriceListAuditEventsAction,
} from '@/actions/price-lists';
import {
  upsertPriceListEntriesAction,
  deletePriceListEntryAction,
} from '@/actions/price-list-entries';
import { SupplierPriceListConfigDialog } from '@/components/listini/supplier-price-list-config-dialog';
import { PRICING_MATRIX } from '@/lib/constants/pricing-matrix';
import type { PriceList, PriceRule, PriceListEntry } from '@/types/listini';

export default function PriceListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [priceList, setPriceList] = useState<PriceList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  useEffect(() => {
    if (params.id) {
      loadPriceList(params.id as string);
    }
  }, [params.id]);

  async function loadPriceList(id: string) {
    try {
      setIsLoading(true);
      const result = await getPriceListByIdAction(id);
      if (result.success && result.priceList) {
        const list = result.priceList as PriceList;
        setPriceList(list);
        setRules((list.rules as PriceRule[]) || []);
      } else {
        toast.error(result.error || 'Listino non trovato');
        router.push('/dashboard/listini');
      }
    } catch (error: any) {
      toast.error('Errore caricamento listino');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function saveRules() {
    if (!priceList) return;

    try {
      setIsSavingRules(true);
      const result = await updatePriceListAction(priceList.id, {
        rules: rules,
      });

      if (result.success) {
        toast.success('Regole salvate con successo');
        setIsEditing(false);
        // Ricarica listino per avere dati aggiornati
        await loadPriceList(priceList.id);
      } else {
        toast.error(result.error || 'Errore salvataggio regole');
      }
    } catch (error: any) {
      toast.error('Errore durante il salvataggio');
      console.error(error);
    } finally {
      setIsSavingRules(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Caricamento listino...</p>
        </div>
      </div>
    );
  }

  if (!priceList) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header con pulsante indietro */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/listini')}
            className="gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Indietro
          </Button>
        </div>

        <DashboardNav
          title={`${priceList.name} - v${priceList.version}`}
          subtitle="Gestione dettaglio listino prezzi"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowConfigDialog(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Configurazione
              </Button>
              {!isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Modifica
                </Button>
              )}
              {isEditing && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setRules((priceList?.rules as PriceRule[]) || []);
                    }}
                    disabled={isSavingRules}
                  >
                    Annulla
                  </Button>
                  <Button onClick={saveRules} disabled={isSavingRules}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSavingRules ? 'Salvataggio...' : 'Salva'}
                  </Button>
                </>
              )}
            </div>
          }
        />

        <Tabs defaultValue="rules" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="rules">
              <Sparkles className="mr-2 h-4 w-4" />
              Regole
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Carica Tariffe
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Calculator className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="audit">
              <FileText className="mr-2 h-4 w-4" />
              Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-6">
            <PriceRulesEditor rules={rules} onChange={setRules} isEditing={isEditing} />
          </TabsContent>

          <TabsContent value="upload" className="mt-6">
            <TariffUploader priceListId={priceList.id} />
          </TabsContent>

          <TabsContent value="preview" className="mt-6">
            <PriceCalculatorPreview
              priceListId={priceList.id}
              isEditing={isEditing}
              onSaveComplete={() => {
                if (priceList.id) {
                  loadPriceList(priceList.id);
                  setIsEditing(false);
                }
              }}
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-6">
            <AuditTrail priceListId={priceList.id} />
          </TabsContent>
        </Tabs>

        {/* Dialog Configurazione Manuale */}
        {priceList && (
          <SupplierPriceListConfigDialog
            open={showConfigDialog}
            onOpenChange={(open) => {
              setShowConfigDialog(open);
            }}
            priceList={priceList}
            onSaveComplete={() => {
              if (priceList.id) {
                loadPriceList(priceList.id);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// Componente Editor Regole
function PriceRulesEditor({
  rules,
  onChange,
  isEditing,
}: {
  rules: PriceRule[];
  onChange: (rules: PriceRule[]) => void;
  isEditing: boolean;
}) {
  const addRule = () => {
    const newRule: PriceRule = {
      id: `rule-${Date.now()}`,
      name: 'Nuova Regola',
      margin_type: 'percent',
      margin_value: 10,
      priority: 0,
      is_active: true,
    };
    onChange([...rules, newRule]);
  };

  const updateRule = (index: number, updates: Partial<PriceRule>) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const deleteRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Regole di Calcolo Prezzi</h2>
          <p className="text-sm text-gray-500">Definisci regole complesse per calcolo dinamico</p>
        </div>
        {isEditing && (
          <Button onClick={addRule} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Aggiungi Regola
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Nessuna regola definita</p>
          {isEditing && (
            <Button onClick={addRule} variant="outline">
              Crea Prima Regola
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, index) => (
            <div
              key={rule.id || index}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {isEditing ? (
                      <Input
                        value={rule.name || ''}
                        onChange={(e) => updateRule(index, { name: e.target.value })}
                        placeholder="Nome regola"
                        className="font-medium"
                      />
                    ) : (
                      <h3 className="font-medium text-gray-900">
                        {rule.name || `Regola ${index + 1}`}
                      </h3>
                    )}
                    <Badge variant={rule.is_active ? 'success' : 'secondary'}>
                      {rule.is_active ? 'Attiva' : 'Disattiva'}
                    </Badge>
                    <Badge variant="outline">Priorità: {rule.priority || 0}</Badge>
                  </div>
                  {isEditing && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <Label className="text-xs">Peso Min (kg)</Label>
                        <Input
                          type="number"
                          value={rule.weight_from || ''}
                          onChange={(e) =>
                            updateRule(index, {
                              weight_from: parseFloat(e.target.value) || undefined,
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Peso Max (kg)</Label>
                        <Input
                          type="number"
                          value={rule.weight_to || ''}
                          onChange={(e) =>
                            updateRule(index, {
                              weight_to: parseFloat(e.target.value) || undefined,
                            })
                          }
                          placeholder="∞"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Margine (%)</Label>
                        <Input
                          type="number"
                          value={rule.margin_value || ''}
                          onChange={(e) =>
                            updateRule(index, {
                              margin_value: parseFloat(e.target.value) || undefined,
                            })
                          }
                          placeholder="10"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tipo Margine</Label>
                        <Select
                          value={rule.margin_type}
                          onChange={(e) =>
                            updateRule(index, {
                              margin_type: e.target.value as 'percent' | 'fixed' | 'none',
                            })
                          }
                        >
                          <option value="percent">Percentuale</option>
                          <option value="fixed">Fisso (€)</option>
                          <option value="none">Nessuno</option>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteRule(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Componente Upload Tariffe
function TariffUploader({ priceListId }: { priceListId: string }) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = async (file: File) => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('priceListId', priceListId);

      const response = await fetch('/api/price-lists/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`File processato: ${result.data.length} righe trovate`);
      } else {
        toast.error(result.error || 'Errore upload file');
      }
    } catch (error: any) {
      toast.error('Errore imprevisto durante upload');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Carica Tariffe</h2>
      <p className="text-sm text-gray-500 mb-6">
        Carica file CSV, Excel, PDF o immagini. Il sistema processerà automaticamente i dati.
      </p>

      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files[0];
          if (file) handleUpload(file);
        }}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 mb-2">
          Trascina file qui o{' '}
          <label className="text-blue-600 hover:text-blue-700 cursor-pointer">
            seleziona file
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
          </label>
        </p>
        <p className="text-xs text-gray-500">
          Supportati: CSV, Excel (.xlsx, .xls), PDF, Immagini (JPG, PNG)
        </p>
        {isUploading && (
          <div className="mt-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600 mt-2">Elaborazione in corso...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente Preview Calcolatore - Mostra entries importate in formato MATRICE con EDITING
function PriceCalculatorPreview({
  priceListId,
  isEditing,
  onSaveComplete,
}: {
  priceListId: string;
  isEditing: boolean;
  onSaveComplete: () => void;
}) {
  const [entries, setEntries] = useState<PriceListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stato per editing matrice
  type MatrixRow = {
    id: string;
    weightFrom: number;
    weightTo: number;
    prices: Record<string, number>;
    fuelSurcharge: number;
    entryIds: Record<string, string | undefined>;
  };

  const [editingMatrix, setEditingMatrix] = useState<MatrixRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [priceListId, refreshKey]);

  async function loadEntries() {
    try {
      setIsLoading(true);
      const result = await getPriceListByIdAction(priceListId);

      if (result.success && result.priceList) {
        const priceList = result.priceList as PriceList & { entries?: PriceListEntry[] };
        const loadedEntries = priceList.entries || [];
        setEntries(loadedEntries);
        // Inizializza matrice editing se in modalità editing
        if (isEditing) {
          initializeEditingMatrix(loadedEntries);
        }
      }
    } catch (error) {
      console.error('Errore caricamento entries:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Inizializza matrice editing dai dati esistenti
  function initializeEditingMatrix(entriesData: PriceListEntry[]) {
    const sortedZones = [...PRICING_MATRIX.ZONES]
      .map((z) => z.code)
      .sort((a, b) => {
        const zoneA = PRICING_MATRIX.ZONES.find((z) => z.code === a);
        const zoneB = PRICING_MATRIX.ZONES.find((z) => z.code === b);
        return (zoneA?.priority || 999) - (zoneB?.priority || 999);
      });

    const uniqueWeights = Array.from(new Set(entriesData.map((e) => e.weight_to))).sort(
      (a, b) => a - b
    );

    const matrixRows: MatrixRow[] = [];

    for (let i = 0; i < uniqueWeights.length; i++) {
      const weightTo = uniqueWeights[i];
      const weightFrom = i > 0 ? uniqueWeights[i - 1] : 0;

      const prices: Record<string, number> = {};
      const entryIds: Record<string, string | undefined> = {};
      let fuelSurcharge = 0;

      sortedZones.forEach((zoneCode) => {
        const entry = entriesData.find((e) => {
          const normalizedEntryZone = normalizeZoneCode(e.zone_code);
          return (
            (normalizedEntryZone === zoneCode || e.zone_code === zoneCode) &&
            e.weight_to === weightTo
          );
        });

        if (entry) {
          prices[zoneCode] = entry.base_price;
          entryIds[zoneCode] = entry.id;
          if (fuelSurcharge === 0 && entry.fuel_surcharge_percent) {
            fuelSurcharge = entry.fuel_surcharge_percent;
          }
        } else {
          prices[zoneCode] = -1;
          entryIds[zoneCode] = undefined;
        }
      });

      matrixRows.push({
        id: `row-${weightTo}`,
        weightFrom,
        weightTo,
        prices,
        fuelSurcharge,
        entryIds,
      });
    }

    setEditingMatrix(matrixRows);
    setHasUnsavedChanges(false);
  }

  // Aggiorna valore prezzo in matrice locale
  function updateMatrixPrice(rowId: string, zoneCode: string, value: number) {
    setEditingMatrix((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          const newPrices = { ...row.prices };
          newPrices[zoneCode] = value;
          return { ...row, prices: newPrices };
        }
        return row;
      })
    );
    setHasUnsavedChanges(true);
  }

  // Aggiorna fuel surcharge in matrice locale
  function updateMatrixFuelSurcharge(rowId: string, value: number) {
    setEditingMatrix((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          return { ...row, fuelSurcharge: value };
        }
        return row;
      })
    );
    setHasUnsavedChanges(true);
  }

  // Aggiorna peso (weightTo) in matrice locale
  function updateMatrixWeight(rowId: string, newWeightTo: number) {
    setEditingMatrix((prev) => {
      const updated = prev.map((row) => {
        if (row.id === rowId) {
          return { ...row, weightTo: newWeightTo };
        }
        return row;
      });
      // Ricalcola weightFrom per tutte le righe
      return updated.map((row, idx) => {
        const weightFrom = idx > 0 ? updated[idx - 1].weightTo : 0;
        return { ...row, weightFrom };
      });
    });
    setHasUnsavedChanges(true);
  }

  // Aggiungi nuova riga
  function addNewRow() {
    const sortedZones = [...PRICING_MATRIX.ZONES]
      .map((z) => z.code)
      .sort((a, b) => {
        const zoneA = PRICING_MATRIX.ZONES.find((z) => z.code === a);
        const zoneB = PRICING_MATRIX.ZONES.find((z) => z.code === b);
        return (zoneA?.priority || 999) - (zoneB?.priority || 999);
      });

    const lastWeight =
      editingMatrix.length > 0 ? editingMatrix[editingMatrix.length - 1].weightTo : 0;

    const newRow: MatrixRow = {
      id: `row-new-${Date.now()}`,
      weightFrom: lastWeight,
      weightTo: lastWeight + 1,
      prices: Object.fromEntries(sortedZones.map((z) => [z, -1])),
      fuelSurcharge: 0,
      entryIds: {},
    };

    setEditingMatrix((prev) => [...prev, newRow]);
    setHasUnsavedChanges(true);
  }

  // Elimina riga
  function removeRow(rowId: string) {
    if (!confirm('Sei sicuro di voler eliminare questa fascia di peso?')) {
      return;
    }

    setEditingMatrix((prev) => {
      const filtered = prev.filter((row) => row.id !== rowId);
      return filtered.map((row, idx) => {
        const weightFrom = idx > 0 ? filtered[idx - 1].weightTo : 0;
        return { ...row, weightFrom };
      });
    });
    setHasUnsavedChanges(true);
  }

  // Salva tutte le modifiche batch
  async function saveAllChanges() {
    if (!hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      const sortedZones = [...PRICING_MATRIX.ZONES]
        .map((z) => z.code)
        .sort((a, b) => {
          const zoneA = PRICING_MATRIX.ZONES.find((z) => z.code === a);
          const zoneB = PRICING_MATRIX.ZONES.find((z) => z.code === b);
          return (zoneA?.priority || 999) - (zoneB?.priority || 999);
        });

      // Crea set di combinazioni (weight_from, weight_to, zone_code) presenti nella matrice
      const matrixKeys = new Set<string>();
      const entriesToSave: Array<{
        weight_from: number;
        weight_to: number;
        zone_code?: string;
        base_price: number;
        service_type: 'standard';
        fuel_surcharge_percent: number;
      }> = [];

      editingMatrix.forEach((row) => {
        sortedZones.forEach((zoneCode) => {
          const price = row.prices[zoneCode];
          if (price >= 0) {
            const key = `${row.weightFrom}-${row.weightTo}-${zoneCode}`;
            matrixKeys.add(key);
            entriesToSave.push({
              weight_from: row.weightFrom,
              weight_to: row.weightTo,
              zone_code: zoneCode,
              base_price: price,
              service_type: 'standard',
              fuel_surcharge_percent: row.fuelSurcharge,
            });
          }
        });
      });

      // Elimina entries che non sono più nella matrice
      const entriesToDelete: string[] = [];
      entries.forEach((entry) => {
        const normalizedZone = normalizeZoneCode(entry.zone_code);
        const key = `${entry.weight_from}-${entry.weight_to}-${normalizedZone || entry.zone_code}`;
        if (!matrixKeys.has(key) && entry.id) {
          entriesToDelete.push(entry.id);
        }
      });

      // Elimina entries rimosse
      let deletedCount = 0;
      if (entriesToDelete.length > 0) {
        const deletePromises = entriesToDelete.map((entryId) =>
          deletePriceListEntryAction(entryId)
        );
        const deleteResults = await Promise.all(deletePromises);
        deletedCount = deleteResults.filter((r) => r.success).length;
      }

      // Salva entries nuove/modificate
      const result = await upsertPriceListEntriesAction(priceListId, entriesToSave);

      if (result.success) {
        const messages = [];
        if (result.inserted && result.inserted > 0) {
          messages.push(`${result.inserted} inserite`);
        }
        if (result.updated && result.updated > 0) {
          messages.push(`${result.updated} aggiornate`);
        }
        if (deletedCount > 0) {
          messages.push(`${deletedCount} eliminate`);
        }
        toast.success(`Modifiche salvate: ${messages.join(', ')}`);
        setHasUnsavedChanges(false);
        await loadEntries();
        onSaveComplete();
      } else {
        toast.error(result.error || 'Errore salvataggio');
      }
    } catch (error: any) {
      console.error('Errore salvataggio batch:', error);
      toast.error('Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  }

  // Annulla modifiche e ricarica dati originali
  function cancelEditing() {
    if (hasUnsavedChanges) {
      if (!confirm('Hai modifiche non salvate. Sei sicuro di voler annullare?')) {
        return;
      }
    }
    initializeEditingMatrix(entries);
    setHasUnsavedChanges(false);
  }

  // Aggiorna matrice quando entra in editing
  useEffect(() => {
    if (isEditing && entries.length > 0 && editingMatrix.length === 0) {
      initializeEditingMatrix(entries);
    }
    if (!isEditing) {
      setHasUnsavedChanges(false);
    }
  }, [isEditing, entries.length]);

  // Formatta valuta
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }

  // Normalizza codice zona (stessa logica di listino fornitore)
  function normalizeZoneCode(code: string | undefined | null): string | null {
    if (!code) return null;

    const normalized = code.toLowerCase().replace(/[_\-\s]+/g, '_');

    const legacyMap: Record<string, string> = {
      it_std: 'IT-ITALIA',
      it_cal: 'IT-CALABRIA',
      it_sic: 'IT-SICILIA',
      it_sar: 'IT-SARDEGNA',
      it_ven: 'IT-DISAGIATE',
      it_liv: 'IT-LIVIGNO',
      it_iso: 'IT-ISOLE-MINORI',
      eu_z1: 'EU-ZONA1',
      eu_z2: 'EU-ZONA2',
    };

    const nameMap: Record<string, string> = {
      italia: 'IT-ITALIA',
      sardegna: 'IT-SARDEGNA',
      calabria: 'IT-CALABRIA',
      sicilia: 'IT-SICILIA',
      livigno: 'IT-LIVIGNO',
      campione: 'IT-LIVIGNO',
      livigno_campione: 'IT-LIVIGNO',
      isole_minori: 'IT-ISOLE-MINORI',
      isole: 'IT-ISOLE-MINORI',
      localita_disagiate: 'IT-DISAGIATE',
      disagiate: 'IT-DISAGIATE',
      europa1: 'EU-ZONA1',
      europa_1: 'EU-ZONA1',
      europa_zona_1: 'EU-ZONA1',
      europa2: 'EU-ZONA2',
      europa_2: 'EU-ZONA2',
      europa_zona_2: 'EU-ZONA2',
    };

    if (legacyMap[normalized]) {
      return legacyMap[normalized];
    }

    if (nameMap[normalized]) {
      return nameMap[normalized];
    }

    if (code.match(/^(IT|EU)-/i)) {
      return code.toUpperCase();
    }

    return code;
  }

  // Costruisce merged rows (memoizzato per evitare ricalcolo O(n²) ad ogni render)
  const mergedRowsMemo = useMemo(() => {
    const sortedZones = [...PRICING_MATRIX.ZONES]
      .map((z) => z.code)
      .sort((a, b) => {
        const zoneA = PRICING_MATRIX.ZONES.find((z) => z.code === a);
        const zoneB = PRICING_MATRIX.ZONES.find((z) => z.code === b);
        return (zoneA?.priority || 999) - (zoneB?.priority || 999);
      });

    const uniqueWeights = Array.from(new Set(entries.map((e) => e.weight_to))).sort(
      (a, b) => a - b
    );

    type MergedRow = {
      weightFrom: number;
      weightTo: number;
      prices: Record<string, number>;
      fuelSurcharge: number;
    };

    const mergedRows: MergedRow[] = [];

    const getPricesForWeight = (w: number) => {
      const rowPrices: Record<string, number> = {};
      let fuelSurcharge = 0;

      sortedZones.forEach((zoneCode) => {
        const entry = entries.find((e) => {
          const normalizedEntryZone = normalizeZoneCode(e.zone_code);
          return (
            (normalizedEntryZone === zoneCode || e.zone_code === zoneCode) && e.weight_to === w
          );
        });
        rowPrices[zoneCode] = entry ? entry.base_price : -1;
        if (entry && entry.fuel_surcharge_percent && fuelSurcharge === 0) {
          fuelSurcharge = entry.fuel_surcharge_percent;
        }
      });
      return { prices: rowPrices, fuelSurcharge };
    };

    const arePricesIdentical = (p1: Record<string, number>, p2: Record<string, number>) => {
      return sortedZones.every((z) => p1[z] === p2[z]);
    };

    for (let i = 0; i < uniqueWeights.length; i++) {
      const currentWeight = uniqueWeights[i];
      const { prices: currentPrices, fuelSurcharge } = getPricesForWeight(currentWeight);
      let prevWeightBreakpoint = i > 0 ? uniqueWeights[i - 1] : 0;

      if (mergedRows.length > 0) {
        const lastMerged = mergedRows[mergedRows.length - 1];
        if (arePricesIdentical(lastMerged.prices, currentPrices)) {
          lastMerged.weightTo = currentWeight;
        } else {
          mergedRows.push({
            weightFrom: lastMerged.weightTo,
            weightTo: currentWeight,
            prices: currentPrices,
            fuelSurcharge,
          });
        }
      } else {
        mergedRows.push({
          weightFrom: 0,
          weightTo: currentWeight,
          prices: currentPrices,
          fuelSurcharge,
        });
      }
    }

    return mergedRows;
  }, [entries]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500">Caricamento tariffe...</p>
        </div>
      </div>
    );
  }

  // Usa editingMatrix se in editing, altrimenti buildMergedRows per visualizzazione
  const displayRows = isEditing ? editingMatrix : mergedRowsMemo;
  const sortedZones = [...PRICING_MATRIX.ZONES]
    .map((z) => z.code)
    .sort((a, b) => {
      const zoneA = PRICING_MATRIX.ZONES.find((z) => z.code === a);
      const zoneB = PRICING_MATRIX.ZONES.find((z) => z.code === b);
      return (zoneA?.priority || 999) - (zoneB?.priority || 999);
    });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Tariffe per Peso e Zona (Matrice Completa)
          </h2>
          <p className="text-sm text-gray-500">
            Visualizzazione a matrice: Righe = Scaglioni di Peso, Colonne = Zone Geografiche
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Aggiorna
            </Button>
          )}
          {isEditing && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={saveAllChanges}
                disabled={isSaving || !hasUnsavedChanges}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Salvataggio...' : 'Salva Tutto'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEditing}
                disabled={isSaving}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Annulla
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addNewRow}
                disabled={isSaving}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Nuova Fascia
              </Button>
              {hasUnsavedChanges && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700">
                  Modifiche non salvate
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {displayRows.length === 0 && entries.length === 0 && !isEditing ? (
        <div className="p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Nessuna tariffa nel listino</p>
          <p className="text-sm text-gray-500">
            Usa la tab &quot;Carica Tariffe&quot; per importare tariffe da CSV o aggiungerle
            manualmente
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r">
                  Peso (KG)
                </th>
                {sortedZones.map((zoneCode) => {
                  const zone = PRICING_MATRIX.ZONES.find((z) => z.code === zoneCode);
                  const zoneName = zone?.name || zoneCode;
                  return (
                    <th
                      key={zoneCode}
                      className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider border-b"
                      title={zoneName}
                    >
                      {zoneName}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider border-b bg-yellow-50">
                  Fuel %
                </th>
                {isEditing && (
                  <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider border-b w-20">
                    Azioni
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayRows.map((row, idx) => {
                const rowId = isEditing ? (row as MatrixRow).id : `row-${idx}`;
                const rowData = isEditing
                  ? (row as MatrixRow)
                  : {
                      id: rowId,
                      weightFrom: row.weightFrom,
                      weightTo: row.weightTo,
                      prices: row.prices,
                      fuelSurcharge: row.fuelSurcharge || 0,
                      entryIds: {},
                    };
                return (
                  <tr key={rowId} className="hover:bg-gray-50">
                    {/* Colonna Peso - Editabile in modalità editing */}
                    <td className="px-4 py-3 font-semibold text-gray-900 border-r bg-gray-50 sticky left-0 z-10 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            value={rowData.weightTo}
                            onChange={(e) => {
                              const newWeight = parseFloat(e.target.value) || 0;
                              updateMatrixWeight(rowId, newWeight);
                            }}
                            className="w-20 text-center"
                            disabled={isSaving}
                          />
                          <span className="text-xs text-gray-500">kg</span>
                        </div>
                      ) : (
                        <>
                          {rowData.weightFrom === 0
                            ? `Fino a ${rowData.weightTo}`
                            : `${rowData.weightFrom} - ${rowData.weightTo}`}{' '}
                          kg
                        </>
                      )}
                    </td>
                    {/* Colonne Zone - Editabili in modalità editing */}
                    {sortedZones.map((zoneCode) => {
                      const price = rowData.prices[zoneCode] ?? -1;
                      return (
                        <td key={`${rowId}-${zoneCode}`} className="px-4 py-3 text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={price >= 0 ? price : ''}
                              onChange={(e) => {
                                const value =
                                  e.target.value === '' ? -1 : parseFloat(e.target.value) || 0;
                                updateMatrixPrice(rowId, zoneCode, value);
                              }}
                              placeholder="-"
                              className="w-24 text-center"
                              disabled={isSaving}
                            />
                          ) : (
                            <div className="flex flex-col items-center">
                              {price >= 0 ? (
                                <>
                                  <span
                                    className={`font-bold ${
                                      price === 0 ? 'text-gray-400' : 'text-gray-900'
                                    }`}
                                  >
                                    {price === 0 ? '0,00 €' : formatCurrency(price)}
                                  </span>
                                  {price === 0 && (
                                    <span className="text-[10px] text-orange-500 font-medium">
                                      (da compilare)
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Colonna Fuel Surcharge */}
                    <td className="px-4 py-3 text-center bg-yellow-50">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={rowData.fuelSurcharge}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            updateMatrixFuelSurcharge(rowId, value);
                          }}
                          className="w-20 text-center"
                          disabled={isSaving}
                        />
                      ) : (
                        <span className="font-semibold text-gray-900">
                          {rowData.fuelSurcharge > 0 ? `${rowData.fuelSurcharge}%` : '-'}
                        </span>
                      )}
                    </td>
                    {/* Colonna Azioni (solo in editing) */}
                    {isEditing && (
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeRow(rowId)}
                          disabled={isSaving}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Componente Audit Trail Enterprise-Grade
function AuditTrail({ priceListId }: { priceListId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const eventTypes = [
    { value: 'all', label: 'Tutti gli eventi' },
    { value: 'price_list_created', label: 'Creazione' },
    { value: 'price_list_updated', label: 'Modifiche' },
    { value: 'price_list_activated', label: 'Attivazioni' },
    { value: 'price_list_entry_imported', label: 'Import' },
    { value: 'price_list_entry_modified', label: 'Modifiche Entries' },
    { value: 'price_list_rule_created', label: 'Regole Create' },
    { value: 'price_list_rule_updated', label: 'Regole Modificate' },
    { value: 'price_list_margin_updated', label: 'Margini Aggiornati' },
    { value: 'price_list_used_for_quote', label: 'Utilizzi' },
  ];

  useEffect(() => {
    loadEvents();
  }, [priceListId, selectedEventType, page]);

  async function loadEvents() {
    try {
      setIsLoading(true);
      const result = await getPriceListAuditEventsAction(priceListId, {
        eventTypes: selectedEventType === 'all' ? undefined : [selectedEventType],
        limit: pageSize,
        offset: page * pageSize,
      });

      if (result.success && result.events) {
        setEvents(result.events);
        setTotalCount(result.total_count || 0);
      }
    } catch (error) {
      console.error('Errore caricamento eventi:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getEventIcon(eventType: string) {
    const icons: Record<string, any> = {
      price_list_created: Plus,
      price_list_updated: Edit,
      price_list_activated: '✓',
      price_list_deactivated: '✗',
      price_list_archived: Package,
      price_list_cloned: Copy,
      price_list_entry_imported: Upload,
      price_list_entry_modified: Edit,
      price_list_entry_deleted: Trash2,
      price_list_rule_created: Sparkles,
      price_list_rule_updated: Sparkles,
      price_list_rule_deleted: Trash2,
      price_list_margin_updated: Calculator,
      price_list_used_for_quote: Eye,
    };
    return icons[eventType] || FileText;
  }

  function getEventColor(eventType: string): string {
    if (eventType.includes('created') || eventType.includes('activated')) {
      return 'text-green-600 bg-green-50';
    }
    if (eventType.includes('updated') || eventType.includes('modified')) {
      return 'text-blue-600 bg-blue-50';
    }
    if (eventType.includes('deleted') || eventType.includes('archived')) {
      return 'text-red-600 bg-red-50';
    }
    if (eventType.includes('imported')) {
      return 'text-purple-600 bg-purple-50';
    }
    return 'text-gray-600 bg-gray-50';
  }

  function exportToCSV() {
    const headers = ['Data', 'Evento', 'Attore', 'Messaggio', 'Dettagli'];
    const rows = events.map((e) => [
      formatDate(e.created_at),
      e.event_type,
      e.actor_email || 'system',
      e.message || '',
      JSON.stringify(e.metadata || {}),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${priceListId.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading && events.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500">Caricamento eventi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Audit Trail</h2>
          <p className="text-sm text-gray-500">
            Storico completo di tutte le modifiche e utilizzi del listino
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
            <FileText className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadEvents} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* Filtri */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium text-gray-700">Filtra per tipo:</Label>
          <Select
            value={selectedEventType}
            onChange={(e) => {
              setSelectedEventType(e.target.value);
              setPage(0);
            }}
            className="w-64"
          >
            {eventTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
          <div className="text-sm text-gray-500 ml-auto">Totale: {totalCount} eventi</div>
        </div>
      </div>

      {/* Timeline eventi */}
      {events.length === 0 ? (
        <div className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Nessun evento trovato</p>
          <p className="text-sm text-gray-500">
            Gli eventi verranno registrati automaticamente quando modifichi il listino
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {events.map((event) => {
              const Icon = getEventIcon(event.event_type);
              const isIconComponent = typeof Icon !== 'string';

              return (
                <div key={event.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    {/* Icona evento */}
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getEventColor(event.event_type)}`}
                    >
                      {isIconComponent ? (
                        <Icon className="h-5 w-5" />
                      ) : (
                        <span className="text-lg">{Icon}</span>
                      )}
                    </div>

                    {/* Contenuto */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {eventTypes.find((t) => t.value === event.event_type)?.label ||
                            event.event_type}
                        </span>
                        {event.severity && event.severity !== 'info' && (
                          <Badge variant="outline" className="text-xs">
                            {event.severity}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {event.message || 'Evento registrato'}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(event.created_at)}
                        </span>
                        {event.actor_email && (
                          <span className="flex items-center gap-1">
                            <span>👤</span>
                            {event.actor_email}
                            {event.actor_type && (
                              <Badge variant="outline" className="text-xs ml-1">
                                {event.actor_type}
                              </Badge>
                            )}
                          </span>
                        )}
                      </div>
                      {/* Dettagli old/new value se presenti */}
                      {(event.old_value || event.new_value) && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs">
                          {event.old_value && (
                            <div className="mb-2">
                              <span className="font-medium text-red-600">Prima:</span>{' '}
                              <span className="text-gray-700">
                                {typeof event.old_value === 'object'
                                  ? JSON.stringify(event.old_value, null, 2)
                                  : String(event.old_value)}
                              </span>
                            </div>
                          )}
                          {event.new_value && (
                            <div>
                              <span className="font-medium text-green-600">Dopo:</span>{' '}
                              <span className="text-gray-700">
                                {typeof event.new_value === 'object'
                                  ? JSON.stringify(event.new_value, null, 2)
                                  : String(event.new_value)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Metadata aggiuntivi */}
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="mt-2 text-xs text-gray-500">
                          {Object.entries(event.metadata).map(([key, value]) => (
                            <span key={key} className="mr-4">
                              <span className="font-medium">{key}:</span> {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Paginazione */}
          {totalCount > pageSize && (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="text-sm text-gray-500">
                Mostrando {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} di{' '}
                {totalCount}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Precedente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={(page + 1) * pageSize >= totalCount}
                >
                  Successiva
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
