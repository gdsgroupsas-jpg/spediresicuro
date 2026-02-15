'use server';

/**
 * Server Actions per Import Spedizioni tramite Scanner LDV
 *
 * Gestisce l'import di spedizioni scansionando la LDV
 * con verifica duplicati e possibilità di cancellare
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { generateTrackingNumber } from '@/lib/db/shipments';
import type { Shipment } from '@/types/shipments';

/**
 * Verifica se l'utente ha la killer feature LDV Scanner attiva
 */
async function hasLDVScannerFeature(userEmail: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('user_has_feature', {
      p_user_email: userEmail,
      p_feature_code: 'ldv_scanner_import',
    });

    if (error) {
      console.error('Errore verifica feature ldv_scanner_import:', error);
      return false;
    }

    return data === true;
  } catch (error: any) {
    console.error('Errore in hasLDVScannerFeature:', error);
    return false;
  }
}

/**
 * Verifica se esiste già una spedizione con questa LDV
 */
async function checkDuplicateLDV(
  ldvNumber: string,
  userEmail: string
): Promise<{
  exists: boolean;
  shipment?: Shipment;
}> {
  try {
    // Cerca per LDV (sia campo ldv che tracking_number)
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .or(`ldv.eq.${ldvNumber},tracking_number.eq.${ldvNumber}`)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Errore verifica duplicato LDV:', error);
      return { exists: false };
    }

    if (data) {
      return {
        exists: true,
        shipment: data as Shipment,
      };
    }

    return { exists: false };
  } catch (error: any) {
    console.error('Errore in checkDuplicateLDV:', error);
    return { exists: false };
  }
}

/**
 * Server Action: Importa spedizione da scanner LDV
 *
 * @param ldvNumber - Numero LDV scansionato
 * @param gpsLocation - Posizione GPS (opzionale)
 * @param shipmentData - Dati spedizione opzionali (se OCR estrae dati)
 * @returns Oggetto con success e dati spedizione creata
 */
export async function importShipmentFromLDV(
  ldvNumber: string,
  gpsLocation?: string | null,
  shipmentData?: Partial<Shipment>
): Promise<{
  success: boolean;
  shipment?: Shipment;
  error?: string;
  isDuplicate?: boolean;
  existingShipment?: Shipment;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato. Devi essere loggato per importare spedizioni.',
      };
    }

    const userEmail = context.actor.email;

    // 2. Verifica killer feature
    const hasFeature = await hasLDVScannerFeature(userEmail);

    if (!hasFeature) {
      return {
        success: false,
        error: 'Non hai accesso allo scanner LDV. Contatta il superadmin per attivare la feature.',
      };
    }

    // 3. Valida input
    if (!ldvNumber || ldvNumber.trim() === '') {
      return {
        success: false,
        error: 'Numero LDV non valido.',
      };
    }

    const ldvClean = ldvNumber.trim().toUpperCase();

    // 4. Verifica duplicati
    const duplicateCheck = await checkDuplicateLDV(ldvClean, userEmail);

    if (duplicateCheck.exists && duplicateCheck.shipment) {
      return {
        success: false,
        isDuplicate: true,
        existingShipment: duplicateCheck.shipment,
        error: `Una spedizione con LDV ${ldvClean} esiste già (Tracking: ${duplicateCheck.shipment.tracking_number || 'N/A'}).`,
      };
    }

    // 5. Ottieni user_id
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      return {
        success: false,
        error: 'Utente non trovato.',
      };
    }

    // 6. Prepara dati spedizione
    const now = new Date().toISOString();
    const trackingNumber = shipmentData?.tracking_number || generateTrackingNumber();

    // Dati base spedizione
    const newShipmentData: any = {
      // Tracking e LDV
      tracking_number: trackingNumber,
      ldv: ldvClean,

      // Mittente (da shipmentData o default)
      sender_name: shipmentData?.sender_name || 'Da definire',
      sender_address: shipmentData?.sender_address || '',
      sender_city: shipmentData?.sender_city || '',
      sender_zip: shipmentData?.sender_zip || '',
      sender_province: shipmentData?.sender_province || '',
      sender_country: shipmentData?.sender_country || 'IT',
      sender_phone: shipmentData?.sender_phone || '',
      sender_email: shipmentData?.sender_email || '',

      // Destinatario (da shipmentData o default)
      recipient_name: shipmentData?.recipient_name || 'Da definire',
      recipient_address: shipmentData?.recipient_address || '',
      recipient_city: shipmentData?.recipient_city || '',
      recipient_zip: shipmentData?.recipient_zip || '',
      recipient_province: shipmentData?.recipient_province || '',
      recipient_country: shipmentData?.recipient_country || 'IT',
      recipient_phone: shipmentData?.recipient_phone || '',
      recipient_email: shipmentData?.recipient_email || '',
      recipient_type: shipmentData?.recipient_type || 'B2C',

      // Pacco
      weight: shipmentData?.weight || 1,
      length: shipmentData?.length || null,
      width: shipmentData?.width || null,
      height: shipmentData?.height || null,

      // Servizio
      courier_id: shipmentData?.courier_id || null,
      service_type: shipmentData?.service_type || 'standard',

      // Status
      status: 'draft', // Draft perché mancano dati completi

      // Utente
      user_id: user.id,
      created_by_user_email: userEmail,

      // Note
      notes: shipmentData?.notes || `Spedizione importata tramite scanner LDV: ${ldvClean}`,
      internal_notes: `Importata via scanner LDV il ${new Date().toLocaleString('it-IT')}`,

      // Flags
      imported: true,
      importSource: 'ldv_scanner',

      // Timestamps
      created_at: now,
      updated_at: now,

      // Soft delete
      deleted: false,
    };

    // Aggiungi GPS se fornito
    if (gpsLocation && gpsLocation.trim() !== '') {
      const gpsParts = gpsLocation.split(',');
      if (gpsParts.length === 2) {
        const lat = parseFloat(gpsParts[0].trim());
        const lng = parseFloat(gpsParts[1].trim());
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          newShipmentData.gps_location = `${lat},${lng}`;
        }
      }
    }

    // 7. Crea spedizione
    const { data: createdShipment, error: createError } = await supabaseAdmin
      .from('shipments')
      .insert([newShipmentData])
      .select()
      .single();

    if (createError) {
      console.error('Errore creazione spedizione da LDV:', createError);
      return {
        success: false,
        error: `Errore durante la creazione della spedizione: ${createError.message}`,
      };
    }

    // 8. Ritorna successo
    return {
      success: true,
      shipment: createdShipment as Shipment,
    };
  } catch (error: any) {
    console.error('Errore in importShipmentFromLDV:', error);
    return {
      success: false,
      error: error.message || "Errore sconosciuto durante l'importazione.",
    };
  }
}

/**
 * Server Action: Verifica se esiste duplicato LDV (prima di importare)
 */
export async function checkLDVDuplicate(ldvNumber: string): Promise<{
  exists: boolean;
  shipment?: Shipment;
  error?: string;
}> {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        exists: false,
        error: 'Non autenticato.',
      };
    }

    const check = await checkDuplicateLDV(ldvNumber.trim().toUpperCase(), context.actor.email);

    return {
      exists: check.exists,
      shipment: check.shipment,
    };
  } catch (error: any) {
    console.error('Errore in checkLDVDuplicate:', error);
    return {
      exists: false,
      error: error.message || 'Errore sconosciuto.',
    };
  }
}
