/**
 * OCR Worker (Sprint 2.4)
 * 
 * Worker per estrazione dati da:
 * - Immagini/screenshot (usando Gemini Vision esistente)
 * - Testo OCR grezzo (parsing deterministico)
 * 
 * INPUT: AgentState con immagine base64 o testo OCR
 * OUTPUT:
 * - Aggiorna state.shipmentDraft (merge non distruttivo)
 * - Calcola missingFields
 * - Setta next_step = "address_worker" (per normalizzazione) o "END" (se mancano dati critici)
 * 
 * ⚠️ NO PII nei log (no addressLine1, fullName, phone, etc.)
 * ⚠️ NON chiama LLM per "inventare" dati mancanti
 */

import { AgentState } from '../orchestrator/state';
import { 
  ShipmentDraft, 
  calculateMissingFieldsForPricing,
  mergeShipmentDraft,
  type ShipmentDraftUpdates,
} from '@/lib/address/shipment-draft';
import { defaultLogger, type ILogger } from '../logger';

// ==================== TIPI ====================

export interface OcrWorkerInput {
  /** Immagine in base64 (senza prefix data:image) */
  image?: string;
  /** Testo OCR grezzo già estratto */
  text?: string;
}

export interface OcrWorkerResult {
  shipmentDraft: ShipmentDraft;
  missingFields: string[];
  clarificationQuestion?: string;
  nextStep: 'address_worker' | 'pricing_worker' | 'END';
  ocrSource: 'image' | 'text';
  extractedFieldsCount: number;
}

// ==================== PATTERN OCR ====================

/**
 * Pattern per rilevare se un messaggio contiene testo tipico da OCR/screenshot
 */
export const OCR_TEXT_PATTERNS = [
  /destinatario\s*[:;]/i,
  /indirizzo\s*[:;]/i,
  /via\s+[a-z]+/i,
  /piazza\s+[a-z]+/i,
  /corso\s+[a-z]+/i,
  /cap\s*[:;]?\s*\d{5}/i,
  /\d{5}\s+[a-z]+\s*\(?[A-Z]{2}\)?/i, // CAP + città + provincia
  /tel\.?\s*[:;]?\s*[\d\s\-\+]+/i,
  /telefono\s*[:;]?\s*[\d\s\-\+]+/i,
  /prov\.?\s*[:;]?\s*[A-Z]{2}/i,
  /provincia\s*[:;]?\s*[A-Z]{2}/i,
  /nome\s*[:;]/i,
  /cognome\s*[:;]/i,
  /spedizione\s*a\s*[:;]?/i,
  /consegna\s*[:;]/i,
  /peso\s*[:;]?\s*\d+[,.]?\d*\s*(kg|g)/i,
];

/**
 * Rileva se il messaggio contiene pattern OCR tipici
 */
export function containsOcrPatterns(text: string): boolean {
  if (!text || text.trim().length < 20) return false;
  
  let matchCount = 0;
  for (const pattern of OCR_TEXT_PATTERNS) {
    if (pattern.test(text)) {
      matchCount++;
      if (matchCount >= 2) return true; // Almeno 2 pattern per essere sicuri
    }
  }
  
  return false;
}

// ==================== PARSING DETERMINISTICO ====================

/**
 * Estrae CAP italiano (5 cifre)
 */
function extractPostalCode(text: string): string | undefined {
  // Pattern: 5 cifre isolate (non parte di numero più lungo)
  const patterns = [
    /CAP\s*[:;]?\s*(\d{5})/i,
    /\b(\d{5})\s+[A-Za-zàèéìòù]+\s*\(?[A-Z]{2}\)?/i, // 20100 Milano (MI)
    /\b(\d{5})\b(?!\d)/, // standalone 5 digits
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return undefined;
}

/**
 * Estrae provincia italiana (2 lettere uppercase)
 */
function extractProvince(text: string): string | undefined {
  const patterns = [
    /prov\.?\s*[:;]?\s*([A-Z]{2})\b/i,
    /provincia\s*[:;]?\s*([A-Z]{2})\b/i,
    /\(\s*([A-Z]{2})\s*\)/i, // (MI)
    /\d{5}\s+[A-Za-zàèéìòù]+\s+([A-Z]{2})\b/i, // 20100 Milano MI
    /[A-Za-zàèéìòù]+\s+\(([A-Z]{2})\)/i, // Milano (MI)
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const prov = match[1].toUpperCase();
      // Valida che sia una provincia italiana plausibile
      if (/^[A-Z]{2}$/.test(prov)) {
        return prov;
      }
    }
  }
  
  return undefined;
}

/**
 * Estrae città dal testo
 */
