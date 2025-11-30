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
    const shipmentForExport = {
      tracking_number: shipment.tracking || shipment.id,
      created_at: shipment.createdAt || new Date().toISOString(),
      status: shipment.status || 'in_preparazione',
      courier_name: shipment.corriere || '',
      sender_name: shipment.mittente?.nome || '',
      sender_address: shipment.mittente?.indirizzo || '',
      sender_city: shipment.mittente?.citta || '',
      sender_province: shipment.mittente?.provincia || '',
      sender_zip: shipment.mittente?.cap || '',
      sender_phone: shipment.mittente?.telefono || '',
      sender_email: shipment.mittente?.email || '',
      recipient_name: shipment.destinatario?.nome || '',
      recipient_address: shipment.destinatario?.indirizzo || '',
      recipient_city: shipment.destinatario?.citta || '',
      recipient_province: shipment.destinatario?.provincia || '',
      recipient_zip: shipment.destinatario?.cap || '',
      recipient_phone: shipment.destinatario?.telefono || '',
      recipient_email: shipment.destinatario?.email || '',
      weight: shipment.peso || 0,
      length: shipment.dimensioni?.lunghezza || 0,
      width: shipment.dimensioni?.larghezza || 0,
      height: shipment.dimensioni?.altezza || 0,
      service_type: shipment.tipoSpedizione || 'standard',
      base_price: shipment.prezzoFinale || 0,
      final_price: shipment.prezzoFinale || 0,
      declared_value: shipment.assicurazione || 0,
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

