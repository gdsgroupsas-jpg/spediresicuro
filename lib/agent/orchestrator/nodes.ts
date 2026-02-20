import { AgentState } from './state';
import { createOCRAdapter } from '../../adapters/ocr';
import { analyzeCorrieriPerformance } from '../../corrieri-performance';
import { addSpedizione } from '../../database';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { CourierServiceType } from '@/types/shipments';
import { getSupabaseUserIdFromEmail } from '../../database';
import type { AuthContext } from '../../auth-context';
import type { CorrierePerformance } from '@/types/corrieri';
import { defaultLogger, type ILogger } from '../logger';
import { pricingConfig } from '@/lib/config';
import { getOllamaLLM } from '@/lib/ai/ollama';

/**
 * Node: Extract Data
 * Extracts data from image/text using OCR and optionally LLM for structuring
 */
export async function extractData(state: AgentState): Promise<Partial<AgentState>> {
  defaultLogger.log('🔄 Executing Node: extractData');

  try {
    const message = state.messages[state.messages.length - 1] as HumanMessage;
    // Check for image content (Multimodal) OR standard text
    let imageBuffer: Buffer | undefined;

    if (Array.isArray(message.content)) {
      const imgPart = message.content.find((c: any) => c.type === 'image_url');
      if (imgPart && typeof imgPart === 'object' && 'image_url' in imgPart) {
        const base64Data = (imgPart.image_url as string).split(';base64,').pop();
        if (base64Data) imageBuffer = Buffer.from(base64Data, 'base64');
      }
    } else if (typeof message.content === 'string' && message.content.startsWith('data:image')) {
      const base64Data = message.content.split(';base64,').pop();
      if (base64Data) imageBuffer = Buffer.from(base64Data, 'base64');
    }

    const llm = getOllamaLLM();

    if (!imageBuffer) {
      return {
        processingStatus: 'error',
        validationErrors: ["Nessuna immagine fornita per l'estrazione OCR."],
      };
    }

    // 1. Standard OCR (Ollama usato solo per strutturare il testo in seguito)
    defaultLogger.log('📸 Falling back to Standard OCR Adapter...');
    const ocr = createOCRAdapter('auto');
    const ocrResult = await ocr.extract(imageBuffer);

    if (!ocrResult.success) {
      return {
        processingStatus: 'error',
        validationErrors: [ocrResult.error || 'Errore OCR sconosciuto'],
      };
    }

    let shipmentData = { ...state.shipmentData, ...ocrResult.extractedData };

    // 2. LLM Cleanup con Ollama (struttura testo OCR)
    if (
      llm &&
      ocrResult.rawText &&
      (!shipmentData.recipient_address || !shipmentData.recipient_zip)
    ) {
      defaultLogger.log('🧠 Using Ollama to structure raw OCR text...');

      const prompt = `
        Sei un esperto di logistica e analisi conversazioni. Analizza il testo estratto da una chat o documento di spedizione.
        
        Obiettivi:
        1. Estrai i dati del destinatario (Nome, Indirizzo, Città, CAP, ecc).
        2. Cerca importi relativi al CONTRASSEGNO (COD). Se c'è una discussione sul prezzo, estrai l'importo finale concordato o menzionato dal mittente.
        3. Estrai note utili (orari preferiti, istruzioni consegna).
        
        Testo OCR:
        """
        ${ocrResult.rawText}
        """
        
        Rispondi ESCLUSIVAMENTE con un JSON valido:
        {
            "recipient_name": "...",
            "recipient_address": "...",
            "recipient_city": "...",
            "recipient_zip": "...",
            "recipient_province": "...",
            "recipient_phone": "...",
            "recipient_email": "...",
            "cash_on_delivery_amount": number | null, // Importo in EURO (es. 49.90). Null se non specificato.
            "notes": "..." // Riassunto breve (es. "Consegna giovedì", "Disputa prezzo 39 vs 49")
        }
        `;

      try {
        const result = await llm.invoke([new HumanMessage(prompt)]);
        const jsonText = result.content
          .toString()
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        const parsed = JSON.parse(jsonText);

        // Merge LLM results, prioritizing them over raw regex OCR if fields are missing
        shipmentData = {
          ...shipmentData,
          recipient_name: parsed.recipient_name || shipmentData.recipient_name,
          recipient_address: parsed.recipient_address || shipmentData.recipient_address,
          recipient_city: parsed.recipient_city || shipmentData.recipient_city,
          recipient_zip: parsed.recipient_zip || shipmentData.recipient_zip,
          recipient_province: parsed.recipient_province || shipmentData.recipient_province,
          recipient_phone: parsed.recipient_phone || shipmentData.recipient_phone,
          recipient_email: parsed.recipient_email || shipmentData.recipient_email,
          cash_on_delivery_amount: parsed.cash_on_delivery_amount,
          notes: parsed.notes,
          cash_on_delivery: !!parsed.cash_on_delivery_amount, // Auto-enable if amount found
        };
      } catch (e) {
        defaultLogger.warn('⚠️ LLM Parsing failed:', e);
      }
    }

    // Calculate initial confidence
    const confidenceScore = (ocrResult.confidence || 0.5) * 100;

    return {
      shipmentData,
      processingStatus: 'validating',
      confidenceScore,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      processingStatus: 'error',
      validationErrors: [`Errore interno extractData: ${errorMessage}`],
    };
  }
}

