/**
 * Worker Creazione Spedizione (LLM-first con fallback regex)
 *
 * Gestisce il flusso conversazionale per creare una spedizione:
 * 1. Prova estrazione dati via LLM (DeepSeek) — capisce linguaggio naturale
 * 2. Fallback a processAddressCore (regex) se LLM non disponibile
 * 3. Validazione postale SEMPRE attiva (guardrail su dati LLM)
 * 4. Se mancano campi → domanda conversazionale (LLM) o template (fallback)
 * 5. Se completo → legge default_sender, calcola pricing, mostra riepilogo
 *
 * NON chiama booking. Si ferma al riepilogo + pricing.
 * L'utente deve confermare esplicitamente per procedere al booking.
 */

import type { AgentState } from '../orchestrator/state';
import type { ShipmentDraft } from '@/lib/address/shipment-draft';
import {
  calculateMissingFieldsForShipment,
  hasEnoughDataForShipmentCreation,
} from '@/lib/address/shipment-draft';
import { mergeShipmentDraft } from '@/lib/address/shipment-draft';
import { processAddressCore } from './address';
import { extractWithLLM } from './shipment-creation-llm';
import { getFullSenderData } from './shipment-booking';
import { calculateOptimalPrice, type PricingResult } from '@/lib/ai/pricing-engine';
import type { ILogger } from '../logger';
import { defaultLogger } from '../logger';

// ==================== HELPERS ====================

/**
 * Label leggibili per i campi mancanti (usato nel fallback deterministico)
 */
const FIELD_LABELS: Record<string, string> = {
  'recipient.fullName': 'nome destinatario',
  'recipient.addressLine1': 'indirizzo destinatario (via e numero civico)',
  'recipient.city': 'citta destinatario',
  'recipient.postalCode': 'CAP destinatario (5 cifre)',
  'recipient.province': 'provincia destinatario (2 lettere, es. MI, RM)',
  'parcel.weightKg': 'peso del pacco in kg',
};

/**
 * Genera messaggio di richiesta integrazioni (fallback deterministico).
 * Usato solo quando LLM non e disponibile.
 */
export function generateCreationClarification(missingFields: string[]): string {
  const labels = missingFields.map((f) => FIELD_LABELS[f] || f).filter(Boolean);

  if (labels.length === 0) {
    return 'Per creare la spedizione ho bisogno di qualche dato in piu.';
  }
  if (labels.length === 1) {
    return `Per creare la spedizione mi serve ancora: **${labels[0]}**.`;
  }
  if (labels.length === 2) {
    return `Per la spedizione mi servono: **${labels[0]}** e **${labels[1]}**.`;
  }
  const last = labels.pop();
  return `Per procedere mi servono: **${labels.join(', ')}** e **${last}**.`;
}

/**
 * Dati mittente per il riepilogo (stessa interfaccia di FullSenderData dal booking worker)
 */
interface SenderSummaryData {
  name: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  company?: string;
  phone?: string;
  email?: string;
}

/**
 * Formatta riepilogo spedizione per conferma utente.
 * Mostra indirizzo mittente COMPLETO dal profilo.
 */
export function formatShipmentSummary(
  draft: ShipmentDraft,
  senderInfo: SenderSummaryData | null,
  pricingOptions: PricingResult[] = []
): string {
  const r = draft.recipient;
  const p = draft.parcel;

  let summary = '**Riepilogo spedizione:**\n\n';

  // Mittente (dal profilo) — indirizzo completo
  if (senderInfo?.name) {
    summary += `**Mittente:** ${senderInfo.name}`;
    if (senderInfo.company) summary += ` (${senderInfo.company})`;
    summary += '\n';
    if (senderInfo.address) {
      summary += `${senderInfo.address}, ${senderInfo.city} (${senderInfo.province}) ${senderInfo.postalCode}\n`;
    }
    if (senderInfo.phone) summary += `Tel. ${senderInfo.phone}\n`;
  } else {
    summary +=
      '**Mittente:** ⚠️ _Indirizzo mittente non configurato. Configuralo nelle impostazioni del profilo._\n';
  }
  summary += '\n';

  // Destinatario
  summary += `**Destinatario:** ${r?.fullName || ''}`;
  if (r?.phone) summary += ` (tel. ${r.phone})`;
  summary += '\n';
  if (r?.addressLine1) summary += `**Indirizzo:** ${r.addressLine1}\n`;
  summary += `**Citta:** ${r?.city || ''} (${r?.province || ''}) ${r?.postalCode || ''}\n`;

  // Pacco
  summary += `\n**Peso:** ${p?.weightKg || 0} kg`;
  if (p?.lengthCm && p?.widthCm && p?.heightCm) {
    summary += ` — ${p.lengthCm}x${p.widthCm}x${p.heightCm} cm`;
  }
  summary += '\n\n';

  // Opzioni prezzo
  const options = pricingOptions || [];
  if (options.length > 0) {
    summary += '**Opzioni disponibili:**\n';
    options.slice(0, 4).forEach((opt, idx) => {
      const marker = idx === 0 ? ' (consigliato)' : '';
      summary += `${idx + 1}. **${opt.courier}** (${opt.serviceType}): **€${opt.finalPrice.toFixed(2)}** — ${opt.estimatedDeliveryDays.min}-${opt.estimatedDeliveryDays.max} giorni${marker}\n`;
    });
    summary +=
      '\nRispondi **"procedi"** o **"conferma"** per prenotare la spedizione.\nPuoi anche dire **"annulla"** per cancellare.';
  } else {
    summary +=
      'Non sono riuscita a calcolare preventivi per questa tratta. Verifica i dati o riprova.';
  }

  return summary;
}

