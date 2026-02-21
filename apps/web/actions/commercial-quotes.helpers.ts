import { supabaseAdmin } from '@/lib/db/client';
import type { ActingContext } from '@/lib/safe-auth';
import type { CommercialQuoteEventType, CommercialQuoteStatus } from '@/types/commercial-quotes';
import type { OrganizationFooterInfo, WorkspaceActingContext } from '@/types/workspace';

/** Estrae ActingContext da WorkspaceActingContext per writeAuditLog */
export function toAuditContext(wsAuth: WorkspaceActingContext): ActingContext {
  return {
    actor: wsAuth.actor,
    target: wsAuth.target,
    isImpersonating: wsAuth.isImpersonating,
  };
}

/** Risposta standard per tutte le actions */
export interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Carica dati organizzazione per footer white-label nei PDF */
export async function loadOrgFooterInfo(orgId: string): Promise<OrganizationFooterInfo | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('name, vat_number, billing_email, billing_address')
      .eq('id', orgId)
      .single();

    if (error || !data) return null;

    return {
      name: data.name,
      vat_number: data.vat_number || null,
      billing_email: data.billing_email || '',
      billing_address: data.billing_address || null,
    };
  } catch {
    return null;
  }
}

/** Transizioni di stato valide */
export const VALID_TRANSITIONS: Record<CommercialQuoteStatus, CommercialQuoteStatus[]> = {
  draft: ['sent'],
  sent: ['negotiating', 'accepted', 'rejected'],
  negotiating: ['sent', 'accepted', 'rejected'],
  accepted: [],
  rejected: [],
  expired: [],
};

/**
 * Raccoglie TUTTI i price_list ID accessibili da un reseller (3 fonti):
 * 1. workspaces.assigned_price_list_id
 * 2. price_list_assignments (tabella N:N)
 * 3. price_lists.assigned_to_user_id (legacy)
 */
export async function collectAccessiblePriceListIds(
  workspaceId: string,
  userId: string
): Promise<string[]> {
  const ids = new Set<string>();

  // Fonte 1: workspaces.assigned_price_list_id
  const { data: wsData } = await supabaseAdmin
    .from('workspaces')
    .select('assigned_price_list_id')
    .eq('id', workspaceId)
    .single();
  if (wsData?.assigned_price_list_id) {
    ids.add(wsData.assigned_price_list_id);
  }

  // Fonte 2: price_list_assignments (tabella N:N)
  const { data: assignments } = await supabaseAdmin
    .from('price_list_assignments')
    .select('price_list_id')
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (assignments) {
    for (const assignment of assignments) {
      ids.add(assignment.price_list_id);
    }
  }

  // Fonte 3: price_lists.assigned_to_user_id (legacy)
  const { data: directAssigned } = await supabaseAdmin
    .from('price_lists')
    .select('id')
    .eq('assigned_to_user_id', userId)
    .eq('status', 'active');
  if (directAssigned) {
    for (const priceList of directAssigned) {
      ids.add(priceList.id);
    }
  }

  return Array.from(ids);
}

export type AccessiblePriceListRow = {
  id: string;
  metadata: Record<string, unknown> | null;
  [key: string]: unknown;
};

/**
 * Query listini accessibili: workspace_id del reseller + listini assegnati.
 */
export async function queryAccessiblePriceLists(
  workspaceId: string,
  accessiblePlIds: string[],
  selectColumns: string
): Promise<AccessiblePriceListRow[] | null> {
  // Non possiamo usare workspaceQuery() qui: il .or() serve per vedere
  // listini assegnati da altri workspace, e workspaceQuery forzerebbe .eq('workspace_id')
  const crossWsDb = supabaseAdmin;
  let query = crossWsDb.from('price_lists').select(selectColumns).eq('status', 'active');

  if (accessiblePlIds.length > 0) {
    const orConditions = [`workspace_id.eq.${workspaceId}`];
    for (const priceListId of accessiblePlIds) {
      orConditions.push(`id.eq.${priceListId}`);
    }
    query = query.or(orConditions.join(','));
  } else {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[queryAccessiblePriceLists] Errore query:', error.message);
  }

  return data as AccessiblePriceListRow[] | null;
}

/** Etichette italiane per tipi evento */
export const EVENT_LABELS: Record<CommercialQuoteEventType, string> = {
  created: 'Preventivo creato',
  updated: 'Preventivo aggiornato',
  sent: 'Inviato al prospect',
  viewed: 'Visualizzato',
  revised: 'Nuova revisione',
  accepted: 'Accettato',
  rejected: 'Rifiutato',
  expired: 'Scaduto',
  reminder_sent: 'Reminder inviato',
  renewed: 'Rinnovato',
  converted: 'Convertito in cliente',
};

/**
 * Formatta il carrier_code in un nome display leggibile.
 * Es: "gls-GLS-5000" -> "GLS 5000"
 * Es: "postedeliverybusiness-SDA---Express---H24+" -> "PosteDeliveryBusiness"
 */
export function formatCarrierDisplayName(carrierCode: string): string {
  const parts = carrierCode.split('-');
  const prefix = parts[0] || carrierCode;

  const knownNames: Record<string, string> = {
    gls: 'GLS',
    brt: 'BRT',
    sda: 'SDA',
    dhl: 'DHL',
    ups: 'UPS',
    fedex: 'FedEx',
    tnt: 'TNT',
    postedeliverybusiness: 'PosteDeliveryBusiness',
    posteitaliane: 'Poste Italiane',
    nexive: 'Nexive',
  };

  return knownNames[prefix.toLowerCase()] || prefix;
}