/**
 * Node: Validate Geo
 * Validates and normalizes address using LLM logic
 */
export async function validateGeo(state: AgentState): Promise<Partial<AgentState>> {
  defaultLogger.log('🔄 Executing Node: validateGeo');
  const data = state.shipmentData;
  const errors: string[] = [];

  // Basic validation
  if (!data.recipient_address) errors.push('Indirizzo mancante');
  if (!data.recipient_city) errors.push('Città mancante');
  if (!data.recipient_zip) errors.push('CAP mancante');

  // Logic validation via LLM se campi presenti
  const llm = getOllamaLLM();
  if (llm && errors.length === 0) {
    const prompt = `
      Verifica questo indirizzo di spedizione italiano:
      "${data.recipient_address}, ${data.recipient_zip} ${data.recipient_city} (${data.recipient_province})"
      
      Rispondi con un JSON:
      {
        "valid": boolean,
        "corrected": boolean,
        "reason": "motivo se non valido o correzione effettuata",
        "normalized": {
           "address": "...",
           "city": "...",
           "zip": "...",
           "province": "..."
        }
      }
      `;

    try {
      const result = await llm.invoke([new HumanMessage(prompt)]);
      const jsonText = result.content
        .toString()
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const validation = JSON.parse(jsonText);

      if (validation.valid) {
        if (validation.corrected) {
          data.recipient_address = validation.normalized.address;
          data.recipient_city = validation.normalized.city;
          data.recipient_zip = validation.normalized.zip;
          data.recipient_province = validation.normalized.province;
        }
      } else {
        errors.push(`Indirizzo non valido: ${validation.reason}`);
      }
    } catch (e) {
      defaultLogger.warn('⚠️ Address Validation LLM failed, skipping advanced check');
    }
  }

  return {
    shipmentData: data,
    validationErrors: errors,
    processingStatus: errors.length > 0 ? 'validating' : 'calculating', // If errors, might stay stuck or go to review. Decision in graph edge.
    needsHumanReview: errors.length > 0,
  };
}

/**
 * Node: Select Courier
 * Selects best courier based on performance and price
 */
