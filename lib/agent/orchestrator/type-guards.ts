/**
 * Type Guards per AgentState
 * 
 * Type guards per migliorare type safety in LangGraph context.
 * Rimuove necessità di `as any` o `unknown` non gestiti.
 * 
 * P3 Task 5: Type Safety Improvements
 */

import { AgentState } from './state';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Type guard per verificare se un valore è AgentState.
 */
export function isAgentState(value: unknown): value is AgentState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Verifica campi obbligatori
  return (
    Array.isArray(obj.messages) &&
    typeof obj.userId === 'string' &&
    typeof obj.userEmail === 'string' &&
    typeof obj.processingStatus === 'string' &&
    Array.isArray(obj.validationErrors) &&
    typeof obj.confidenceScore === 'number' &&
    typeof obj.needsHumanReview === 'boolean'
  );
}

/**
 * Type guard per verificare se un valore è BaseMessage[].
 */
export function isBaseMessageArray(value: unknown): value is BaseMessage[] {
  if (!Array.isArray(value)) {
    return false;
  }

  // Verifica che tutti gli elementi siano BaseMessage
  return value.every(msg => {
    return (
      typeof msg === 'object' &&
      msg !== null &&
      'content' in msg &&
      'getType' in msg
    );
  });
}

/**
 * Type guard per verificare se un valore è Record<string, unknown> (AgentState-like).
 */
export function isAgentStateLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Wrapper type-safe per convertire unknown in AgentState.
 * Lancia errore se il valore non è AgentState valido.
 */
export function assertAgentState(value: unknown): AgentState {
  if (!isAgentState(value)) {
    throw new Error('Valore non è un AgentState valido');
  }
  return value;
}

/**
 * Wrapper type-safe per convertire unknown in AgentState con fallback.
 */
export function toAgentState(value: unknown, fallback: AgentState): AgentState {
  if (isAgentState(value)) {
    return value;
  }
  return fallback;
}

