/**
 * Shared Pricing Logic - Single Source of Truth
 *
 * Calcola prezzi dai listini database (supplier + custom)
 * Usato da:
 * - /api/quotes/db (comparatore preventivi)
 * - /api/spedizioni (creazione spedizione fallback)
 * - Qualsiasi altro endpoint che necessita calcolo prezzi
 */

import { isSuperAdminCheck, isResellerCheck } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db/client';
import { calculateBestPriceForReseller } from '@/lib/db/price-lists-advanced';

export interface PriceCalculationParams {
  userId: string;
  workspaceId: string; // ✨ M3: Aggiunto per isolamento multi-tenant
  courierCode: string; // es. "Gls", "PosteDeliveryBusiness"
  weight: number;
  destination: {
    zip: string;
    province?: string;
    city?: string;
    country?: string;
  };
  serviceType?: 'standard' | 'express';
  options?: {
    cashOnDelivery?: boolean;
    declaredValue?: number;
    insurance?: boolean;
  };
}

export interface PriceCalculationResult {
  success: boolean;
  price?: number;
  supplierPrice?: number;
  margin?: number;
  contractCode?: string;
  carrierCode?: string;
  configId?: string;
  error?: string;
  details?: any;
}

/**
 * Calcola il prezzo finale per una spedizione dai listini database
 *
 * @param params - Parametri per il calcolo
 * @returns Prezzo finale calcolato dai listini personalizzati
 */
export async function calculatePriceFromPriceList(
  params: PriceCalculationParams
): Promise<PriceCalculationResult> {
  try {
    const {
      userId,
      workspaceId,
      courierCode,
      weight,
      destination,
      serviceType = 'standard',
      options = {},
    } = params;

    // Validazione parametri
    if (!userId || !workspaceId || !courierCode || !weight || weight <= 0) {
      return {
        success: false,
        error: 'Parametri mancanti o non validi (userId, workspaceId, courierCode, weight)',
      };
    }

    if (!destination.zip) {
      return {
        success: false,
        error: 'CAP destinazione obbligatorio',
      };
    }

    console.log(`💰 [PRICE CALC] Calcolo prezzo per:`, {
      userId: userId.substring(0, 8) + '...',
      courierCode,
      weight,
      destination: destination.zip,
    });

    // Recupera info utente
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('id', userId)
      .single();

    if (!user) {
      return {
        success: false,
        error: 'Utente non trovato',
      };
    }

    const isSuperadmin = isSuperAdminCheck(user);
    const isReseller = isResellerCheck(user);

    // Per reseller e superadmin: usa sistema listini avanzato
    if (isReseller || isSuperadmin) {
      // ✨ M3: Passa workspaceId
      const bestPriceResult = await calculateBestPriceForReseller(user.id, workspaceId, {
        weight: weight,
        destination: {
          zip: destination.zip,
          province: destination.province || undefined,
          country: destination.country || 'IT',
        },
        contractCode: courierCode, // Match per contract_code nei listini
        serviceType: serviceType,
        options: {
          declaredValue: options.declaredValue || 0,
          cashOnDelivery: options.cashOnDelivery || false,
          insurance: options.insurance || false,
        },
      });

      if (bestPriceResult && bestPriceResult.bestPrice) {
        const quote = bestPriceResult.bestPrice as any;

        console.log(`✅ [PRICE CALC] Prezzo calcolato:`, {
          totalPrice: quote.total_price,
          supplierPrice: quote.weight_price,
          margin: quote.margin,
          contractCode: quote.contractCode,
        });

        return {
          success: true,
          price: parseFloat(quote.total_price || '0'),
          supplierPrice: parseFloat(quote.weight_price || '0'),
          margin: parseFloat(quote.margin || '0'),
          contractCode: quote.contractCode,
          carrierCode: quote.carrierCode,
          configId: quote._configId || quote._courierConfigId,
          details: quote,
        };
      } else {
        console.warn(`⚠️ [PRICE CALC] Nessun prezzo trovato nei listini per:`, {
          courierCode,
          weight,
          destination: destination.zip,
        });
        return {
          success: false,
          error: `Nessun listino attivo trovato per il corriere ${courierCode}`,
        };
      }
    } else {
      // Utenti normali: usa listini assegnati (stessa logica)
      // TODO: Implementare se necessario per utenti normali
      return {
        success: false,
        error: 'Calcolo prezzi per utenti normali non ancora implementato',
      };
    }
  } catch (error: any) {
    console.error(`❌ [PRICE CALC] Errore calcolo prezzo:`, error);
    return {
      success: false,
      error: error.message || 'Errore durante il calcolo del prezzo',
    };
  }
}