function extractCity(text: string): string | undefined {
  const patterns = [
    /città\s*[:;]?\s*([A-Za-zàèéìòù\s]+?)(?=\s*\(?[A-Z]{2}\)?|\s*$|\s*\d{5}|\n)/i,
    /\d{5}\s+([A-Za-zàèéìòù\s]+?)(?=\s*\(?[A-Z]{2}\)?|\s*$|\s+[A-Z]{2}\s|\n)/i, // 20100 Milano (MI) o 20100 Milano MI
    /comune\s*[:;]?\s*([A-Za-zàèéìòù\s]+?)(?=\s*\(?[A-Z]{2}\)?|\s*$|\n)/i,
    // Pattern per "(MI)" con città prima
    /([A-Za-zàèéìòù]+)\s*\([A-Z]{2}\)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const city = match[1].trim();
      // Almeno 2 caratteri e non solo numeri, escludi parole troppo corte
      if (city.length >= 3 && !/^\d+$/.test(city) && !/^[A-Z]{2}$/.test(city)) {
        return city;
      }
    }
  }
  
  return undefined;
}

/**
 * Estrae nome destinatario
 */
function extractRecipientName(text: string): string | undefined {
  const patterns = [
    /destinatario\s*[:;]?\s*([A-Za-zàèéìòù\s]+?)(?=\n|via|piazza|corso|indirizzo|tel|$)/i,
    /nome\s*[:;]?\s*([A-Za-zàèéìòù]+)\s+(?:cognome\s*[:;]?\s*)?([A-Za-zàèéìòù]+)/i,
    /spedizione\s*a\s*[:;]?\s*([A-Za-zàèéìòù\s]+?)(?=\n|via|$)/i,
    /consegna\s*(?:a|per)\s*[:;]?\s*([A-Za-zàèéìòù\s]+?)(?=\n|via|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Combina nome e cognome se presenti
      const fullName = match[2] ? `${match[1].trim()} ${match[2].trim()}` : match[1].trim();
      if (fullName.length >= 3 && fullName.length < 100) {
        return fullName;
      }
    }
  }
  
  return undefined;
}

/**
 * Estrae indirizzo (via, piazza, corso, etc.)
 */
