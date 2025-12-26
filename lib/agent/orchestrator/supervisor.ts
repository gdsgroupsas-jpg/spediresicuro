/**
 * Supervisor Node
 * 
 * Il "cervello" che decide il routing:
 * - Intent pricing con dati sufficienti -> pricing_worker
 * - Intent pricing senza dati -> END (con clarification_request)
 * - Intent non-pricing -> legacy
 * - Risposta pronta -> END
 */

import { AgentState } from './state';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { detectPricingIntent } from '@/lib/agent/intent-detector';

// Helper per ottenere LLM (stesso pattern di nodes.ts)
const getLLM = () => {
  if (!process.env.GOOGLE_API_KEY) {
    console.warn('⚠️ GOOGLE_API_KEY mancante - Supervisor userà logica base');
    return null;
  }
  return new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash-001',
    maxOutputTokens: 512,
    temperature: 0.1,
    apiKey: process.env.GOOGLE_API_KEY,
  });
};

/**
 * Estrae dati spedizione dal messaggio usando LLM (se disponibile) o logica base
 */
async function extractShipmentDetailsFromMessage(
  message: string,
  existingDetails?: AgentState['shipment_details']
): Promise<AgentState['shipment_details']> {
  const llm = getLLM();
  
  // Se abbiamo già dati completi, non serve ri-estrarre
  if (existingDetails?.weight && existingDetails?.destinationZip && existingDetails?.destinationProvince) {
    return existingDetails;
  }
  
  // Prova con LLM se disponibile
  if (llm) {
    try {
      const prompt = `Analizza questo messaggio dell'utente e estrai i dati per un preventivo spedizione.

Messaggio: "${message}"

Dati già noti: ${JSON.stringify(existingDetails || {}, null, 2)}

Estrai SOLO i dati presenti nel messaggio. Rispondi ESCLUSIVAMENTE con JSON valido:
{
  "weight": number | null,  // Peso in kg
  "destinationZip": string | null,  // CAP destinazione (5 cifre)
  "destinationProvince": string | null,  // Provincia (2 lettere, es. "RM")
  "serviceType": "standard" | "express" | "economy" | null,
  "cashOnDelivery": number | null,  // Importo contrassegno (0 = no)
  "declaredValue": number | null,  // Valore dichiarato
  "insurance": boolean | null
}

Se un dato non è presente, usa null.`;

      const result = await llm.invoke([new HumanMessage(prompt)]);
      const jsonText = result.content.toString().replace(/```json/g, '').replace(/```/g, '').trim();
      const extracted = JSON.parse(jsonText);
      
      // Merge con dati esistenti (priorità ai nuovi se presenti)
      return {
        ...existingDetails,
        weight: extracted.weight ?? existingDetails?.weight,
        destinationZip: extracted.destinationZip ?? existingDetails?.destinationZip,
        destinationProvince: extracted.destinationProvince ?? existingDetails?.destinationProvince,
        serviceType: extracted.serviceType ?? existingDetails?.serviceType,
        cashOnDelivery: extracted.cashOnDelivery ?? existingDetails?.cashOnDelivery,
        declaredValue: extracted.declaredValue ?? existingDetails?.declaredValue,
        insurance: extracted.insurance ?? existingDetails?.insurance,
      };
    } catch (error) {
      console.warn('⚠️ [Supervisor] Errore estrazione LLM, uso logica base:', error);
    }
  }
  
  // Fallback: logica base (regex semplice)
  // TODO: Migliorare con regex più sofisticate se necessario
  const details: AgentState['shipment_details'] = { ...existingDetails };
  
  // Estrai peso (es. "2 kg", "2kg", "peso 5")
  const weightMatch = message.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|chili|peso)/i) || 
                      message.match(/peso\s*(\d+(?:[.,]\d+)?)/i);
  if (weightMatch) {
    details.weight = parseFloat(weightMatch[1].replace(',', '.'));
  }
  
  // Estrai CAP (5 cifre)
  const zipMatch = message.match(/\b(\d{5})\b/);
  if (zipMatch) {
    details.destinationZip = zipMatch[1];
  }
  
  // Estrai provincia (2 lettere maiuscole)
  const provinceMatch = message.match(/\b([A-Z]{2})\b/);
  if (provinceMatch) {
    details.destinationProvince = provinceMatch[1];
  }
  
  return details;
}

/**
 * Verifica se abbiamo abbastanza dati per calcolare un preventivo
 */
