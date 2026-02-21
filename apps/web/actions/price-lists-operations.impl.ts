import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import {
  createPriceList,
  deletePriceList,
  getApplicablePriceList,
  getPriceListById,
} from '@/lib/db/price-lists';
import type { CreatePriceListInput, PriceCalculationResult } from '@/types/listini';
import type { CourierServiceType } from '@/types/shipments';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';
import { rateLimit } from '@/lib/security/rate-limit';
import { validateUUID } from '@/lib/validators';
import { __clearMasterListCache } from '@/lib/db/price-lists-advanced';
import { isAdminOrAbove, isResellerCheck, isBYOC as isBYOCCheck } from '@/lib/auth-helpers';

export async function getApplicablePriceListActionImpl(courierId?: string): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const workspaceId = wsContext.workspace.id;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', wsContext.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const priceList = await getApplicablePriceList(user.id, workspaceId, courierId);
    return { success: true, priceList };
  } catch (error: any) {
    console.error('Errore recupero listino applicabile:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function calculateQuoteActionImpl(
  params: {
    weight: number;
    volume?: number;
    destination: {
      zip?: string;
      province?: string;
      region?: string;
      country?: string;
    };
    courierId?: string;
    serviceType?: CourierServiceType;
    options?: {
      declaredValue?: number;
      cashOnDelivery?: boolean;
      insurance?: boolean;
    };
  },
  priceListId?: string
): Promise<{
  success: boolean;
  result?: PriceCalculationResult;
  error?: string;
  resellerComparison?: {
    apiSource: 'reseller' | 'master' | 'default';
    resellerPrice?: PriceCalculationResult;
    masterPrice?: PriceCalculationResult;
    priceDifference?: number;
  };
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const workspaceId = wsContext.workspace.id;

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller')
      .eq('email', wsContext.actor.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    if (user.is_reseller && !priceListId) {
      const { calculateBestPriceForReseller } = await import('@/lib/db/price-lists-advanced');
      const bestPriceResult = await calculateBestPriceForReseller(user.id, workspaceId, params);

      if (!bestPriceResult) {
        return {
          success: false,
          error: 'Impossibile calcolare preventivo. Verifica listino configurato.',
        };
      }

      return {
        success: true,
        result: bestPriceResult.bestPrice,
        resellerComparison: {
          apiSource: bestPriceResult.apiSource,
          resellerPrice: bestPriceResult.resellerPrice,
          masterPrice: bestPriceResult.masterPrice,
          priceDifference: bestPriceResult.priceDifference,
        },
      };
    }

    const { calculatePriceWithRules } = await import('@/lib/db/price-lists-advanced');
    const result = await calculatePriceWithRules(user.id, workspaceId, params, priceListId);

    if (!result) {
      return {
        success: false,
        error: 'Impossibile calcolare preventivo. Verifica listino configurato.',
      };
    }

    return { success: true, result };
  } catch (error: any) {
    console.error('Errore calcolo preventivo:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function assignPriceListToUserActionImpl(
  userId: string,
  priceListId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!validateUUID(userId) || !validateUUID(priceListId)) {
      return { success: false, error: 'ID non valido' };
    }

    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const currentUser = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };

    const isAdmin = isAdminOrAbove(currentUser);
    const isReseller = isResellerCheck(currentUser);

    if (!isAdmin && !isReseller) {
      return {
        success: false,
        error: 'Solo admin e reseller possono assegnare listini',
      };
    }

    const rl = await rateLimit('assign-listino', currentUser.id, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return { success: false, error: 'Troppe richieste. Riprova tra qualche secondo.' };
    }

    if (isReseller) {
      const { data: plCheck } = await supabaseAdmin
        .from('price_lists')
        .select('default_margin_percent')
        .eq('id', priceListId)
        .single();

      if (
        plCheck &&
        plCheck.default_margin_percent !== null &&
        plCheck.default_margin_percent < 0
      ) {
        return {
          success: false,
          error: 'Non puoi assegnare un listino con margine negativo (vendita sottocosto)',
        };
      }
    }

    const { error: rpcError } = await supabaseAdmin.rpc('assign_listino_to_user_multi', {
      p_caller_id: currentUser.id,
      p_user_id: userId,
      p_price_list_id: priceListId,
    });

    if (rpcError) {
      console.error('Errore RPC assegnazione listino:', rpcError);
      const errorMessage = rpcError.message || '';

      if (errorMessage.includes('UNAUTHORIZED') || errorMessage.includes('Non hai accesso')) {
        return {
          success: false,
          error: 'Non hai accesso a questo listino. Puoi assegnare solo listini che hai creato.',
        };
      }

      if (errorMessage.includes('USER_NOT_FOUND')) {
        return { success: false, error: 'Utente non trovato' };
      }

      if (errorMessage.includes('FORBIDDEN') || errorMessage.includes('solo ai tuoi clienti')) {
        return {
          success: false,
          error: 'Puoi assegnare listini solo ai tuoi clienti',
        };
      }

      return { success: false, error: rpcError.message };
    }

    await writeAuditLog({
      context: wsContext as any,
      action: AUDIT_ACTIONS.PRICE_LIST_ASSIGNED,
      resourceType: AUDIT_RESOURCE_TYPES.PRICE_LIST_ASSIGNMENT,
      resourceId: priceListId,
      metadata: { targetUserId: userId, priceListId },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Errore assegnazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function revokePriceListFromUserActionImpl(
  userId: string,
  priceListId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!validateUUID(userId) || !validateUUID(priceListId)) {
      return { success: false, error: 'ID non valido' };
    }

    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const currentUser = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };

    const isAdmin = isAdminOrAbove(currentUser);
    const isReseller = isResellerCheck(currentUser);

    if (!isAdmin && !isReseller) {
      return { success: false, error: 'Solo admin e reseller possono gestire listini' };
    }

    const rl = await rateLimit('assign-listino', currentUser.id, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return { success: false, error: 'Troppe richieste. Riprova tra qualche secondo.' };
    }

    const { error: rpcError } = await supabaseAdmin.rpc('revoke_listino_from_user', {
      p_caller_id: currentUser.id,
      p_user_id: userId,
      p_price_list_id: priceListId,
    });

    if (rpcError) {
      console.error('Errore RPC revoca listino:', rpcError);
      const errorMessage = rpcError.message || '';
      if (errorMessage.includes('FORBIDDEN')) {
        return { success: false, error: 'Puoi gestire listini solo dei tuoi clienti' };
      }
      return { success: false, error: rpcError.message };
    }

    await writeAuditLog({
      context: wsContext as any,
      action: AUDIT_ACTIONS.PRICE_LIST_REVOKED,
      resourceType: AUDIT_RESOURCE_TYPES.PRICE_LIST_ASSIGNMENT,
      resourceId: priceListId,
      metadata: { targetUserId: userId, priceListId },
    });

    return { success: true };
  } catch (error: any) {
    console.error('Errore revoca listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function bulkUpdateUserListiniActionImpl(
  userId: string,
  selectedListinoIds: string[]
): Promise<{
  success: boolean;
  added: number;
  removed: number;
  error?: string;
}> {
  try {
    if (!validateUUID(userId)) {
      return { success: false, added: 0, removed: 0, error: 'ID utente non valido' };
    }
    for (const id of selectedListinoIds) {
      if (!validateUUID(id)) {
        return { success: false, added: 0, removed: 0, error: 'ID listino non valido' };
      }
    }

    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, added: 0, removed: 0, error: 'Non autenticato' };
    }
    const currentUser = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };

    const isAdmin = isAdminOrAbove(currentUser);
    const isReseller = isResellerCheck(currentUser);

    if (!isAdmin && !isReseller) {
      return { success: false, added: 0, removed: 0, error: 'Permessi insufficienti' };
    }

    const rl = await rateLimit('assign-listino', currentUser.id, { limit: 30, windowSeconds: 60 });
    if (!rl.allowed) {
      return {
        success: false,
        added: 0,
        removed: 0,
        error: 'Troppe richieste. Riprova tra qualche secondo.',
      };
    }

    if (isReseller && selectedListinoIds.length > 0) {
      const { data: plsCheck } = await supabaseAdmin
        .from('price_lists')
        .select('id, default_margin_percent')
        .in('id', selectedListinoIds);

      const negativeMargin = plsCheck?.find(
        (pl) => pl.default_margin_percent !== null && pl.default_margin_percent < 0
      );
      if (negativeMargin) {
        return {
          success: false,
          added: 0,
          removed: 0,
          error: 'Non puoi assegnare un listino con margine negativo (vendita sottocosto)',
        };
      }
    }

    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'bulk_update_user_listini',
      {
        p_caller_id: currentUser.id,
        p_user_id: userId,
        p_selected_ids: selectedListinoIds,
      }
    );

    if (rpcError) {
      console.error('Errore RPC bulk_update_user_listini:', rpcError);
      const msg = rpcError.message || '';
      if (msg.includes('FORBIDDEN')) {
        return {
          success: false,
          added: 0,
          removed: 0,
          error: 'Puoi gestire listini solo dei tuoi clienti',
        };
      }
      if (msg.includes('UNAUTHORIZED')) {
        return {
          success: false,
          added: 0,
          removed: 0,
          error: 'Non hai accesso a uno o piu listini selezionati',
        };
      }
      return { success: false, added: 0, removed: 0, error: rpcError.message };
    }

    const added = rpcResult?.added ?? 0;
    const removed = rpcResult?.removed ?? 0;

    if (added > 0 || removed > 0) {
      await writeAuditLog({
        context: wsContext as any,
        action: added > 0 ? AUDIT_ACTIONS.PRICE_LIST_ASSIGNED : AUDIT_ACTIONS.PRICE_LIST_REVOKED,
        resourceType: AUDIT_RESOURCE_TYPES.PRICE_LIST_ASSIGNMENT,
        resourceId: userId,
        metadata: { targetUserId: userId, selectedListinoIds, added, removed },
      });
    }

    return { success: true, added, removed };
  } catch (error: any) {
    console.error('Errore bulk_update_user_listini:', error);
    return { success: false, added: 0, removed: 0, error: error.message || 'Errore sconosciuto' };
  }
}

