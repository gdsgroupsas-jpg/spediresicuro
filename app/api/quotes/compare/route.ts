/**
 * API Route: Confronto Prezzi per Reseller
 * 
 * Restituisce tutti i contratti disponibili (API Reseller e API Master)
 * con i prezzi calcolati per permettere confronto e selezione manuale
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';
import { calculateBestPriceForReseller } from '@/lib/db/price-lists-advanced';
import type { CourierServiceType } from '@/types/shipments';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      weight,
      volume,
      destination,
      courierId,
      serviceType = 'standard',
      options = {},
    } = body;

    // Validazione parametri
    if (!weight || weight <= 0) {
      return NextResponse.json(
        { error: 'Peso obbligatorio e deve essere > 0' },
        { status: 400 }
      );
    }

    if (!destination?.zip) {
      return NextResponse.json(
        { error: 'CAP destinazione obbligatorio' },
        { status: 400 }
      );
    }

    // Recupera info utente
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller, account_type')
      .eq('email', session.user.email)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // Se è reseller, calcola confronto API Reseller vs Master
    if (user.is_reseller) {
      const comparison = await calculateBestPriceForReseller(user.id, {
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
        return NextResponse.json(
          { error: 'Impossibile calcolare preventivo' },
          { status: 500 }
        );
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
    const result = await calculatePriceWithRules(user.id, {
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
      return NextResponse.json(
        { error: 'Impossibile calcolare preventivo' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contracts: [{
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
      }],
      bestPrice: result.finalPrice,
      bestSource: 'default',
    });
  } catch (error: any) {
    console.error('Errore confronto prezzi:', error);
    return NextResponse.json(
      { error: error.message || 'Errore sconosciuto' },
      { status: 500 }
    );
  }
}
