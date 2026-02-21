import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';
import { buildPriceMatrix } from '@/lib/commercial-quotes/matrix-builder';
import {
  findProspectByContactInternal,
  linkQuoteToProspectInternal,
} from '@/actions/reseller-prospects';
import { getDefaultClauses } from '@/lib/commercial-quotes/clauses';
import type {
  CommercialQuote,
  CreateCommercialQuoteInput,
  DeliveryMode,
  PriceMatrixSnapshot,
} from '@/types/commercial-quotes';
import {
  collectAccessiblePriceListIds,
  formatCarrierDisplayName,
  queryAccessiblePriceLists,
  toAuditContext,
  type ActionResult,
} from './commercial-quotes.helpers';

/**
 * Crea un nuovo preventivo commerciale.
 * Genera automaticamente la matrice prezzi dal listino selezionato.
 */
export async function createCommercialQuoteActionImpl(
  input: CreateCommercialQuoteInput
): Promise<ActionResult<CommercialQuote>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    if (!input.prospect_company?.trim()) {
      return { success: false, error: 'Nome azienda prospect obbligatorio' };
    }
    if (!input.carrier_code?.trim() || !input.contract_code?.trim()) {
      return { success: false, error: 'Corriere e contratto obbligatori' };
    }

    const accessiblePlIds = await collectAccessiblePriceListIds(workspaceId, userId);

    let priceListId: string | undefined = input.price_list_id;
    if (!priceListId) {
      const plList = await queryAccessiblePriceLists(workspaceId, accessiblePlIds, 'id, metadata');

      const matched = plList?.find(
        (priceList) =>
          (priceList.metadata as Record<string, unknown>)?.contract_code === input.contract_code
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
    const marginFixedEur = input.margin_fixed_eur ?? null;
    const vatMode = input.vat_mode ?? 'excluded';
    const vatRate = input.vat_rate ?? 22;
    const validityDays = input.validity_days ?? 30;
    const deliveryMode = input.delivery_mode ?? 'carrier_pickup';
    const pickupFee = input.pickup_fee ?? null;
    const goodsNeedsProcessing = input.goods_needs_processing ?? false;
    const processingFee = input.processing_fee ?? null;

    const carrierDisplayName = formatCarrierDisplayName(input.carrier_code);

    let priceMatrix: PriceMatrixSnapshot;
    if (input.price_matrix_override) {
      const overrideMatrix = input.price_matrix_override;
      if (
        !overrideMatrix.zones?.length ||
        !overrideMatrix.weight_ranges?.length ||
        !overrideMatrix.prices?.length ||
        overrideMatrix.prices.length !== overrideMatrix.weight_ranges.length ||
        overrideMatrix.prices.some((row) => row.length !== overrideMatrix.zones.length) ||
        overrideMatrix.prices.some((row) => row.some((price) => price < 0))
      ) {
        return { success: false, error: 'Matrice prezzi override non valida' };
      }
      priceMatrix = overrideMatrix;
    } else {
      priceMatrix = await buildPriceMatrix({
        priceListId,
        marginPercent,
        marginFixedEur: marginFixedEur ?? undefined,
        workspaceId,
        vatMode,
        vatRate,
        carrierDisplayName,
        deliveryMode,
        pickupFee,
        goodsNeedsProcessing,
        processingFee,
      });
    }

    let additionalCarriers = null;
    if (input.additional_carrier_codes && input.additional_carrier_codes.length > 0) {
      const additionalSnapshots = [];
      for (const additionalCarrier of input.additional_carrier_codes) {
        let additionalCarrierPriceListId = additionalCarrier.price_list_id;
        if (!additionalCarrierPriceListId) {
          const acPlList = await queryAccessiblePriceLists(
            workspaceId,
            accessiblePlIds,
            'id, metadata'
          );

          const acMatched = acPlList?.find(
            (priceList) =>
              (priceList.metadata as Record<string, unknown>)?.contract_code ===
              additionalCarrier.contract_code
          );
          additionalCarrierPriceListId = acMatched?.id;
        }

        if (additionalCarrierPriceListId) {
          const acMatrix = await buildPriceMatrix({
            priceListId: additionalCarrierPriceListId,
            marginPercent: additionalCarrier.margin_percent ?? marginPercent,
            marginFixedEur: marginFixedEur ?? undefined,
            workspaceId,
            vatMode,
            vatRate,
            carrierDisplayName: formatCarrierDisplayName(additionalCarrier.carrier_code),
            deliveryMode,
            pickupFee,
            goodsNeedsProcessing,
            processingFee,
          });
          additionalSnapshots.push({
            carrier_code: additionalCarrier.carrier_code,
            contract_code: additionalCarrier.contract_code,
            price_matrix: acMatrix,
          });
        }
      }
      if (additionalSnapshots.length > 0) {
        additionalCarriers = additionalSnapshots;
      }
    }

    if (input.volumetric_divisor && input.volumetric_divisor !== 5000) {
      priceMatrix.volumetric_divisor = input.volumetric_divisor;
    }

    const clauses =
      input.clauses && input.clauses.length > 0
        ? input.clauses
        : getDefaultClauses(vatMode, vatRate, {
            deliveryMode,
            pickupFee,
            goodsNeedsProcessing,
            processingFee,
          });

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
        margin_fixed_eur: marginFixedEur,
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

    await workspaceQuery(workspaceId)
      .from('commercial_quote_events')
      .insert({
        quote_id: quote.id,
        event_type: 'created',
        event_data: {
          margin_percent: marginPercent,
          margin_fixed_eur: marginFixedEur,
          carrier_code: input.carrier_code,
        },
        actor_id: userId,
      });

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
      console.error('[CRM] Auto-link prospect error:', linkErr);
    }

    return { success: true, data: quote as CommercialQuote };
  } catch (error: any) {
    console.error('Errore createCommercialQuoteAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Genera anteprima matrice prezzi senza creare preventivo.
 * Usata dal wizard per mostrare la matrice editabile nello step Offerta.
 */
export async function previewPriceMatrixActionImpl(params: {
  priceListId: string;
  marginPercent: number;
  marginFixedEur?: number;
  carrierCode: string;
  vatMode?: 'included' | 'excluded';
  deliveryMode?: DeliveryMode;
  pickupFee?: number | null;
  goodsNeedsProcessing?: boolean;
  processingFee?: number | null;
}): Promise<ActionResult<PriceMatrixSnapshot>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const carrierDisplayName = formatCarrierDisplayName(params.carrierCode);

    const matrix = await buildPriceMatrix({
      priceListId: params.priceListId,
      marginPercent: params.marginPercent,
      marginFixedEur: params.marginFixedEur,
      workspaceId: wsAuth.workspace.id,
      vatMode: params.vatMode ?? 'excluded',
      vatRate: 22,
      carrierDisplayName,
      deliveryMode: params.deliveryMode ?? 'carrier_pickup',
      pickupFee: params.pickupFee ?? null,
      goodsNeedsProcessing: params.goodsNeedsProcessing ?? false,
      processingFee: params.processingFee ?? null,
    });

    return { success: true, data: matrix };
  } catch (error: any) {
    console.error('Errore previewPriceMatrixAction:', error);
    return { success: false, error: error.message || 'Errore generazione anteprima' };
  }
}
