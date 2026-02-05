/**
 * API Route: Confronto Prezzi per Reseller
 *
 * Restituisce tutti i contratti disponibili (API Reseller e API Master)
 * con i prezzi calcolati per permettere confronto e selezione manuale
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { calculateBestPriceForReseller } from '@/lib/db/price-lists-advanced';
import type { CourierServiceType } from '@/types/shipments';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // ✨ M3: Usa getWorkspaceAuth per avere context con workspace
    const wsContext = await getWorkspaceAuth();
    if (!wsContext?.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const workspaceId = wsContext.workspace.id;

    const body = await request.json();
    const { weight, volume, destination, courierId, serviceType = 'standard', options = {} } = body;

    // Validazione parametri
    if (!weight || weight <= 0) {
      return NextResponse.json({ error: 'Peso obbligatorio e deve essere > 0' }, { status: 400 });
    }

    if (!destination?.zip) {
      return NextResponse.json({ error: 'CAP destinazione obbligatorio' }, { status: 400 });
    }

    // Recupera info utente
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller, account_type')
      .eq('email', wsContext.actor.email)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    // Se è reseller, calcola confronto API Reseller vs Master
    if (user.is_reseller) {
      // ✨ M3: Passa workspaceId
      const comparison = await calculateBestPriceForReseller(user.id, workspaceId, {
        weight: parseFloat(weight),
        volume: volume ? parseFloat(volume) : undefined,
        destination: {
          zip: destination.zip,
          province: destination.province,
          region: destination.region,
          country: destination.country || 'IT',
        },
        courierId,
        serviceType: serviceType as CourierServiceType,
        options: {
          declaredValue: options.declaredValue ? parseFloat(options.declaredValue) : undefined,
          cashOnDelivery: options.cashOnDelivery || false,
          insurance: options.insurance || false,
        },
      });

      if (!comparison) {
        return NextResponse.json({ error: 'Impossibile calcolare preventivo' }, { status: 500 });
      }

      // Costruisci risposta con tutti i contratti disponibili
      const contracts = [];

      // Contratto API Reseller (se disponibile)
      if (comparison.resellerPrice) {
        contracts.push({
          id: 'reseller',
          name: 'API Reseller',
          type: 'reseller',
          price: comparison.resellerPrice.finalPrice,
          basePrice: comparison.resellerPrice.basePrice,
          surcharges: comparison.resellerPrice.surcharges,
          margin: comparison.resellerPrice.margin,
          totalCost: comparison.resellerPrice.totalCost,
          isBest: comparison.apiSource === 'reseller',
          priceListId: comparison.resellerPrice.priceListId,
          // ✨ NUOVO: VAT Semantics (ADR-001) - Campi opzionali
          vat_mode: comparison.resellerPrice.vatMode || 'excluded',
          vat_rate: comparison.resellerPrice.vatRate || 22.0,
          vat_amount: comparison.resellerPrice.vatAmount || 0,
          total_price_with_vat:
            comparison.resellerPrice.totalPriceWithVAT || comparison.resellerPrice.finalPrice,
        });
      }

      // Contratto API Master (se disponibile)
      if (comparison.masterPrice) {
        contracts.push({
          id: 'master',
          name: 'API Master',
          type: 'master',
          price: comparison.masterPrice.finalPrice,
          basePrice: comparison.masterPrice.basePrice,
          surcharges: comparison.masterPrice.surcharges,
          margin: comparison.masterPrice.margin,
          totalCost: comparison.masterPrice.totalCost,
          isBest: comparison.apiSource === 'master',
          priceListId: comparison.masterPrice.priceListId,
          // ✨ NUOVO: VAT Semantics (ADR-001) - Campi opzionali
          vat_mode: comparison.masterPrice.vatMode || 'excluded',
          vat_rate: comparison.masterPrice.vatRate || 22.0,
          vat_amount: comparison.masterPrice.vatAmount || 0,
          total_price_with_vat:
            comparison.masterPrice.totalPriceWithVAT || comparison.masterPrice.finalPrice,
        });
      }

      return NextResponse.json({
        success: true,
        contracts,
        bestPrice: comparison.bestPrice.finalPrice,
        bestSource: comparison.apiSource,
        priceDifference: comparison.priceDifference,
      });
    }

    // Utente standard: calcola solo prezzo normale
    const { calculatePriceWithRules } = await import('@/lib/db/price-lists-advanced');
    // ✨ M3: Passa workspaceId
    const result = await calculatePriceWithRules(user.id, workspaceId, {
      weight: parseFloat(weight),
      volume: volume ? parseFloat(volume) : undefined,
      destination: {
        zip: destination.zip,
        province: destination.province,
        region: destination.region,
        country: destination.country || 'IT',
      },
      courierId,
      serviceType: serviceType as CourierServiceType,
      options: {
        declaredValue: options.declaredValue ? parseFloat(options.declaredValue) : undefined,
        cashOnDelivery: options.cashOnDelivery || false,
        insurance: options.insurance || false,
      },
    });

    if (!result) {
      return NextResponse.json({ error: 'Impossibile calcolare preventivo' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      contracts: [
        {
          id: 'default',
          name: 'Contratto Standard',
          type: 'default',
          price: result.finalPrice,
          basePrice: result.basePrice,
          surcharges: result.surcharges,
          margin: result.margin,
          totalCost: result.totalCost,
          isBest: true,
          priceListId: result.priceListId,
          // ✨ NUOVO: VAT Semantics (ADR-001) - Campi opzionali
          vat_mode: result.vatMode || 'excluded',
          vat_rate: result.vatRate || 22.0,
          vat_amount: result.vatAmount || 0,
          total_price_with_vat: result.totalPriceWithVAT || result.finalPrice,
        },
      ],
      bestPrice: result.finalPrice,
      bestSource: 'default',
    });
  } catch (error: any) {
    console.error('Errore confronto prezzi:', error);
    return NextResponse.json({ error: error.message || 'Errore sconosciuto' }, { status: 500 });
  }
}
