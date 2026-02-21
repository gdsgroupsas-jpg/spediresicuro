import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';
import { buildPriceMatrix } from '@/lib/commercial-quotes/matrix-builder';
import { getDefaultClauses, mergeWithCustomClauses } from '@/lib/commercial-quotes/clauses';
import { convertQuoteToClient } from '@/lib/commercial-quotes/conversion';
import { sendPremiumWelcomeEmail } from '@/lib/email/resend';
import { updateProspectOnQuoteStatus } from '@/actions/reseller-prospects';
import type {
  CommercialQuote,
  ConvertQuoteInput,
  CreateRevisionInput,
  RenewExpiredQuoteInput,
} from '@/types/commercial-quotes';
import {
  formatCarrierDisplayName,
  toAuditContext,
  type ActionResult,
} from './commercial-quotes.helpers';

/**
 * Crea una nuova revisione del preventivo.
 * Ricalcola la matrice se il margine è cambiato.
 */
export async function createRevisionActionImpl(
  input: CreateRevisionInput
): Promise<ActionResult<CommercialQuote>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    const { data: parent, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', input.parent_quote_id)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !parent) {
      return { success: false, error: 'Preventivo originale non trovato' };
    }

    const rootId = parent.parent_quote_id || parent.id;
    const { count: revisionCount } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id', { count: 'exact', head: true })
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);

    const newRevision = (revisionCount || 1) + 1;
    const newMargin = input.margin_percent ?? parent.margin_percent;
    const newMarginFixedEur =
      input.margin_fixed_eur !== undefined
        ? input.margin_fixed_eur
        : (parent.margin_fixed_eur ?? null);
    const newValidityDays = input.validity_days ?? parent.validity_days;
    const newDeliveryMode = input.delivery_mode ?? parent.delivery_mode ?? 'carrier_pickup';
    const newPickupFee =
      input.pickup_fee !== undefined ? input.pickup_fee : (parent.pickup_fee ?? null);
    const newGoodsNeedsProcessing =
      input.goods_needs_processing ?? parent.goods_needs_processing ?? false;
    const newProcessingFee =
      input.processing_fee !== undefined ? input.processing_fee : (parent.processing_fee ?? null);

    let newMatrix = parent.price_matrix;
    const marginChanged =
      (input.margin_percent && input.margin_percent !== parent.margin_percent) ||
      (input.margin_fixed_eur !== undefined && input.margin_fixed_eur !== parent.margin_fixed_eur);
    if (marginChanged && parent.price_list_id) {
      const carrierDisplayName =
        parent.price_matrix?.carrier_display_name || formatCarrierDisplayName(parent.carrier_code);
      newMatrix = await buildPriceMatrix({
        priceListId: parent.price_list_id,
        marginPercent: newMargin,
        marginFixedEur: newMarginFixedEur ?? undefined,
        workspaceId,
        vatMode: parent.vat_mode || 'excluded',
        vatRate: parent.vat_rate || 22,
        carrierDisplayName,
        deliveryMode: newDeliveryMode,
        pickupFee: newPickupFee,
        goodsNeedsProcessing: newGoodsNeedsProcessing,
        processingFee: newProcessingFee,
      });
    }

    let clauses = input.clauses || parent.clauses;
    const deliveryChanged = input.delivery_mode && input.delivery_mode !== parent.delivery_mode;
    const processingChanged =
      input.goods_needs_processing !== undefined &&
      input.goods_needs_processing !== parent.goods_needs_processing;
    if (deliveryChanged || processingChanged) {
      const newDefaults = getDefaultClauses(parent.vat_mode || 'excluded', parent.vat_rate || 22, {
        deliveryMode: newDeliveryMode,
        pickupFee: newPickupFee,
        goodsNeedsProcessing: newGoodsNeedsProcessing,
        processingFee: newProcessingFee,
      });
      const customClauses = (parent.clauses || []).filter(
        (clause: any) => clause.type === 'custom'
      );
      clauses = mergeWithCustomClauses(newDefaults, customClauses);
    }

    const { data: revision, error: insertError } = await supabaseAdmin
      .from('commercial_quotes')
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        prospect_company: parent.prospect_company,
        prospect_contact_name: parent.prospect_contact_name,
        prospect_email: parent.prospect_email,
        prospect_phone: parent.prospect_phone,
        prospect_sector: parent.prospect_sector,
        prospect_estimated_volume: parent.prospect_estimated_volume,
        prospect_notes: parent.prospect_notes,
        carrier_code: parent.carrier_code,
        contract_code: parent.contract_code,
        price_list_id: parent.price_list_id,
        margin_percent: newMargin,
        margin_fixed_eur: newMarginFixedEur,
        validity_days: newValidityDays,
        delivery_mode: newDeliveryMode,
        pickup_fee: newPickupFee,
        goods_needs_processing: newGoodsNeedsProcessing,
        processing_fee: newProcessingFee,
        revision: newRevision,
        parent_quote_id: rootId,
        revision_notes: input.revision_notes,
        price_matrix: newMatrix,
        clauses,
        vat_mode: parent.vat_mode,
        vat_rate: parent.vat_rate,
        original_margin_percent: parent.original_margin_percent || parent.margin_percent,
        status: 'draft',
      })
      .select('*')
      .single();

    if (insertError || !revision) {
      return { success: false, error: `Errore creazione revisione: ${insertError?.message}` };
    }

    await workspaceQuery(workspaceId)
      .from('commercial_quote_events')
      .insert({
        quote_id: revision.id,
        event_type: 'revised',
        event_data: {
          previous_revision: parent.revision,
          new_revision: newRevision,
          margin_changed: input.margin_percent !== parent.margin_percent,
          previous_margin: parent.margin_percent,
          new_margin: newMargin,
        },
        actor_id: userId,
      });

    await writeAuditLog({
      context: toAuditContext(wsAuth),
      action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_REVISED,
      resourceType: 'commercial_quote',
      resourceId: revision.id,
      metadata: {
        parent_id: rootId,
        revision: newRevision,
        margin_percent: newMargin,
      },
    });

    return { success: true, data: revision as CommercialQuote };
  } catch (error: any) {
    console.error('Errore createRevisionAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Converte un preventivo accettato in cliente operativo.
 * Crea listino custom + utente con 1 click.
 */
export async function convertQuoteToClientActionImpl(
  input: ConvertQuoteInput
): Promise<ActionResult<{ userId: string; priceListId: string }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', input.quote_id)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    if (quote.status !== 'accepted') {
      return { success: false, error: 'Solo preventivi accettati possono essere convertiti' };
    }

    if (quote.converted_user_id) {
      return { success: false, error: 'Preventivo già convertito' };
    }

    if (!input.client_email?.trim()) {
      return { success: false, error: 'Email cliente obbligatoria' };
    }
    if (!input.client_name?.trim()) {
      return { success: false, error: 'Nome cliente obbligatorio' };
    }
    if (!input.client_password || input.client_password.length < 8) {
      return { success: false, error: 'Password deve essere almeno 8 caratteri' };
    }

    const result = await convertQuoteToClient({
      quote: quote as CommercialQuote,
      clientEmail: input.client_email,
      clientName: input.client_name,
      clientPassword: input.client_password,
      clientCompanyName: input.client_company_name,
      clientPhone: input.client_phone,
      resellerId: userId,
    });

    await supabaseAdmin
      .from('commercial_quotes')
      .update({
        converted_user_id: result.userId,
        converted_price_list_id: result.priceListId,
      })
      .eq('id', input.quote_id);

    await workspaceQuery(workspaceId)
      .from('commercial_quote_events')
      .insert({
        quote_id: input.quote_id,
        event_type: 'converted',
        event_data: {
          client_email: input.client_email,
          user_id: result.userId,
          price_list_id: result.priceListId,
        },
        actor_id: userId,
      });

    await writeAuditLog({
      context: toAuditContext(wsAuth),
      action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_CONVERTED,
      resourceType: 'commercial_quote',
      resourceId: input.quote_id,
      metadata: {
        prospect_company: quote.prospect_company,
        client_email: input.client_email,
        converted_user_id: result.userId,
        converted_price_list_id: result.priceListId,
      },
    });

    try {
      await updateProspectOnQuoteStatus(workspaceId, input.quote_id, 'accepted', userId);
    } catch (prospectErr) {
      console.error('[CRM] updateProspectOnQuoteStatus (conversion) error:', prospectErr);
    }

    try {
      await sendPremiumWelcomeEmail({
        to: input.client_email,
        userName: input.client_name,
        credentials: { email: input.client_email, password: input.client_password },
        resellerName: wsAuth.target.name || wsAuth.target.email || undefined,
        resellerCompany: wsAuth.workspace.organization_name || undefined,
      });
    } catch (emailError: any) {
      console.error('Errore invio email benvenuto:', emailError.message);
    }

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Errore convertQuoteToClientAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Rinnova un preventivo scaduto creando una nuova revisione draft.
 * Il preventivo scaduto RESTA expired (storia preservata).
 */
export async function renewExpiredQuoteActionImpl(
  input: RenewExpiredQuoteInput
): Promise<ActionResult<CommercialQuote>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    const { data: expired, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', input.expired_quote_id)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !expired) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    if (expired.status !== 'expired') {
      return { success: false, error: 'Solo preventivi scaduti possono essere rinnovati' };
    }

    const rootId = expired.parent_quote_id || expired.id;
    const { count: revisionCount } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id', { count: 'exact', head: true })
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);

    const newRevision = (revisionCount || 1) + 1;
    const newMargin = input.margin_percent ?? expired.margin_percent;
    const newMarginFixedEur =
      input.margin_fixed_eur !== undefined
        ? input.margin_fixed_eur
        : (expired.margin_fixed_eur ?? null);
    const newValidityDays = input.new_validity_days ?? expired.validity_days;

    let newMatrix = expired.price_matrix;
    const marginChanged =
      (input.margin_percent && input.margin_percent !== expired.margin_percent) ||
      (input.margin_fixed_eur !== undefined && input.margin_fixed_eur !== expired.margin_fixed_eur);
    if (marginChanged && expired.price_list_id) {
      const carrierDisplayName =
        expired.price_matrix?.carrier_display_name ||
        formatCarrierDisplayName(expired.carrier_code);
      newMatrix = await buildPriceMatrix({
        priceListId: expired.price_list_id,
        marginPercent: newMargin,
        marginFixedEur: newMarginFixedEur ?? undefined,
        workspaceId,
        vatMode: expired.vat_mode || 'excluded',
        vatRate: expired.vat_rate || 22,
        carrierDisplayName,
        deliveryMode: expired.delivery_mode || 'carrier_pickup',
        pickupFee: expired.pickup_fee,
        goodsNeedsProcessing: expired.goods_needs_processing || false,
        processingFee: expired.processing_fee,
      });
    }

    const { data: renewal, error: insertError } = await supabaseAdmin
      .from('commercial_quotes')
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        prospect_company: expired.prospect_company,
        prospect_contact_name: expired.prospect_contact_name,
        prospect_email: expired.prospect_email,
        prospect_phone: expired.prospect_phone,
        prospect_sector: expired.prospect_sector,
        prospect_estimated_volume: expired.prospect_estimated_volume,
        prospect_notes: expired.prospect_notes,
        carrier_code: expired.carrier_code,
        contract_code: expired.contract_code,
        price_list_id: expired.price_list_id,
        margin_percent: newMargin,
        margin_fixed_eur: newMarginFixedEur,
        validity_days: newValidityDays,
        delivery_mode: expired.delivery_mode,
        pickup_fee: expired.pickup_fee,
        goods_needs_processing: expired.goods_needs_processing,
        processing_fee: expired.processing_fee,
        revision: newRevision,
        parent_quote_id: rootId,
        revision_notes: input.revision_notes || 'Rinnovo da preventivo scaduto',
        price_matrix: newMatrix,
        clauses: expired.clauses,
        vat_mode: expired.vat_mode,
        vat_rate: expired.vat_rate,
        original_margin_percent: expired.original_margin_percent || expired.margin_percent,
        status: 'draft',
      })
      .select('*')
      .single();

    if (insertError || !renewal) {
      return { success: false, error: `Errore rinnovo: ${insertError?.message}` };
    }

    await workspaceQuery(workspaceId)
      .from('commercial_quote_events')
      .insert({
        quote_id: expired.id,
        event_type: 'renewed',
        event_data: {
          new_quote_id: renewal.id,
          new_revision: newRevision,
          new_margin: newMargin,
        },
        actor_id: userId,
      });

    await workspaceQuery(workspaceId)
      .from('commercial_quote_events')
      .insert({
        quote_id: renewal.id,
        event_type: 'created',
        event_data: {
          renewed_from: expired.id,
          revision: newRevision,
        },
        actor_id: userId,
      });

    await writeAuditLog({
      context: toAuditContext(wsAuth),
      action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_REVISED,
      resourceType: 'commercial_quote',
      resourceId: renewal.id,
      metadata: {
        parent_id: rootId,
        renewed_from: expired.id,
        revision: newRevision,
        margin_percent: newMargin,
      },
    });

    return { success: true, data: renewal as CommercialQuote };
  } catch (error: any) {
    console.error('Errore renewExpiredQuoteAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
