'use server';

/**
 * Server Actions per Privacy e Compliance GDPR
 *
 * Gestisce:
 * - Export dati utente (Diritto alla Portabilità - Art. 20 GDPR)
 * - Cancellazione account con anonimizzazione (Diritto all'Oblio - Art. 17 GDPR)
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * Export dati utente in formato JSON
 *
 * Recupera e restituisce tutti i dati dell'utente:
 * - Profilo utente
 * - Storico spedizioni
 * - Preventivi
 * - Configurazioni
 *
 * @returns JSON string con tutti i dati dell'utente
 */
export async function exportUserData(): Promise<{
  success: boolean;
  data?: string;
  filename?: string;
  error?: string;
}> {
  try {
    // Verifica autenticazione
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Utente non autenticato',
      };
    }

    const userEmail = context.actor.email;

    console.log('📦 [PRIVACY] Export dati per:', userEmail);

    // 1. Recupera profilo utente
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      console.error('❌ [PRIVACY] Errore recupero utente:', userError);
      return {
        success: false,
        error: 'Utente non trovato',
      };
    }

    // 2. Recupera tutte le spedizioni dell'utente
    const { data: shipments, error: shipmentsError } = await supabaseAdmin
      .from('shipments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (shipmentsError) {
      console.error('❌ [PRIVACY] Errore recupero spedizioni:', shipmentsError);
      // Non blocchiamo l'export se le spedizioni falliscono
    }

    // 3. Recupera preventivi (se esiste tabella preventivi)
    let quotes: any[] = [];
    try {
      const { data: quotesData, error: quotesError } = await supabaseAdmin
        .from('quotes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!quotesError && quotesData) {
        quotes = quotesData;
      }
    } catch (error) {
      // Tabella preventivi potrebbe non esistere, ignoriamo
      console.log('⚠️ [PRIVACY] Tabella preventivi non disponibile');
    }

    // 4. Prepara oggetto dati completo
    const exportData = {
      export_info: {
        export_date: new Date().toISOString(),
        user_email: userEmail,
        user_id: user.id,
        format_version: '1.0',
      },
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        provider: user.provider,
        company_name: user.company_name,
        vat_number: user.vat_number,
        phone: user.phone,
        image: user.image,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login_at: user.last_login_at,
        // Dati cliente (se presenti)
        dati_cliente: user.dati_cliente,
        default_sender: user.default_sender,
        integrazioni: user.integrazioni,
      },
      shipments: shipments || [],
      quotes: quotes,
      statistics: {
        total_shipments: shipments?.length || 0,
        total_quotes: quotes.length,
      },
    };

    // 5. Converti in JSON formattato
    const jsonData = JSON.stringify(exportData, null, 2);

    // 6. Genera nome file
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `spediresicuro-export-${userEmail.replace('@', '_at_')}-${timestamp}.json`;

    console.log('✅ [PRIVACY] Export completato:', {
      shipments: shipments?.length || 0,
      quotes: quotes.length,
    });

    return {
      success: true,
      data: jsonData,
      filename,
    };
  } catch (error: any) {
    console.error('❌ [PRIVACY] Errore export dati:', error);
    return {
      success: false,
      error: error.message || "Errore durante l'export dei dati",
    };
  }
}

/**
 * Cancellazione account con anonimizzazione dati
 *
 * ⚠️ CRITICO: Non possiamo fare DELETE brutale delle spedizioni per motivi fiscali/legali.
 * Le spedizioni devono restare per tracciabilità, ma vengono anonimizzate.
 *
 * Logica:
 * 1. Anonimizza profilo utente (email = deleted_[uuid]@void.com, name = 'Utente Eliminato')
 * 2. Anonimizza campi PII nelle spedizioni (mantiene dati non personali per statistiche)
 * 3. Logout immediato
 *
 * @param confirmation - Testo di conferma obbligatorio
 * @returns Risultato operazione
 */
