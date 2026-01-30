/**
 * Dialog per test validazione API vs Listino DB
 *
 * ✨ FASE 3: Testa 10 combinazioni random (zone/weight) confrontando
 * prezzi del listino DB vs prezzi API reali Spedisci.Online
 */

'use client';

import { testSpedisciOnlineRates } from '@/actions/spedisci-online-rates';
import { testSpediamoProRates } from '@/lib/actions/spediamopro';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PRICING_MATRIX } from '@/lib/constants/pricing-matrix';
import type { PriceList, PriceListEntry } from '@/types/listini';
import { AlertTriangle, CheckCircle2, Loader2, Play, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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
  status: 'match' | 'warning' | 'error' | 'missing';
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
  const metadata = (priceList.metadata || priceList.source_metadata || {}) as any;
  const configId = metadata.courier_config_id || metadata.config_id;
  const carrierCode = metadata.carrier_code;
  const contractCode = metadata.contract_code;
  const provider: string = metadata.provider || 'spediscionline';
  const isSpediamoPro = provider === 'spediamopro';

  // Europa zone mapping from metadata
  const zoneMapping = metadata?.zone_mapping as
    | Record<string, { label: string; countries: string[] }>
    | undefined;
  const isEuropa = isSpediamoPro && !!metadata?.region && metadata.region === 'europa';

  // Sample addresses per country for Europa testing
  const europaTestAddresses: Record<
    string,
    { city: string; state: string; postalCode: string; country: string }
  > = {
    FR: { city: 'Paris', state: '', postalCode: '75001', country: 'FR' },
    DE: { city: 'Berlin', state: '', postalCode: '10115', country: 'DE' },
    ES: { city: 'Madrid', state: '', postalCode: '28001', country: 'ES' },
    BE: { city: 'Bruxelles', state: '', postalCode: '1000', country: 'BE' },
    NL: { city: 'Amsterdam', state: '', postalCode: '1012', country: 'NL' },
    AT: { city: 'Wien', state: '', postalCode: '1010', country: 'AT' },
    PT: { city: 'Lisboa', state: '', postalCode: '1000-001', country: 'PT' },
    PL: { city: 'Warszawa', state: '', postalCode: '00-001', country: 'PL' },
    CZ: { city: 'Praha', state: '', postalCode: '11000', country: 'CZ' },
    HU: { city: 'Budapest', state: '', postalCode: '1011', country: 'HU' },
    RO: { city: 'Bucuresti', state: '', postalCode: '010011', country: 'RO' },
    BG: { city: 'Sofia', state: '', postalCode: '1000', country: 'BG' },
    GR: { city: 'Athina', state: '', postalCode: '10431', country: 'GR' },
    SE: { city: 'Stockholm', state: '', postalCode: '11120', country: 'SE' },
    FI: { city: 'Helsinki', state: '', postalCode: '00100', country: 'FI' },
    DK: { city: 'København', state: '', postalCode: '1050', country: 'DK' },
    IE: { city: 'Dublin', state: '', postalCode: 'D01', country: 'IE' },
    SK: { city: 'Bratislava', state: '', postalCode: '81101', country: 'SK' },
    SI: { city: 'Ljubljana', state: '', postalCode: '1000', country: 'SI' },
    HR: { city: 'Zagreb', state: '', postalCode: '10000', country: 'HR' },
    EE: { city: 'Tallinn', state: '', postalCode: '10111', country: 'EE' },
    LV: { city: 'Riga', state: '', postalCode: 'LV-1050', country: 'LV' },
    LT: { city: 'Vilnius', state: '', postalCode: 'LT-01100', country: 'LT' },
    LU: { city: 'Luxembourg', state: '', postalCode: '1111', country: 'LU' },
    GB: { city: 'London', state: '', postalCode: 'SW1A 1AA', country: 'GB' },
    CH: { city: 'Zürich', state: '', postalCode: '8001', country: 'CH' },
    NO: { city: 'Oslo', state: '', postalCode: '0150', country: 'NO' },
  };

  // Get test address for Europa zone (pick first country in zone)
  const getEuropaTestAddress = (zoneCode: string) => {
    if (zoneMapping?.[zoneCode]) {
      const firstCountry = zoneMapping[zoneCode].countries[0];
      return (
        europaTestAddresses[firstCountry] || {
          city: 'Paris',
          state: '',
          postalCode: '75001',
          country: 'FR',
        }
      );
    }
    return { city: 'Paris', state: '', postalCode: '75001', country: 'FR' };
  };

  // Genera combinazioni random per test
  const generateTestCombinations = (
    entries: PriceListEntry[]
  ): Array<{ zone: string; weight: number; entry?: PriceListEntry }> => {
    if (!entries || entries.length === 0) {
      return [];
    }

    // SpediamoPro Europa: entries have zone_code — pick 1-2 entries per zone
    if (isSpediamoPro && entries.some((e) => e.zone_code)) {
      const combinations: Array<{ zone: string; weight: number; entry?: PriceListEntry }> = [];
      const entriesByZone = new Map<string, PriceListEntry[]>();
      entries.forEach((e) => {
        const zc = e.zone_code || 'unknown';
        if (!entriesByZone.has(zc)) entriesByZone.set(zc, []);
        entriesByZone.get(zc)!.push(e);
      });

      // Take up to 10 combos spread across zones
      const zones = Array.from(entriesByZone.keys());
      let remaining = 10;
      const perZone = Math.max(1, Math.floor(10 / zones.length));

      for (const zone of zones) {
        if (remaining <= 0) break;
        const zEntries = entriesByZone.get(zone)!.sort((a, b) => a.weight_from - b.weight_from);
        const toTake = Math.min(perZone, remaining, zEntries.length);
        // Pick evenly spread entries
        const step = Math.max(1, Math.floor(zEntries.length / toTake));
        for (let i = 0; i < toTake && remaining > 0; i++) {
          const entry = zEntries[Math.min(i * step, zEntries.length - 1)];
          const weight = entry.weight_from + (entry.weight_to - entry.weight_from) / 2;
          combinations.push({
            zone: entry.zone_code || zone,
            weight: Math.round(weight * 100) / 100,
            entry,
          });
          remaining--;
        }
      }
      return combinations;
    }

    // SpediamoPro Italia: entries sono fasce peso (+ opzionalmente taglie)
    if (isSpediamoPro) {
      const combinations: Array<{ zone: string; weight: number; entry?: PriceListEntry }> = [];
      const sorted = [...entries].sort((a, b) => a.weight_from - b.weight_from);
      const toTest = sorted.slice(0, 10);
      toTest.forEach((entry) => {
        const weight = entry.weight_from + (entry.weight_to - entry.weight_from) / 2;
        const sizeLabel = (entry as any).size_label;
        const zoneName = sizeLabel ? `${sizeLabel} / ${weight} kg` : '-';
        combinations.push({ zone: zoneName, weight: Math.round(weight * 100) / 100, entry });
      });
      return combinations;
    }

    // SpedisciOnline: raggruppa entries per zona
    const entriesByZone = new Map<string, PriceListEntry[]>();
    entries.forEach((entry) => {
      if (entry.zone_code) {
        if (!entriesByZone.has(entry.zone_code)) {
          entriesByZone.set(entry.zone_code, []);
        }
        entriesByZone.get(entry.zone_code)!.push(entry);
      }
    });

    const combinations: Array<{ zone: string; weight: number }> = [];
    const zones = Array.from(entriesByZone.keys());
    const zonesToTest = zones.slice(0, 10);

    zonesToTest.forEach((zone) => {
      const zoneEntries = entriesByZone.get(zone)!;
      if (zoneEntries.length > 0) {
        const entry = zoneEntries[0];
        const weight = entry.weight_from + (entry.weight_to - entry.weight_from) / 2;
        combinations.push({ zone, weight: Math.round(weight * 100) / 100 });
      }
    });

    return combinations;
  };

  // Calcola prezzo da listino DB
  const calculateDbPrice = (
    zone: string,
    weight: number,
    entries: PriceListEntry[],
    refEntry?: PriceListEntry
  ): number | null => {
    const refSizeLabel = (refEntry as any)?.size_label;
    const refZoneCode = refEntry?.zone_code;
    // Trova entry che matcha zona/taglia e peso
    const entry = entries.find((e) => {
      const weightMatch = weight >= e.weight_from && weight <= e.weight_to;
      if (isSpediamoPro) {
        // Europa: match by zone_code + weight
        if (refZoneCode) {
          return weightMatch && e.zone_code === refZoneCode;
        }
        // Italia with sizes: match by size_label
        if (refSizeLabel) {
          return weightMatch && (e as any).size_label === refSizeLabel;
        }
        return weightMatch;
      }
      return e.zone_code === zone && weightMatch;
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
      city: 'Milano',
      state: 'MI',
      postalCode: '20100',
      country: 'IT',
    };
  };

  // Dimensioni pacco test: usa le dimensioni dall'entry se disponibili, altrimenti fallback dal nome
  const getTestPackageDimensions = (
    entry?: any,
    name?: string
  ): { length: number; width: number; height: number } => {
    if (entry?.max_length && entry?.max_width && entry?.max_height) {
      return { length: entry.max_length, width: entry.max_width, height: entry.max_height };
    }
    if (name) {
      const n = name.toLowerCase();
      if (n.includes('(s)')) return { length: 8, width: 38, height: 64 };
      if (n.includes('(m)')) return { length: 19, width: 38, height: 64 };
      if (n.includes('(l)')) return { length: 41, width: 38, height: 64 };
    }
    return { length: 30, width: 20, height: 15 };
  };

  // Esegui test
  const runTests = async () => {
    if (!priceList.entries || priceList.entries.length === 0) {
      toast.error('Listino non ha entries da testare');
      return;
    }

    if (!configId) {
      toast.error('Listino non ha metadata completi (configId mancante)');
      return;
    }

    if (!isSpediamoPro && (!carrierCode || !contractCode)) {
      toast.error('Listino non ha metadata completi (carrierCode, contractCode)');
      return;
    }

    setIsTesting(true);
    setResults([]);
    setSummary(null);

    try {
      const entries = priceList.entries as PriceListEntry[];
      const combinations = generateTestCombinations(entries);

      if (combinations.length === 0) {
        toast.error('Nessuna combinazione valida trovata per il test');
        setIsTesting(false);
        return;
      }

      const testResults: TestResult[] = [];

      // Testa ogni combinazione
      for (const combo of combinations) {
        const zone = isSpediamoPro ? null : PRICING_MATRIX.ZONES.find((z) => z.code === combo.zone);
        const sizeLabel = (combo.entry as any)?.size_label;
        const entryZoneCode = combo.entry?.zone_code;

        // Build zone display name
        let zoneName: string;
        if (isEuropa && entryZoneCode && zoneMapping?.[entryZoneCode]) {
          const zm = zoneMapping[entryZoneCode];
          zoneName = `${zm.label} (${zm.countries.slice(0, 3).join(', ')}${zm.countries.length > 3 ? '...' : ''})`;
        } else if (isSpediamoPro) {
          zoneName = sizeLabel ? `${sizeLabel} / ${combo.weight} kg` : `${combo.weight} kg`;
        } else {
          zoneName = zone?.name || combo.zone;
        }

        // Build test address
        let testAddress: { city: string; state: string; postalCode: string; country: string };
        if (isEuropa && entryZoneCode) {
          testAddress = getEuropaTestAddress(entryZoneCode);
        } else if (isSpediamoPro) {
          testAddress = { city: 'Milano', state: 'MI', postalCode: '20100', country: 'IT' };
        } else {
          testAddress = getTestAddressForZone(combo.zone);
        }

        // Calcola prezzo DB (passa entry di riferimento per match taglia)
        const dbPrice = calculateDbPrice(combo.zone, combo.weight, entries, combo.entry);

        // Chiama API (routing per provider)
        // Dimensioni pacco coerenti con la taglia dell'entry o del listino
        const testPackages = [
          { ...getTestPackageDimensions(combo.entry, priceList.name), weight: combo.weight },
        ];
        const apiResult = isSpediamoPro
          ? await testSpediamoProRates({
              packages: testPackages,
              shipFrom: {
                city: 'Roma',
                state: 'RM',
                postalCode: '00100',
                country: 'IT',
              },
              shipTo: {
                city: testAddress.city,
                state: testAddress.state,
                postalCode: testAddress.postalCode,
                country: testAddress.country,
              },
              configId,
            })
          : await testSpedisciOnlineRates({
              packages: testPackages,
              shipFrom: {
                name: 'Mittente Test',
                company: 'Azienda Test',
                street1: 'Via Roma 1',
                city: 'Roma',
                state: 'RM',
                postalCode: '00100',
                country: 'IT',
                email: 'test@example.com',
              },
              shipTo: {
                name: 'Destinatario Test',
                street1: 'Via Test 1',
                city: testAddress.city,
                state: testAddress.state,
                postalCode: testAddress.postalCode,
                country: testAddress.country,
                email: 'test@example.com',
              },
              configId,
            });

        let apiPrice: number | null = null;
        let error: string | undefined;

        if (apiResult.success && apiResult.rates) {
          // Cerca rate che matcha il carrier
          const matchingRate = isSpediamoPro
            ? apiResult.rates.find(
                (rate: any) => rate.carrierCode?.toLowerCase() === carrierCode?.toLowerCase()
              )
            : apiResult.rates.find((rate: any) => {
                const rateCarrierCode = rate.carrierCode?.toLowerCase();
                const rateContractCode = rate.contractCode?.toLowerCase();
                return (
                  rateCarrierCode === carrierCode?.toLowerCase() &&
                  rateContractCode?.includes(contractCode?.toLowerCase())
                );
              });

          if (matchingRate && matchingRate.total_price) {
            apiPrice = parseFloat(matchingRate.total_price);
          } else {
            const availableCarriers = apiResult.rates.map((r: any) => r.carrierCode).join(', ');
            error = isSpediamoPro
              ? `Carrier "${carrierCode}" non trovato. Disponibili: ${availableCarriers}`
              : `Rate non trovato per ${carrierCode}/${contractCode}`;
          }
        } else {
          error = apiResult.error || `Errore API (rates: ${apiResult.rates?.length ?? 'null'})`;
        }

        // Calcola differenza
        let difference: number | null = null;
        let differencePercent: number | null = null;
        let status: TestResult['status'] = 'error';

        if (dbPrice !== null && apiPrice !== null) {
          difference = apiPrice - dbPrice;
          differencePercent = dbPrice > 0 ? (difference / dbPrice) * 100 : 0;

          if (Math.abs(differencePercent) <= 1) {
            status = 'match';
          } else if (Math.abs(differencePercent) <= 5) {
            status = 'warning';
          } else {
            status = 'error';
          }
        } else if (dbPrice === null) {
          status = 'missing';
          error = 'Entry non trovata nel listino DB';
        } else if (apiPrice === null) {
          status = 'error';
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
      const matched = testResults.filter((r) => r.status === 'match').length;
      const warnings = testResults.filter((r) => r.status === 'warning').length;
      const errors = testResults.filter((r) => r.status === 'error').length;
      const missing = testResults.filter((r) => r.status === 'missing').length;

      const validDifferences = testResults
        .filter((r) => r.differencePercent !== null)
        .map((r) => Math.abs(r.differencePercent!));
      const avgDifference =
        validDifferences.length > 0
          ? validDifferences.reduce((a, b) => a + b, 0) / validDifferences.length
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
        toast.warning(`Test completato: ${matched} match, ${warnings} warning (differenza > 1%)`);
      } else {
        toast.success(`Test completato: ${matched} match perfetti`);
      }
    } catch (error: any) {
      console.error('Errore test API validation:', error);
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
            Confronta i prezzi del listino DB con i prezzi reali dell&apos;API{' '}
            {isSpediamoPro ? 'SpediamoPro' : 'Spedisci.Online'}. Verranno testate 10 combinazioni
            random (zone/weight).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info metadata */}
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Configurazione API</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>
                <span className="font-semibold">Provider:</span>{' '}
                {isSpediamoPro ? 'SpediamoPro' : 'Spedisci.Online'}
              </p>
              <p>
                <span className="font-semibold">Config ID:</span>{' '}
                <code className="text-xs bg-blue-100 px-1.5 py-0.5 rounded">
                  {configId || 'N/A'}
                </code>
              </p>
              {!isSpediamoPro && (
                <>
                  <p>
                    <span className="font-semibold">Carrier Code:</span> {carrierCode || 'N/A'}
                  </p>
                  <p>
                    <span className="font-semibold">Contract Code:</span> {contractCode || 'N/A'}
                  </p>
                </>
              )}
            </div>
            {(!configId || (!isSpediamoPro && (!carrierCode || !contractCode))) && (
              <p className="text-sm text-red-700 font-medium mt-2">
                Metadata incompleti. Il test potrebbe non funzionare correttamente.
              </p>
            )}
          </div>

          {/* Pulsante Run Test */}
          <div className="flex justify-center">
            <Button
              onClick={runTests}
              disabled={
                isTesting || !configId || (!isSpediamoPro && (!carrierCode || !contractCode))
              }
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
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-5">
              <h4 className="font-semibold text-gray-900 mb-4">Riepilogo Test</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Totali
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                    Match
                  </p>
                  <p className="text-3xl font-bold text-green-700 mt-1">{summary.matched}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider">
                    Warning
                  </p>
                  <p className="text-3xl font-bold text-yellow-700 mt-1">{summary.warnings}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                    Errori
                  </p>
                  <p className="text-3xl font-bold text-red-700 mt-1">{summary.errors}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Diff. Media
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {summary.avgDifference.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Risultati */}
          {results.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Risultati Dettagliati</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">
                        {isSpediamoPro ? 'Fascia' : 'Zona'}
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">Peso (kg)</th>
                      <th className="px-4 py-3 text-right font-semibold">Prezzo DB</th>
                      <th className="px-4 py-3 text-right font-semibold">Prezzo API</th>
                      <th className="px-4 py-3 text-right font-semibold">Differenza</th>
                      <th className="px-4 py-3 text-center font-semibold">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => (
                      <tr
                        key={idx}
                        className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{result.zoneName}</div>
                          {result.zone !== '-' && (
                            <div className="text-xs text-gray-500">{result.zone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{result.weight} kg</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                          {result.dbPrice !== null ? `€${result.dbPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                          {result.apiPrice !== null ? `€${result.apiPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {result.difference !== null && result.differencePercent !== null ? (
                            <span
                              className={`font-bold ${
                                Math.abs(result.differencePercent) > 5
                                  ? 'text-red-700'
                                  : Math.abs(result.differencePercent) > 1
                                    ? 'text-yellow-700'
                                    : 'text-green-700'
                              }`}
                            >
                              {result.difference > 0 ? '+' : ''}
                              {result.difference.toFixed(2)}€ (
                              {result.differencePercent > 0 ? '+' : ''}
                              {result.differencePercent.toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {result.status === 'match' && (
                            <Badge className="bg-green-600 text-white font-semibold">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              OK
                            </Badge>
                          )}
                          {result.status === 'warning' && (
                            <Badge className="bg-yellow-500 text-white font-semibold">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Warning
                            </Badge>
                          )}
                          {result.status === 'error' && (
                            <div>
                              <Badge className="bg-red-600 text-white font-semibold">
                                <XCircle className="w-3 h-3 mr-1" />
                                Errore
                              </Badge>
                              {result.error && (
                                <div
                                  className="text-xs text-red-600 mt-1 max-w-[300px] whitespace-normal break-words"
                                  title={result.error}
                                >
                                  {result.error}
                                </div>
                              )}
                            </div>
                          )}
                          {result.status === 'missing' && (
                            <Badge className="bg-gray-500 text-white font-semibold">
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
