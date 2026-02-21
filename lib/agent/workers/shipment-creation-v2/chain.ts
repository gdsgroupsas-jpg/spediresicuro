/**
 * Orchestratore della catena "Creazione spedizione".
 * Invoca worker LLM per estrazione dati, fa merge e validazione, poi:
 * - se mancano campi: ritorna clarification_request e stato da persistere;
 * - se tutto completo: calcola preventivo, esegue booking, ritorna booking_result.
 */

import { HumanMessage } from '@langchain/core/messages';
import type { AgentState } from '@/lib/agent/orchestrator/state';
import { runLlmExtractionWorker } from './llm-extraction-workers';
import { getMissingFromDraft } from './validation-workers';
import { generateClarificationFromMissingFields } from './clarification';
import { pricingWorker } from '../pricing';
import { bookingWorker } from '../booking';
import type { ShipmentChainResult } from './types';
import type { ILogger } from '@/lib/agent/logger';
import { defaultLogger } from '@/lib/agent/logger';

export interface RunShipmentCreationChainInput {
  message: string;
  existingState?: AgentState | null;
  userId: string;
  userEmail: string;
  traceId: string;
  /** Workspace ID per isolamento multi-tenant (propagato a pricing/booking worker) */
  workspaceId?: string;
}

/**
 * Esegue la catena creazione spedizione: validazione (7 worker) → se completo: pricing + booking.
 * Restituisce risultato con shipmentDraft, missingFields, clarification_request o booking_result,
 * e agentState da persistere in sessione.
 */
export async function runShipmentCreationChain(
  input: RunShipmentCreationChainInput,
  logger: ILogger = defaultLogger
): Promise<ShipmentChainResult> {
  const { message, existingState, userId, userEmail } = input;
  const existingDraft = existingState?.shipmentDraft;

  const updatedDraft = await runLlmExtractionWorker(message, existingDraft, logger);
  const missingFields = getMissingFromDraft(updatedDraft);
  updatedDraft.missingFields = missingFields;

  const baseState: AgentState = {
    ...(existingState || {}),
    messages: [...(existingState?.messages || []), new HumanMessage(message)],
    userId,
    userEmail,
    shipmentDraft: updatedDraft,
    missingFields,
    shipment_creation_phase: missingFields.length > 0 ? 'collecting' : 'ready',
    processingStatus: 'complete',
    validationErrors: existingState?.validationErrors || [],
    confidenceScore: existingState?.confidenceScore ?? 0,
    needsHumanReview: false,
    shipmentData: existingState?.shipmentData || {},
  } as AgentState;

  if (missingFields.length > 0) {
    const clarification_request = generateClarificationFromMissingFields(missingFields);
    return {
      shipmentDraft: updatedDraft,
      missingFields,
      clarification_request,
      shipment_creation_phase: 'collecting',
      agentState: {
        ...baseState,
        clarification_request,
      },
    };
  }

  // Dati completi: calcola preventivo e poi esegue booking
  const stateWithDetails: AgentState = {
    ...baseState,
    shipment_details: {
      weight: updatedDraft.parcel?.weightKg,
      destinationZip: updatedDraft.recipient?.postalCode,
      destinationProvince: updatedDraft.recipient?.province,
      serviceType: 'standard',
    },
  };

  const pricingResult = await pricingWorker(stateWithDetails, logger);
  if (pricingResult.clarification_request || !pricingResult.pricing_options?.length) {
    return {
      shipmentDraft: updatedDraft,
      missingFields: [],
      clarification_request:
        pricingResult.clarification_request ||
        'Non è stato possibile calcolare un preventivo. Riprova con CAP e provincia corretti.',
      shipment_creation_phase: 'collecting',
      agentState: { ...baseState, ...pricingResult },
    };
  }

  const stateWithPricing: AgentState = {
    ...stateWithDetails,
    ...pricingResult,
    pricing_options: pricingResult.pricing_options,
  };

  const bookingUpdate = await bookingWorker(stateWithPricing, logger);
  const booking_result = bookingUpdate.booking_result;

  return {
    shipmentDraft: updatedDraft,
    missingFields: [],
    shipment_creation_phase: 'ready',
    booking_result,
    agentState: {
      ...stateWithPricing,
      ...bookingUpdate,
    } as AgentState,
  };
}