function hasEnoughDataForPricing(details?: AgentState['shipment_details']): boolean {
  if (!details) return false;
  
  return !!(
    details.weight &&
    details.weight > 0 &&
    details.destinationZip &&
    details.destinationZip.length === 5 &&
    details.destinationProvince &&
    details.destinationProvince.length === 2
  );
}

/**
 * Supervisor Node
 * 
 * Decide il routing basandosi sullo stato:
 * - Se abbiamo preventivi già calcolati -> END
 * - Se abbiamo abbastanza dati -> pricing_worker
 * - Se mancano dati -> END (con clarification_request)
 */
export async function supervisor(state: AgentState): Promise<Partial<AgentState>> {
  console.log('🧠 [Supervisor] Decisione routing...');
  
  try {
    // Se abbiamo già preventivi calcolati, termina
    if (state.pricing_options && state.pricing_options.length > 0) {
      console.log('✅ [Supervisor] Preventivi già calcolati, termino');
      return {
        next_step: 'END',
        processingStatus: 'complete',
      };
    }
    
    // Estrai ultimo messaggio utente
    const lastMessage = state.messages[state.messages.length - 1];
    const messageText = lastMessage && 'content' in lastMessage 
      ? String(lastMessage.content) 
      : '';
    
    // Estrai/aggiorna dati spedizione dal messaggio
    const shipmentDetails = await extractShipmentDetailsFromMessage(
      messageText,
      state.shipment_details
    );
    
    // Verifica se abbiamo abbastanza dati
    const hasEnoughData = hasEnoughDataForPricing(shipmentDetails);
    
    if (hasEnoughData) {
      console.log('✅ [Supervisor] Dati sufficienti, routing a pricing_worker');
      return {
        shipment_details: shipmentDetails,
        next_step: 'pricing_worker',
        processingStatus: 'calculating',
        iteration_count: (state.iteration_count || 0) + 1,
      };
    } else {
      // Determina cosa manca
      const missing: string[] = [];
      if (!shipmentDetails?.weight || shipmentDetails.weight <= 0) missing.push('peso');
      if (!shipmentDetails?.destinationZip || shipmentDetails.destinationZip.length !== 5) missing.push('CAP destinazione');
      if (!shipmentDetails?.destinationProvince || shipmentDetails.destinationProvince.length !== 2) missing.push('provincia destinazione');
      
      console.log(`⚠️ [Supervisor] Dati insufficienti, mancano: ${missing.join(', ')}`);
      
      return {
        shipment_details: shipmentDetails,
        clarification_request: `Per calcolare un preventivo preciso, ho bisogno di: ${missing.join(', ')}. Puoi fornirmi questi dati?`,
        next_step: 'END', // Termina con clarification_request popolato
        processingStatus: 'idle',
      };
    }
    
  } catch (error: any) {
    console.error('❌ [Supervisor] Errore:', error);
    return {
      clarification_request: `Errore nell'analisi della richiesta: ${error.message}. Riprova.`,
      next_step: 'legacy', // Fallback a legacy in caso di errore
      processingStatus: 'error',
      validationErrors: [...(state.validationErrors || []), error.message],
    };
  }
}

// ==================== FUNZIONE PURA PER TESTING ====================

export interface DecisionInput {
  isPricingIntent: boolean;
  hasPricingOptions: boolean;
  hasClarificationRequest: boolean;
  hasEnoughData: boolean;
}

export type SupervisorDecision = 'pricing_worker' | 'legacy' | 'END';

/**
 * Funzione PURA per decidere il prossimo step.
 * Facile da testare senza mock di LLM/DB.
 * 
 * @param input - Dati di input per la decisione
 * @returns 'pricing_worker' | 'legacy' | 'END'
 */
export function decideNextStep(input: DecisionInput): SupervisorDecision {
  // Se abbiamo già preventivi calcolati -> END
  if (input.hasPricingOptions) {
    return 'END';
  }
  
  // Se c'è già una richiesta di chiarimento -> END (mostra al client)
  if (input.hasClarificationRequest) {
    return 'END';
  }
  
  // Se NON è un intent pricing -> legacy handler (Claude)
  if (!input.isPricingIntent) {
    return 'legacy';
  }
  
  // È un intent pricing...
  if (input.hasEnoughData) {
    // Ha abbastanza dati -> pricing_worker
    return 'pricing_worker';
  } else {
    // Mancano dati -> END (supervisor avrà popolato clarification_request)
    return 'END';
  }
}

