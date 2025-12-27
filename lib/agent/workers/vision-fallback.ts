/**
 * Vision Fallback Policy (Sprint 2.5 Phase 2)
 * 
 * Gestisce:
 * - Retry 1x per errori transienti (timeout, 429, 5xx)
 * - Classificazione errori
 * - Fallback a clarification_request se Vision fallisce
 * 
 * ⚠️ Claude NON è Vision fallback.
 *    Claude può essere usato SOLO per:
 *    - Post-processing di output Vision già ottenuto
 *    - Estrazione da testo (se input testuale esiste)
 * 
 * ⚠️ NO PII nei log (no base64, no fullName, no addressLine1, no phone)
 */

import { AgentState } from '../orchestrator/state';
import { extractData } from '../orchestrator/nodes';
import { defaultLogger, type ILogger } from '../logger';
import { HumanMessage } from '@langchain/core/messages';

// ==================== TIPI ====================

export interface VisionResult {
  success: boolean;
  data?: Partial<AgentState>;
  error?: VisionError;
  attempts: number;
}

export interface VisionError {
  type: 'transient' | 'permanent' | 'unavailable';
  code?: string;
  message: string;
  retryable: boolean;
}

// ==================== CONFIGURAZIONE ====================

export const visionFallbackConfig = {
  /** Numero massimo di retry per errori transienti */
  MAX_RETRIES: 1,
  
  /** Delay tra retry in ms */
  RETRY_DELAY_MS: parseInt(process.env.VISION_RETRY_DELAY_MS || '1000', 10),
  
  /** Timeout per singola chiamata Vision in ms */
  VISION_TIMEOUT_MS: parseInt(process.env.VISION_TIMEOUT_MS || '30000', 10),
} as const;

// ==================== ERROR CLASSIFICATION ====================

/**
 * Pattern per identificare errori transienti (retryable)
 */
const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /429/,                    // Rate limit
  /too many requests/i,
  /rate.?limit/i,
  /5\d{2}/,                 // 5xx status codes
  /internal.?server.?error/i,
  /service.?unavailable/i,
  /temporarily.?unavailable/i,
  /ENOTFOUND/i,             // DNS failure (transient network issue)
  /ECONNREFUSED/i,
];

/**
 * Pattern per identificare errori permanenti (non retryable)
 */
const PERMANENT_ERROR_PATTERNS = [
  /invalid.?api.?key/i,
  /unauthorized/i,
  /403/,                    // Forbidden
  /401/,                    // Unauthorized
  /quota.?exceeded/i,
  /billing/i,
  /invalid.?request/i,
  /bad.?request/i,
  /400/,                    // Bad request
];

/**
 * Pattern per identificare API non disponibile
 */
const UNAVAILABLE_PATTERNS = [
  /GOOGLE_API_KEY mancante/i,
  /api.?key.?missing/i,
  /not.?configured/i,
];

/**
 * Classifica un errore per determinare se è retryable
 */
export function classifyVisionError(error: unknown): VisionError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = error instanceof Error && 'code' in error 
    ? String((error as Error & { code?: string }).code) 
    : undefined;
  
  // Check unavailable first
  for (const pattern of UNAVAILABLE_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        type: 'unavailable',
        code: errorCode,
        message: 'Vision API non configurata',
        retryable: false,
      };
    }
  }
  
  // Check permanent errors
  for (const pattern of PERMANENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        type: 'permanent',
        code: errorCode,
        message: errorMessage,
        retryable: false,
      };
    }
  }
  
  // Check transient errors
  for (const pattern of TRANSIENT_ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        type: 'transient',
        code: errorCode,
        message: errorMessage,
        retryable: true,
      };
    }
  }
  
  // Default: treat unknown errors as transient (give 1 retry chance)
  return {
    type: 'transient',
    code: errorCode,
    message: errorMessage,
    retryable: true,
  };
}

// ==================== RETRY LOGIC ====================

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Esegue Vision con retry policy
 * 
 * Policy:
 * 1. Prima chiamata a extractData
 * 2. Se errore transiente: 1 retry dopo delay
 * 3. Se ancora fallisce O errore permanente: return failure
 * 
 * @param state - AgentState con immagine
 * @param logger - Logger (default: defaultLogger)
 * @returns VisionResult con success/failure e dati
 */
export async function executeVisionWithRetry(
  state: AgentState,
  imageContent: string,
  logger: ILogger = defaultLogger
): Promise<VisionResult> {
  let attempts = 0;
  let lastError: VisionError | undefined;
  
  // Crea stato per extractData con immagine
  const visionState: AgentState = {
    ...state,
    messages: [new HumanMessage({ content: imageContent })],
  };
  
  while (attempts <= visionFallbackConfig.MAX_RETRIES) {
    attempts++;
    
    // Log attempt (NO PII - no base64 content)
    logger.log(`🔄 [Vision] Tentativo ${attempts}/${visionFallbackConfig.MAX_RETRIES + 1}`);
    
    try {
      // Chiama extractData con timeout wrapper
      const visionResult = await Promise.race([
        extractData(visionState),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Vision timeout')), visionFallbackConfig.VISION_TIMEOUT_MS)
        ),
      ]);
      
      // Check se extractData ha riportato errore nel risultato
      if (visionResult.processingStatus === 'error') {
        const errorMsg = visionResult.validationErrors?.join(', ') || 'Errore Vision sconosciuto';
        throw new Error(errorMsg);
      }
      
      // Success
      logger.log(`✅ [Vision] Successo al tentativo ${attempts}`);
      return {
        success: true,
        data: visionResult,
        attempts,
      };
      
    } catch (error: unknown) {
      lastError = classifyVisionError(error);
      
      // Log error type (NO PII)
      logger.warn(`⚠️ [Vision] Tentativo ${attempts} fallito: ${lastError.type} - ${lastError.message.substring(0, 100)}`);
      
      // Se non retryable, esci subito
      if (!lastError.retryable) {
        logger.log(`❌ [Vision] Errore non retryable, abort`);
        break;
      }
      
      // Se abbiamo altri tentativi, aspetta e riprova
      if (attempts <= visionFallbackConfig.MAX_RETRIES) {
        logger.log(`⏳ [Vision] Retry tra ${visionFallbackConfig.RETRY_DELAY_MS}ms...`);
        await sleep(visionFallbackConfig.RETRY_DELAY_MS);
      }
    }
  }
  
  // Tutti i tentativi falliti
  return {
    success: false,
    error: lastError || {
      type: 'permanent',
      message: 'Tutti i tentativi Vision falliti',
      retryable: false,
    },
    attempts,
  };
}

// ==================== CLARIFICATION HELPERS ====================

/**
 * Genera messaggio clarification appropriato per tipo di errore
 */
export function generateVisionClarificationMessage(error: VisionError): string {
  switch (error.type) {
    case 'unavailable':
      return 'L\'analisi automatica delle immagini non è disponibile al momento. Puoi incollare il testo dello screenshot?';
    
    case 'transient':
      return 'Si è verificato un errore temporaneo nell\'analisi dell\'immagine. Puoi riprovare o incollare il testo manualmente?';
    
    case 'permanent':
      return 'Non sono riuscita a elaborare l\'immagine. Puoi indicarmi i dati manualmente (CAP, città, provincia, peso)?';
    
    default:
      return 'Errore nell\'analisi dell\'immagine. Puoi incollare il testo dello screenshot?';
  }
}

