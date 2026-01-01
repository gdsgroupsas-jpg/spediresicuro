/**
 * Error Translator - P4 Task 3
 * 
 * Trasforma errori tecnici in messaggi umani comprensibili.
 * 
 * âš ï¸ SICUREZZA:
 * - NO PII nei messaggi (mai mostrare indirizzi raw, nomi, telefoni)
 * - NO stack trace esposti all'utente
 * - Log tecnico separato in telemetria (admin only)
 */

import { AgentState } from './orchestrator/state';
import { defaultLogger, type ILogger } from './logger';


// ====== TIPI ======

export interface HumanMessage {
  message: string;
  actionable: boolean;
  field?: string; // Campo specifico per auto-focus UI
  severity?: 'info' | 'warning' | 'error';
}

export interface AgentError {
  type: 'validation' | 'system' | 'preflight' | 'confidence' | 'fallback';
  field?: string;
  technical: string; // Errore tecnico (solo per log, non mostrato all'utente)
  fallbackReason?: string;
  confidenceScore?: number;
}

// ====== MAPPING ERRORI ======

/**
 * Traduce errori di validazione in messaggi umani
 */
function translateValidationError(error: string, field?: string): HumanMessage {
  const errorLower = error.toLowerCase();
  
  // Mapping campo-specifico
  if (field) {
    const fieldMap: Record<string, HumanMessage> = {
      'destinationZip': {
        message: 'Manca il CAP di destinazione. Puoi indicarlo?',
        actionable: true,
        field: 'destinationZip',
        severity: 'warning',
      },
      'destinationProvince': {
        message: 'Manca la provincia di destinazione. Puoi indicarla? (es. RM, MI, TO)',
        actionable: true,
        field: 'destinationProvince',
        severity: 'warning',
      },
      'weight': {
        message: 'Per procedere, ho bisogno del peso del pacco (in kg).',
        actionable: true,
        field: 'weight',
        severity: 'warning',
      },
      'destinationCity': {
        message: 'Manca la cittÃ  di destinazione. Puoi indicarla?',
        actionable: true,
        field: 'destinationCity',
        severity: 'warning',
      },
      'recipientName': {
        message: 'Manca il nome del destinatario. Puoi indicarlo?',
        actionable: true,
        field: 'recipientName',
        severity: 'warning',
      },
    };
    
    if (fieldMap[field]) {
      return fieldMap[field];
    }
  }
  
  // Pattern matching generico
  if (errorLower.includes('cap') || errorLower.includes('zip')) {
    return {
      message: 'Il CAP deve essere un numero di 5 cifre valido. Puoi verificarlo?',
      actionable: true,
      severity: 'warning',
    };
  }
  
  if (errorLower.includes('provincia') || errorLower.includes('province')) {
    return {
      message: 'La provincia deve essere un codice di 2 lettere (es. RM, MI, TO). Puoi correggerla?',
      actionable: true,
      severity: 'warning',
    };
  }
  
  if (errorLower.includes('peso') || errorLower.includes('weight')) {
    return {
      message: 'Il peso deve essere un numero positivo maggiore di zero. Puoi indicarlo?',
      actionable: true,
      severity: 'warning',
    };
  }
  
  if (errorLower.includes('indirizzo') || errorLower.includes('address')) {
    return {
      message: 'L\'indirizzo non Ã¨ completo. Controlla che ci siano: via, numero civico, CAP e provincia.',
      actionable: true,
      severity: 'warning',
    };
  }
  
  if (errorLower.includes('wallet') || errorLower.includes('saldo')) {
    return {
      message: 'Il saldo del wallet non Ã¨ sufficiente per questa spedizione. Vuoi ricaricare?',
      actionable: true,
      severity: 'error',
    };
  }
  
  // Default: messaggio generico ma utile
  return {
    message: 'C\'Ã¨ un problema con i dati inseriti. Puoi verificare e riprovare?',
    actionable: true,
    severity: 'warning',
  };
}

/**
 * Traduce errori di sistema in messaggi umani
 */
function translateSystemError(error: string, fallbackReason?: string): HumanMessage {
  // Log tecnico (solo in telemetria, non mostrato all'utente)
  const technicalError = fallbackReason 
    ? `System error: ${error}, fallbackReason: ${fallbackReason}`
    : `System error: ${error}`;
  
  // Log in telemetria (admin only)
  console.error('[TELEMETRY]', JSON.stringify({
    event: 'systemErrorTranslated',
    error_technical: technicalError,
    fallback_reason: fallbackReason || null,
  }));
  
  // Messaggi utente-friendly
  if (fallbackReason === 'graph_error') {
    return {
      message: 'Ho avuto un problema tecnico nel calcolo. Riprova tra un attimo.',
      actionable: false,
      severity: 'error',
    };
  }
  
  if (fallbackReason === 'intent_error') {
    return {
      message: 'Non ho capito bene la richiesta. Puoi riformularla in modo piÃ¹ chiaro?',
      actionable: true,
      severity: 'info',
    };
  }
  
  if (fallbackReason === 'non_pricing') {
    return {
      message: 'Per questa richiesta uso un sistema diverso. Un attimo...',
      actionable: false,
      severity: 'info',
    };
  }
  
  // Default: messaggio generico ma rassicurante
  return {
    message: 'Ho avuto un problema tecnico. Riprova tra un attimo.',
    actionable: false,
    severity: 'error',
  };
}

