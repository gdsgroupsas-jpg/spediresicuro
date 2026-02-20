/**
 * Worker Booking Sicuro per Creazione Spedizione
 *
 * Chiamato SOLO dopo conferma esplicita dell'utente (fase ready + "procedi"/"conferma").
 * Mappa ShipmentDraft + default_sender → CreateShipmentInput,
 * poi delega INTERAMENTE a createShipmentCore (Single Source of Truth).
 *
 * NON tocca il bookingWorker esistente (lib/agent/workers/booking.ts).
 * Quello resta per il flusso pricing graph legacy.
 */

import type { AgentState } from '../orchestrator/state';
import type { BookingResult } from './booking';
import type { ILogger } from '../logger';
import { defaultLogger } from '../logger';
import type { ShipmentDraft } from '@/lib/address/shipment-draft';
import type { ActingContext } from '@/lib/safe-auth';
import type { CreateShipmentInput } from '@/lib/validations/shipment';
import type { PricingResult } from '@/lib/ai/pricing-engine';

// ==================== TIPI INTERNI ====================

/**
 * Dati mittente completi letti dal DB (users.default_sender o anne_user_memory)
 */
interface FullSenderData {
  name: string;
  company?: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  phone?: string;
  email?: string;
}

// ==================== HELPERS ====================

/**
 * Legge i dati mittente completi dal DB.
 * Prima prova anne_user_memory.default_sender, poi users.default_sender.
 */
