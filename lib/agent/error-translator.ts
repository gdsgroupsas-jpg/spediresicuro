/**
 * Error Translator - P4 Task 3
 */

import { AgentState } from './orchestrator/state';
import { defaultLogger, type ILogger } from './logger';

export interface HumanMessage {
  message: string;
  actionable: boolean;
  field?: string;
  severity?: 'info' | 'warning' | 'error';
}

export interface AgentError {
  type: 'validation' | 'system' | 'preflight' | 'confidence' | 'fallback';
  field?: string;
  technical: string;
  fallbackReason?: string;
  confidenceScore?: number;
}

function translateValidationError(error: string, field?: string): HumanMessage {
  const errorLower = error.toLowerCase();
  
  if (field) {
    const fieldMap: Record<string, HumanMessage> = {
      'destinationZip': { message: 'Manca il CAP di destinazione. Puoi indicarlo?', actionable: true, field: 'destinationZip', severity: 'warning' },
      'weight': { message: 'Per procedere, ho bisogno del peso del pacco (in kg).', actionable: true, field: 'weight', severity: 'warning' },
    };
    if (fieldMap[field]) return fieldMap[field];
  }
  
  if (errorLower.includes('cap') || errorLower.includes('zip')) {
    return { message: 'Il CAP deve essere un numero di 5 cifre valido.', actionable: true, severity: 'warning' };
  }
  if (errorLower.includes('peso') || errorLower.includes('weight')) {
    return { message: 'Il peso deve essere un numero positivo.', actionable: true, severity: 'warning' };
  }
  return { message: 'C\'e un problema con i dati inseriti.', actionable: true, severity: 'warning' };
}

function translateSystemError(error: string, fallbackReason?: string): HumanMessage {
  if (fallbackReason === 'graph_error') {
    return { message: 'Ho avuto un problema tecnico nel calcolo. Riprova tra un attimo.', actionable: false, severity: 'error' };
  }
  return { message: 'Ho avuto un problema tecnico. Riprova tra un attimo.', actionable: false, severity: 'error' };
}

function translatePreflightError(errors: string[]): HumanMessage {
  if (errors.length === 0) {
    return { message: 'Tutto a posto! Puoi procedere.', actionable: false, severity: 'info' };
  }
  return { message: 'Ci sono dati mancanti per completare la prenotazione.', actionable: true, severity: 'warning' };
}

function translateLowConfidence(confidenceScore: number): HumanMessage {
  if (confidenceScore >= 70) {
    return { message: 'I dati sembrano corretti. Vuoi procedere?', actionable: true, severity: 'info' };
  }
  if (confidenceScore >= 50) {
    return { message: 'I dati non sono completamente chiari.', actionable: true, severity: 'warning' };
  }
  return { message: 'I dati non sono chiari. Puoi riformulare la richiesta in modo piu specifico?', actionable: true, severity: 'warning' };
}

export function translateError(state: AgentState, logger: ILogger = defaultLogger): HumanMessage | null {
  try {
    if (state.validationErrors && state.validationErrors.length > 0) {
      const firstError = state.validationErrors[0];
      const fieldMatch = firstError.match(/(\w+):/);
      const field = fieldMatch ? fieldMatch[1] : undefined;
      return translateValidationError(firstError, field);
    }
    
    if (state.booking_result?.status === 'failed') {
      const errorCode = state.booking_result.error_code;
      if (errorCode === 'INSUFFICIENT_CREDIT') {
        return { message: 'Il saldo del wallet non e sufficiente per questa spedizione. Vuoi ricaricare?', actionable: true, severity: 'error' };
      }
      if (errorCode === 'PREFLIGHT_FAILED') {
        return { message: 'Ci sono dati mancanti per completare la prenotazione.', actionable: true, severity: 'warning' };
      }
      return { message: state.booking_result.user_message || 'La prenotazione non e andata a buon fine.', actionable: true, severity: 'error' };
    }
    
    if (state.confidenceScore !== undefined && state.confidenceScore < 50) {
      return translateLowConfidence(state.confidenceScore);
    }
    
    if (state.processingStatus === 'error') {
      return { message: 'Si e verificato un errore. Riprova.', actionable: true, severity: 'error' };
    }
    
    return null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Error Translator] Errore:', errorMessage);
    return { message: 'Si e verificato un problema.', actionable: false, severity: 'error' };
  }
}

export function translateSpecificError(error: AgentError, logger: ILogger = defaultLogger): HumanMessage {
  try {
    switch (error.type) {
      case 'validation': return translateValidationError(error.technical, error.field);
      case 'system': return translateSystemError(error.technical, error.fallbackReason);
      case 'preflight': return translatePreflightError([error.technical]);
      case 'confidence': return translateLowConfidence(error.confidenceScore || 0);
      case 'fallback': return translateSystemError(error.technical, error.fallbackReason);
      default: return { message: 'Si e verificato un problema.', actionable: false, severity: 'error' };
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('[Error Translator] Errore:', errorMessage);
    return { message: 'Si e verificato un problema.', actionable: false, severity: 'error' };
  }
}