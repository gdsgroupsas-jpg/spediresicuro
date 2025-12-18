import { AgentState } from './state';
import { createOCRAdapter } from '../../adapters/ocr';
import { analyzeCorrieriPerformance } from '../../corrieri-performance';
import { addSpedizione } from '../../database';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { CourierServiceType } from '@/types/shipments';
import { getSupabaseUserIdFromEmail } from '../../database';
import type { AuthContext } from '../../auth-context';

// Helper to get LLM instance (returns null if no key)
const getLLM = () => {
  if (!process.env.GOOGLE_API_KEY) {
    console.warn('⚠️ GOOGLE_API_KEY mancante - Skipping LLM features');
    return null;
  }
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash-001',
    maxOutputTokens: 2048,
    temperature: 0.1,
    apiKey: process.env.GOOGLE_API_KEY,
  });
};

/**
 * Node: Extract Data
 * Extracts data from image/text using OCR and optionally LLM for structuring
 */
export async function extractData(state: AgentState): Promise<Partial<AgentState>> {
  console.log('🔄 Executing Node: extractData');
  
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

    // Initialize LLM once
    const llm = getLLM();

    if (!imageBuffer) {
        return {
            processingStatus: 'error',
            validationErrors: ['Nessuna immagine fornita per l\'estrazione OCR.'],
        };
    }

    // 1. DIRECT GEMINI VISION (Multimodal)
    if (llm && imageBuffer) {
        console.log('🧠 Using Gemini Vision (Multimodal) for extraction...');
        
        const geminiMessage = new HumanMessage({
          content: [
            {
              type: 'text',
              text: `Analizza questa immagine (chat o documento spedizione).
              
              Obiettivi:
              1. Estrai i dati del destinatario (Nome, Indirizzo, Città, CAP, ecc).
              2. Cerca importi relativi al CONTRASSEGNO (COD). Se c'è una discussione sul prezzo, estrai l'importo finale concordato o menzionato dal mittente.
              3. Estrai note utili (orari preferiti, istruzioni consegna, contenuto discussione).
              
              Rispondi ESCLUSIVAMENTE con un JSON valido:
              {
                  "recipient_name": "...",
                  "recipient_address": "...",
                  "recipient_city": "...",
                  "recipient_zip": "...",
                  "recipient_province": "...",
                  "recipient_phone": "...",
                  "recipient_email": "...",
                  "cash_on_delivery_amount": number | null, 
                  "notes": "..."
              }`
            },
            {
              type: 'image_url',
              image_url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
            }
          ]
        });

        try {
            const result = await llm.invoke([geminiMessage]);
            const jsonText = result.content.toString().replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonText);

            const shipmentData = {
                ...state.shipmentData,
                recipient_name: parsed.recipient_name,
                recipient_address: parsed.recipient_address,
                recipient_city: parsed.recipient_city,
                recipient_zip: parsed.recipient_zip,
                recipient_province: parsed.recipient_province,
                recipient_phone: parsed.recipient_phone,
                recipient_email: parsed.recipient_email,
                cash_on_delivery_amount: parsed.cash_on_delivery_amount,
                notes: parsed.notes,
                cash_on_delivery: !!parsed.cash_on_delivery_amount,
            };

            return {
                shipmentData,
                processingStatus: 'validating',
                confidenceScore: 90, // Gemini Vision is usually high confidence
            };

        } catch (e) {
            console.warn('⚠️ Gemini Vision failed, falling back to standard OCR:', e);
            // Fallthrough to standard OCR
        }
    }

    // 2. Fallback: Standard OCR (Previous Logic)
    console.log('📸 Falling back to Standard OCR Adapter...');
    const ocr = createOCRAdapter('auto');
    const ocrResult = await ocr.extract(imageBuffer);

    if (!ocrResult.success) {
        return {
            processingStatus: 'error',
            validationErrors: [ocrResult.error || 'Errore OCR sconosciuto'],
        };
    }

    let shipmentData = { ...state.shipmentData, ...ocrResult.extractedData };

    // 3. LLM Cleanup (Legacy/Fallback)
    // Reuse 'llm' from above if available
    if (llm && ocrResult.rawText && (!shipmentData.recipient_address || !shipmentData.recipient_zip)) {
        console.log('🧠 Using LLM to structure raw OCR text...');
        
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
            const jsonText = result.content.toString().replace(/```json/g, '').replace(/```/g, '').trim();
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
            console.warn('⚠️ LLM Parsing failed:', e);
        }
    }

    // Calculate initial confidence
    const confidenceScore = (ocrResult.confidence || 0.5) * 100;

    return {
        shipmentData,
        processingStatus: 'validating',
        confidenceScore,
    };

  } catch (error: any) {
    return {
        processingStatus: 'error',
        validationErrors: [`Errore interno extractData: ${error.message}`],
    };
  }
}

/**
 * Node: Validate Geo
 * Validates and normalizes address using LLM logic
 */
export async function validateGeo(state: AgentState): Promise<Partial<AgentState>> {
  console.log('🔄 Executing Node: validateGeo');
  const data = state.shipmentData;
  const errors: string[] = [];

  // Basic validation
  if (!data.recipient_address) errors.push('Indirizzo mancante');
  if (!data.recipient_city) errors.push('Città mancante');
  if (!data.recipient_zip) errors.push('CAP mancante');

  // Logic validation via LLM if fields are present but maybe fishy
  const llm = getLLM();
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
           const jsonText = result.content.toString().replace(/```json/g, '').replace(/```/g, '').trim();
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
          console.warn('⚠️ Address Validation LLM failed, skipping advanced check');
      }
  }

  return {
      shipmentData: data,
      validationErrors: errors,
      processingStatus: errors.length > 0 ? 'validating' : 'calculating', // If errors, might stay stuck or go to review. Decision in graph edge.
      needsHumanReview: errors.length > 0
  };
}

