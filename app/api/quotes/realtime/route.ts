/**
 * API Route: Quote Real-Time da Spedisci.Online
 * 
 * Chiama API Spedisci.Online per ottenere rates real-time con cache Redis
 * 
 * ⚠️ ENTERPRISE: Include cache Redis (TTL 5min), debounce, retry logic
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { testSpedisciOnlineRates } from '@/actions/spedisci-online-rates';

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
      zip,
      province,
      city,
      courier,
      contractCode,
      services = [],
      insuranceValue = 0,
      codValue = 0,
      shipFrom, // Opzionale, usa default se non fornito
      shipTo, // Opzionale, usa default se non fornito
    } = body;

    // Validazione parametri minimi
    if (!weight || weight <= 0) {
      return NextResponse.json(
        { error: 'Peso obbligatorio e deve essere > 0' },
        { status: 400 }
      );
    }

    if (!zip) {
      return NextResponse.json(
        { error: 'CAP destinazione obbligatorio' },
        { status: 400 }
      );
    }

    // Prepara parametri per testSpedisciOnlineRates
    const testParams = {
      packages: [{
        length: 30,
        width: 20,
        height: 15,
        weight: parseFloat(weight),
      }],
      shipFrom: shipFrom || {
        name: 'Mittente',
        street1: 'Via Roma 1',
        city: 'Roma',
        state: 'RM',
        postalCode: '00100',
        country: 'IT',
        email: session.user.email || 'mittente@example.com',
      },
      shipTo: shipTo || {
        name: 'Destinatario',
        street1: 'Via Destinazione 1',
        city: city || 'Milano',
        state: province || 'MI',
        postalCode: zip,
        country: 'IT',
        email: 'destinatario@example.com',
      },
      notes: `Quote real-time per ${courier || 'corriere'}`,
      insuranceValue: parseFloat(insuranceValue) || 0,
      codValue: parseFloat(codValue) || 0,
      accessoriServices: services || [],
    };

    // Chiama testSpedisciOnlineRates (che ha già cache Redis integrata)
    const result = await testSpedisciOnlineRates(testParams);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Errore durante il recupero dei rates',
          details: result.details,
        },
        { status: 500 }
      );
    }

    // Filtra per corriere se specificato
    let rates = result.rates || [];
    if (courier) {
      rates = rates.filter((r: any) => 
        r.carrierCode?.toLowerCase() === courier.toLowerCase() ||
        r.carrierCode?.toLowerCase().includes(courier.toLowerCase())
      );
    }

    // Filtra per contractCode se specificato
    if (contractCode && rates.length > 0) {
      rates = rates.filter((r: any) => 
        r.contractCode === contractCode
      );
    }

    return NextResponse.json({
      success: true,
      rates,
      details: {
        ...result.details,
        cached: result.details?.cached || false,
        cacheAge: result.details?.cacheAge,
        totalRates: rates.length,
        carriersFound: [...new Set(rates.map((r: any) => r.carrierCode))],
      },
    });
  } catch (error: any) {
    console.error('Errore quote real-time:', error);
    return NextResponse.json(
      { error: error.message || 'Errore sconosciuto' },
      { status: 500 }
    );
  }
}
