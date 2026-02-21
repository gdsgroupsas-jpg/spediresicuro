/**
 * Price List Manager Worker
 *
 * Worker specializzato per gestione listini prezzi:
 * - Clonazione listini master
 * - Assegnazione a utenti
 * - Ricerca listini master
 *
 * Usa i tool definiti in lib/agent/tools/price-list-tools.ts
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getOllamaLLM } from '@/lib/ai/ollama';
import { defaultLogger, type ILogger } from '../logger';
import { AgentState } from '../orchestrator/state';

/**
 * Price List Manager Worker Node
 * @param specificFlowId - Azione specifica (es. listini_visualizza, listini_clona) quando invocato da runSpecificFlowChain
 */
export async function priceListManagerWorker(
  state: AgentState,
  logger: ILogger = defaultLogger,
  specificFlowId?: string
): Promise<Partial<AgentState>> {
  logger.log('🏷️ [Price List Worker] Esecuzione...');

  try {
    const llm = getOllamaLLM();
    if (!llm) {
      return {
        clarification_request: 'Modello locale (Ollama) non disponibile. Avvia Ollama e riprova.',
        processingStatus: 'error',
      };
    }

    const lastMessage = state.messages[state.messages.length - 1];
    const messageText = lastMessage && 'content' in lastMessage ? String(lastMessage.content) : '';

    const systemPrompt = `Sei un assistente specializzato nella gestione dei listini prezzi per SpedireSicuro.
Aiuta Superadmin e Reseller (autorizzati) con: ricerca listini master, clonazione listini, assegnazione a utenti.
Contesto: userId=${state.userId}, ruolo=${state.agent_context?.user_role || 'N/A'}.
Rispondi in modo conciso e operativo.`;

    const messages = [new SystemMessage(systemPrompt), new HumanMessage(messageText)];

    logger.log('🤖 [Price List Worker] Invoco Ollama...');
    const result = await llm.invoke(messages);

    const content = result?.content;
    const text = typeof content === 'string' ? content : (content && String(content)) || '';
    return {
      clarification_request: text,
      next_step: 'END',
    };
  } catch (error: any) {
    logger.error('❌ [Price List Worker] Errore:', error);
    return {
      clarification_request: `Errore durante l'operazione sui listini: ${error.message}`,
      processingStatus: 'error',
    };
  }
}

/**
 * Detect Price List Intent
 */
export function detectPriceListIntent(message: string): boolean {
  const patterns = [
    /listin[oi]/i,
    /prezzi/i,
    /clona/i,
    /assegna/i,
    /crea.*listino/i,
    /nuovo.*listino/i,
  ];

  // Escludi "calcola preventivo" o "prezzo spedizione" che sono pricing intent
  if (/preventivo|costo.*spedizione|quanto.*costa/i.test(message)) return false;

  return patterns.some((p) => p.test(message));
}
