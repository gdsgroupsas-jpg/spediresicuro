/**
 * Pagina Dettaglio Listino Fornitore per Reseller
 *
 * Visualizza il listino con le sue righe (entries) in formato tabellare
 * Dati basati su peso in kg e prezzi
 */

"use client";

import { approvePriceListAction } from "@/actions/approve-price-list";
import { updateCustomerPriceListMarginAction } from "@/actions/customer-price-lists";
import { upsertPriceListEntriesAction } from "@/actions/price-list-entries";
import { getPriceListByIdAction } from "@/actions/price-lists";
import DashboardNav from "@/components/dashboard-nav";
import { ImportCsvDialog } from "@/components/listini/import-csv-dialog";
import { ManualPriceListEntriesForm } from "@/components/listini/manual-price-list-entries-form";
import { SupplierPriceListConfigDialog } from "@/components/listini/supplier-price-list-config-dialog";
import { SyncIncrementalDialog } from "@/components/listini/sync-incremental-dialog";
import { TestApiValidationDialog } from "@/components/listini/test-api-validation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRICING_MATRIX } from "@/lib/constants/pricing-matrix";
import type { PriceList, PriceListEntry } from "@/types/listini";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Edit,
  FileText,
  Info,
  Package,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Formatta valuta
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

// Formatta data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Badge status
function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: {
      label: "Bozza",
      className: "bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    active: {
      label: "Attivo",
      className: "bg-green-100 text-green-700 border-green-200",
    },
    archived: {
      label: "Archiviato",
      className: "bg-gray-100 text-gray-700 border-gray-200",
    },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Badge tipo servizio