/**
 * Calcola pricing per un draft completo
 */
async function calculatePricingForDraft(
  draft: ShipmentDraft,
  logger: ILogger
): Promise<PricingResult[]> {
  try {
    const result = await calculateOptimalPrice({
      weight: draft.parcel?.weightKg || 1,
      destinationZip: draft.recipient?.postalCode || '',
      destinationProvince: draft.recipient?.province || '',
    });
    return result || [];
  } catch (error) {
    logger.error('Errore calcolo pricing per creazione spedizione:', error);
    return [];
  }
}

// ==================== WORKER PRINCIPALE ====================

/**
 * Worker per la creazione spedizione.
 * Strategia: LLM-first con fallback a regex.
 *
 * Flusso:
 * 1. Prova estrazione LLM (DeepSeek) — capisce linguaggio naturale
 * 2. Se LLM fallisce → usa processAddressCore (regex deterministico)
 * 3. Validazione postale sempre attiva come guardrail
 * 4. Se mancano campi → collecting (domanda conversazionale LLM o template)
 * 5. Se completo → ready (riepilogo + pricing)
 *
 * NON chiama booking. L'utente deve confermare esplicitamente.
 */
export async function shipmentCreationWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const messageText = lastMessage && 'content' in lastMessage ? String(lastMessage.content) : '';

  logger.log('📦 [Shipment Creation Worker] Elaboro messaggio per creazione spedizione');

  let updatedDraft: ShipmentDraft;
  let conversationalQuestion: string | undefined;

  // STRATEGIA: LLM-first con fallback a regex
  const llmResult = await extractWithLLM(messageText, state.shipmentDraft, logger);

  if (llmResult) {
    // LLM ha estratto dati — merge con draft esistente
    updatedDraft = mergeShipmentDraft(state.shipmentDraft, llmResult.extractedData);
    conversationalQuestion = llmResult.conversationalQuestion || undefined;
    logger.log(
      `📦 [Shipment Creation Worker] LLM extraction OK (confidence: ${llmResult.confidence})`
    );
  } else {
    // Fallback: processAddressCore (regex deterministico)
    const { updatedDraft: regexDraft } = processAddressCore(messageText, state.shipmentDraft);
    updatedDraft = regexDraft;
    logger.log('📦 [Shipment Creation Worker] Fallback a processAddressCore (regex)');
  }

  // Verifica campi mancanti per spedizione completa
  const missingFields = calculateMissingFieldsForShipment(updatedDraft);

  if (missingFields.length > 0) {
    // Fase collecting — chiedi integrazioni
    logger.log(
      `📦 [Shipment Creation Worker] Mancano ${missingFields.length} campi: ${missingFields.join(', ')}`
    );

    return {
      shipmentDraft: updatedDraft,
      shipment_creation_phase: 'collecting',
      // Usa domanda conversazionale LLM se disponibile, altrimenti template
      clarification_request: conversationalQuestion || generateCreationClarification(missingFields),
      next_step: 'END',
      processingStatus: 'idle',
    };
  }

  // Fase ready — tutti i dati presenti
  logger.log('📦 [Shipment Creation Worker] Dati completi, calcolo pricing e riepilogo');

  // Leggi mittente completo dal profilo (stessa fonte usata dal booking worker)
  const senderInfo = await getFullSenderData(state.userId);

  // Calcola pricing
  const pricingOptions = await calculatePricingForDraft(updatedDraft, logger);

  // Formatta riepilogo
  const summary = formatShipmentSummary(updatedDraft, senderInfo, pricingOptions);

  return {
    shipmentDraft: updatedDraft,
    shipment_creation_phase: 'ready',
    shipment_creation_summary: summary,
    pricing_options: pricingOptions,
    clarification_request: summary,
    next_step: 'END',
    processingStatus: 'complete',
  };
}
