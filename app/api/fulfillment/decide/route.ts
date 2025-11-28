/**
 * API Route: Fulfillment Decision
 *
 * Endpoint per ottenere decisione ottimale di fulfillment
 */

import { NextRequest, NextResponse } from 'next/server';
import { createFulfillmentOrchestrator } from '@/lib/engine/fulfillment-orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      order_id,
      items,
      destination,
      service_type,
      delivery_deadline,
      priorities,
    } = body;

    // Validazione
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items mancanti' },
        { status: 400 }
      );
    }

    if (!destination || !destination.zip) {
      return NextResponse.json(
        { error: 'Destinazione mancante' },
        { status: 400 }
      );
    }

    // Crea orchestratore
    const orchestrator = createFulfillmentOrchestrator(priorities);

    // Ottieni decisione
    const decision = await orchestrator.decide({
      order_id,
      items,
      destination,
      service_type,
      delivery_deadline: delivery_deadline ? new Date(delivery_deadline) : undefined,
      priorities,
    });

    return NextResponse.json({
      success: true,
      decision,
    });
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
