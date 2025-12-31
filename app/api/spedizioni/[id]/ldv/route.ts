/**
 * API Route: Download LDV (Lettera di Vettura) ORIGINALE
 * 
 * Endpoint: GET /api/spedizioni/[id]/ldv?format=pdf
 * 
 * PRIORITÀ:
 * 1. LDV originale dal corriere (label_url o label_pdf_url da metadata)
 * 2. Fallback a ExportService se non disponibile etichetta originale
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/supabase';
// TODO: Verifica path reale ExportService, se non esiste crea stub temporaneo o correggi import.
import { ExportService } from '@/lib/adapters/export';

// Forza rendering dinamico (usa nextUrl.searchParams)
export const dynamic = 'force-dynamic';

/**
 * Estrae URL etichetta originale dal metadata della spedizione
 */
function extractOriginalLabelUrl(shipment: any): string | null {
  const metadata = shipment.metadata;
  if (!metadata) return null;
  
  // Prova in ordine: label_url, label_pdf_url (per Poste)
  return metadata.label_url || metadata.label_pdf_url || null;
}

/**
 * Scarica PDF da URL esterno
 */
async function downloadPdfFromUrl(url: string): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    console.log('📥 [LDV] Download etichetta originale da:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf,*/*',
      },
    });
    
    if (!response.ok) {
      console.error('❌ [LDV] Errore download etichetta:', response.status, response.statusText);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'application/pdf';
    const arrayBuffer = await response.arrayBuffer();
    const data = Buffer.from(arrayBuffer);
    
    console.log('✅ [LDV] Etichetta originale scaricata:', {
      size: data.length,
      contentType,
    });
    
    return { data, contentType };
  } catch (error) {
    console.error('❌ [LDV] Errore fetch etichetta originale:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'pdf') as 'pdf' | 'csv' | 'xlsx';

    // Verifica autenticazione
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Recupera la spedizione direttamente da Supabase
    const { data: shipment, error: fetchError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('id', id)
      .eq('deleted', false)
      .single();

    if (fetchError || !shipment) {
      console.error('Errore recupero spedizione per LDV:', fetchError?.message);
      return NextResponse.json(
        { error: 'Spedizione non trovata' },
        { status: 404 }
      );
    }

    console.log('📄 [LDV] Richiesta download per spedizione:', {
      id: shipment.id?.substring(0, 8),
      tracking: shipment.tracking_number || shipment.ldv,
      hasMetadata: !!shipment.metadata,
      metadataKeys: shipment.metadata ? Object.keys(shipment.metadata) : [],
    });

    // =====================================================
    // PRIORITÀ 1: Scarica etichetta ORIGINALE dal corriere
    // =====================================================
    const originalLabelUrl = extractOriginalLabelUrl(shipment);
    
    if (originalLabelUrl && format === 'pdf') {
      console.log('🏷️ [LDV] Trovata etichetta originale:', originalLabelUrl);
      
      const pdfResult = await downloadPdfFromUrl(originalLabelUrl);
      
      if (pdfResult) {
        const trackingNumber = shipment.tracking_number || shipment.ldv || shipment.id;
        const filename = `LDV_${trackingNumber}.pdf`;
        
        return new NextResponse(new Uint8Array(pdfResult.data), {
          headers: {
            'Content-Type': pdfResult.contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }
      
      console.warn('⚠️ [LDV] Download etichetta originale fallito, uso fallback');
    }

    // =====================================================
    // FALLBACK: Genera LDV con ExportService (non originale)
    // =====================================================
    console.log('📋 [LDV] Uso ExportService come fallback (etichetta non originale)');
    
    // Converti formato spedizione per ExportService
    const shipmentForExport = {
      tracking_number: shipment.tracking_number || shipment.tracking || shipment.ldv || shipment.id,
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

    // Genera LDV con ExportService
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