function extractAddress(text: string): string | undefined {
  const patterns = [
    /indirizzo\s*[:;]?\s*([^\n]+?)(?=\s*\d{5}|\s*cap|\s*città|\s*tel|$)/i,
    /(via\s+[A-Za-zàèéìòù\s']+(?:,?\s*\d+[a-z]?)?)/i,
    /(piazza\s+[A-Za-zàèéìòù\s']+(?:,?\s*\d+[a-z]?)?)/i,
    /(corso\s+[A-Za-zàèéìòù\s']+(?:,?\s*\d+[a-z]?)?)/i,
    /(viale\s+[A-Za-zàèéìòù\s']+(?:,?\s*\d+[a-z]?)?)/i,
    /(largo\s+[A-Za-zàèéìòù\s']+(?:,?\s*\d+[a-z]?)?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const address = match[1].trim();
      if (address.length >= 5) {
        return address;
      }
    }
  }
  
  return undefined;
}

/**
 * Estrae telefono
 */
function extractPhone(text: string): string | undefined {
  const patterns = [
    /tel\.?\s*[:;]?\s*([\+]?[\d\s\-]{6,15})/i,
    /telefono\s*[:;]?\s*([\+]?[\d\s\-]{6,15})/i,
    /cell\.?\s*[:;]?\s*([\+]?[\d\s\-]{6,15})/i,
    /(\+39[\s\-]?)?3\d{2}[\s\-]?\d{6,7}/i, // Mobile italiano
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Normalizza rimuovendo spazi e trattini
      const phone = match[1].replace(/[\s\-]/g, '');
      if (phone.length >= 6 && phone.length <= 15) {
        return phone;
      }
    }
  }
  
  return undefined;
}

/**
 * Estrae peso (in kg)
 */
function extractWeight(text: string): number | undefined {
  // Prima cerca pattern espliciti in kg
  const kgPatterns = [
    /peso\s*[:;]?\s*(\d+[,.]?\d*)\s*kg/i,
    /(\d+[,.]?\d*)\s*kg\b/i, // Generico con kg
  ];
  
  for (const pattern of kgPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const weight = parseFloat(match[1].replace(',', '.'));
      // Peso plausibile (0.1 - 100 kg)
      if (weight > 0 && weight <= 100) {
        return weight;
      }
    }
  }
  
  // Poi cerca pattern in grammi
  const gramPatterns = [
    /peso\s*[:;]?\s*(\d+[,.]?\d*)\s*grammi/i,
    /peso\s*[:;]?\s*(\d+[,.]?\d*)\s*g\b/i,
    /(\d+[,.]?\d*)\s*grammi\b/i,
  ];
  
  for (const pattern of gramPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const grams = parseFloat(match[1].replace(',', '.'));
      // Converti in kg
      const weight = grams / 1000;
      if (weight > 0 && weight <= 100) {
        return weight;
      }
    }
  }
  
  return undefined;
}

/**
 * Parsing completo del testo OCR
 * NON usa LLM, solo regex deterministico
 */
function parseOcrText(text: string): ShipmentDraftUpdates {
  const recipient: ShipmentDraftUpdates['recipient'] = {};
  const parcel: ShipmentDraftUpdates['parcel'] = {};
  
  // Estrai ogni campo
  const postalCode = extractPostalCode(text);
  if (postalCode) recipient.postalCode = postalCode;
  
  const province = extractProvince(text);
  if (province) recipient.province = province;
  
  const city = extractCity(text);
  if (city) recipient.city = city;
  
  const fullName = extractRecipientName(text);
  if (fullName) recipient.fullName = fullName;
  
  const addressLine1 = extractAddress(text);
  if (addressLine1) recipient.addressLine1 = addressLine1;
  
  const phone = extractPhone(text);
  if (phone) recipient.phone = phone;
  
  const weight = extractWeight(text);
  if (weight) parcel.weightKg = weight;
  
  return {
    recipient: Object.keys(recipient).length > 0 ? recipient : undefined,
    parcel: Object.keys(parcel).length > 0 ? parcel : undefined,
  };
}

/**
 * Conta i campi estratti
 */
function countExtractedFields(updates: ShipmentDraftUpdates): number {
  let count = 0;
  
  if (updates.recipient) {
    count += Object.values(updates.recipient).filter(v => v !== undefined).length;
  }
  if (updates.parcel) {
    count += Object.values(updates.parcel).filter(v => v !== undefined).length;
  }
  if (updates.sender) {
    count += Object.values(updates.sender).filter(v => v !== undefined).length;
  }
  
  return count;
}

// ==================== CLARIFICATION GENERATION ====================

/**
 * Genera domanda di chiarimento per dati mancanti
 */
function generateClarificationQuestion(missingFields: string[]): string {
  const fieldLabels: Record<string, string> = {
    'recipient.postalCode': 'CAP',
    'recipient.province': 'provincia (es. MI, RM)',
    'recipient.city': 'città',
    'recipient.addressLine1': 'indirizzo (via/piazza)',
    'recipient.fullName': 'nome destinatario',
    'parcel.weightKg': 'peso del pacco in kg',
  };
  
  const missingLabels = missingFields
    .map(f => fieldLabels[f] || f)
    .filter(Boolean);
  
  if (missingLabels.length === 0) {
    return 'Ho estratto i dati dallo screenshot. Puoi verificare e correggere se necessario.';
  }
  
  if (missingLabels.length === 1) {
    return `Ho estratto alcuni dati, ma mi manca: **${missingLabels[0]}**.`;
  }
  
  if (missingLabels.length === 2) {
    return `Dai dati estratti mancano: **${missingLabels[0]}** e **${missingLabels[1]}**.`;
  }
  
  const lastLabel = missingLabels.pop();
  return `Ho estratto dati parziali. Mancano: **${missingLabels.join(', ')}** e **${lastLabel}**.`;
}

// ==================== CORE LOGIC (CONSOLIDATA) ====================

/**
 * Logica core condivisa per estrazione OCR e decisione next step.
 * Elimina duplicazione tra versione async e sync.
 * 
 * Esportata per test unitari diretti.
 */
export function processOcrCore(
  text: string,
  existingDraft?: ShipmentDraft
): {
  updatedDraft: ShipmentDraft;
  missingFields: string[];
  extractedFieldsCount: number;
} {
  const extractedUpdates = parseOcrText(text);
  const extractedFieldsCount = countExtractedFields(extractedUpdates);
  const updatedDraft = mergeShipmentDraft(existingDraft, extractedUpdates);
  const missingFields = calculateMissingFieldsForPricing(updatedDraft);
  
  return {
    updatedDraft,
    missingFields,
    extractedFieldsCount,
  };
}

// ==================== MAIN WORKER ====================

/**
 * OCR Worker
 * 
 * Estrae dati da immagine o testo OCR.
 * Merge con dati esistenti (non distruttivo).
 * Determina se procedere ad address_worker o chiedere chiarimenti.
 * 
 * @param state - AgentState corrente
 * @returns Partial<AgentState> con shipmentDraft aggiornato
 */
export async function ocrWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('📸 [OCR Worker] Esecuzione...');
  
  try {
    // Estrai ultimo messaggio
    const lastMessage = state.messages[state.messages.length - 1];
    const messageContent = lastMessage && 'content' in lastMessage 
      ? lastMessage.content 
      : '';
    
    // Determina tipo input (immagine o testo)
    let ocrSource: 'image' | 'text' = 'text';
    let textToProcess = '';
    
    // Check se è un'immagine base64
    if (typeof messageContent === 'string' && messageContent.startsWith('data:image')) {
      // TODO Sprint 2.5: Implementare chiamata a extractData() per immagini
      // Per ora, fallback a clarification request
      ocrSource = 'image';
      logger.log('📸 [OCR Worker] Immagine rilevata - TODO: integrazione Gemini Vision');
      
      // Ritorna clarification per immagini (MVP testo first)
      return {
        clarification_request: 'Ho ricevuto un\'immagine, ma l\'estrazione automatica non è ancora attiva. Puoi incollare il testo dello screenshot?',
        next_step: 'END',
        processingStatus: 'idle',
      };
    }
    
    // Tratta come testo OCR
    textToProcess = typeof messageContent === 'string' ? messageContent : String(messageContent);
    
    if (!textToProcess.trim()) {
      logger.warn('⚠️ [OCR Worker] Testo vuoto');
      return {
        clarification_request: 'Non ho ricevuto dati. Puoi incollare il testo dello screenshot o indicare i dati della spedizione?',
        next_step: 'END',
        processingStatus: 'idle',
      };
    }
    
    // Usa logica core condivisa
    const { updatedDraft, missingFields, extractedFieldsCount } = processOcrCore(
      textToProcess,
      state.shipmentDraft
    );
    
    // Log telemetria (NO PII - solo conteggi)
    logger.log(`📸 [OCR Worker] Campi estratti: ${extractedFieldsCount}, source: ${ocrSource}`);
    logger.log(`📸 [OCR Worker] Campi mancanti per pricing: ${missingFields.length}`);
    
    // Se non abbiamo estratto nulla, chiedi chiarimenti
    if (extractedFieldsCount === 0) {
      logger.log('⚠️ [OCR Worker] Nessun dato estratto, richiedo chiarimenti');
      return {
        clarification_request: 'Non sono riuscita a estrarre dati dallo screenshot. Puoi indicarmi CAP, città, provincia e peso del pacco?',
        next_step: 'END',
        processingStatus: 'idle',
      };
    }
    
    // Se abbiamo estratto qualcosa
    if (missingFields.length === 0) {
      // Abbiamo tutto per il pricing -> address_worker per normalizzazione
      logger.log('✅ [OCR Worker] Dati sufficienti, routing a address_worker');
      return {
        shipmentDraft: updatedDraft,
        shipment_details: {
          weight: updatedDraft.parcel?.weightKg,
          destinationZip: updatedDraft.recipient?.postalCode,
          destinationProvince: updatedDraft.recipient?.province,
        },
        next_step: 'address_worker',
        processingStatus: 'extracting',
      };
    }
    
    // Mancano dati per pricing -> clarification ma salva quello che abbiamo
    const clarificationQuestion = generateClarificationQuestion(missingFields);
    logger.log(`⚠️ [OCR Worker] Dati parziali, mancano: ${missingFields.join(', ')}`);
    
    return {
      shipmentDraft: updatedDraft,
      clarification_request: clarificationQuestion,
      next_step: 'END',
      processingStatus: 'idle',
    };
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [OCR Worker] Errore:', errorMessage);
    return {
      clarification_request: 'Mi dispiace, non sono riuscita a elaborare i dati. Puoi riprovare?',
      next_step: 'END',
      processingStatus: 'error',
      validationErrors: [...(state.validationErrors || []), `OCR Error: ${errorMessage}`],
    };
  }
}

/**
 * Versione sincrona per uso in unit test o pre-elaborazione
 * Usa la stessa logica core della versione async
 */
export function processOcrSync(
  text: string, 
  existingDraft?: ShipmentDraft
): OcrWorkerResult {
  const { updatedDraft, missingFields, extractedFieldsCount } = processOcrCore(text, existingDraft);
  
  let nextStep: OcrWorkerResult['nextStep'] = 'END';
  let clarificationQuestion: string | undefined;
  
  if (extractedFieldsCount === 0) {
    clarificationQuestion = 'Non sono riuscita a estrarre dati. Puoi indicarmi CAP, città, provincia e peso?';
  } else if (missingFields.length === 0) {
    nextStep = 'address_worker';
  } else {
    clarificationQuestion = generateClarificationQuestion(missingFields);
  }
  
  return {
    shipmentDraft: updatedDraft,
    missingFields,
    clarificationQuestion,
    nextStep,
    ocrSource: 'text',
    extractedFieldsCount,
  };
}

