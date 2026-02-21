/**
 * @deprecated Usare le catene lineari in lib/agent/chains. run-flow non invoca più runIntermediary.
 * Figura di intramezzo tra Supervisor e le azioni specifiche.
 * - Risolve il flowId macro in un flowId specifico (Ollama).
 * - Invoca il flusso specifico.
 * - Gestisce fallback in caso di validazione fallita o richieste di approvazione.
 */

import { chatWithOllama } from '@/lib/ai/ollama';
import type { FlowId } from './supervisor';
import {
  getSpecificFlowIdsForMacro,
  isSpecificFlowId,
  type SpecificFlowId,
} from './specific-flows';
import { runSpecificFlow } from './flows/run-specific-flow';
import type { FlowResult } from './flows/types';
import type { RunFlowInput } from './flows/run-flow';
import { defaultLogger } from './logger';

function buildPromptForMacro(macro: FlowId): string {
  const specifics = getSpecificFlowIdsForMacro(macro);
  if (specifics.length === 0) return '';

  const list = specifics.map((s) => s.replace(macro + '_', '')).join(', ');
  return `Sei un classificatore. Assegna il messaggio dell'utente a una sola azione specifica della categoria "${macro}".

Azioni ammesse (rispondi SOLO con la parola chiave, nulla altro):
${specifics.map((s) => `- ${s}`).join('\n')}

Rispondi con una sola parola: l'azione scelta (es. ${specifics[0]}). Nessun altro testo.`;
}

function parseSpecificFromResponse(content: string, macro: FlowId): SpecificFlowId {
  const raw = content.trim().toLowerCase().replace(/[\s.]/g, '');
  const candidates = getSpecificFlowIdsForMacro(macro);
  if (candidates.length === 0) return macro as unknown as SpecificFlowId;
  for (const c of candidates) {
    if (raw === c.replace(/_/g, '')) return c;
    if (raw === c) return c;
    if (raw.includes(c.replace(/_/g, ''))) return c;
  }
  const match = content.match(
    new RegExp(`\\b(${candidates.join('|').replace(/_/g, '_')})\\b`, 'i')
  );
  if (match && isSpecificFlowId(match[1])) return match[1];
  return candidates[0];
}

export interface IntermediaryInput extends RunFlowInput {}

export interface IntermediaryResult extends FlowResult {
  specificFlowId: SpecificFlowId;
}

/**
 * Risolve il flowId specifico a partire dal macro e dal messaggio (Ollama).
 */
export async function resolveSpecificFlowId(
  macro: FlowId,
  message: string
): Promise<SpecificFlowId> {
  const prompt = buildPromptForMacro(macro);
  if (!prompt) return macro as unknown as SpecificFlowId;

  try {
    const response = await chatWithOllama({
      messages: [{ role: 'user', content: message }],
      system: prompt,
      temperature: 0,
      maxTokens: 64,
    });
    return parseSpecificFromResponse(response.content || '', macro);
  } catch (err) {
    console.error('[Intermediary] Errore risoluzione specifica, uso primo specifico:', err);
    const candidates = getSpecificFlowIdsForMacro(macro);
    return candidates[0];
  }
}

/**
 * Esegue il flusso tramite Intermediary: risolve specifico -> runSpecificFlow -> gestisce approval/validation.
 */
export async function runIntermediary(
  macro: FlowId,
  input: IntermediaryInput
): Promise<IntermediaryResult> {
  const specificFlowId = await resolveSpecificFlowId(macro, input.message);
  defaultLogger.log(`[Intermediary] Macro: ${macro} -> specifico: ${specificFlowId}`);

  let result: FlowResult;
  try {
    result = await runSpecificFlow(specificFlowId, input);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[Intermediary] Errore flusso specifico:', errMsg);
    return {
      message: `Si è verificato un problema nell'elaborazione della richiesta. Puoi riformulare o riprovare. (${specificFlowId})`,
      specificFlowId,
      validationFailed: errMsg,
    };
  }

  if (result.validationFailed) {
    return {
      ...result,
      message:
        result.message ||
        'La richiesta non è stata validata. Puoi fornire più dettagli o riprovare.',
      specificFlowId,
    };
  }

  if (result.needsApproval) {
    return {
      ...result,
      message: result.needsApproval,
      specificFlowId,
    };
  }

  return {
    ...result,
    specificFlowId,
  };
}
