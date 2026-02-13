'use server';

/**
 * Server Actions: Preventivatore Commerciale
 *
 * Gestione preventivi commerciali per agenti/reseller.
 * Pipeline: draft -> sent -> negotiating -> accepted|rejected|expired
 *
 * Pattern: getWorkspaceAuth() + supabaseAdmin + return {success, data?, error?}
 *
 * @module actions/commercial-quotes
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import type { WorkspaceActingContext } from '@/types/workspace';
import type { ActingContext } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';
import { buildPriceMatrix } from '@/lib/commercial-quotes/matrix-builder';
import {
  findProspectByContactInternal,
  linkQuoteToProspectInternal,
  updateProspectOnQuoteStatus,
} from '@/actions/reseller-prospects';
import { getDefaultClauses, mergeWithCustomClauses } from '@/lib/commercial-quotes/clauses';
import { generateCommercialQuotePDF } from '@/lib/commercial-quotes/pdf-generator';
import { convertQuoteToClient } from '@/lib/commercial-quotes/conversion';
import { computeAnalytics } from '@/lib/commercial-quotes/analytics';
import { sendQuoteToProspectEmail, sendPremiumWelcomeEmail } from '@/lib/email/resend';
import type {
  CommercialQuote,
  CreateCommercialQuoteInput,
  CreateRevisionInput,
  ConvertQuoteInput,
  QuotePipelineStats,
  QuoteAnalyticsData,
  CommercialQuoteStatus,
  NegotiationTimelineEntry,
  RenewExpiredQuoteInput,
  CommercialQuoteEventType,
} from '@/types/commercial-quotes';

// ============================================
// HELPERS
// ============================================

/** Estrae ActingContext da WorkspaceActingContext per writeAuditLog */
function toAuditContext(wsAuth: WorkspaceActingContext): ActingContext {
  return {
    actor: wsAuth.actor,
    target: wsAuth.target,
    isImpersonating: wsAuth.isImpersonating,
  };
}

/** Risposta standard per tutte le actions */
interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Transizioni di stato valide */
const VALID_TRANSITIONS: Record<CommercialQuoteStatus, CommercialQuoteStatus[]> = {
  draft: ['sent'],
  sent: ['negotiating', 'accepted', 'rejected'],
  negotiating: ['sent', 'accepted', 'rejected'],
  accepted: [], // Stato finale (solo conversione)
  rejected: [], // Stato finale
  expired: [], // Stato finale (impostato da cron/trigger)
};

// ============================================
// CREATE
// ============================================

/**
 * Crea un nuovo preventivo commerciale.
 * Genera automaticamente la matrice prezzi dal listino selezionato.
 */