function getServiceTypeBadge(serviceType: string) {
  const serviceConfig: Record<string, { label: string; className: string }> = {
    standard: { label: "Standard", className: "bg-blue-100 text-blue-700" },
    express: { label: "Express", className: "bg-purple-100 text-purple-700" },
    economy: { label: "Economy", className: "bg-green-100 text-green-700" },
    same_day: { label: "Same Day", className: "bg-red-100 text-red-700" },
    next_day: { label: "Next Day", className: "bg-orange-100 text-orange-700" },
  };

  const config = serviceConfig[serviceType] || serviceConfig.standard;

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

export default function PriceListDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [priceList, setPriceList] = useState<PriceList | null>(null);
  const [entries, setEntries] = useState<PriceListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showManualFormDialog, setShowManualFormDialog] = useState(false);
  const [showImportCsvDialog, setShowImportCsvDialog] = useState(false);
  const [showTestApiDialog, setShowTestApiDialog] = useState(false);
  const [showSyncIncrementalDialog, setShowSyncIncrementalDialog] =
    useState(false);
  const [activeTab, setActiveTab] = useState<"matrix" | "entries">("matrix");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [weightFilter, setWeightFilter] = useState<string>("all");

  // Stato locale per editing batch della matrice
  type MatrixRow = {
    id: string; // ID univoco riga (per tracking)
    weightFrom: number;
    weightTo: number;
    prices: Record<string, number>; // zone -> base_price
    fuelSurcharge: number; // Fuel surcharge percentuale (uguale per tutte le zone della riga)
    entryIds: Record<string, string | undefined>; // zone -> entry.id (per tracking entry esistenti)
  };

  const [editingMatrix, setEditingMatrix] = useState<MatrixRow[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
        const list = result.priceList as PriceList & {
          entries?: PriceListEntry[];
        };
        setPriceList(list);
        setEntries(list.entries || []);
        // Inizializza matrice editing dai dati esistenti
        initializeEditingMatrix(list.entries || []);
      } else {
        toast.error(result.error || "Listino non trovato");
        router.push("/dashboard/reseller/listini-fornitore");
      }
    } catch (error: any) {
      toast.error("Errore caricamento listino");
      console.error(error);
      router.push("/dashboard/reseller/listini-fornitore");
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

    const normalizeZoneCode = (
      code: string | undefined | null
    ): string | null => {
      if (!code) return null;
      const legacyMap: Record<string, string> = {
        "IT-STD": "IT-ITALIA",
        "IT-CAL": "IT-CALABRIA",
        "IT-SIC": "IT-SICILIA",
        "IT-SAR": "IT-SARDEGNA",
        "IT-VEN": "IT-DISAGIATE",
        "IT-LIV": "IT-LIVIGNO",
        "IT-ISO": "IT-ISOLE-MINORI",
        "EU-Z1": "EU-ZONA1",
      };
      return legacyMap[code] || code;
    };

    const uniqueWeights = Array.from(
      new Set(entriesData.map((e) => e.weight_to))
    ).sort((a, b) => a - b);

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
          // Prendi fuel_surcharge dalla prima entry trovata (assumiamo sia uguale per tutte le zone della riga)
          if (fuelSurcharge === 0 && entry.fuel_surcharge_percent) {
            fuelSurcharge = entry.fuel_surcharge_percent;
          }
        } else {
          prices[zoneCode] = -1; // -1 = mancante
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
      editingMatrix.length > 0
        ? editingMatrix[editingMatrix.length - 1].weightTo
        : 0;

    const newRow: MatrixRow = {
      id: `row-new-${Date.now()}`,
      weightFrom: lastWeight,
      weightTo: lastWeight + 1, // Default: +1 kg
      prices: Object.fromEntries(
        sortedZones.map((z) => [z, -1]) // -1 = vuoto
      ),
      fuelSurcharge: 0,
      entryIds: {},
    };

    setEditingMatrix((prev) => [...prev, newRow]);
    setHasUnsavedChanges(true);
  }

  // Elimina riga
  function removeRow(rowId: string) {
    if (!confirm("Sei sicuro di voler eliminare questa fascia di peso?")) {
      return;
    }

    setEditingMatrix((prev) => {
      const filtered = prev.filter((row) => row.id !== rowId);
      // Ricalcola weightFrom dopo rimozione
      return filtered.map((row, idx) => {
        const weightFrom = idx > 0 ? filtered[idx - 1].weightTo : 0;
        return { ...row, weightFrom };
      });
    });
    setHasUnsavedChanges(true);
  }

  // Salva tutte le modifiche batch
  async function saveAllChanges() {
    if (!priceList || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      const sortedZones = [...PRICING_MATRIX.ZONES]
        .map((z) => z.code)
        .sort((a, b) => {
          const zoneA = PRICING_MATRIX.ZONES.find((z) => z.code === a);
          const zoneB = PRICING_MATRIX.ZONES.find((z) => z.code === b);
          return (zoneA?.priority || 999) - (zoneB?.priority || 999);
        });

      // Prepara entries da salvare
      const entriesToSave: Array<{
        weight_from: number;
        weight_to: number;
        zone_code?: string;
        base_price: number;
        service_type: "standard";
        fuel_surcharge_percent: number;
      }> = [];

      editingMatrix.forEach((row) => {
        sortedZones.forEach((zoneCode) => {
          const price = row.prices[zoneCode];
          // Salva solo se prezzo è valido (>= 0)
          if (price >= 0) {
            entriesToSave.push({
              weight_from: row.weightFrom,
              weight_to: row.weightTo,
              zone_code: zoneCode,
              base_price: price,
              service_type: "standard",
              fuel_surcharge_percent: row.fuelSurcharge,
            });
          }
        });
      });

      // Usa upsert per salvare tutto insieme
      const result = await upsertPriceListEntriesAction(
        priceList.id,
        entriesToSave
      );

      if (result.success) {
        toast.success(
          `Modifiche salvate: ${result.inserted || 0} inserite, ${
            result.updated || 0
          } aggiornate`
        );
        setHasUnsavedChanges(false);
        // Ricarica listino per aggiornare entries
        await loadPriceList(priceList.id);
      } else {
        toast.error(result.error || "Errore salvataggio");
      }
    } catch (error: any) {
      console.error("Errore salvataggio batch:", error);
      toast.error("Errore durante il salvataggio");
    } finally {
      setIsSaving(false);
    }
  }

  // Annulla modifiche e ricarica dati originali
  function cancelEditing() {
    if (hasUnsavedChanges) {
      if (
        !confirm("Hai modifiche non salvate. Sei sicuro di voler annullare?")
      ) {
        return;
      }
    }
    setIsEditing(false);
    initializeEditingMatrix(entries);
    setHasUnsavedChanges(false);
  }

  // Costruisce merged rows (logica esistente)
  function buildMergedRows() {
    const sortedZones = [...PRICING_MATRIX.ZONES]
      .map((z) => z.code)
      .sort((a, b) => {
        const zoneA = PRICING_MATRIX.ZONES.find((z) => z.code === a);
        const zoneB = PRICING_MATRIX.ZONES.find((z) => z.code === b);
        return (zoneA?.priority || 999) - (zoneB?.priority || 999);
      });

    const normalizeZoneCode = (
      code: string | undefined | null
    ): string | null => {
      if (!code) return null;
      const legacyMap: Record<string, string> = {
        "IT-STD": "IT-ITALIA",
        "IT-CAL": "IT-CALABRIA",
        "IT-SIC": "IT-SICILIA",
        "IT-SAR": "IT-SARDEGNA",
        "IT-VEN": "IT-DISAGIATE",
        "IT-LIV": "IT-LIVIGNO",
        "IT-ISO": "IT-ISOLE-MINORI",
        "EU-Z1": "EU-ZONA1",
      };
      return legacyMap[code] || code;
    };

    const uniqueWeights = Array.from(
      new Set(entries.map((e) => e.weight_to))
    ).sort((a, b) => a - b);

    type MergedRow = {
      weightFrom: number;
      weightTo: number;
      prices: Record<string, number>;
    };

    const mergedRows: MergedRow[] = [];

    const getPricesForWeight = (w: number) => {
      const rowPrices: Record<string, number> = {};
      sortedZones.forEach((zoneCode) => {
        const entry = entries.find((e) => {
          const normalizedEntryZone = normalizeZoneCode(e.zone_code);
          return (
            (normalizedEntryZone === zoneCode || e.zone_code === zoneCode) &&
            e.weight_to === w
          );
        });
        rowPrices[zoneCode] = entry ? entry.base_price : -1;
      });
      return rowPrices;
    };

    const arePricesIdentical = (
      p1: Record<string, number>,
      p2: Record<string, number>
    ) => {
      return sortedZones.every((z) => p1[z] === p2[z]);
    };

    for (let i = 0; i < uniqueWeights.length; i++) {
      const currentWeight = uniqueWeights[i];
      const currentPrices = getPricesForWeight(currentWeight);
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
          });
        }
      } else {
        mergedRows.push({
          weightFrom: 0,
          weightTo: currentWeight,
          prices: currentPrices,
        });
      }
    }

    return mergedRows;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50">
      <DashboardNav title="Dettaglio Listino" subtitle={priceList.name} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header con Back */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/reseller/listini-fornitore")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna ai Listini
          </Button>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {priceList.name}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    {priceList.courier?.name || "Corriere non specificato"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Creato: {formatDate(priceList.created_at)}
                  </span>
                  <span>Versione: {priceList.version}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(priceList.status)}
              {/* ✨ FASE 5: Pulsante Approvazione (solo se draft) */}
              {priceList.status === "draft" && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={async () => {
                    const result = await approvePriceListAction(
                      priceList.id,
                      "balanced"
                    );
                    if (result.success) {
                      toast.success(
                        "Listino approvato e attivato con successo"
                      );
                      loadPriceList(priceList.id);
                    } else {
                      toast.error(
                        result.error || "Errore approvazione listino"
                      );
                      if (result.validation) {
                        console.log("Dettagli validazione:", result.validation);
                      }
                    }
                  }}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approva Listino
                </Button>
              )}
            </div>
          </div>

          {priceList.description && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-400 mt-0.5" />
                <p className="text-sm text-gray-600">{priceList.description}</p>
              </div>
            </div>
          )}

          {/* Statistiche */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Righe Tariffe</p>
              <p className="text-2xl font-bold text-blue-900">
                {entries.length}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">
                Margine Default
              </p>
              {priceList.list_type === "custom" && isEditing ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={priceList.default_margin_percent || 0}
                    onChange={async (e) => {
                      const newMargin = parseFloat(e.target.value) || 0;
                      const result = await updateCustomerPriceListMarginAction(
                        priceList.id,
                        newMargin
                      );
                      if (result.success && result.priceList) {
                        setPriceList(result.priceList);
                        toast.success("Margine aggiornato");
                      } else {
                        toast.error(result.error || "Errore aggiornamento");
                      }
                    }}
                    className="w-20 text-center"
                    disabled={isSaving}
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
              ) : (
                <p className="text-2xl font-bold text-green-900">
                  {priceList.default_margin_percent
                    ? `${priceList.default_margin_percent}%`
                    : "-"}
                </p>
              )}
              {priceList.list_type === "custom" && !isEditing && (
                <p className="text-xs text-gray-500 mt-1">
                  Clicca &quot;Modifica Manuale&quot; per modificare
                </p>
              )}
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Tipo</p>
              <p className="text-2xl font-bold text-purple-900 capitalize">
                {priceList.list_type || "supplier"}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">Fonte</p>
              <p className="text-2xl font-bold text-orange-900 capitalize">
                {priceList.source_type || "manual"}
              </p>
            </div>
          </div>
        </div>

        {/* ✨ FASE 6: Tabs per Matrice e Entries */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "matrix" | "entries")}
          className="w-full"
        >
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <TabsList>
                  <TabsTrigger value="matrix">
                    <Package className="h-4 w-4 mr-2" />
                    Matrice
                  </TabsTrigger>
                  <TabsTrigger value="entries">
                    <FileText className="h-4 w-4 mr-2" />
                    Entries ({entries.length})
                  </TabsTrigger>
                </TabsList>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {activeTab === "matrix"
                      ? "Tariffe per Peso e Zona (Matrice Completa)"
                      : "Lista Entries"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {activeTab === "matrix"
                      ? "Visualizzazione a matrice: Righe = Scaglioni di Peso, Colonne = Zone Geografiche"
                      : "Visualizzazione tabellare di tutte le entries con filtri"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* ✨ FASE 2: Pulsanti per inserimento entries */}
                {!isEditing && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowManualFormDialog(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Aggiungi Entry
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImportCsvDialog(true)}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Importa CSV
                    </Button>
                    {/* ✨ FASE 3: Pulsante Test API */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTestApiDialog(true)}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Test API
                    </Button>
                    {/* ✨ FASE 4: Pulsante Sync Incrementale */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSyncIncrementalDialog(true)}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Sync Incrementale
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfigDialog(true)}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Configurazione
                </Button>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Modifica Manuale
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={saveAllChanges}
                      disabled={isSaving || !hasUnsavedChanges}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? "Salvataggio..." : "Salva Tutto"}
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
                      <Badge
                        variant="outline"
                        className="bg-orange-50 text-orange-700"
                      >
                        Modifiche non salvate
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Tab Content: Matrice */}
            <TabsContent value="matrix" className="m-0">
              {editingMatrix.length === 0 && !isEditing ? (
                <div className="p-12 text-center">
                  <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    Nessuna tariffa nel listino
                  </p>
                  <p className="text-sm text-gray-500">
                    Le tariffe vengono aggiunte durante la sincronizzazione da
                    Spedisci.Online
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {(() => {
                    // Ordina zone secondo priority
                    const sortedZones = [...PRICING_MATRIX.ZONES]
                      .map((z) => z.code)
                      .sort((a, b) => {
                        const zoneA = PRICING_MATRIX.ZONES.find(
                          (z) => z.code === a
                        );
                        const zoneB = PRICING_MATRIX.ZONES.find(
                          (z) => z.code === b
                        );
                        return (
                          (zoneA?.priority || 999) - (zoneB?.priority || 999)
                        );
                      });

                    // Usa editingMatrix se in editing, altrimenti buildMergedRows per visualizzazione
                    const displayRows = isEditing
                      ? editingMatrix
                      : buildMergedRows();

                    return (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r">
                              Peso (KG)
                            </th>
                            {sortedZones.map((zoneCode) => {
                              const zone = PRICING_MATRIX.ZONES.find(
                                (z) => z.code === zoneCode
                              );
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
                            const rowId = isEditing
                              ? (row as MatrixRow).id
                              : `row-${idx}`;
                            const rowData = isEditing
                              ? (row as MatrixRow)
                              : {
                                  id: rowId,
                                  weightFrom: row.weightFrom,
                                  weightTo: row.weightTo,
                                  prices: row.prices,
                                  fuelSurcharge: 0,
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
                                          const newWeight =
                                            parseFloat(e.target.value) || 0;
                                          updateMatrixWeight(rowId, newWeight);
                                        }}
                                        className="w-20 text-center"
                                        disabled={isSaving}
                                      />
                                      <span className="text-xs text-gray-500">
                                        kg
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      {rowData.weightFrom === 0
                                        ? `Fino a ${rowData.weightTo}`
                                        : `${rowData.weightFrom} - ${rowData.weightTo}`}{" "}
                                      kg
                                    </>
                                  )}
                                </td>
                                {/* Colonne Zone - Editabili in modalità editing */}
                                {sortedZones.map((zoneCode) => {
                                  const price = rowData.prices[zoneCode] ?? -1;
                                  return (
                                    <td
                                      key={`${rowId}-${zoneCode}`}
                                      className="px-4 py-3 text-center"
                                    >
                                      {isEditing ? (
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={price >= 0 ? price : ""}
                                          onChange={(e) => {
                                            const value =
                                              e.target.value === ""
                                                ? -1
                                                : parseFloat(e.target.value) ||
                                                  0;
                                            updateMatrixPrice(
                                              rowId,
                                              zoneCode,
                                              value
                                            );
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
                                                  price === 0
                                                    ? "text-gray-400"
                                                    : "text-gray-900"
                                                }`}
                                              >
                                                {price === 0
                                                  ? "0,00 €"
                                                  : formatCurrency(price)}
                                              </span>
                                              {price === 0 && (
                                                <span className="text-[10px] text-orange-500 font-medium">
                                                  (da compilare)
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            <span className="text-gray-300">
                                              -
                                            </span>
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
                                        const value =
                                          parseFloat(e.target.value) || 0;
                                        updateMatrixFuelSurcharge(rowId, value);
                                      }}
                                      className="w-20 text-center"
                                      disabled={isSaving}
                                    />
                                  ) : (
                                    <span className="font-semibold text-gray-900">
                                      {rowData.fuelSurcharge > 0
                                        ? `${rowData.fuelSurcharge}%`
                                        : "-"}
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
                    );
                  })()}
                </div>
              )}
            </TabsContent>

            {/* ✨ FASE 6: Tab Content: Entries */}
            <TabsContent value="entries" className="m-0">
              <div className="p-6">
                {/* Filtri */}
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Filtra per Zona
                    </label>
                    <select
                      value={zoneFilter}
                      onChange={(e) => setZoneFilter(e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2 text-sm"
                    >
                      <option value="all">Tutte le zone</option>
                      {PRICING_MATRIX.ZONES.map((zone) => (
                        <option key={zone.code} value={zone.code}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      Filtra per Peso (kg)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={weightFilter === "all" ? "" : weightFilter}
                      onChange={(e) => setWeightFilter(e.target.value || "all")}
                      placeholder="Tutti i pesi"
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Tabella Entries */}
                {entries.length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      Nessuna entry nel listino
                    </p>
                    <p className="text-sm text-gray-500">
                      Aggiungi entries manualmente o importa da CSV
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">
                            Zona
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">
                            Peso da (kg)
                          </th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase">
                            Peso a (kg)
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">
                            Prezzo Base
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">
                            Fuel %
                          </th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase">
                            COD (€)
                          </th>
                          <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase">
                            Tipo Servizio
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {entries
                          .filter((entry) => {
                            if (
                              zoneFilter !== "all" &&
                              entry.zone_code !== zoneFilter
                            ) {
                              return false;
                            }
                            if (weightFilter !== "all") {
                              const weight = parseFloat(weightFilter);
                              if (
                                !isNaN(weight) &&
                                (weight < entry.weight_from ||
                                  weight > entry.weight_to)
                              ) {
                                return false;
                              }
                            }
                            return true;
                          })
                          .map((entry) => {
                            const zone = PRICING_MATRIX.ZONES.find(
                              (z) => z.code === entry.zone_code
                            );
                            return (
                              <tr key={entry.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                  <div>
                                    <div className="font-medium">
                                      {zone?.name || entry.zone_code || "-"}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {entry.zone_code}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {entry.weight_from} kg
                                </td>
                                <td className="px-4 py-3">
                                  {entry.weight_to} kg
                                </td>
                                <td className="px-4 py-3 text-right font-semibold">
                                  {formatCurrency(entry.base_price)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {entry.fuel_surcharge_percent
                                    ? `${entry.fuel_surcharge_percent}%`
                                    : "-"}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {entry.cash_on_delivery_surcharge
                                    ? formatCurrency(
                                        entry.cash_on_delivery_surcharge
                                      )
                                    : "-"}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {getServiceTypeBadge(entry.service_type)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Note e Info Aggiuntive */}
        {priceList.notes && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Note</h3>
            <p className="text-gray-600 whitespace-pre-wrap">
              {priceList.notes}
            </p>
          </div>
        )}

        {/* Dialog Configurazione Manuale */}
        {priceList && (
          <SupplierPriceListConfigDialog
            open={showConfigDialog}
            onOpenChange={(open) => {
              setShowConfigDialog(open);
            }}
            priceList={priceList}
            onSaveComplete={() => {
              loadPriceList(priceList.id);
            }}
          />
        )}

        {/* ✨ FASE 2: Dialog Form Manuale Entries */}
        {priceList && (
          <Dialog
            open={showManualFormDialog}
            onOpenChange={setShowManualFormDialog}
          >
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Aggiungi Entries Manualmente</DialogTitle>
                <DialogDescription>
                  Inserisci una o più entries manualmente per questo listino
                </DialogDescription>
              </DialogHeader>
              <ManualPriceListEntriesForm
                priceListId={priceList.id}
                onSuccess={() => {
                  setShowManualFormDialog(false);
                  loadPriceList(priceList.id);
                }}
                onCancel={() => setShowManualFormDialog(false)}
              />
            </DialogContent>
          </Dialog>
        )}

        {/* ✨ FASE 2: Dialog Import CSV */}
        {priceList && (
          <ImportCsvDialog
            open={showImportCsvDialog}
            onOpenChange={setShowImportCsvDialog}
            priceListId={priceList.id}
            onSuccess={() => {
              loadPriceList(priceList.id);
            }}
          />
        )}

        {/* ✨ FASE 3: Dialog Test API Validation */}
        {priceList && (
          <TestApiValidationDialog
            open={showTestApiDialog}
            onOpenChange={setShowTestApiDialog}
            priceList={priceList}
          />
        )}

        {/* ✨ FASE 4: Dialog Sync Incrementale */}
        {priceList && (
          <SyncIncrementalDialog
            open={showSyncIncrementalDialog}
            onOpenChange={setShowSyncIncrementalDialog}
            priceList={priceList}
            onSuccess={() => {
              loadPriceList(priceList.id);
            }}
          />
        )}
      </div>
    </div>
  );
}
