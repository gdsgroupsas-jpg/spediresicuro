/**
 * API Route: Fulfillment Decision
 *
 * Endpoint per ottenere decisione ottimale di fulfillment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFulfillmentOrchestrator } from '@/lib/engine/fulfillment-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { order_id, items, destination, service_type, delivery_deadline, priorities } = body;

    // Validazione
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Items mancanti' }, { status: 400 });
    }

    if (!destination || !destination.zip) {
      return NextResponse.json({ error: 'Destinazione mancante' }, { status: 400 });
    }

    // Ottieni orchestratore
    const orchestrator = getFulfillmentOrchestrator();

    // L'orchestrator attuale non ha metodo decide()
    // Questo endpoint è per funzionalità futura
    // Per ora restituiamo un errore o una risposta di base

    return NextResponse.json(
      {
        success: false,
        error:
          'Endpoint non ancora implementato. Usa createShipmentWithOrchestrator per creare spedizioni.',
        message:
          'Questo endpoint sarà implementato in futuro per decisioni di fulfillment avanzate.',
      },
      { status: 501 }
    );
  } catch (error: any) {
    console.error('Fulfillment Decision Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante il calcolo della decisione',
      },
      { status: 500 }
    );
  }
}
