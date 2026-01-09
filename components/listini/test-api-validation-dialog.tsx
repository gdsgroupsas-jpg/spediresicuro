/**
 * Dialog per test validazione API vs Listino DB
 *
 * ✨ FASE 3: Testa 10 combinazioni random (zone/weight) confrontando
 * prezzi del listino DB vs prezzi API reali Spedisci.Online
 */

"use client";

import { testSpedisciOnlineRates } from "@/actions/spedisci-online-rates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRICING_MATRIX } from "@/lib/constants/pricing-matrix";
import type { PriceList, PriceListEntry } from "@/types/listini";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TestApiValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceList: PriceList;
}

interface TestResult {
  zone: string;
  zoneName: string;
  weight: number;
  dbPrice: number | null;
  apiPrice: number | null;
  difference: number | null;
  differencePercent: number | null;
  status: "match" | "warning" | "error" | "missing";
  error?: string;
}

export function TestApiValidationDialog({
  open,
  onOpenChange,
  priceList,
}: TestApiValidationDialogProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    matched: number;
    warnings: number;
    errors: number;
    missing: number;
    avgDifference: number;
  } | null>(null);

  // Estrai metadata per configurazione API
  const metadata = (priceList.metadata ||
    priceList.source_metadata ||
    {}) as any;
  const configId = metadata.courier_config_id;
  const carrierCode = metadata.carrier_code;
  const contractCode = metadata.contract_code;

  // Genera combinazioni random per test
  const generateTestCombinations = (
    entries: PriceListEntry[]
  ): Array<{ zone: string; weight: number }> => {
    if (!entries || entries.length === 0) {
      return [];
    }

    // Raggruppa entries per zona
    const entriesByZone = new Map<string, PriceListEntry[]>();
    entries.forEach((entry) => {
      if (entry.zone_code) {
        if (!entriesByZone.has(entry.zone_code)) {
          entriesByZone.set(entry.zone_code, []);
        }
        entriesByZone.get(entry.zone_code)!.push(entry);
      }
    });

    // Prendi 10 combinazioni random
    const combinations: Array<{ zone: string; weight: number }> = [];
    const zones = Array.from(entriesByZone.keys());

    // Se abbiamo meno di 10 zone, usa tutte le zone disponibili
    const zonesToTest = zones.slice(0, 10);

    zonesToTest.forEach((zone) => {
      const zoneEntries = entriesByZone.get(zone)!;
      if (zoneEntries.length > 0) {
        // Prendi un peso random nel range della prima entry
        const entry = zoneEntries[0];
        const weight =
          entry.weight_from + (entry.weight_to - entry.weight_from) / 2;
        combinations.push({ zone, weight: Math.round(weight * 100) / 100 });
      }
    });

    return combinations;
  };

  // Calcola prezzo da listino DB
  const calculateDbPrice = (
    zone: string,
    weight: number,
    entries: PriceListEntry[]
  ): number | null => {
    // Trova entry che matcha zona e peso
    const entry = entries.find((e) => {
      const zoneMatch = e.zone_code === zone;
      const weightMatch = weight >= e.weight_from && weight <= e.weight_to;
      return zoneMatch && weightMatch;
    });

    if (!entry) {
      return null;
    }

    // Calcola prezzo base + supplementi
    let price = entry.base_price;

    // Fuel surcharge
    if (entry.fuel_surcharge_percent) {
      price += price * (entry.fuel_surcharge_percent / 100);
    }

    // Island surcharge
    if (entry.island_surcharge) {
      price += entry.island_surcharge;
    }

    // ZTL surcharge
    if (entry.ztl_surcharge) {
      price += entry.ztl_surcharge;
    }

    return Math.round(price * 100) / 100;
  };

  // Ottieni indirizzo di test per zona
  const getTestAddressForZone = (zoneCode: string) => {
    const zone = PRICING_MATRIX.ZONES.find((z) => z.code === zoneCode);
    if (zone && zone.sampleAddress) {
      return zone.sampleAddress;
    }

    // Fallback: usa indirizzo standard
    return {
      city: "Milano",
      state: "MI",
      postalCode: "20100",
      country: "IT",
    };
  };

  // Esegui test
  const runTests = async () => {
    if (!priceList.entries || priceList.entries.length === 0) {
      toast.error("Listino non ha entries da testare");
      return;
    }

    if (!configId || !carrierCode || !contractCode) {
      toast.error(
        "Listino non ha metadata completi (configId, carrierCode, contractCode)"
      );
      return;
    }

    setIsTesting(true);
    setResults([]);
    setSummary(null);

    try {
      const entries = priceList.entries as PriceListEntry[];
      const combinations = generateTestCombinations(entries);

      if (combinations.length === 0) {
        toast.error("Nessuna combinazione valida trovata per il test");
        setIsTesting(false);
        return;
      }

      const testResults: TestResult[] = [];

      // Testa ogni combinazione
      for (const combo of combinations) {
        const zone = PRICING_MATRIX.ZONES.find((z) => z.code === combo.zone);
        const zoneName = zone?.name || combo.zone;
        const testAddress = getTestAddressForZone(combo.zone);

        // Calcola prezzo DB
        const dbPrice = calculateDbPrice(combo.zone, combo.weight, entries);

        // Chiama API
        const apiResult = await testSpedisciOnlineRates({
          packages: [
            {
              length: 30,
              width: 20,
              height: 15,
              weight: combo.weight,
            },
          ],
          shipFrom: {
            name: "Mittente Test",
            company: "Azienda Test",
            street1: "Via Roma 1",
            city: "Roma",
            state: "RM",
            postalCode: "00100",
            country: "IT",
            email: "test@example.com",
          },
          shipTo: {
            name: "Destinatario Test",
            street1: "Via Test 1",
            city: testAddress.city,
            state: testAddress.state,
            postalCode: testAddress.postalCode,
            country: testAddress.country,
            email: "test@example.com",
          },
          configId,
        });

        let apiPrice: number | null = null;
        let error: string | undefined;

        if (apiResult.success && apiResult.rates) {
          // Cerca rate che matcha carrierCode e contractCode
          const matchingRate = apiResult.rates.find((rate: any) => {
            const rateCarrierCode = rate.carrierCode?.toLowerCase();
            const rateContractCode = rate.contractCode?.toLowerCase();
            return (
              rateCarrierCode === carrierCode.toLowerCase() &&
              rateContractCode?.includes(contractCode.toLowerCase())
            );
          });

          if (matchingRate && matchingRate.total_price) {
            apiPrice = parseFloat(matchingRate.total_price);
          } else {
            error = `Rate non trovato per ${carrierCode}/${contractCode}`;
          }
        } else {
          error = apiResult.error || "Errore chiamata API";
        }

        // Calcola differenza
        let difference: number | null = null;
        let differencePercent: number | null = null;
        let status: TestResult["status"] = "error";

        if (dbPrice !== null && apiPrice !== null) {
          difference = apiPrice - dbPrice;
          differencePercent = dbPrice > 0 ? (difference / dbPrice) * 100 : 0;

          if (Math.abs(differencePercent) <= 1) {
            status = "match";
          } else if (Math.abs(differencePercent) <= 5) {
            status = "warning";
          } else {
            status = "error";
          }
        } else if (dbPrice === null) {
          status = "missing";
          error = "Entry non trovata nel listino DB";
        } else if (apiPrice === null) {
          status = "error";
        }

        testResults.push({
          zone: combo.zone,
          zoneName,
          weight: combo.weight,
          dbPrice,
          apiPrice,
          difference,
          differencePercent,
          status,
          error,
        });
      }

      setResults(testResults);

      // Calcola summary
      const matched = testResults.filter((r) => r.status === "match").length;
      const warnings = testResults.filter((r) => r.status === "warning").length;
      const errors = testResults.filter((r) => r.status === "error").length;
      const missing = testResults.filter((r) => r.status === "missing").length;

      const validDifferences = testResults
        .filter((r) => r.differencePercent !== null)
        .map((r) => Math.abs(r.differencePercent!));
      const avgDifference =
        validDifferences.length > 0
          ? validDifferences.reduce((a, b) => a + b, 0) /
            validDifferences.length
          : 0;

      setSummary({
        total: testResults.length,
        matched,
        warnings,
        errors,
        missing,
        avgDifference: Math.round(avgDifference * 100) / 100,
      });

      // Toast con risultato
      if (errors > 0 || missing > 0) {
        toast.warning(
          `Test completato: ${matched} match, ${warnings} warning, ${errors} errori, ${missing} mancanti`
        );
      } else if (warnings > 0) {
        toast.warning(
          `Test completato: ${matched} match, ${warnings} warning (differenza > 1%)`
        );
      } else {
        toast.success(`Test completato: ${matched} match perfetti`);
      }
    } catch (error: any) {
      console.error("Errore test API validation:", error);
      toast.error(`Errore durante il test: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Validazione API vs Listino DB</DialogTitle>
          <DialogDescription>
            Confronta i prezzi del listino DB con i prezzi reali dell&apos;API
            Spedisci.Online. Verranno testate 10 combinazioni random
            (zone/weight).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info metadata */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">
              Configurazione API
            </h4>
            <div className="text-sm text-blue-700 space-y-1">
              <p>
                <span className="font-medium">Config ID:</span>{" "}
                {configId || "N/A"}
              </p>
              <p>
                <span className="font-medium">Carrier Code:</span>{" "}
                {carrierCode || "N/A"}
              </p>
              <p>
                <span className="font-medium">Contract Code:</span>{" "}
                {contractCode || "N/A"}
              </p>
            </div>
            {(!configId || !carrierCode || !contractCode) && (
              <p className="text-sm text-red-600 mt-2">
                ⚠️ Metadata incompleti. Il test potrebbe non funzionare
                correttamente.
              </p>
            )}
          </div>

          {/* Pulsante Run Test */}
          <div className="flex justify-center">
            <Button
              onClick={runTests}
              disabled={isTesting || !configId || !carrierCode || !contractCode}
              className="gap-2"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Test in corso...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Esegui Test (10 combinazioni)
                </>
              )}
            </Button>
          </div>

          {/* Summary */}
          {summary && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Riepilogo Test</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Totali</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary.total}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-600">Match</p>
                  <p className="text-2xl font-bold text-green-700">
                    {summary.matched}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-yellow-600">Warning</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {summary.warnings}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-red-600">Errori</p>
                  <p className="text-2xl font-bold text-red-700">
                    {summary.errors}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Diff. Media</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {summary.avgDifference.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Risultati */}
          {results.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">
                Risultati Dettagliati
              </h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Zona</th>
                      <th className="px-4 py-2 text-left">Peso (kg)</th>
                      <th className="px-4 py-2 text-right">Prezzo DB</th>
                      <th className="px-4 py-2 text-right">Prezzo API</th>
                      <th className="px-4 py-2 text-right">Differenza</th>
                      <th className="px-4 py-2 text-center">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-4 py-2">
                          <div>
                            <div className="font-medium">{result.zoneName}</div>
                            <div className="text-xs text-gray-500">
                              {result.zone}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">{result.weight} kg</td>
                        <td className="px-4 py-2 text-right">
                          {result.dbPrice !== null
                            ? `€${result.dbPrice.toFixed(2)}`
                            : "-"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {result.apiPrice !== null
                            ? `€${result.apiPrice.toFixed(2)}`
                            : "-"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {result.difference !== null &&
                          result.differencePercent !== null ? (
                            <div>
                              <div
                                className={
                                  Math.abs(result.differencePercent) > 5
                                    ? "text-red-600 font-medium"
                                    : Math.abs(result.differencePercent) > 1
                                    ? "text-yellow-600"
                                    : "text-green-600"
                                }
                              >
                                {result.difference > 0 ? "+" : ""}
                                {result.difference.toFixed(2)}€ (
                                {result.differencePercent > 0 ? "+" : ""}
                                {result.differencePercent.toFixed(1)}%)
                              </div>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {result.status === "match" && (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          )}
                          {result.status === "warning" && (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Warning
                            </Badge>
                          )}
                          {result.status === "error" && (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3 mr-1" />
                              Errore
                            </Badge>
                          )}
                          {result.status === "missing" && (
                            <Badge className="bg-gray-100 text-gray-700">
                              <XCircle className="w-3 h-3 mr-1" />
                              Mancante
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