/**
 * Traduce errori di preflight (booking) in messaggi umani
 */
function translatePreflightError(errors: string[]): HumanMessage {
  if (errors.length === 0) {
    return {
      message: 'Tutto a posto! Puoi procedere.',
      actionable: false,
      severity: 'info',
    };
  }
  
  // Analizza errori preflight
  const missingFields = errors.map(e => {
    const eLower = e.toLowerCase();
    if (eLower.includes('peso')) return 'peso';
    if (eLower.includes('cap')) return 'CAP';
    if (eLower.includes('provincia')) return 'provincia';
    if (eLower.includes('indirizzo')) return 'indirizzo';
    return null;
  }).filter(Boolean) as string[];
  
  if (missingFields.length > 0) {
    return {
      message: `Per procedere con la prenotazione, ho bisogno di: ${missingFields.join(', ')}.`,
      actionable: true,
      severity: 'warning',
    };
  }
  
  return {
    message: 'Ci sono alcuni dati mancanti per completare la prenotazione. Controlla i campi obbligatori.',
    actionable: true,
    severity: 'warning',
  };
}

/**
 * Traduce confidence score basso in messaggio umano
 */
function translateLowConfidence(confidenceScore: number): HumanMessage {
  if (confidenceScore >= 70) {
    return {
      message: 'I dati sembrano corretti. Vuoi procedere?',
      actionable: true,
      severity: 'info',
    };
  }
  
  if (confidenceScore >= 50) {
    return {
      message: 'I dati non sono completamente chiari. Puoi riformulare o aggiungere dettagli?',
      actionable: true,
      severity: 'warning',
    };
  }
  
  return {
    message: 'I dati non sono chiari. Puoi riformulare la richiesta in modo piÃ¹ specifico?',
    actionable: true,
    severity: 'warning',
  };
}

// ====== FUNZIONE PRINCIPALE ======

/**
 * Traduce errori tecnici in messaggi umani comprensibili
 * 
 * @param state - AgentState con errori da tradurre
 * @param logger - Logger per telemetria
 * @returns Messaggio umano o null se non ci sono errori
 */
export function translateError(
  state: AgentState,
  logger: ILogger = defaultLogger
): HumanMessage | null {
  try {
    // 1. PrioritÃ : errori di validazione
    if (state.validationErrors && state.validationErrors.length > 0) {
      const firstError = state.validationErrors[0];
      
      // Estrai campo se presente (es. "destinationZip: required")
      const fieldMatch = firstError.match(/(\w+):/);
      const field = fieldMatch ? fieldMatch[1] : undefined;
      
      return translateValidationError(firstError, field);
    }
    
    // 2. Confidence score basso
    if (state.confidenceScore !== undefined && state.confidenceScore < 50) {
      return translateLowConfidence(state.confidenceScore);
    }
    
    // 3. Processing status error
    if (state.processingStatus === 'error') {
      // Cerca fallbackReason in telemetria (se disponibile)
      // Per ora usiamo un messaggio generico
      return {
        message: 'Si Ã¨ verificato un errore. Riprova o contatta il supporto se il problema persiste.',
        actionable: true,
        severity: 'error',
      };
    }
    
    // 4. Booking result con errori
    if (state.booking_result?.status === 'failed') {
      const errorCode = state.booking_result.error_code;
      
      if (errorCode === 'INSUFFICIENT_CREDIT') {
        return {
          message: 'Il saldo del wallet non Ã¨ sufficiente per questa spedizione. Vuoi ricaricare?',
          actionable: true,
          severity: 'error',
        };
      }
      
      if (errorCode === 'PREFLIGHT_FAILED') {
        return {
          message: 'Ci sono dati mancanti per completare la prenotazione. Controlla i campi obbligatori.',
          actionable: true,
          severity: 'warning',
        };
      }
      
      return {
        message: state.booking_result.user_message || 'La prenotazione non Ã¨ andata a buon fine. Riprova.',
        actionable: true,
        severity: 'error',
      };
    }
    
    // Nessun errore da tradurre
    return null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('âŒ [Error Translator] Errore nella traduzione:', errorMessage);
    
    // Fallback: messaggio generico
    return {
      message: 'Si Ã¨ verificato un problema. Riprova piÃ¹ tardi.',
      actionable: false,
      severity: 'error',
    };
  }
}

/**
 * Traduce un errore specifico (per uso diretto)
 */
export function translateSpecificError(
  error: AgentError,
  logger: ILogger = defaultLogger
): HumanMessage {
  try {
    switch (error.type) {
      case 'validation':
        return translateValidationError(error.technical, error.field);
      
      case 'system':
        return translateSystemError(error.technical, error.fallbackReason);
      
      case 'preflight':
        return translatePreflightError([error.technical]);
      
      case 'confidence':
        return translateLowConfidence(error.confidenceScore || 0);
      
      case 'fallback':
        return translateSystemError(error.technical, error.fallbackReason);
      
      default:
        return {
          message: 'Si Ã¨ verificato un problema. Riprova piÃ¹ tardi.',
          actionable: false,
          severity: 'error',
        };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('âŒ [Error Translator] Errore nella traduzione specifica:', errorMessage);
    
    return {
      message: 'Si Ã¨ verificato un problema. Riprova piÃ¹ tardi.',
      actionable: false,
      severity: 'error',
    };
  }
}