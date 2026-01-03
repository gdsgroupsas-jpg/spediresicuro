'use server';

/**
 * Server Actions: Sincronizzazione Automatica Listini Prezzi
 * 
 * Funzione helper per sincronizzare automaticamente i listini fornitore
 * dopo il completamento del wizard di configurazione API corriere.
 * 
 * Supporta:
 * - Spedisci.Online (attuale)
 * - Corrieri diretti (futuro)
 */

import { syncPriceListsFromSpedisciOnline } from './spedisci-online-rates';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * Sincronizza automaticamente i listini fornitore dopo configurazione API
 * 
 * @param providerId - ID del provider (es: 'spedisci_online')
 * @param configId - ID della configurazione appena salvata (opzionale)
 * @returns Risultato sincronizzazione (non blocca se fallisce)
 */
export async function autoSyncPriceListsAfterConfig(
  providerId: string,
  configId?: string
): Promise<{
  success: boolean;
  priceListsCreated?: number;
  priceListsUpdated?: number;
  error?: string;
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      console.log('⚠️ [AUTO-SYNC] Utente non autenticato, salto sincronizzazione');
      return { success: false, error: 'Non autenticato' };
    }

    // Verifica permessi: solo reseller, BYOC e superadmin
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', session.user.email)
      .single();

    if (!user) {
      console.log('⚠️ [AUTO-SYNC] Utente non trovato, salto sincronizzazione');
      return { success: false, error: 'Utente non trovato' };
    }

    const isAdmin =
      user.account_type === 'admin' || user.account_type === 'superadmin';
    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === 'byoc';

    if (!isAdmin && !isReseller && !isBYOC) {
      console.log('⚠️ [AUTO-SYNC] Utente non autorizzato, salto sincronizzazione');
      return { success: false, error: 'Non autorizzato' };
    }

    // Sincronizza in base al provider
    switch (providerId) {
      case 'spedisci_online':
      case 'spedisci-online':
        console.log('🔄 [AUTO-SYNC] Avvio sincronizzazione listini da Spedisci.Online...');
        
        // Recupera courier_id se configId è fornito (per sincronizzare solo quel corriere)
        let courierId: string | undefined;
        if (configId) {
          // Potremmo recuperare il courier_id dalla configurazione se necessario
          // Per ora sincronizziamo tutti i corrieri disponibili
        }

        const syncResult = await syncPriceListsFromSpedisciOnline({
          courierId,
          priceListName: undefined, // Usa nome automatico
          overwriteExisting: false, // Non sovrascrivere listini esistenti
        });

        if (syncResult.success) {
          console.log('✅ [AUTO-SYNC] Sincronizzazione completata:', {
            created: syncResult.priceListsCreated,
            updated: syncResult.priceListsUpdated,
            entries: syncResult.entriesAdded,
          });
        } else {
          console.warn('⚠️ [AUTO-SYNC] Sincronizzazione fallita (non bloccante):', syncResult.error);
        }

        return {
          success: syncResult.success,
          priceListsCreated: syncResult.priceListsCreated,
          priceListsUpdated: syncResult.priceListsUpdated,
          error: syncResult.error,
        };

      // Futuro: altri provider
      // case 'poste':
      // case 'gls':
      //   return await syncPriceListsFromDirectCourier(providerId, configId);
      //   break;

      default:
        console.log(`ℹ️ [AUTO-SYNC] Provider ${providerId} non supporta sincronizzazione automatica`);
        return { success: true }; // Non è un errore, semplicemente non supportato
    }
  } catch (error: any) {
    // ⚠️ IMPORTANTE: Non bloccare il wizard se la sincronizzazione fallisce
    console.error('❌ [AUTO-SYNC] Errore sincronizzazione automatica (non bloccante):', error);
    return {
      success: false,
      error: error.message || 'Errore sincronizzazione automatica',
    };
  }
}

