/**
 * API Route: Tracking Pubblico (senza autenticazione)
 *
 * Endpoint: GET /api/public-tracking/[trackingNumber]
 *
 * Restituisce eventi tracking per cliente finale.
 * Nessuna autenticazione richiesta — dati limitati (no user_id, no prezzo).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrackingService } from '@/lib/services/tracking';

// Forza rendering dinamico
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingNumber: string }> }
) {
  try {
    const { trackingNumber } = await params;

    if (!trackingNumber || trackingNumber.trim().length < 3) {
      return NextResponse.json({ error: 'Numero di tracking non valido' }, { status: 400 });
    }

    const trackingService = getTrackingService();
    const result = await trackingService.getTrackingByNumber(trackingNumber.trim());

    if (!result.success) {
      return NextResponse.json(
        { error: 'Spedizione non trovata', tracking_number: trackingNumber },
        { status: 404 }
      );
    }

    // Restituisci solo dati sicuri (no user_id, no prezzo, no raw_data)
    const safeEvents = result.events.map((event) => ({
      date: event.event_date,
      status: event.status,
      status_normalized: event.status_normalized,
      location: event.location,
      description: event.description || event.status,
    }));

    return NextResponse.json({
      success: true,
      tracking_number: result.tracking_number,
      carrier: result.carrier,
      current_status: result.current_status,
      current_status_normalized: result.current_status_normalized,
      is_delivered: result.is_delivered,
      last_update: result.last_update,
      events: safeEvents,
    });
  } catch (error) {
    console.error('Errore API public-tracking:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
