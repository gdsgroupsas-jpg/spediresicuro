/**
 * Pagina Dettaglio Listino Fornitore per Reseller
 *
 * Visualizza il listino con le sue righe (entries) in formato tabellare
 * Dati basati su peso in kg e prezzi
 */

"use client";

import { getPriceListByIdAction } from "@/actions/price-lists";
import DashboardNav from "@/components/dashboard-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PriceList, PriceListEntry } from "@/types/listini";
import { ArrowLeft, Calendar, Info, Package, Truck } from "lucide-react";
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
              <p className="text-2xl font-bold text-green-900">
                {priceList.default_margin_percent
                  ? `${priceList.default_margin_percent}%`
                  : "-"}
              </p>
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

        {/* Matrix View (Pivot Table) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Tariffe per Peso e Zona (Matrice Completa)
            </h2>
            <p className="text-sm text-gray-500">
              Visualizzazione a matrice: Righe = Scaglioni di Peso, Colonne =
              Zone Geografiche
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Nessuna tariffa nel listino</p>
              <p className="text-sm text-gray-500">
                Le tariffe vengono aggiunte durante la sincronizzazione da
                Spedisci.Online
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {(() => {
                // 1. Extract Unique Zones (Cols) and Sort
                // Priority: IT-STD, IT-CAL, IT-SIC, IT-SAR, IT-VEN, IT-LIV, IT-ISO, EU*
                const uniqueZones = Array.from(
                  new Set(entries.map((e) => e.zone_code || "Tutte"))
                ).sort((a, b) => {
                  const priority = [
                    "IT-STD",
                    "IT-CAL",
                    "IT-SIC",
                    "IT-SAR",
                    "IT-VEN",
                    "IT-LIV",
                    "IT-ISO",
                  ];
                  const idxA = priority.indexOf(a);
                  const idxB = priority.indexOf(b);
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return a.localeCompare(b);
                });

                // 2. Extract Unique Weights (Rows) and Sort
                // Group by "weight_to" as the breakpoint
                const uniqueWeights = Array.from(
                  new Set(entries.map((e) => e.weight_to))
                ).sort((a, b) => a - b);

                // 3. Merging Logic (Smart Grouping)
                // We want to group consecutive weight rows if ALL prices in that row are identical to the next one.
                type MergedRow = {
                  weightFrom: number;
                  weightTo: number;
                  prices: Record<string, number>; // zone -> price
                };

                const mergedRows: MergedRow[] = [];

                // Helper to get prices for a specific weight breakpoint
                const getPricesForWeight = (w: number) => {
                  const rowPrices: Record<string, number> = {};
                  uniqueZones.forEach((z) => {
                    const entry = entries.find(
                      (e) =>
                        (e.zone_code === z ||
                          (!e.zone_code && z === "Tutte")) &&
                        e.weight_to === w
                    );
                    // Use -1 if missing to ensure we don't accidentally merge existing with missing
                    rowPrices[z] = entry ? entry.base_price : -1;
                  });
                  return rowPrices;
                };

                // Helper to check if two price maps are identical
                const arePricesIdentical = (
                  p1: Record<string, number>,
                  p2: Record<string, number>
                ) => {
                  return uniqueZones.every((z) => p1[z] === p2[z]);
                };

                for (let i = 0; i < uniqueWeights.length; i++) {
                  const currentWeight = uniqueWeights[i];
                  const currentPrices = getPricesForWeight(currentWeight);

                  // Find previous weight boundary for this specific row (or 0)
                  // Note: This is an approximation. Ideally we use the entry's weight_from,
                  // but since we are iterating breakpoints, we assume continuity.
                  // For the merged row, we just track the min Start and max End.
                  let prevWeightBreakpoint = i > 0 ? uniqueWeights[i - 1] : 0;

                  if (mergedRows.length > 0) {
                    const lastMerged = mergedRows[mergedRows.length - 1];

                    // Try to merge with previous if prices match
                    if (arePricesIdentical(lastMerged.prices, currentPrices)) {
                      // UPDATE previous merged row to extend to current weight
                      lastMerged.weightTo = currentWeight;
                    } else {
                      // New Row
                      mergedRows.push({
                        weightFrom: lastMerged.weightTo, // Start where last ended
                        weightTo: currentWeight,
                        prices: currentPrices,
                      });
                    }
                  } else {
                    // First Row
                    mergedRows.push({
                      weightFrom: 0,
                      weightTo: currentWeight,
                      prices: currentPrices,
                    });
                  }
                }

                return (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 border-r">
                          Peso (KG)
                        </th>
                        {uniqueZones.map((zone) => (
                          <th
                            key={zone}
                            className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider border-b"
                          >
                            {zone}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {mergedRows.map((row, idx) => {
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-gray-900 border-r bg-gray-50 sticky left-0 z-10 whitespace-nowrap">
                              {row.weightFrom === 0
                                ? `Fino a ${row.weightTo}`
                                : `${row.weightFrom} - ${row.weightTo}`}{" "}
                              kg
                            </td>
                            {uniqueZones.map((zone) => {
                              const price = row.prices[zone];
                              return (
                                <td
                                  key={`${idx}-${zone}`}
                                  className="px-4 py-3 text-center"
                                >
                                  {price >= 0 ? (
                                    <div className="flex flex-col items-center">
                                      <span className="font-bold text-gray-900">
                                        {formatCurrency(price)}
                                      </span>
                                      {/* Show Surcharges if huge difference */}
                                      {price > 12 && (
                                        <span className="text-[10px] text-orange-600 font-medium">
                                          (Zona Remota?)
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}
        </div>

        {/* Note e Info Aggiuntive */}
        {priceList.notes && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Note</h3>
            <p className="text-gray-600 whitespace-pre-wrap">
              {priceList.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
