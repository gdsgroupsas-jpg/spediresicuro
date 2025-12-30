/**
 * API Route: Download LDV (Lettera di Vettura)
 * 
 * Endpoint: GET /api/spedizioni/[id]/ldv?format=pdf
 * 
 * Scarica la LDV di una spedizione in formato PDF, CSV o XLSX
 */

import { NextRequest, NextResponse } from 'next/server';
// TODO: Verifica path reale ExportService, se non esiste crea stub temporaneo o correggi import.
import { ExportService } from '@/lib/adapters/export';

// Forza rendering dinamico (usa nextUrl.searchParams)
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'pdf') as 'pdf' | 'csv' | 'xlsx';

    // Recupera la spedizione dal database
    const response = await fetch(`${request.nextUrl.origin}/api/spedizioni?id=${id}`);
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Spedizione non trovata' },
        { status: 404 }
      );
    }

    const result = await response.json();
    const shipment = result.data;

    if (!shipment) {
      return NextResponse.json(
        { error: 'Spedizione non trovata' },
        { status: 404 }
      );
    }

    // Converti formato spedizione per ExportService
    // ⚠️ FIX: Leggi da recipient_name (nuovo formato Supabase) oppure destinatario.nome (legacy)
    const shipmentForExport = {
      tracking_number: shipment.tracking || shipment.ldv || shipment.id,
      created_at: shipment.createdAt || shipment.created_at || new Date().toISOString(),
      status: shipment.status || 'in_preparazione',
      courier_name: shipment.corriere || shipment.courier_name || '',
      // SENDER: Leggi da sender_* fields PRIMA (Supabase) poi fallback a mittente object (legacy)
      sender_name: shipment.sender_name || shipment.mittente?.nome || '',
      sender_address: shipment.sender_address || shipment.mittente?.indirizzo || '',
      sender_city: shipment.sender_city || shipment.mittente?.citta || '',
      sender_province: shipment.sender_province || shipment.mittente?.provincia || '',
      sender_zip: shipment.sender_postal_code || shipment.sender_zip || shipment.mittente?.cap || '',
      sender_phone: shipment.sender_phone || shipment.mittente?.telefono || '',
      sender_email: shipment.sender_email || shipment.mittente?.email || '',
      // RECIPIENT: Leggi da recipient_* fields PRIMA (Supabase) poi fallback a destinatario object (legacy)
      recipient_name: shipment.recipient_name || shipment.destinatario?.nome || '',
      recipient_address: shipment.recipient_address || shipment.destinatario?.indirizzo || '',
      recipient_city: shipment.recipient_city || shipment.destinatario?.citta || '',
      recipient_province: shipment.recipient_province || shipment.destinatario?.provincia || '',
      recipient_zip: shipment.recipient_postal_code || shipment.recipient_zip || shipment.destinatario?.cap || '',
      recipient_phone: shipment.recipient_phone || shipment.destinatario?.telefono || '',
      recipient_email: shipment.recipient_email || shipment.destinatario?.email || '',
      weight: shipment.peso || shipment.weight || 0,
      length: shipment.dimensioni?.lunghezza || shipment.length || 0,
      width: shipment.dimensioni?.larghezza || shipment.width || 0,
      height: shipment.dimensioni?.altezza || shipment.height || 0,
      service_type: shipment.tipoSpedizione || shipment.service_type || 'standard',
      base_price: shipment.prezzoFinale || shipment.base_price || 0,
      final_price: shipment.prezzoFinale || shipment.final_price || 0,
      declared_value: shipment.assicurazione || shipment.declared_value || 0,
    };

    // Genera LDV
    const ldvResult = await ExportService.exportLDV(shipmentForExport, format);

    // Converti Buffer in ArrayBuffer se necessario
    let responseData: BodyInit;
    if (ldvResult.data instanceof Buffer) {
      responseData = new Uint8Array(ldvResult.data);
    } else if (typeof ldvResult.data === 'string') {
      responseData = new TextEncoder().encode(ldvResult.data);
    } else {
      responseData = ldvResult.data as BodyInit;
    }

    // Restituisci il file
    return new NextResponse(responseData, {
      headers: {
        'Content-Type': ldvResult.mimeType,
        'Content-Disposition': `attachment; filename="${ldvResult.filename}"`,
      },
    });
  } catch (error) {
    console.error('Errore generazione LDV:', error);
    return NextResponse.json(
      { error: 'Errore durante la generazione della LDV' },
      { status: 500 }
    );
  }
}