export async function getFullSenderData(userId: string): Promise<FullSenderData | null> {
  try {
    const { getUserMemory } = await import('@/lib/ai/user-memory');
    const memory = await getUserMemory(userId);

    if (memory?.defaultSender?.address && memory.defaultSender?.city) {
      return {
        name: memory.defaultSender.name || '',
        company: memory.defaultSender.company,
        address: memory.defaultSender.address,
        city: memory.defaultSender.city,
        province: memory.defaultSender.province || '',
        postalCode: memory.defaultSender.zip || '',
        phone: memory.defaultSender.phone,
        email: memory.defaultSender.email,
      };
    }

    // Fallback: users.default_sender (JSON column)
    const { supabaseAdmin } = await import('@/lib/db/client');
    const { data } = await supabaseAdmin
      .from('users')
      .select('default_sender, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (data?.default_sender && typeof data.default_sender === 'object') {
      const ds = data.default_sender as Record<string, string>;
      if (ds.address && ds.city) {
        return {
          name: ds.name || ds.nome || data.full_name || '',
          company: ds.company || ds.azienda,
          address: ds.address || ds.indirizzo || '',
          city: ds.city || ds.citta || '',
          province: ds.province || ds.provincia || '',
          postalCode: ds.postalCode || ds.zip || ds.cap || '',
          phone: ds.phone || ds.telefono,
          email: ds.email,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Mappa ShipmentDraft + sender + pricing option → CreateShipmentInput
 */
export function mapDraftToShipmentInput(
  draft: ShipmentDraft,
  sender: FullSenderData,
  selectedOption: PricingResult
): CreateShipmentInput {
  const r = draft.recipient!;
  const p = draft.parcel!;

  return {
    sender: {
      name: sender.name,
      company: sender.company,
      address: sender.address,
      city: sender.city,
      province: sender.province,
      postalCode: sender.postalCode,
      country: 'IT',
      phone: sender.phone,
      email: sender.email,
    },
    recipient: {
      name: r.fullName || '',
      company: r.companyName,
      address: r.addressLine1 || '',
      address2: r.addressLine2,
      city: r.city || '',
      province: r.province || '',
      postalCode: r.postalCode || '',
      country: r.country || 'IT',
      phone: r.phone,
    },
    packages: [
      {
        weight: p.weightKg || 1,
        length: p.lengthCm || 30,
        width: p.widthCm || 20,
        height: p.heightCm || 15,
      },
    ],
    carrier: selectedOption.courier as CreateShipmentInput['carrier'],
    // TODO: per utenti BYOC, leggere provider dalla courier_config
    provider: 'spediscionline',
    base_price: selectedOption.basePrice,
    final_price: selectedOption.finalPrice,
  };
}

// ==================== WORKER PRINCIPALE ====================

/**
 * Worker booking sicuro per creazione spedizione.
 *
 * Precondizioni:
 * - shipment_creation_phase === 'ready'
 * - agent_context.acting_context presente (iniettato da supervisor-router)
 * - shipmentDraft completo
 * - pricing_options con almeno 1 opzione
 *
 * Flusso:
 * 1. Verifica precondizioni (acting_context, draft, sender, pricing)
 * 2. Mappa draft + sender → CreateShipmentInput
 * 3. Chiama createShipmentCore (SSOT: idempotency, wallet, courier, DB, compensation)
 * 4. Ritorna BookingResult
 */
export async function shipmentBookingWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('🚀 [Shipment Booking Worker] Avvio prenotazione spedizione');

  // 1. Verifica acting_context
  const actingContext = state.agent_context?.acting_context;
  if (!actingContext) {
    logger.error('🚀 [Shipment Booking Worker] acting_context mancante');
    return {
      booking_result: {
        status: 'failed',
        error_code: 'MISSING_CONTEXT',
        user_message: 'Errore di autenticazione. Riprova o contatta il supporto.',
      },
      next_step: 'END',
    };
  }

  // 2. Verifica draft completo
  const draft = state.shipmentDraft;
  if (!draft?.recipient?.fullName || !draft?.parcel?.weightKg) {
    logger.error('🚀 [Shipment Booking Worker] Draft incompleto');
    return {
      booking_result: {
        status: 'failed',
        error_code: 'INCOMPLETE_DATA',
        user_message: 'I dati della spedizione sono incompleti. Ricominciamo.',
      },
      shipment_creation_phase: 'collecting',
      next_step: 'END',
    };
  }

  // 3. Leggi mittente completo dal DB
  const senderData = await getFullSenderData(actingContext.target.id);
  if (!senderData) {
    logger.error('🚀 [Shipment Booking Worker] Dati mittente non trovati');
    return {
      booking_result: {
        status: 'failed',
        error_code: 'MISSING_SENDER',
        user_message:
          'Non ho trovato il tuo indirizzo mittente. Configuralo nelle impostazioni del profilo.',
      },
      next_step: 'END',
    };
  }

  // 4. Seleziona opzione pricing (prima opzione = consigliata)
  const pricingOptions = state.pricing_options;
  if (!pricingOptions || pricingOptions.length === 0) {
    logger.error('🚀 [Shipment Booking Worker] Nessuna opzione pricing');
    return {
      booking_result: {
        status: 'failed',
        error_code: 'NO_PRICING',
        user_message: 'Non ci sono preventivi disponibili. Riprova con dati diversi.',
      },
      next_step: 'END',
    };
  }

  // Seleziona l'opzione scelta dall'utente (default: prima = consigliata)
  const selectedOption = selectPricingOption(state, pricingOptions);

  // 5. Mappa draft → CreateShipmentInput
  const shipmentInput = mapDraftToShipmentInput(draft, senderData, selectedOption);

  // 6. Chiama createShipmentCore (SSOT)
  try {
    const { createShipmentCore } = await import('@/lib/shipments/create-shipment-core');
    const { supabaseAdmin } = await import('@/lib/db/client');
    const { getCourierClientReal } = await import('@/lib/shipments/get-courier-client');

    // Risolvi il courier client
    const courierResult = await getCourierClientReal(supabaseAdmin, shipmentInput, {
      userId: actingContext.target.id,
    });

    const result = await createShipmentCore({
      context: actingContext,
      validated: shipmentInput,
      deps: {
        supabaseAdmin,
        getCourierClient: async () => courierResult.client,
        courierConfigId: courierResult.configId,
      },
    });

    // Mappa risultato → BookingResult
    if (result.status === 200 && result.json?.shipment) {
      const shipment = result.json.shipment;
      logger.log(`🚀 [Shipment Booking Worker] Spedizione creata: ${shipment.tracking_number}`);

      return {
        booking_result: {
          status: 'success',
          shipment_id: shipment.id,
          carrier_reference: shipment.tracking_number,
          user_message: `Spedizione creata con successo! Tracking: **${shipment.tracking_number}** (${selectedOption.courier}).`,
        },
        shipment_creation_phase: undefined, // Reset fase
        next_step: 'END',
        processingStatus: 'complete',
      };
    }

    // Errore da createShipmentCore
    return mapCoreErrorToBookingResult(result, logger);
  } catch (error) {
    logger.error('🚀 [Shipment Booking Worker] Errore imprevisto:', error);
    return {
      booking_result: {
        status: 'failed',
        error_code: 'SYSTEM_ERROR',
        user_message: 'Si è verificato un errore durante la prenotazione. Riprova tra poco.',
      },
      next_step: 'END',
    };
  }
}

// ==================== HELPERS INTERNI ====================

/**
 * Seleziona l'opzione pricing dall'input utente.
 * MED-4 FIX: riconosce numeri, ordinali italiani, e nomi corriere.
 */
function selectPricingOption(state: AgentState, pricingOptions: PricingResult[]): PricingResult {
  const lastMessage = state.messages[state.messages.length - 1];
  const text =
    lastMessage && 'content' in lastMessage ? String(lastMessage.content).toLowerCase() : '';

  // 1. Match per numero (es. "procedi con la 2", "opzione 3")
  const numberMatch = text.match(/(?:opzione|numero|la)\s*(\d)/i) || text.match(/^(\d)$/);
  if (numberMatch) {
    const idx = parseInt(numberMatch[1], 10) - 1;
    if (idx >= 0 && idx < pricingOptions.length) {
      return pricingOptions[idx];
    }
  }

  // 2. Match per ordinale italiano (es. "la seconda", "la terza")
  const ordinals: Record<string, number> = {
    prima: 0,
    primo: 0,
    seconda: 1,
    secondo: 1,
    terza: 2,
    terzo: 2,
    quarta: 3,
    quarto: 3,
  };
  for (const [word, idx] of Object.entries(ordinals)) {
    if (text.includes(word) && idx < pricingOptions.length) {
      return pricingOptions[idx];
    }
  }

  // 3. Match per nome corriere (es. "procedi con GLS", "scegli DHL")
  const courierMatch = pricingOptions.findIndex((opt) => text.includes(opt.courier.toLowerCase()));
  if (courierMatch >= 0) {
    return pricingOptions[courierMatch];
  }

  // Default: prima opzione (consigliata)
  return pricingOptions[0];
}

/**
 * Mappa errori di createShipmentCore → BookingResult user-friendly
 */
function mapCoreErrorToBookingResult(
  result: { status: number; json: any },
  logger: ILogger
): Partial<AgentState> {
  const errorMsg = result.json?.message || result.json?.error || 'Errore sconosciuto';
  logger.error(`🚀 [Shipment Booking Worker] Errore core: ${result.status} - ${errorMsg}`);

  if (result.status === 402) {
    const required = result.json?.required || 0;
    const available = result.json?.available || 0;
    return {
      booking_result: {
        status: 'failed',
        error_code: 'INSUFFICIENT_CREDIT',
        user_message: `Credito insufficiente. Servono €${required.toFixed(2)} ma hai €${available.toFixed(2)}. Ricarica il wallet.`,
      },
      next_step: 'END',
    };
  }

  if (result.status === 503) {
    return {
      booking_result: {
        status: 'retryable',
        user_message: 'Il corriere è temporaneamente non disponibile. Riprova tra qualche minuto.',
        retry_after_ms: 60_000,
      },
      next_step: 'END',
    };
  }

  if (result.status === 422) {
    return {
      booking_result: {
        status: 'failed',
        error_code: 'INVALID_ADDRESS',
        user_message:
          "L'indirizzo destinatario non è valido secondo il corriere. Verifica e correggi i dati.",
      },
      shipment_creation_phase: 'collecting',
      next_step: 'END',
    };
  }

  return {
    booking_result: {
      status: 'failed',
      error_code: 'SYSTEM_ERROR',
      user_message: 'Errore durante la prenotazione. Riprova o contatta il supporto.',
    },
    next_step: 'END',
  };
}
