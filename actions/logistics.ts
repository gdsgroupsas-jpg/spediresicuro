'use server';

/**
 * Server Actions per Gestione Logistica e Ritiro
 *
 * Gestisce la scansione LDV e il ritiro dei pacchi con geolocalizzazione
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { createServerActionClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/db/client';
import type { Shipment } from '@/types/shipments';

/**
 * Cerca una spedizione per LDV (Lettera di Vettura) o tracking number
 */
async function findShipmentByLDV(ldvNumber: string): Promise<Shipment | null> {
  try {
    // Cerca prima per LDV
    let { data, error } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('ldv', ldvNumber)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('Errore ricerca spedizione per LDV:', error);
      throw new Error(`Errore ricerca spedizione: ${error.message}`);
    }

    // Se trovato per LDV, ritorna
    if (data) {
      return data as Shipment;
    }

    // Fallback: cerca per tracking_number
    const { data: trackingData, error: trackingError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('tracking_number', ldvNumber)
      .eq('deleted', false)
      .limit(1)
      .maybeSingle();

    if (trackingError && trackingError.code !== 'PGRST116') {
      console.error('Errore ricerca spedizione per tracking:', trackingError);
      throw new Error(`Errore ricerca spedizione: ${trackingError.message}`);
    }

    return trackingData as Shipment | null;
  } catch (error: any) {
    console.error('Errore in findShipmentByLDV:', error);
    throw error;
  }
}

/**
 * Server Action: Conferma ritiro pacco tramite scansione LDV
 *
 * @param ldvNumber - Numero LDV scansionato (es. "3UW1LZ1405977")
 * @param gpsLocation - Posizione GPS in formato "lat,lng" (es. "45.4642,9.1900")
 * @returns Oggetto con success e dati spedizione aggiornata
 */
export async function confirmPickupScan(
  ldvNumber: string,
  gpsLocation: string | null
): Promise<{
  success: boolean;
  shipment?: Shipment;
  error?: string;
}> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Non autenticato. Devi essere loggato per effettuare la scansione.',
      };
    }

    // 2. Valida input
    if (!ldvNumber || ldvNumber.trim() === '') {
      return {
        success: false,
        error: 'Numero LDV non valido.',
      };
    }

    const ldvClean = ldvNumber.trim().toUpperCase();

    // 3. Cerca spedizione per LDV o tracking number
    const shipment = await findShipmentByLDV(ldvClean);

    if (!shipment) {
      return {
        success: false,
        error: `Nessuna spedizione trovata con LDV/Tracking: ${ldvClean}`,
      };
    }

    // 4. Verifica se già ritirata
    if (shipment.status === 'scanned_at_pickup') {
      return {
        success: false,
        error: `Questa spedizione è già stata ritirata il ${shipment.pickup_time ? new Date(shipment.pickup_time).toLocaleString('it-IT') : 'in precedenza'}.`,
      };
    }

    // 5. Prepara dati aggiornamento
    const pickupTime = new Date().toISOString();

    // Valida formato GPS se fornito
    let gpsValidated: string | null = null;
    if (gpsLocation && gpsLocation.trim() !== '') {
      const gpsParts = gpsLocation.split(',');
      if (gpsParts.length === 2) {
        const lat = parseFloat(gpsParts[0].trim());
        const lng = parseFloat(gpsParts[1].trim());
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          gpsValidated = `${lat},${lng}`;
        } else {
          console.warn('Formato GPS non valido:', gpsLocation);
        }
      }
    }

    // 6. Aggiorna spedizione
    const updateData: any = {
      status: 'scanned_at_pickup',
      pickup_time: pickupTime,
      updated_at: pickupTime,
    };

    if (gpsValidated) {
      updateData.gps_location = gpsValidated;
    }

    // Ottieni informazioni utente per audit
    const userEmail = context.actor.email;
    if (userEmail) {
      updateData.picked_up_by = userEmail;
    }

    const { data: updatedShipment, error: updateError } = await supabaseAdmin
      .from('shipments')
      .update(updateData)
      .eq('id', shipment.id)
      .select()
      .single();

    if (updateError) {
      console.error('Errore aggiornamento spedizione:', updateError);
      return {
        success: false,
        error: `Errore durante l'aggiornamento della spedizione: ${updateError.message}`,
      };
    }

    // 7. Ritorna successo con dati aggiornati
    return {
      success: true,
      shipment: updatedShipment as Shipment,
    };
  } catch (error: any) {
    console.error('Errore in confirmPickupScan:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante la scansione.',
    };
  }
}