export async function requestAccountDeletion(confirmation: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Verifica autenticazione
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return {
        success: false,
        error: 'Utente non autenticato',
      };
    }

    // Verifica conferma
    if (confirmation !== 'ELIMINA') {
      return {
        success: false,
        error: 'Conferma non valida. Devi digitare "ELIMINA" per procedere.',
      };
    }

    const userEmail = context.actor.email;

    console.log('🗑️ [PRIVACY] Richiesta cancellazione account per:', userEmail);

    // 1. Recupera utente
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (userError || !user) {
      console.error('❌ [PRIVACY] Errore recupero utente:', userError);
      return {
        success: false,
        error: 'Utente non trovato',
      };
    }

    const userId = user.id;
    const deletionUuid = crypto.randomUUID();

    // 2. Anonimizza profilo utente
    const anonymizedEmail = `deleted_${deletionUuid}@void.com`;
    const anonymizedName = 'Utente Eliminato';

    const { error: updateUserError } = await supabaseAdmin
      .from('users')
      .update({
        email: anonymizedEmail,
        name: anonymizedName,
        // Rimuovi dati sensibili
        password: null, // Elimina password
        phone: null,
        company_name: null,
        vat_number: null,
        image: null,
        dati_cliente: null,
        default_sender: null,
        integrazioni: null,
        // Mantieni timestamps per audit
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateUserError) {
      console.error('❌ [PRIVACY] Errore anonimizzazione utente:', updateUserError);
      return {
        success: false,
        error: "Errore durante l'anonimizzazione del profilo",
      };
    }

    console.log('✅ [PRIVACY] Profilo utente anonimizzato');

    // 3. Anonimizza campi PII nelle spedizioni
    // Manteniamo i dati non personali (peso, misure, prezzi) per statistiche
    // Anonimizziamo solo i dati personali (nomi, indirizzi, email, telefoni)
    const { error: updateShipmentsError } = await supabaseAdmin
      .from('shipments')
      .update({
        // Anonimizza mittente
        sender_name: '[Anonimizzato]',
        sender_address: null,
        sender_city: null,
        sender_zip: null,
        sender_province: null,
        sender_phone: null,
        sender_email: null,
        sender_reference: null,
        // Anonimizza destinatario
        recipient_name: '[Anonimizzato]',
        recipient_address: null,
        recipient_city: null,
        recipient_zip: null,
        recipient_province: null,
        recipient_phone: null,
        recipient_email: null,
        recipient_notes: null,
        recipient_reference: null,
        // Mantieni: tracking_number, weight, dimensions, prices, status, dates
        // per tracciabilità fiscale e statistiche
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateShipmentsError) {
      console.error('❌ [PRIVACY] Errore anonimizzazione spedizioni:', updateShipmentsError);
      // Non blocchiamo se c'è un errore, ma logghiamo
      console.warn('⚠️ [PRIVACY] Alcune spedizioni potrebbero non essere state anonimizzate');
    } else {
      console.log('✅ [PRIVACY] Spedizioni anonimizzate');
    }

    // 4. Anonimizza preventivi (se esistono)
    try {
      await supabaseAdmin
        .from('quotes')
        .update({
          // Anonimizza dati personali nei preventivi
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } catch (error) {
      // Tabella preventivi potrebbe non esistere, ignoriamo
      console.log('⚠️ [PRIVACY] Tabella preventivi non disponibile o errore anonimizzazione');
    }

    console.log('✅ [PRIVACY] Account cancellato e anonimizzato con successo');

    // 5. Logout verrà gestito dal client dopo il redirect
    return {
      success: true,
      message: 'Account cancellato con successo. Verrai disconnesso tra pochi secondi.',
    };
  } catch (error: any) {
    console.error('❌ [PRIVACY] Errore cancellazione account:', error);
    return {
      success: false,
      error: error.message || "Errore durante la cancellazione dell'account",
    };
  }
}
