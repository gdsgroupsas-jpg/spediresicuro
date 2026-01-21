'use server';

/**
 * Server Actions per Generazione LDV Interna
 *
 * Genera LDV (Lettera di Vettura) internamente senza chiamare API corriere.
 * Utile quando:
 * - L'utente preferisce generare LDV localmente
 * - Le API corriere non sono disponibili
 * - Si vuole evitare costi API
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { generateShipmentPDF, generateShipmentCSV } from '@/lib/generate-shipment-document';
import type { Shipment } from '@/types/shipments';

/**
 * Genera LDV interna (PDF) per una spedizione
 *
 * @param shipmentId - ID spedizione
 * @param format - Formato output ('pdf' | 'csv')
 * @returns Buffer del file generato
 */
export async function generateInternalLDV(
  shipmentId: string,
  format: 'pdf' | 'csv' = 'pdf'
): Promise<{
  success: boolean;
  data?: Buffer;
  filename?: string;
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato',
      };
    }

    // 2. Recupera spedizione
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .single();

    if (shipmentError || !shipment) {
      return {
        success: false,
        error: 'Spedizione non trovata',
      };
    }

    // 3. Verifica che l'utente abbia accesso alla spedizione
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('email', context.actor.email)
      .single();

    if (!user) {
      return {
        success: false,
        error: 'Utente non trovato',
      };
    }

    // Solo admin o proprietario possono generare LDV
    if (user.role !== 'admin' && shipment.user_id !== user.id) {
      return {
        success: false,
        error: 'Accesso negato',
      };
    }

    // 4. Prepara dati per generazione
    const spedizioneData = {
      tracking: shipment.tracking_number || shipment.id,
      mittente: {
        nome: shipment.sender_name || 'Da definire',
        indirizzo: shipment.sender_address || '',
        citta: shipment.sender_city || '',
        provincia: shipment.sender_province || '',
        cap: shipment.sender_zip || '',
        telefono: shipment.sender_phone || '',
        email: shipment.sender_email || '',
      },
      destinatario: {
        nome: shipment.recipient_name || 'Da definire',
        indirizzo: shipment.recipient_address || '',
        citta: shipment.recipient_city || '',
        provincia: shipment.recipient_province || '',
        cap: shipment.recipient_zip || '',
        telefono: shipment.recipient_phone || '',
        email: shipment.recipient_email || '',
      },
      peso: Number(shipment.weight) || 0,
      dimensioni: {
        lunghezza: Number(shipment.length) || 0,
        larghezza: Number(shipment.width) || 0,
        altezza: Number(shipment.height) || 0,
      },
      tipoSpedizione: shipment.service_type || 'standard',
      corriere: shipment.courier_id || 'Non specificato',
      prezzoFinale: Number(shipment.final_price) || 0,
      status: shipment.status || 'draft',
      note: shipment.notes || '',
      createdAt: shipment.created_at,
      contrassegno: shipment.cash_on_delivery_amount || '',
      assicurazione: shipment.declared_value || '',
      contenuto: shipment.content || '',
      rif_mittente: shipment.sender_reference || '',
      rif_destinatario: shipment.recipient_reference || '',
      colli: shipment.packages_count || 1,
    };

    // 5. Genera file
    let fileData: Buffer;
    let filename: string;

    if (format === 'pdf') {
      const pdfDoc = generateShipmentPDF(spedizioneData);
      const pdfOutput = pdfDoc.output('arraybuffer');
      fileData = Buffer.from(pdfOutput);
      // ⚠️ FIX: Nome file deve contenere "etichetta" o "ldv" per test e2e (manteniamo LDV_ per compatibilità)
      filename = `LDV_${shipment.tracking_number || shipment.id}_${new Date().toISOString().split('T')[0]}.pdf`;
    } else {
      const csvContent = generateShipmentCSV(spedizioneData);
      fileData = Buffer.from(csvContent, 'utf-8');
      // ⚠️ FIX: Nome file deve contenere "etichetta" o "ldv" per test e2e (manteniamo LDV_ per compatibilità)
      filename = `LDV_${shipment.tracking_number || shipment.id}_${new Date().toISOString().split('T')[0]}.csv`;
    }

    console.log(`✅ LDV interna generata: ${filename}`);

    return {
      success: true,
      data: fileData,
      filename,
    };
  } catch (error: any) {
    console.error('Errore generazione LDV interna:', error);
    return {
      success: false,
      error: error.message || 'Errore durante la generazione LDV',
    };
  }
}
