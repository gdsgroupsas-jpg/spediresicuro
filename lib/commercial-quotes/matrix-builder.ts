/**
 * Matrix Builder - Genera matrice prezzi completa per preventivi commerciali
 *
 * Dato un price_list_id, carica tutte le entries e costruisce una matrice
 * peso x zona con margine applicato. Funzione server-side.
 *
 * Performance target: < 500ms (singola query + calcolo in-memory)
 */

import { supabaseAdmin } from '@/lib/db/client';
import type { PriceListEntry } from '@/types/listini';
import type {
  PriceMatrixSnapshot,
  PriceMatrixWeightRange,
  DeliveryMode,
} from '@/types/commercial-quotes';

// Zone standard italiane (ordine display nel PDF)
const DEFAULT_ZONE_LABELS: Record<string, string> = {
  'IT-ITALIA': 'Italia',
  'IT-SICILIA': 'Sicilia',
  'IT-CALABRIA': 'Calabria',
  'IT-SARDEGNA': 'Sardegna',
  'IT-LIVIGNO': 'Livigno',
};

export interface BuildPriceMatrixParams {
  priceListId: string;
  marginPercent: number;
  workspaceId: string;
  vatMode?: 'included' | 'excluded';
  vatRate?: number;
  /** Nome display del corriere per lo snapshot */
  carrierDisplayName: string;
  /** Tipo servizio da filtrare (default: 'standard') */
  serviceType?: string;
  /** Modalita' ritiro/consegna (default: 'carrier_pickup') */
  deliveryMode?: DeliveryMode;
  /** Supplemento ritiro in EUR (null = gratuito) */
  pickupFee?: number | null;
  /** La merce richiede lavorazione (etichettatura, imballaggio) */
  goodsNeedsProcessing?: boolean;
  /** Costo lavorazione per spedizione in EUR (null = incluso) */
  processingFee?: number | null;
  /** Margine fisso in EUR aggiunto a ogni fascia dopo il margine % */
  marginFixedEur?: number;
}

/**
 * Costruisce una PriceMatrixSnapshot da un listino esistente.
 *
 * 1. Carica price_list_entries in una query
 * 2. Raggruppa per zone_code (colonne) e fasce peso (righe)
 * 3. Applica margine percentuale
 * 4. Ritorna snapshot immutabile per il preventivo
 */
export async function buildPriceMatrix(
  params: BuildPriceMatrixParams
): Promise<PriceMatrixSnapshot> {
  const {
    priceListId,
    marginPercent,
    carrierDisplayName,
    vatMode = 'excluded',
    vatRate = 22,
    serviceType = 'standard',
    deliveryMode = 'carrier_pickup',
    pickupFee = null,
    goodsNeedsProcessing = false,
    processingFee = null,
    marginFixedEur,
  } = params;

  // 1. Carica tutte le entries del listino
  const { data: entries, error } = await supabaseAdmin
    .from('price_list_entries')
    .select('*')
    .eq('price_list_id', priceListId)
    .order('weight_from', { ascending: true });

  if (error) {
    throw new Error(`Errore caricamento listino: ${error.message}`);
  }

  if (!entries || entries.length === 0) {
    throw new Error('Listino senza voci di prezzo');
  }

  // 2. Filtra per service_type
  const typedEntries = entries as PriceListEntry[];
  const filteredEntries = typedEntries.filter(
    (e) => !e.service_type || e.service_type === serviceType
  );

  if (filteredEntries.length === 0) {
    throw new Error(`Nessuna voce per servizio "${serviceType}"`);
  }

  // 3. Estrai zone uniche (colonne)
  const zoneSet = new Set<string>();
  for (const entry of filteredEntries) {
    zoneSet.add(entry.zone_code || 'IT-ITALIA');
  }

  // Ordina zone secondo ordine standard
  const zoneOrder = Object.keys(DEFAULT_ZONE_LABELS);
  const sortedZoneCodes = Array.from(zoneSet).sort((a, b) => {
    const idxA = zoneOrder.indexOf(a);
    const idxB = zoneOrder.indexOf(b);
    // Zone note prima, poi le altre in ordine alfabetico
    if (idxA >= 0 && idxB >= 0) return idxA - idxB;
    if (idxA >= 0) return -1;
    if (idxB >= 0) return 1;
    return a.localeCompare(b);
  });

  const zones = sortedZoneCodes.map((code) => DEFAULT_ZONE_LABELS[code] || code);

  // 4. Estrai fasce peso uniche (righe)
  const weightRangeMap = new Map<string, PriceMatrixWeightRange>();
  for (const entry of filteredEntries) {
    const key = `${entry.weight_from}-${entry.weight_to}`;
    if (!weightRangeMap.has(key)) {
      weightRangeMap.set(key, {
        from: entry.weight_from,
        to: entry.weight_to,
        label: `${entry.weight_from} - ${entry.weight_to} kg`,
      });
    }
  }

  // Ordina per peso crescente
  const weightRanges = Array.from(weightRangeMap.values()).sort((a, b) => a.from - b.from);

  // 5. Costruisci matrice prezzi con margine
  // Indicizza entries per lookup rapido: chiave = "weightFrom-weightTo|zoneCode"
  const entryIndex = new Map<string, PriceListEntry>();
  for (const entry of filteredEntries) {
    const zone = entry.zone_code || 'IT-ITALIA';
    const key = `${entry.weight_from}-${entry.weight_to}|${zone}`;
    // Se duplicati, tieni quello con prezzo piu' specifico (ultimo vince)
    entryIndex.set(key, entry);
  }

  const marginMultiplier = 1 + marginPercent / 100;
  const fixedMargin = marginFixedEur ?? 0;

  const prices: number[][] = weightRanges.map((range) => {
    return sortedZoneCodes.map((zoneCode) => {
      const key = `${range.from}-${range.to}|${zoneCode}`;
      const entry = entryIndex.get(key);

      if (!entry) {
        // Se non c'e' prezzo specifico per questa zona, prova IT-ITALIA come fallback
        const fallbackKey = `${range.from}-${range.to}|IT-ITALIA`;
        const fallbackEntry = entryIndex.get(fallbackKey);
        if (fallbackEntry) {
          // Applica eventuale sovrapprezzo isola
          const surcharge = fallbackEntry.island_surcharge || 0;
          const basePrice = fallbackEntry.base_price + surcharge;
          return roundPrice(basePrice * marginMultiplier + fixedMargin);
        }
        return 0; // Nessun prezzo disponibile
      }

      const basePrice = entry.base_price + (entry.island_surcharge || 0);
      return roundPrice(basePrice * marginMultiplier + fixedMargin);
    });
  });

  // 6. Determina servizi inclusi
  const servicesIncluded: string[] = [];
  const sampleEntry = filteredEntries[0];
  if (sampleEntry?.fuel_surcharge_percent && sampleEntry.fuel_surcharge_percent > 0) {
    servicesIncluded.push('fuel_surcharge');
  }

  // 7. Costruisci snapshot
  const snapshot: PriceMatrixSnapshot = {
    zones,
    weight_ranges: weightRanges,
    prices,
    services_included: servicesIncluded,
    carrier_display_name: carrierDisplayName,
    vat_mode: vatMode,
    vat_rate: vatRate,
    pickup_fee: pickupFee ?? null,
    delivery_mode: deliveryMode,
    goods_needs_processing: goodsNeedsProcessing,
    processing_fee: processingFee ?? null,
    ...(fixedMargin > 0 && { margin_fixed_eur: fixedMargin }),
    generated_at: new Date().toISOString(),
  };

  return snapshot;
}

/** Arrotonda prezzo a 2 decimali */
function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}
