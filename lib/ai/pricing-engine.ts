/**
 * Pricing Engine per Anne
 *
 * Calcola il prezzo ottimale per una spedizione basandosi su:
 * - Peso e dimensioni
 * - Destinazione (CAP, provincia)
 * - Tipo servizio richiesto
 * - Opzioni (contrassegno, assicurazione)
 *
 * Restituisce il corriere e servizio più conveniente
 */

import { supabaseAdmin } from '@/lib/db/client';
import { calculatePrice } from '@/lib/db/price-lists';
import { featureFlags, pricingConfig } from '@/lib/config';

export interface PricingRequest {
  weight: number; // kg
  destinationZip: string; // CAP destinazione (5 cifre)
  destinationProvince: string; // Provincia (2 lettere, es. "RM")
  serviceType?: 'standard' | 'express' | 'economy';
  cashOnDelivery?: number; // Importo contrassegno (0 = no contrassegno)
  declaredValue?: number; // Valore dichiarato per assicurazione
  insurance?: boolean;
  workspaceId?: string; // ID workspace per isolamento multi-tenant
}

export interface PricingResult {
  courier: string;
  serviceType: string;
  basePrice: number;
  surcharges: number;
  totalCost: number;
  finalPrice: number; // Con margine applicato
  margin: number;
  estimatedDeliveryDays: {
    min: number;
    max: number;
  };
  recommendation: 'best_price' | 'best_speed' | 'best_reliability';
}

/**
 * Determina la zona geografica dal CAP
 */
function getZoneFromZip(zip: string): string {
  const cap = parseInt(zip);

  // Nord (20xxx-29xxx)
  if (cap >= 20000 && cap <= 29999) return 'nord';

  // Centro (00xxx-09xxx, 10xxx-19xxx, 30xxx-69xxx)
  if (
    (cap >= 0 && cap <= 9999) ||
    (cap >= 10000 && cap <= 19999) ||
    (cap >= 30000 && cap <= 69999)
  ) {
    return 'centro';
  }

  // Sud e Isole (70xxx-99xxx)
  if (cap >= 70000 && cap <= 99999) return 'sud';

  return 'centro'; // Default
}

/**
 * Determina se è un'isola dal CAP
 */
function isIsland(zip: string, province: string): boolean {
  const islandProvinces = ['CA', 'SS', 'NU', 'OT', 'TP', 'AG', 'CL', 'EN', 'RG', 'SR', 'ME', 'PA'];
  return islandProvinces.includes(province.toUpperCase());
}

/**
 * Calcola prezzo per tutti i corrieri disponibili
 */
export async function calculateOptimalPrice(request: PricingRequest): Promise<PricingResult[]> {
  try {
    // Recupera tutti i corrieri attivi
    const { data: couriers, error: couriersError } = await supabaseAdmin
      .from('couriers')
      .select('id, name, code')
      .eq('status', 'active');

    if (couriersError || !couriers || couriers.length === 0) {
      console.error('Errore recupero corrieri:', couriersError);
      return [];
    }

    const results: PricingResult[] = [];
    // ⚠️ RIMOSSO: const marginPercent = 15 hardcoded
    // Il margine deve venire dal listino o non essere applicato

    // Calcola per ogni corriere
    for (const courier of couriers) {
      try {
        // Prova prima con il tipo servizio richiesto, poi con standard
        const serviceTypes = request.serviceType
          ? [request.serviceType, 'standard']
          : ['standard', 'express', 'economy'];

        for (const serviceType of serviceTypes) {
          const priceResult = await calculatePrice(
            courier.id,
            request.workspaceId || '',
            request.weight,
            request.destinationZip,
            serviceType,
            {
              cashOnDelivery: request.cashOnDelivery ? request.cashOnDelivery > 0 : false,
              declaredValue: request.declaredValue,
              insurance: request.insurance,
            }
          );

          if (priceResult) {
            // ✅ NUOVO: Usa margine dal listino se disponibile
            let margin: number;
            let finalPrice: number;

            // Il calcolo prezzo può includere già il margine (se listino configurato)
            // Nota: calculatePrice restituisce { basePrice, surcharges, totalCost, details }
            // Il margine potrebbe essere in details.margin se il listino lo include
            const marginFromDetails = priceResult.details?.margin;
            if (marginFromDetails !== undefined && marginFromDetails !== null) {
              // Margine dal listino (preferito)
              margin = marginFromDetails;
              finalPrice = priceResult.totalCost + margin;
            } else if (featureFlags.FINANCE_STRICT_MARGIN) {
              // Strict mode: skip corriere se manca configurazione margine
              console.warn(
                `[PRICING_ENGINE] Corriere ${courier.name} senza margine configurato - skipped in strict mode`
              );
              continue;
            } else {
              // Legacy mode: fallback con warning deprecation
              console.warn(
                `[PRICING_ENGINE] ⚠️ DEPRECATED: Usando DEFAULT_MARGIN_PERCENT (${pricingConfig.DEFAULT_MARGIN_PERCENT}%) per ${courier.name}. Configurare listino.`
              );
              margin = (priceResult.totalCost * pricingConfig.DEFAULT_MARGIN_PERCENT) / 100;
              finalPrice = priceResult.totalCost + margin;
            }

            results.push({
              courier: courier.name,
              serviceType,
              basePrice: priceResult.basePrice,
              surcharges: priceResult.surcharges,
              totalCost: priceResult.totalCost,
              finalPrice: Math.round(finalPrice * 100) / 100,
              margin: Math.round(margin * 100) / 100,
              estimatedDeliveryDays: priceResult.details.estimatedDeliveryDays || {
                min: 3,
                max: 5,
              },
              recommendation: 'best_price', // TODO: calcolare in base a metriche
            });

            // Se abbiamo trovato un prezzo per il servizio richiesto, non provare altri
            if (request.serviceType && serviceType === request.serviceType) {
              break;
            }
          }
        }
      } catch (error: any) {
        console.error(`Errore calcolo prezzo per ${courier.name}:`, error);
        // Continua con il prossimo corriere
      }
    }

    // Ordina per prezzo finale (crescente)
    results.sort((a, b) => a.finalPrice - b.finalPrice);

    // Assegna raccomandazione
    if (results.length > 0) {
      results[0].recommendation = 'best_price';
    }

    return results;
  } catch (error: any) {
    console.error('Errore calcolo prezzo ottimale:', error);
    return [];
  }
}

/**
 * Suggerimento rapido: corriere migliore per una destinazione
 */
export async function getBestCourierForDestination(
  zip: string,
  province: string,
  weight: number
): Promise<{ courier: string; price: number; reason: string } | null> {
  const results = await calculateOptimalPrice({
    weight,
    destinationZip: zip,
    destinationProvince: province,
  });

  if (results.length === 0) {
    return null;
  }

  const best = results[0];
  const zone = getZoneFromZip(zip);
  const isIslandDest = isIsland(zip, province);

  let reason = `Prezzo più conveniente: €${best.finalPrice.toFixed(2)}`;

  if (isIslandDest) {
    reason += ' (destinazione isola)';
  } else if (zone === 'sud') {
    reason += ' (destinazione sud Italia)';
  }

  return {
    courier: best.courier,
    price: best.finalPrice,
    reason,
  };
}
