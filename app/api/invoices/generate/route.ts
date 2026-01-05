/**
 * API Endpoint: Genera Fattura per Spedizione
 * 
 * POST /api/invoices/generate
 * 
 * Genera una fattura PDF per una spedizione.
 * Body: { shipmentId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSafeAuth } from '@/lib/safe-auth';
import { generateInvoiceForShipment } from '@/app/actions/invoices';

export async function POST(request: NextRequest) {
  try {
    const context = await requireSafeAuth();
    const body = await request.json();
    const { shipmentId } = body;

    if (!shipmentId) {
      return NextResponse.json(
        { error: 'shipmentId richiesto' },
        { status: 400 }
      );
    }

    // Genera fattura
    const invoice = await generateInvoiceForShipment(shipmentId);

    return NextResponse.json({
      success: true,
      invoice,
      message: 'Fattura generata con successo',
    });
  } catch (error: any) {
    console.error('Errore generazione fattura:', error);
    return NextResponse.json(
      { error: error.message || 'Errore generazione fattura' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';



