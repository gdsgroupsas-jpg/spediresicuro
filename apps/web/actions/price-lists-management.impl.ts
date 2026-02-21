import { isAdminOrAbove, isSuperAdminCheck } from '@/lib/auth-helpers';
import { __clearMasterListCache } from '@/lib/db/price-lists-advanced';
import { getPriceListById } from '@/lib/db/price-lists';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import type {
  AssignPriceListInput,
  ClonePriceListInput,
  PriceListAssignment,
} from '@/types/listini';

export async function clonePriceListActionImpl(input: ClonePriceListInput): Promise<{
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

    // Solo superadmin puÃ² clonare
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin puÃ² clonare listini',
      };
    }

    // Verifica che il listino sorgente esista
    const sourcePriceList = await getPriceListById(input.source_price_list_id, workspaceId);
    if (!sourcePriceList) {
      return { success: false, error: 'Listino sorgente non trovato' };
    }

    // H7 FIX: Dedup check â€” previene clone duplicato con stesso nome
    const wqClone = workspaceQuery(workspaceId);
    const { data: existingClone } = await wqClone
      .from('price_lists')
      .select('id')
      .eq('name', input.name)
      .limit(1)
      .maybeSingle();

    if (existingClone) {
      return {
        success: false,
        error: `Esiste giÃ  un listino con il nome "${input.name}". Scegli un nome diverso.`,
      };
    }

    // Usa la funzione DB clone_price_list
    const { data: clonedId, error } = await supabaseAdmin.rpc('clone_price_list', {
      p_source_id: input.source_price_list_id,
      p_new_name: input.name,
      p_target_user_id: input.target_user_id || null,
      p_overrides: input.overrides || {},
    });

    if (error) {
      console.error('Errore clonazione listino:', error);
      return { success: false, error: error.message };
    }

    // Recupera il listino clonato
    const clonedPriceList = await getPriceListById(clonedId, workspaceId);

    console.log(
      `âœ… [CLONE] Listino ${input.source_price_list_id} clonato come ${clonedId} (${input.name})`
    );

    // H8 FIX: Invalida cache master list dopo clonazione
    __clearMasterListCache();

    return { success: true, priceList: clonedPriceList };
  } catch (error: any) {
    console.error('Errore clonazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function assignPriceListToUserViaTableActionImpl(
  input: AssignPriceListInput
): Promise<{
  success: boolean;
  assignment?: PriceListAssignment;
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

    // Solo superadmin puÃ² assegnare
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin puÃ² assegnare listini',
      };
    }

    // âœ¨ FIX: Passa p_caller_id per supportare service_role
    // La funzione PostgreSQL usa auth.uid() che Ã¨ NULL con service_role,
    // quindi passiamo esplicitamente l'ID del chiamante
    const { data: assignmentId, error } = await supabaseAdmin.rpc('assign_price_list', {
      p_price_list_id: input.price_list_id,
      p_user_id: input.user_id,
      p_notes: input.notes || null,
      p_caller_id: user.id, // âœ¨ Passa ID utente corrente per service_role
    });

    if (error) {
      console.error('Errore assegnazione listino:', error);
      return { success: false, error: error.message };
    }

    // Recupera l'assegnazione creata
    const { data: assignment } = await supabaseAdmin
      .from('price_list_assignments')
      .select(
        `
        *,
        price_list:price_lists(id, name, list_type, courier_id),
        user:users!price_list_assignments_user_id_fkey(id, email, name, account_type),
        assigner:users!price_list_assignments_assigned_by_fkey(id, email)
      `
      )
      .eq('id', assignmentId)
      .single();

    console.log(
      `âœ… [ASSIGN] Listino ${input.price_list_id} assegnato a ${input.user_id} (assignment ID: ${assignmentId})`
    );

    return { success: true, assignment };
  } catch (error: any) {
    console.error('Errore assegnazione listino:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function revokePriceListAssignmentActionImpl(assignmentId: string): Promise<{
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

    // Solo superadmin puÃ² revocare
    if (!isSuperAdminCheck(user)) {
      return {
        success: false,
        error: 'Solo superadmin puÃ² revocare assegnazioni',
      };
    }

    // Usa la funzione DB revoke_price_list_assignment
    const { data: success, error } = await supabaseAdmin.rpc('revoke_price_list_assignment', {
      p_assignment_id: assignmentId,
    });

    if (error) {
      console.error('Errore revoca assegnazione:', error);
      return { success: false, error: error.message };
    }

    console.log(`âœ… [REVOKE] Assegnazione ${assignmentId} revocata`);

    return { success: true };
  } catch (error: any) {
    console.error('Errore revoca assegnazione:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function getAvailableCouriersForUserActionImpl(): Promise<{
  success: boolean;
  couriers?: Array<{
    courierId: string;
    courierName: string;
    providerId: string;
    contractCode: string;
    doesClientPickup: boolean;
  }>;
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

    // Import dinamico per evitare problemi di bundling
    const { getAvailableCouriersForUser } = await import('@/lib/db/price-lists');
    const couriers = await getAvailableCouriersForUser(user.id);

    return { success: true, couriers };
  } catch (error: any) {
    console.error('Errore getAvailableCouriersForUserAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

export async function getPriceListAuditEventsActionImpl(
  priceListId: string,
  options?: {
    eventTypes?: string[];
    limit?: number;
    offset?: number;
    actorId?: string;
  }
): Promise<{
  success: boolean;
  events?: Array<{
    id: string;
    event_type: string;
    severity: string;
    actor_id?: string;
    actor_email?: string;
    actor_type?: string;
    message?: string;
    old_value?: any;
    new_value?: any;
    metadata?: any;
    created_at: string;
  }>;
  total_count?: number;
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

    // Verifica permessi sul listino
    const priceList = await getPriceListById(priceListId, workspaceId);
    if (!priceList) {
      return { success: false, error: 'Listino non trovato' };
    }

    const isAdmin = isAdminOrAbove(user);
    const isOwner = priceList.created_by === user.id;
    const isAssignedOwner = priceList.assigned_to_user_id === user.id;

    if (!isAdmin && !isOwner && !isAssignedOwner) {
      return {
        success: false,
        error: "Non hai i permessi per vedere l'audit di questo listino",
      };
    }

    // Recupera eventi
    const { data, error } = await supabaseAdmin.rpc('get_price_list_audit_events', {
      p_price_list_id: priceListId,
      p_event_types: options?.eventTypes || null,
      p_limit: options?.limit || 100,
      p_offset: options?.offset || 0,
      p_actor_id: options?.actorId || null,
    });

    if (error) {
      console.error('Errore get_price_list_audit_events:', error);
      return { success: false, error: error.message };
    }

    const events = data || [];
    const total_count = events.length > 0 ? events[0].total_count : 0;

    return {
      success: true,
      events: events.map((e: any) => ({
        id: e.id,
        event_type: e.event_type,
        severity: e.severity,
        actor_id: e.actor_id,
        actor_email: e.actor_email,
        actor_type: e.actor_type,
        message: e.message,
        old_value: e.old_value,
        new_value: e.new_value,
        metadata: e.metadata,
        created_at: e.created_at,
      })),
      total_count: Number(total_count),
    };
  } catch (error: any) {
    console.error('Errore getPriceListAuditEventsAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