/**
 * Node: Select Courier
 * Selects best courier based on performance and price
 */
export async function selectCourier(state: AgentState): Promise<Partial<AgentState>> {
  console.log('🔄 Executing Node: selectCourier');
  
  if (state.needsHumanReview) return {}; // Skip if already flagged

  const { recipient_city, recipient_province, weight = 1 } = state.shipmentData;

  try {
      // Crea AuthContext da stato per analisi performance
      const authContext = await createAuthContextFromState(state);
      
      const performances = await analyzeCorrieriPerformance(
          recipient_city || '', 
          recipient_province || '',
          authContext
      );

      // Simple Selection Logic (can be expanded)
      // 1. Filter reliable couriers (Score > 80)
      const reliable = performances.filter(p => p.reliabilityScore >= 80);
      
      // 2. Select cheapest among reliable (Mock prices since we don't have full price list logic exposed as simple function)
      // In prod: await getCourierPrice(courier, weight, ...)
      
      // MOCK LOGIC for selection
      let bestChoice = reliable.length > 0 ? reliable[0] : performances[0];
      
      if (!bestChoice) {
          // Fallback if no performance data
          bestChoice = { corriere: 'BRT', reliabilityScore: 70 } as any; 
      }

      const selectedCourier = {
          id: bestChoice.corriere.toLowerCase(), // normalized id
          name: bestChoice.corriere,
          serviceType: 'standard' as CourierServiceType,
          price: 10 + (weight * 0.5), // Mock price calculation
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
          processingStatus: 'calculating'
      };

  } catch (error) {
      console.error('Error selecting courier:', error);
      return { needsHumanReview: true, validationErrors: [...state.validationErrors, 'Errore selezione corriere'] };
  }
}

/**
 * Node: Calculate Margins
 * Adds user margin to the base price
 */
export async function calculateMargins(state: AgentState): Promise<Partial<AgentState>> {
  console.log('🔄 Executing Node: calculateMargins');
  
  if (state.needsHumanReview || !state.selectedCourier) return {};

  const basePrice = state.selectedCourier.price;
  const marginPercent = 20; // Default or fetch from user config
  
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
      processingStatus: 'complete' // Ready for check_confidence
  };
}

/**
 * Node: Save Shipment
 * Persists data to Supabase
 */
/**
 * Helper: Crea AuthContext da AgentState
 */
async function createAuthContextFromState(state: AgentState): Promise<AuthContext> {
    if (!state.userEmail) {
        throw new Error('userEmail mancante nello stato - impossibile creare AuthContext');
    }

    // Prova a ottenere userId Supabase da email
    let supabaseUserId: string | null = null;
    try {
        supabaseUserId = await getSupabaseUserIdFromEmail(state.userEmail, state.userId || undefined);
    } catch (error: any) {
        console.warn('⚠️ [NODES] Errore recupero userId Supabase:', error.message);
    }

    // Se non abbiamo userId Supabase, NON possiamo permettere operazioni
    if (!supabaseUserId) {
        console.error('❌ [NODES] Impossibile ottenere userId Supabase per:', state.userEmail);
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
    console.log('🔄 Executing Node: saveShipment');
    
    try {
        const shipmentInput = {
            ...state.shipmentData,
            status: 'ready_to_ship',
            created_via_ocr: true,
            ocr_confidence_score: state.confidenceScore,
        };

        // Crea AuthContext da stato
        const authContext = await createAuthContextFromState(state);

        // Note: addSpedizione handles ID generation and some defaults
        const result = await addSpedizione(shipmentInput, authContext);
        
        return {
            shipmentId: result ? result.id : undefined,
            processingStatus: 'complete',
            shipmentData: { ...state.shipmentData, status: 'ready_to_ship' }
        };

    } catch (error: any) {
        console.error('Error saving shipment:', error);
        return {
            validationErrors: [...state.validationErrors, `Errore salvataggio: ${error.message}`],
            needsHumanReview: true
        };
    }
}

/**
 * Node: Human Review
 * Flags for review and optionally saves as draft
 */
export async function humanReview(state: AgentState): Promise<Partial<AgentState>> {
    console.log('🔄 Executing Node: humanReview');
    
    // Save as draft contextually if we have minimum data
    if (state.shipmentData.recipient_name || state.shipmentData.recipient_address) {
        try {
            const shipmentInput = {
                ...state.shipmentData,
                status: 'needs_review',
                created_via_ocr: true,
                ocr_confidence_score: state.confidenceScore,
                internal_notes: `Review required. Errors: ${state.validationErrors.join(', ')}`
            };
            
            // Crea AuthContext da stato
            const authContext = await createAuthContextFromState(state);
            const result = await addSpedizione(shipmentInput, authContext);
            return {
                shipmentId: result ? result.id : undefined,
                processingStatus: 'error', 
            };
        } catch (e) {
            console.error('Failed to save draft for review', e);
        }
    }

    return { processingStatus: 'error' };
}