export async function createCommercialQuoteAction(
  input: CreateCommercialQuoteInput
): Promise<ActionResult<CommercialQuote>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    // Validazione input
    if (!input.prospect_company?.trim()) {
      return { success: false, error: 'Nome azienda prospect obbligatorio' };
    }
    if (!input.carrier_code?.trim() || !input.contract_code?.trim()) {
      return { success: false, error: 'Corriere e contratto obbligatori' };
    }

    // Recupera assigned_price_list_id dal workspace (listini assegnati dal superadmin)
    const { data: wsData } = await supabaseAdmin
      .from('workspaces')
      .select('assigned_price_list_id')
      .eq('id', workspaceId)
      .single();

    const assignedPlId = wsData?.assigned_price_list_id;

    // Trova il price_list_id dal contract_code se non fornito
    let priceListId: string | undefined = input.price_list_id;
    if (!priceListId) {
      // Cerca listino attivo - include listini del workspace E listini assegnati
      let plQuery = supabaseAdmin.from('price_lists').select('id, metadata').eq('status', 'active');

      if (assignedPlId) {
        plQuery = plQuery.or(`workspace_id.eq.${workspaceId},id.eq.${assignedPlId}`);
      } else {
        plQuery = plQuery.eq('workspace_id', workspaceId);
      }

      const { data: plList } = await plQuery;

      const matched = plList?.find(
        (p: { id: string; metadata: Record<string, unknown> | null }) =>
          (p.metadata as Record<string, unknown>)?.contract_code === input.contract_code
      );

      if (!matched) {
        return { success: false, error: 'Nessun listino trovato per questo contratto' };
      }
      priceListId = matched.id;
    }

    if (!priceListId) {
      return { success: false, error: 'Nessun listino trovato' };
    }

    const marginPercent = input.margin_percent ?? 20;
    const vatMode = input.vat_mode ?? 'excluded';
    const vatRate = input.vat_rate ?? 22;
    const validityDays = input.validity_days ?? 30;
    const deliveryMode = input.delivery_mode ?? 'carrier_pickup';
    const pickupFee = input.pickup_fee ?? null;
    const goodsNeedsProcessing = input.goods_needs_processing ?? false;
    const processingFee = input.processing_fee ?? null;

    // Genera carrier display name dal carrier_code
    const carrierDisplayName = formatCarrierDisplayName(input.carrier_code);

    // Costruisci matrice prezzi
    const priceMatrix = await buildPriceMatrix({
      priceListId,
      marginPercent,
      workspaceId,
      vatMode,
      vatRate,
      carrierDisplayName,
      deliveryMode,
      pickupFee,
      goodsNeedsProcessing,
      processingFee,
    });

    // Costruisci matrici aggiuntive per confronto multi-corriere
    let additionalCarriers = null;
    if (input.additional_carrier_codes && input.additional_carrier_codes.length > 0) {
      const additionalSnapshots = [];
      for (const ac of input.additional_carrier_codes) {
        // Usa price_list_id diretto se fornito, altrimenti cerca per contract_code
        let acPriceListId = ac.price_list_id;
        if (!acPriceListId) {
          // Includi listini del workspace E listini assegnati (stessa logica di sopra)
          let acPlQuery = supabaseAdmin
            .from('price_lists')
            .select('id, metadata')
            .eq('status', 'active');

          if (assignedPlId) {
            acPlQuery = acPlQuery.or(`workspace_id.eq.${workspaceId},id.eq.${assignedPlId}`);
          } else {
            acPlQuery = acPlQuery.eq('workspace_id', workspaceId);
          }

          const { data: acPlList } = await acPlQuery;

          const acMatched = acPlList?.find(
            (p: { id: string; metadata: Record<string, unknown> | null }) =>
              (p.metadata as Record<string, unknown>)?.contract_code === ac.contract_code
          );
          acPriceListId = acMatched?.id;
        }

        if (acPriceListId) {
          const acMatrix = await buildPriceMatrix({
            priceListId: acPriceListId,
            marginPercent: ac.margin_percent ?? marginPercent,
            workspaceId,
            vatMode,
            vatRate,
            carrierDisplayName: formatCarrierDisplayName(ac.carrier_code),
            deliveryMode,
            pickupFee,
            goodsNeedsProcessing,
            processingFee,
          });
          additionalSnapshots.push({
            carrier_code: ac.carrier_code,
            contract_code: ac.contract_code,
            price_matrix: acMatrix,
          });
        }
      }
      if (additionalSnapshots.length > 0) {
        additionalCarriers = additionalSnapshots;
      }
    }

    // Clausole: default + custom (con delivery mode)
    const defaultClauses = getDefaultClauses(vatMode, vatRate, {
      deliveryMode,
      pickupFee,
      goodsNeedsProcessing,
      processingFee,
    });
    const clauses = input.clauses
      ? mergeWithCustomClauses(defaultClauses, input.clauses)
      : defaultClauses;

    // INSERT preventivo
    const { data: quote, error: insertError } = await supabaseAdmin
      .from('commercial_quotes')
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        prospect_company: input.prospect_company.trim(),
        prospect_contact_name: input.prospect_contact_name?.trim() || null,
        prospect_email: input.prospect_email?.trim().toLowerCase() || null,
        prospect_phone: input.prospect_phone?.trim() || null,
        prospect_sector: input.prospect_sector || null,
        prospect_estimated_volume: input.prospect_estimated_volume || null,
        prospect_notes: input.prospect_notes?.trim() || null,
        carrier_code: input.carrier_code,
        contract_code: input.contract_code,
        price_list_id: priceListId,
        margin_percent: marginPercent,
        validity_days: validityDays,
        delivery_mode: deliveryMode,
        pickup_fee: pickupFee,
        goods_needs_processing: goodsNeedsProcessing,
        processing_fee: processingFee,
        revision: 1,
        price_matrix: priceMatrix,
        additional_carriers: additionalCarriers,
        clauses,
        vat_mode: vatMode,
        vat_rate: vatRate,
        original_margin_percent: marginPercent,
        status: 'draft',
      })
      .select('*')
      .single();

    if (insertError || !quote) {
      return { success: false, error: `Errore creazione preventivo: ${insertError?.message}` };
    }

    // Evento lifecycle
    await supabaseAdmin.from('commercial_quote_events').insert({
      quote_id: quote.id,
      event_type: 'created',
      event_data: { margin_percent: marginPercent, carrier_code: input.carrier_code },
      actor_id: userId,
    });

    // Audit log
    await writeAuditLog({
      context: toAuditContext(wsAuth),
      action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_CREATED,
      resourceType: 'commercial_quote',
      resourceId: quote.id,
      metadata: {
        prospect_company: input.prospect_company,
        carrier_code: input.carrier_code,
        margin_percent: marginPercent,
        delivery_mode: deliveryMode,
      },
    });

    // Auto-link con prospect esistente (non-bloccante)
    try {
      const matchedProspect = await findProspectByContactInternal(
        workspaceId,
        input.prospect_email?.trim().toLowerCase() || undefined,
        input.prospect_company?.trim() || undefined
      );
      if (matchedProspect) {
        await linkQuoteToProspectInternal(matchedProspect.id, quote.id, userId);
        console.log(`[CRM] Auto-linked quote ${quote.id} to prospect ${matchedProspect.id}`);
      }
    } catch (linkErr) {
      // Non-bloccante: log errore ma non fallisce la creazione
      console.error('[CRM] Auto-link prospect error:', linkErr);
    }

    return { success: true, data: quote as CommercialQuote };
  } catch (error: any) {
    console.error('Errore createCommercialQuoteAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// READ
// ============================================

/**
 * Lista preventivi del workspace con filtri opzionali.
 */
export async function getCommercialQuotesAction(filters?: {
  status?: CommercialQuoteStatus;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ quotes: CommercialQuote[]; total: number }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    // Query unica: carica tutte le quotes del workspace (root + revisioni)
    // poi raggruppa in JS per evitare N+1
    const { data: allQuotes, error } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('revision', { ascending: false });

    if (error) {
      return { success: false, error: `Errore caricamento preventivi: ${error.message}` };
    }

    const all = (allQuotes || []) as CommercialQuote[];

    // Raggruppa per root: per ogni catena di revisioni, prendi l'ultima revisione
    const latestByRoot = new Map<string, CommercialQuote>();
    for (const q of all) {
      const rootId = q.parent_quote_id || q.id;
      const existing = latestByRoot.get(rootId);
      if (!existing || q.revision > existing.revision) {
        latestByRoot.set(rootId, q);
      }
    }

    // Converti in array e applica filtri
    let enrichedQuotes = Array.from(latestByRoot.values());

    if (filters?.status) {
      enrichedQuotes = enrichedQuotes.filter((q) => q.status === filters.status);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      enrichedQuotes = enrichedQuotes.filter(
        (q) =>
          q.prospect_company?.toLowerCase().includes(searchLower) ||
          q.prospect_email?.toLowerCase().includes(searchLower) ||
          q.prospect_contact_name?.toLowerCase().includes(searchLower)
      );
    }

    // Ordina per data creazione decrescente
    enrichedQuotes.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Paginazione
    const total = enrichedQuotes.length;
    const paginatedQuotes = enrichedQuotes.slice(offset, offset + limit);

    return {
      success: true,
      data: { quotes: paginatedQuotes, total },
    };
  } catch (error: any) {
    console.error('Errore getCommercialQuotesAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Dettaglio singolo preventivo con catena revisioni.
 */
export async function getCommercialQuoteByIdAction(
  quoteId: string
): Promise<ActionResult<{ quote: CommercialQuote; revisions: CommercialQuote[] }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    // Carica la quote
    const { data: quote, error } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    // Carica tutte le revisioni (sia parent che figlie)
    const rootId = quote.parent_quote_id || quote.id;

    // Carica root + tutte le revisioni
    const { data: allRevisions } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`)
      .eq('workspace_id', workspaceId)
      .order('revision', { ascending: true });

    return {
      success: true,
      data: {
        quote: quote as CommercialQuote,
        revisions: (allRevisions as CommercialQuote[]) || [],
      },
    };
  } catch (error: any) {
    console.error('Errore getCommercialQuoteByIdAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Statistiche pipeline preventivi.
 */
export async function getQuotePipelineStatsAction(): Promise<ActionResult<QuotePipelineStats>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: quotes, error } = await supabaseAdmin
      .from('commercial_quotes')
      .select('status')
      .eq('workspace_id', workspaceId);

    if (error) {
      return { success: false, error: `Errore statistiche: ${error.message}` };
    }

    const stats: QuotePipelineStats = {
      draft: 0,
      sent: 0,
      negotiating: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      total: quotes?.length || 0,
      conversion_rate: 0,
    };

    for (const q of quotes || []) {
      const status = q.status as CommercialQuoteStatus;
      if (status in stats) {
        (stats as any)[status]++;
      }
    }

    // Conversion rate: accepted / (accepted + rejected)
    const closedDeals = stats.accepted + stats.rejected;
    stats.conversion_rate = closedDeals > 0 ? stats.accepted / closedDeals : 0;

    return { success: true, data: stats };
  } catch (error: any) {
    console.error('Errore getQuotePipelineStatsAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// SEND & STATUS
// ============================================

/**
 * Invia un preventivo: genera PDF, salva in Storage, aggiorna status.
 */
export async function sendCommercialQuoteAction(
  quoteId: string
): Promise<ActionResult<{ pdfUrl: string }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    // Carica quote
    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    if (quote.status !== 'draft' && quote.status !== 'negotiating') {
      return { success: false, error: `Impossibile inviare preventivo in stato "${quote.status}"` };
    }

    // Genera PDF
    const branding = wsAuth.workspace.branding || null;
    const pdfBuffer = await generateCommercialQuotePDF(quote as CommercialQuote, branding);

    // Upload PDF in Supabase Storage
    const storagePath = `${workspaceId}/${quoteId}/preventivo_rev${quote.revision}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('commercial-quotes')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      // Prova a creare il bucket se non esiste
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        await supabaseAdmin.storage.createBucket('commercial-quotes', { public: false });
        const { error: retryError } = await supabaseAdmin.storage
          .from('commercial-quotes')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });
        if (retryError) {
          return { success: false, error: `Errore upload PDF: ${retryError.message}` };
        }
      } else {
        return { success: false, error: `Errore upload PDF: ${uploadError.message}` };
      }
    }

    // Aggiorna quote: status + sent_at + pdf_storage_path
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('commercial_quotes')
      .update({
        status: 'sent',
        sent_at: now,
        pdf_storage_path: storagePath,
      })
      .eq('id', quoteId);

    if (updateError) {
      return { success: false, error: `Errore aggiornamento stato: ${updateError.message}` };
    }

    // Evento lifecycle
    await supabaseAdmin.from('commercial_quote_events').insert({
      quote_id: quoteId,
      event_type: 'sent',
      event_data: { pdf_storage_path: storagePath },
      actor_id: userId,
    });

    // Audit log
    await writeAuditLog({
      context: toAuditContext(wsAuth),
      action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_SENT,
      resourceType: 'commercial_quote',
      resourceId: quoteId,
      metadata: {
        prospect_company: quote.prospect_company,
        revision: quote.revision,
      },
    });

    // Invio email al prospect (non-bloccante)
    if (quote.prospect_email) {
      try {
        await sendQuoteToProspectEmail({
          to: quote.prospect_email,
          prospectName: quote.prospect_contact_name || quote.prospect_company,
          resellerCompanyName: wsAuth.workspace.organization_name || 'SpedireSicuro',
          quoteValidityDays: quote.validity_days,
          pdfBuffer,
        });
      } catch (emailError: any) {
        // Non-bloccante: log errore ma non fallisce l'azione
        console.error('Errore invio email prospect:', emailError.message);
      }
    }

    return { success: true, data: { pdfUrl: storagePath } };
  } catch (error: any) {
    console.error('Errore sendCommercialQuoteAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Aggiorna stato preventivo (negotiating, accepted, rejected).
 */
export async function updateQuoteStatusAction(
  quoteId: string,
  newStatus: CommercialQuoteStatus,
  notes?: string
): Promise<ActionResult> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    // Carica quote corrente
    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id, status, prospect_company')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    // Verifica transizione valida
    const currentStatus = quote.status as CommercialQuoteStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Transizione non valida: ${currentStatus} -> ${newStatus}`,
      };
    }

    // Update
    const updatePayload: Record<string, any> = {
      status: newStatus,
    };

    if (newStatus === 'accepted' || newStatus === 'rejected') {
      updatePayload.responded_at = new Date().toISOString();
    }
    if (notes) {
      updatePayload.response_notes = notes;
    }

    const { error: updateError } = await supabaseAdmin
      .from('commercial_quotes')
      .update(updatePayload)
      .eq('id', quoteId);

    if (updateError) {
      return { success: false, error: `Errore aggiornamento: ${updateError.message}` };
    }

    // Evento lifecycle
    await supabaseAdmin.from('commercial_quote_events').insert({
      quote_id: quoteId,
      event_type: newStatus,
      event_data: { previous_status: currentStatus, notes },
      actor_id: userId,
    });

    // Audit log per accepted/rejected
    if (newStatus === 'accepted') {
      await writeAuditLog({
        context: toAuditContext(wsAuth),
        action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_ACCEPTED,
        resourceType: 'commercial_quote',
        resourceId: quoteId,
        metadata: { prospect_company: quote.prospect_company },
      });
    } else if (newStatus === 'rejected') {
      await writeAuditLog({
        context: toAuditContext(wsAuth),
        action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_REJECTED,
        resourceType: 'commercial_quote',
        resourceId: quoteId,
        metadata: { prospect_company: quote.prospect_company, notes },
      });
    }

    // Aggiorna prospect collegato se accepted/rejected (non-bloccante)
    if (newStatus === 'accepted' || newStatus === 'rejected') {
      try {
        await updateProspectOnQuoteStatus(workspaceId, quoteId, newStatus, userId, notes);
      } catch (prospectErr) {
        console.error('[CRM] updateProspectOnQuoteStatus error:', prospectErr);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Errore updateQuoteStatusAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// REVISIONS
// ============================================

/**
 * Crea una nuova revisione del preventivo.
 * Ricalcola la matrice se il margine è cambiato.
 */
export async function createRevisionAction(
  input: CreateRevisionInput
): Promise<ActionResult<CommercialQuote>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    // Carica quote parent
    const { data: parent, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', input.parent_quote_id)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !parent) {
      return { success: false, error: 'Preventivo originale non trovato' };
    }

    // Determina root per contare revisioni
    const rootId = parent.parent_quote_id || parent.id;
    const { count: revisionCount } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id', { count: 'exact', head: true })
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);

    const newRevision = (revisionCount || 1) + 1;
    const newMargin = input.margin_percent ?? parent.margin_percent;
    const newValidityDays = input.validity_days ?? parent.validity_days;
    const newDeliveryMode = input.delivery_mode ?? parent.delivery_mode ?? 'carrier_pickup';
    const newPickupFee =
      input.pickup_fee !== undefined ? input.pickup_fee : (parent.pickup_fee ?? null);
    const newGoodsNeedsProcessing =
      input.goods_needs_processing ?? parent.goods_needs_processing ?? false;
    const newProcessingFee =
      input.processing_fee !== undefined ? input.processing_fee : (parent.processing_fee ?? null);

    // Ricalcola matrice se margine cambiato
    let newMatrix = parent.price_matrix;
    if (
      input.margin_percent &&
      input.margin_percent !== parent.margin_percent &&
      parent.price_list_id
    ) {
      const carrierDisplayName =
        parent.price_matrix?.carrier_display_name || formatCarrierDisplayName(parent.carrier_code);
      newMatrix = await buildPriceMatrix({
        priceListId: parent.price_list_id,
        marginPercent: input.margin_percent,
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

    // Clausole: ricalcola se delivery mode o processing cambia, altrimenti eredita
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
      // Mantieni clausole custom, sostituisci le standard
      const customClauses = (parent.clauses || []).filter((c: any) => c.type === 'custom');
      clauses = mergeWithCustomClauses(newDefaults, customClauses);
    }

    // INSERT nuova revisione
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

    // Evento lifecycle
    await supabaseAdmin.from('commercial_quote_events').insert({
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

    // Audit log
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

// ============================================
// CONVERSION
// ============================================

/**
 * Converte un preventivo accettato in cliente operativo.
 * Crea listino custom + utente con 1 click.
 */
export async function convertQuoteToClientAction(
  input: ConvertQuoteInput
): Promise<ActionResult<{ userId: string; priceListId: string }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    // Carica quote
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
      return { success: false, error: 'Preventivo gia\u0300 convertito' };
    }

    // Validazione input
    if (!input.client_email?.trim()) {
      return { success: false, error: 'Email cliente obbligatoria' };
    }
    if (!input.client_name?.trim()) {
      return { success: false, error: 'Nome cliente obbligatorio' };
    }
    if (!input.client_password || input.client_password.length < 8) {
      return { success: false, error: 'Password deve essere almeno 8 caratteri' };
    }

    // Esegui conversione
    const result = await convertQuoteToClient({
      quote: quote as CommercialQuote,
      clientEmail: input.client_email,
      clientName: input.client_name,
      clientPassword: input.client_password,
      clientCompanyName: input.client_company_name,
      clientPhone: input.client_phone,
      resellerId: userId,
    });

    // Aggiorna quote con IDs conversione
    await supabaseAdmin
      .from('commercial_quotes')
      .update({
        converted_user_id: result.userId,
        converted_price_list_id: result.priceListId,
      })
      .eq('id', input.quote_id);

    // Evento lifecycle
    await supabaseAdmin.from('commercial_quote_events').insert({
      quote_id: input.quote_id,
      event_type: 'converted',
      event_data: {
        client_email: input.client_email,
        user_id: result.userId,
        price_list_id: result.priceListId,
      },
      actor_id: userId,
    });

    // Audit log
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

    // Aggiorna prospect collegato: won + converted (non-bloccante)
    try {
      await updateProspectOnQuoteStatus(workspaceId, input.quote_id, 'accepted', userId);
    } catch (prospectErr) {
      console.error('[CRM] updateProspectOnQuoteStatus (conversion) error:', prospectErr);
    }

    // Email premium benvenuto al nuovo cliente (non-bloccante)
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

// ============================================
// DELETE
// ============================================

/**
 * Elimina un preventivo in bozza.
 */
export async function deleteCommercialQuoteDraftAction(quoteId: string): Promise<ActionResult> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    // Verifica che sia una bozza
    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id, status')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    if (quote.status !== 'draft') {
      return { success: false, error: 'Solo bozze possono essere eliminate' };
    }

    // Elimina (cascade elimina anche events)
    const { error: deleteError } = await supabaseAdmin
      .from('commercial_quotes')
      .delete()
      .eq('id', quoteId);

    if (deleteError) {
      return { success: false, error: `Errore eliminazione: ${deleteError.message}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Errore deleteCommercialQuoteDraftAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// PDF GENERATION (anteprima)
// ============================================

/**
 * Genera PDF on-the-fly per anteprima bozze.
 * Ritorna base64 del PDF.
 */
export async function generateQuotePdfAction(
  quoteId: string
): Promise<ActionResult<{ pdfBase64: string }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    // Carica quote
    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    // Genera PDF
    const branding = wsAuth.workspace.branding || null;
    const pdfBuffer = await generateCommercialQuotePDF(quote as CommercialQuote, branding);
    const pdfBase64 = pdfBuffer.toString('base64');

    return { success: true, data: { pdfBase64 } };
  } catch (error: any) {
    console.error('Errore generateQuotePdfAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Calcola analytics completi per i preventivi commerciali del workspace.
 * KPI, funnel, margini, performance corriere/settore, timeline.
 */
export async function getQuoteAnalyticsAction(): Promise<ActionResult<QuoteAnalyticsData>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: quotes, error } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Errore query analytics:', error);
      return { success: false, error: error.message };
    }

    const analytics = computeAnalytics((quotes || []) as CommercialQuote[]);
    return { success: true, data: analytics };
  } catch (error: any) {
    console.error('Errore getQuoteAnalyticsAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// NEGOTIATION TIMELINE
// ============================================

/** Etichette italiane per tipi evento */
const EVENT_LABELS: Record<CommercialQuoteEventType, string> = {
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
 * Carica la timeline negoziazione completa per un preventivo.
 * Include eventi di tutta la catena revisioni (root + figli).
 */
export async function getQuoteNegotiationTimelineAction(
  quoteId: string
): Promise<ActionResult<NegotiationTimelineEntry[]>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    // Carica quote per trovare root
    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id, parent_quote_id, workspace_id')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    const rootId = quote.parent_quote_id || quote.id;

    // Trova tutti gli ID della catena (root + revisioni)
    const { data: chainQuotes } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id')
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);

    const chainIds = (chainQuotes || []).map((q) => q.id);

    // Carica tutti gli eventi della catena
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('commercial_quote_events')
      .select('id, quote_id, event_type, event_data, actor_id, created_at')
      .in('quote_id', chainIds)
      .order('created_at', { ascending: true });

    if (eventsError) {
      return { success: false, error: eventsError.message };
    }

    // Carica nomi attori (batch)
    const actorIds = [...new Set((events || []).map((e) => e.actor_id).filter(Boolean))];
    let actorMap = new Map<string, string>();
    if (actorIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .in('id', actorIds);

      for (const u of users || []) {
        actorMap.set(u.id, u.full_name || u.email || 'Utente');
      }
    }

    // Mappa a NegotiationTimelineEntry
    const timeline: NegotiationTimelineEntry[] = (events || []).map((e) => ({
      id: e.id,
      event_type: e.event_type as CommercialQuoteEventType,
      event_label: EVENT_LABELS[e.event_type as CommercialQuoteEventType] || e.event_type,
      event_data: e.event_data,
      actor_name: e.actor_id ? actorMap.get(e.actor_id) || null : null,
      created_at: e.created_at,
      notes: e.event_data?.notes || e.event_data?.revision_notes || null,
    }));

    return { success: true, data: timeline };
  } catch (error: any) {
    console.error('Errore getQuoteNegotiationTimelineAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// RENEW EXPIRED QUOTE
// ============================================

/**
 * Rinnova un preventivo scaduto creando una nuova revisione draft.
 * Il preventivo scaduto RESTA expired (storia preservata).
 */
export async function renewExpiredQuoteAction(
  input: RenewExpiredQuoteInput
): Promise<ActionResult<CommercialQuote>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    // Carica quote scaduta
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

    // Determina root e nuovo numero revisione
    const rootId = expired.parent_quote_id || expired.id;
    const { count: revisionCount } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id', { count: 'exact', head: true })
      .or(`id.eq.${rootId},parent_quote_id.eq.${rootId}`);

    const newRevision = (revisionCount || 1) + 1;
    const newMargin = input.margin_percent ?? expired.margin_percent;
    const newValidityDays = input.new_validity_days ?? expired.validity_days;

    // Ricalcola matrice se margine cambiato
    let newMatrix = expired.price_matrix;
    if (
      input.margin_percent &&
      input.margin_percent !== expired.margin_percent &&
      expired.price_list_id
    ) {
      const carrierDisplayName =
        expired.price_matrix?.carrier_display_name ||
        formatCarrierDisplayName(expired.carrier_code);
      newMatrix = await buildPriceMatrix({
        priceListId: expired.price_list_id,
        marginPercent: input.margin_percent,
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

    // INSERT nuova revisione come draft
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

    // Evento 'renewed' sul preventivo scaduto
    await supabaseAdmin.from('commercial_quote_events').insert({
      quote_id: expired.id,
      event_type: 'renewed',
      event_data: {
        new_quote_id: renewal.id,
        new_revision: newRevision,
        new_margin: newMargin,
      },
      actor_id: userId,
    });

    // Evento 'created' sulla nuova revisione
    await supabaseAdmin.from('commercial_quote_events').insert({
      quote_id: renewal.id,
      event_type: 'created',
      event_data: {
        renewed_from: expired.id,
        revision: newRevision,
      },
      actor_id: userId,
    });

    // Audit log
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

// ============================================
// AVAILABLE CARRIERS (workspace-scoped)
// ============================================

/**
 * Restituisce i corrieri disponibili per il preventivatore commerciale.
 * Basato sui price_lists attivi del workspace con LEFT JOIN su couriers.
 * Ogni listino attivo = un corriere selezionabile (non richiede metadata.contract_code).
 */
export async function getAvailableCarriersForQuotesAction(): Promise<
  ActionResult<
    Array<{
      contractCode: string;
      carrierCode: string;
      courierName: string;
      priceListId: string;
      doesClientPickup: boolean;
    }>
  >
> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    // Recupera assigned_price_list_id dal workspace (listini assegnati dal superadmin)
    const { data: wsData } = await supabaseAdmin
      .from('workspaces')
      .select('assigned_price_list_id')
      .eq('id', workspaceId)
      .single();

    const assignedPriceListId = wsData?.assigned_price_list_id;

    // Query con LEFT JOIN su couriers - include listini del workspace E listini assegnati
    let query = supabaseAdmin
      .from('price_lists')
      .select('id, name, metadata, source_metadata, courier_id, couriers(name)')
      .eq('status', 'active');

    if (assignedPriceListId) {
      // Listini del workspace OR listino assegnato dal superadmin
      query = query.or(`workspace_id.eq.${workspaceId},id.eq.${assignedPriceListId}`);
    } else {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data: priceLists, error } = await query;

    if (error) {
      return { success: false, error: `Errore caricamento listini: ${error.message}` };
    }

    if (!priceLists || priceLists.length === 0) {
      return { success: true, data: [] };
    }

    // Ogni listino attivo = un corriere selezionabile
    const carriers: Array<{
      contractCode: string;
      carrierCode: string;
      courierName: string;
      priceListId: string;
      doesClientPickup: boolean;
    }> = [];

    const contractCodes: string[] = [];

    for (const pl of priceLists) {
      const metadata = (pl.metadata || {}) as Record<string, unknown>;
      const sourceMeta = (pl.source_metadata || {}) as Record<string, unknown>;

      // Risolvi contract_code: metadata -> source_metadata -> pl.id come fallback
      const contractCode =
        (metadata.contract_code as string) || (sourceMeta.contract_code as string) || pl.id;

      // Risolvi carrier_code: metadata -> source_metadata -> contract_code
      const carrierCode =
        (metadata.carrier_code as string) || (sourceMeta.carrier_code as string) || contractCode;

      // Risolvi nome display: couriers.name -> formatCarrierDisplayName -> pl.name
      const courierJoin = pl.couriers as unknown as { name: string } | null;
      const courierName = courierJoin?.name || formatCarrierDisplayName(carrierCode) || pl.name;

      carriers.push({
        contractCode,
        carrierCode,
        courierName,
        priceListId: pl.id,
        doesClientPickup: false,
      });

      // Raccogli contract_code reali per lookup pickup
      if (contractCode !== pl.id) {
        contractCodes.push(contractCode);
      }
    }

    // Arricchisci con does_client_pickup da supplier_price_list_config
    if (contractCodes.length > 0) {
      const { data: configs } = await supabaseAdmin
        .from('supplier_price_list_config')
        .select('contract_code, does_client_pickup')
        .in('contract_code', contractCodes);

      if (configs && configs.length > 0) {
        const pickupMap = new Map<string, boolean>();
        for (const cfg of configs) {
          if (cfg.contract_code) {
            pickupMap.set(cfg.contract_code, cfg.does_client_pickup ?? false);
          }
        }
        for (const carrier of carriers) {
          if (pickupMap.has(carrier.contractCode)) {
            carrier.doesClientPickup = pickupMap.get(carrier.contractCode)!;
          }
        }
      }
    }

    return { success: true, data: carriers };
  } catch (error: any) {
    console.error('Errore getAvailableCarriersForQuotesAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// HELPERS
// ============================================

/**
 * Formatta il carrier_code in un nome display leggibile.
 * Es: "gls-GLS-5000" -> "GLS 5000"
 * Es: "postedeliverybusiness-SDA---Express---H24+" -> "PosteDeliveryBusiness"
 */
function formatCarrierDisplayName(carrierCode: string): string {
  // Estrai il prefisso prima del primo trattino
  const parts = carrierCode.split('-');
  const prefix = parts[0] || carrierCode;

  // Mappa nomi noti
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