export async function deletePriceListActionImpl(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    const existingPriceList = await getPriceListById(id, workspaceId);
    if (!existingPriceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    const isAdmin = isAdminOrAbove(user);
    const isOwner = existingPriceList.created_by === user.id;
    const isAssignedOwner = existingPriceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: 'Non hai i permessi per eliminare questo listino',
      };
    }

    const isBYOC = isBYOCCheck(user);
    if (isBYOC && existingPriceList.list_type !== 'supplier') {
      return {
        success: false,
        error: 'BYOC puo eliminare solo listini fornitore',
      };
    }

    await deletePriceList(id, workspaceId);
    __clearMasterListCache();

    return { success: true };
  } catch (error: any) {
    console.error('Errore eliminazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function createSupplierPriceListActionImpl(
  data: Omit<CreatePriceListInput, 'list_type' | 'is_global'> & {
    courier_id: string;
    metadata?: {
      courier_config_id?: string;
      carrier_code?: string;
      contract_code?: string;
      synced_at?: string;
    };
  }
): Promise<{
  success: boolean;
  priceList?: any;
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();
    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }
    const user = {
      id: wsContext.actor.id,
      account_type: wsContext.actor.account_type,
      is_reseller: wsContext.actor.is_reseller,
    };
    const workspaceId = wsContext.workspace.id;

    const isReseller = isResellerCheck(user);
    const isBYOC = isBYOCCheck(user);

    if (!isReseller && !isBYOC) {
      return {
        success: false,
        error: 'Solo Reseller e BYOC possono creare listini fornitore',
      };
    }

    if (
      data.metadata?.courier_config_id &&
      data.metadata?.carrier_code &&
      data.metadata?.contract_code
    ) {
      const { data: existingLists } = await supabaseAdmin
        .from('price_lists')
        .select('id, name, metadata, source_metadata')
        .eq('created_by', user.id)
        .eq('list_type', 'supplier')
        .limit(100);

      if (existingLists && data.metadata) {
        const duplicate = existingLists.find((pl: any) => {
          const metadata = pl.metadata || pl.source_metadata || {};
          return (
            metadata.courier_config_id === data.metadata?.courier_config_id &&
            metadata.carrier_code?.toLowerCase() === data.metadata?.carrier_code?.toLowerCase() &&
            metadata.contract_code?.toLowerCase() === data.metadata?.contract_code?.toLowerCase()
          );
        });

        if (duplicate) {
          return {
            success: false,
            error: `Esiste gia un listino per questa configurazione (${data.metadata?.carrier_code}/${data.metadata?.contract_code}). Usa un nome diverso o modifica il listino esistente.`,
          };
        }
      }
    }

    const priceListData: CreatePriceListInput = {
      ...data,
      list_type: 'supplier',
      is_global: false,
    };

    const priceList = await createPriceList(priceListData, user.id, workspaceId);
    return { success: true, priceList };
  } catch (error: any) {
    console.error('Errore creazione listino fornitore:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