export async function selectCourier(state: AgentState): Promise<Partial<AgentState>> {
  defaultLogger.log('🔄 Executing Node: selectCourier');

  if (state.needsHumanReview) return {}; // Skip if already flagged

  const { recipient_city, recipient_province, weight = 1 } = state.shipmentData;

  try {
    // Crea AuthContext da stato per analisi performance
    const authContext = await createAuthContextFromState(state, defaultLogger);

    const performances = await analyzeCorrieriPerformance(
      recipient_city || '',
      recipient_province || '',
      authContext
    );

    // Simple Selection Logic (can be expanded)
    // 1. Filter reliable couriers (Score >= MIN_RELIABILITY)
    const reliable = performances.filter(
      (p) => p.reliabilityScore >= pricingConfig.MIN_RELIABILITY_SCORE
    );

    // 2. Select cheapest among reliable (Mock prices since we don't have full price list logic exposed as simple function)
    // In prod: await getCourierPrice(courier, weight, ...)

    // MOCK LOGIC for selection
    let bestChoice: CorrierePerformance | undefined =
      reliable.length > 0 ? reliable[0] : performances[0];

    if (!bestChoice) {
      // Fallback if no performance data
      bestChoice = {
        corriere: 'Bartolini' as const, // Usa un Corriere valido dal tipo
        zona: `${recipient_city || ''}, ${recipient_province || ''}`,
        periodo: 'default',
        totaleSpedizioni: 0,
        consegneInTempo: 0,
        consegneInRitardo: 0,
        tempoMedioConsegna: 48,
        tassoSuccesso: 100,
        reliabilityScore: 70,
        ultimoAggiornamento: new Date().toISOString(),
      };
    }

    // TypeScript ora sa che bestChoice non è undefined
    const selectedCourier = {
      id: bestChoice.corriere.toLowerCase(), // normalized id
      name: bestChoice.corriere,
      serviceType: 'standard' as CourierServiceType,
      price: 10 + weight * 0.5, // Mock price calculation
      reliabilityScore: bestChoice.reliabilityScore,
      reason: `Selezionato per affidabilità ${bestChoice.reliabilityScore}% su ${recipient_city}`,
    };

    return {
      selectedCourier,
      shipmentData: {
        ...state.shipmentData,
        courier_id: selectedCourier.id,
        service_type: selectedCourier.serviceType,
      },
      processingStatus: 'calculating',
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    defaultLogger.error('Error selecting courier:', errorMessage);
    return {
      needsHumanReview: true,
      validationErrors: [...state.validationErrors, 'Errore selezione corriere'],
    };
  }
}

/**
 * Node: Calculate Margins
 * Adds user margin to the base price
 */
export async function calculateMargins(state: AgentState): Promise<Partial<AgentState>> {
  defaultLogger.log('🔄 Executing Node: calculateMargins');

  if (state.needsHumanReview || !state.selectedCourier) return {};

  const basePrice = state.selectedCourier.price;
  const marginPercent = pricingConfig.DEFAULT_MARGIN_PERCENT; // Default or fetch from user config

  // Calculate final price
  const finalPrice = basePrice * (1 + marginPercent / 100);

  return {
    shipmentData: {
      ...state.shipmentData,
      base_price: basePrice,
      margin_percent: marginPercent,
      final_price: parseFloat(finalPrice.toFixed(2)),
      total_cost: parseFloat(finalPrice.toFixed(2)), // Assuming total_cost = final_price mostly
    },
    processingStatus: 'complete', // Ready for check_confidence
  };
}

/**
 * Node: Save Shipment
 * Persists data to Supabase
 */
/**
 * Helper: Crea AuthContext da AgentState
 */
async function createAuthContextFromState(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<AuthContext> {
  if (!state.userEmail) {
    throw new Error('userEmail mancante nello stato - impossibile creare AuthContext');
  }

  // Prova a ottenere userId Supabase da email
  let supabaseUserId: string | null = null;
  try {
    supabaseUserId = await getSupabaseUserIdFromEmail(state.userEmail, state.userId || undefined);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('⚠️ [NODES] Errore recupero userId Supabase:', errorMessage);
  }

  // Se non abbiamo userId Supabase, NON possiamo permettere operazioni
  if (!supabaseUserId) {
    // NO PII: non loggare userEmail direttamente
    logger.error('❌ [NODES] Impossibile ottenere userId Supabase');
    throw new Error('Impossibile ottenere userId Supabase - verifica autenticazione');
  }

  return {
    type: 'user',
    userId: supabaseUserId,
    userEmail: state.userEmail,
    isAdmin: false, // Default, può essere verificato se necessario
  };
}

export async function saveShipment(state: AgentState): Promise<Partial<AgentState>> {
  defaultLogger.log('🔄 Executing Node: saveShipment');

  try {
    const shipmentInput = {
      ...state.shipmentData,
      status: 'ready_to_ship',
      created_via_ocr: true,
      ocr_confidence_score: state.confidenceScore,
    };

    // Crea AuthContext da stato
    const authContext = await createAuthContextFromState(state, defaultLogger);

    // Note: addSpedizione handles ID generation and some defaults
    const result = await addSpedizione(shipmentInput, authContext);

    return {
      shipmentId: result ? result.id : undefined,
      processingStatus: 'complete',
      shipmentData: { ...state.shipmentData, status: 'ready_to_ship' },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    defaultLogger.error('Error saving shipment:', errorMessage);
    return {
      validationErrors: [...state.validationErrors, `Errore salvataggio: ${errorMessage}`],
      needsHumanReview: true,
    };
  }
}

/**
 * Node: Human Review
 * Flags for review and optionally saves as draft
 */
export async function humanReview(state: AgentState): Promise<Partial<AgentState>> {
  defaultLogger.log('🔄 Executing Node: humanReview');

  // Save as draft contextually if we have minimum data
  if (state.shipmentData.recipient_name || state.shipmentData.recipient_address) {
    try {
      const shipmentInput = {
        ...state.shipmentData,
        status: 'needs_review',
        created_via_ocr: true,
        ocr_confidence_score: state.confidenceScore,
        internal_notes: `Review required. Errors: ${state.validationErrors.join(', ')}`,
      };

      // Crea AuthContext da stato
      const authContext = await createAuthContextFromState(state, defaultLogger);
      const result = await addSpedizione(shipmentInput, authContext);
      return {
        shipmentId: result ? result.id : undefined,
        processingStatus: 'error',
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      defaultLogger.error('Failed to save draft for review', errorMessage);
    }
  }

  return { processingStatus: 'error' };
}
