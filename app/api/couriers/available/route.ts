/**
 * API: Available Couriers
 *
 * GET /api/couriers/available - Recupera corrieri disponibili per l'utente corrente
 * 
 * Basato su:
 * 1. Configurazioni API (courier_configs) con owner_user_id = userId
 * 2. contract_mapping JSONB per estrarre corrieri configurati
 * 
 * ⚠️ SICUREZZA: Espone SOLO dati necessari alla UI
 * NON espone: contractCode, API keys, providerId, courierId interno
 * 
 * Risposta:
 * {
 *   couriers: [
 *     { displayName: string, courierName: string }
 *   ],
 *   total: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-middleware';
import { handleApiError } from '@/lib/api-responses';
import { getAvailableCouriersForUser } from '@/lib/db/price-lists';

// ⚠️ IMPORTANTE: Questa route usa headers() per l'autenticazione, quindi deve essere dinamica
export const dynamic = 'force-dynamic';

/**
 * Mapping nomi corriere interni -> nomi display UI
 * I nomi nel contract_mapping sono tecnici (es. "PosteDeliveryBusiness", "Gls")
 * Per la UI vogliamo nomi user-friendly (es. "Poste Italiane", "GLS")
 */
const COURIER_DISPLAY_NAMES: Record<string, string> = {
  'Gls': 'GLS',
  'GLS': 'GLS',
  'gls': 'GLS',
  'PosteDeliveryBusiness': 'Poste Italiane',
  'postedeliverybusiness': 'Poste Italiane',
  'Poste': 'Poste Italiane',
  'BRT': 'Bartolini',
  'Bartolini': 'Bartolini',
  'brt': 'Bartolini',
  'SDA': 'SDA',
  'sda': 'SDA',
  'DHL': 'DHL',
  'dhl': 'DHL',
  'TNT': 'TNT',
  'tnt': 'TNT',
  'UPS': 'UPS',
  'ups': 'UPS',
  'FedEx': 'FedEx',
  'fedex': 'FedEx',
};

/**
 * Ottiene il nome display per un corriere
 */
function getDisplayName(courierName: string): string {
  return COURIER_DISPLAY_NAMES[courierName] || courierName;
}

/**
 * GET - Recupera corrieri disponibili per l'utente autenticato
 * 
 * ⚠️ SICUREZZA: Espone SOLO dati necessari alla UI (displayName, courierId)
 * NON espone: contractCode, API keys, providerId dettagliato
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticazione
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { session } = authResult;

    const userId = session.user.id;

    // Recupera corrieri disponibili dal DB
    const couriers = await getAvailableCouriersForUser(userId);

    // ⚠️ IMPORTANTE: Include contractCode per distinguere contratti diversi con stesso displayName
    // Es: "PosteDeliveryBusiness" e "Poste Italiane" possono avere contractCode diversi
    // e devono essere mostrati come opzioni separate
    const safeCouriers = couriers.map((courier) => ({
      displayName: getDisplayName(courier.courierName),
      courierName: courier.courierName,
      contractCode: courier.contractCode, // ⚠️ Necessario per distinguere contratti
    }));

    // ⚠️ FIX: Deduplica per displayName + contractCode invece di solo displayName
    // Questo permette di mostrare più contratti con stesso nome (es. due contratti Poste Italiane)
    const uniqueCouriers = Array.from(
      new Map(safeCouriers.map((c) => [`${c.displayName}::${c.contractCode}`, c])).values()
    );

    return NextResponse.json({
      couriers: uniqueCouriers,
      total: uniqueCouriers.length,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/couriers/available');
  }
}
