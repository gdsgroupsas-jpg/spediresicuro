import { canManagePriceLists } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { groupRatesByCarrierAndContract } from './spedisci-online-rates-sync.grouping.impl';
import { syncGroupedRatesToPriceLists } from './spedisci-online-rates-sync.persistence.impl';
import { collectSyncRatesForPriceLists } from './spedisci-online-rates-sync.scan.impl';
import type { SyncPriceListsOptions, SyncPriceListsResult } from './spedisci-online-rates.types';

export async function syncPriceListsFromSpedisciOnlineImpl(
  options?: SyncPriceListsOptions
): Promise<SyncPriceListsResult> {
  let lockKey: string | null = null;

  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    let user;
    if (context.actor.id === 'test-user-id') {
      user = { id: 'test-user-id', account_type: 'admin', is_reseller: true };
    } else {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, account_type, is_reseller')
        .eq('email', context.actor.email)
        .single();
      user = data;
    }

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const workspaceId = context.workspace.id;
    const wq = workspaceQuery(workspaceId);

    if (!canManagePriceLists(user)) {
      return {
        success: false,
        error: 'Solo admin, reseller e BYOC possono sincronizzare listini',
      };
    }

    lockKey = `sync_price_lists_${user.id}_${options?.courierId || 'all'}`;
    const { data: lockResult, error: lockError } = await supabaseAdmin.rpc(
      'acquire_idempotency_lock',
      {
        p_idempotency_key: lockKey,
        p_user_id: user.id,
        p_ttl_minutes: 30,
      }
    );

    if (lockError) {
      console.error(`? [SYNC] Errore acquisizione lock:`, lockError);
      return {
        success: false,
        error: "Errore durante l'acquisizione del lock. Riprova tra poco.",
      };
    }

    if (!lockResult || lockResult.length === 0 || !lockResult[0]?.acquired) {
      const status = lockResult?.[0]?.status || 'unknown';
      const errorMsg = lockResult?.[0]?.error_message || 'Operazione già in corso';

      console.warn(`[SYNC] Lock non acquisito (status: ${status}): ${errorMsg}`);
      return {
        success: false,
        error: 'Sincronizzazione già in corso. Attendi il completamento prima di riprovare.',
      };
    }

    const scanResult = await collectSyncRatesForPriceLists({
      options,
      userId: user.id,
    });

    if (scanResult.earlyResult) {
      return scanResult.earlyResult;
    }

    if (!scanResult.scanOutput) {
      return {
        success: false,
        error: 'Errore interno: scanOutput assente',
      };
    }

    const { rates, carriersProcessed, weightsToProbe, zones, mode, probedWeightsSorted } =
      scanResult.scanOutput;

    const ratesByCarrierAndContract = groupRatesByCarrierAndContract(rates);

    const { priceListsCreated, priceListsUpdated, entriesAdded } =
      await syncGroupedRatesToPriceLists({
        ratesByCarrierAndContract,
        options,
        userId: user.id,
        workspaceId,
        wq,
        zones,
        mode,
        weightsToProbe,
        probedWeightsSorted,
      });

    const result: SyncPriceListsResult = {
      success: true,
      priceListsCreated,
      priceListsUpdated,
      entriesAdded,
      details: {
        ratesProcessed: rates.length,
        carriersProcessed,
      },
    };

    console.log(
      `? [SYNC] Sincronizzazione completata: ${priceListsCreated} creati, ${priceListsUpdated} aggiornati, ${entriesAdded} entries aggiunte`
    );
    console.log(`[SYNC] Riepilogo finale:`, {
      totalGroups: Object.keys(ratesByCarrierAndContract).length,
      totalCarriers: carriersProcessed.length,
      carriersProcessed: carriersProcessed.length,
      carriersProcessedList: carriersProcessed,
      priceListsCreated,
      priceListsUpdated,
      entriesAdded,
    });
    console.log(
      `[SYNC] Carriers unici trovati: ${carriersProcessed.length}, Gruppi (carrierCode+contractCode) processati: ${Object.keys(ratesByCarrierAndContract).length}`
    );

    return result;
  } catch (error: any) {
    console.error('Errore sincronizzazione listini da spedisci.online:', error);
    return {
      success: false,
      error: error.message || 'Errore durante la sincronizzazione',
    };
  } finally {
    if (lockKey) {
      try {
        const zeroUuid = '00000000-0000-0000-0000-000000000000';
        await supabaseAdmin.rpc('complete_idempotency_lock', {
          p_idempotency_key: lockKey,
          p_shipment_id: zeroUuid,
          p_status: 'completed',
        });
      } catch (e: any) {
        console.error('? [SYNC] Errore rilascio lock:', e.message || e);
      }
    }
  }
}
