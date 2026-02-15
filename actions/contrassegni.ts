'use server';

/**
 * Server Actions per Gestione Contrassegni
 *
 * Gestisce le azioni sui contrassegni:
 * - Preso in carica
 * - Evaso
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import type { Shipment } from '@/types/shipments';

/**
 * Server Action: Marca contrassegno come "Preso in carica"
 */
export async function markContrassegnoInCarica(shipmentId: string): Promise<{
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
        error: 'Non autenticato. Devi essere loggato per gestire i contrassegni.',
      };
    }

    // 2. Recupera spedizione
    const { data: shipment, error: fetchError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .eq('cash_on_delivery', true)
      .eq('deleted', false)
      .single();

    if (fetchError || !shipment) {
      return {
        success: false,
        error: 'Spedizione non trovata o non è un contrassegno.',
      };
    }

    // 3. Aggiorna con nota interna
    const now = new Date().toISOString();
    const existingNotes = shipment.internal_notes || '';
    const newNote = `[${now}] Contrassegno preso in carica da ${context.actor.email || context.actor.name || 'utente'}\n`;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('shipments')
      .update({
        internal_notes: existingNotes ? `${existingNotes}\n${newNote}` : newNote,
        updated_at: now,
      })
      .eq('id', shipmentId)
      .select()
      .single();

    if (updateError) {
      console.error('Errore aggiornamento contrassegno:', updateError);
      return {
        success: false,
        error: `Errore durante l'aggiornamento: ${updateError.message}`,
      };
    }

    return {
      success: true,
      shipment: updated as Shipment,
    };
  } catch (error: any) {
    console.error('Errore markContrassegnoInCarica:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante la gestione del contrassegno.',
    };
  }
}

/**
 * Server Action: Marca contrassegno come "Evaso"
 */
export async function markContrassegnoEvaso(shipmentId: string): Promise<{
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
        error: 'Non autenticato. Devi essere loggato per gestire i contrassegni.',
      };
    }

    // 2. Recupera spedizione
    const { data: shipment, error: fetchError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('id', shipmentId)
      .eq('cash_on_delivery', true)
      .eq('deleted', false)
      .single();

    if (fetchError || !shipment) {
      return {
        success: false,
        error: 'Spedizione non trovata o non è un contrassegno.',
      };
    }

    // 3. Verifica che sia consegnata
    if (shipment.status !== 'delivered' && !shipment.delivered_at) {
      return {
        success: false,
        error: 'Il contrassegno può essere evaso solo se la spedizione è stata consegnata.',
      };
    }

    // 4. Aggiorna con nota interna e marca come evaso
    const now = new Date().toISOString();
    const existingNotes = shipment.internal_notes || '';
    const newNote = `[${now}] Contrassegno EVASO da ${context.actor.email || context.actor.name || 'utente'}\n`;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('shipments')
      .update({
        internal_notes: existingNotes ? `${existingNotes}\n${newNote}` : newNote,
        updated_at: now,
        // Aggiungi flag nel notes per indicare che è evaso
        notes: shipment.notes
          ? `${shipment.notes}\n[CONTRASSEGNO EVASO - ${new Date(now).toLocaleDateString('it-IT')}]`
          : `[CONTRASSEGNO EVASO - ${new Date(now).toLocaleDateString('it-IT')}]`,
      })
      .eq('id', shipmentId)
      .select()
      .single();

    if (updateError) {
      console.error('Errore aggiornamento contrassegno:', updateError);
      return {
        success: false,
        error: `Errore durante l'aggiornamento: ${updateError.message}`,
      };
    }

    return {
      success: true,
      shipment: updated as Shipment,
    };
  } catch (error: any) {
    console.error('Errore markContrassegnoEvaso:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto durante la gestione del contrassegno.',
    };
  }
}
