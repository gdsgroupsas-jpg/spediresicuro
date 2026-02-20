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

import {
  assignPriceListTool,
  clonePriceListTool,
  searchMasterPriceListsTool,
} from '@/lib/agent/tools/price-list-tools';
import { toolRegistry } from '@/lib/agent/tools/registry'; // Usa il registry per compatibilità
import { llmConfig } from '@/lib/config';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { defaultLogger, type ILogger } from '../logger';
import { createGraphLLM } from '../llm-factory';
import { AgentState } from '../orchestrator/state';

/**
 * Price List Manager Worker Node
 */
export async function priceListManagerWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('🏷️ [Price List Worker] Esecuzione...');

  try {
    const llm = createGraphLLM({
      maxOutputTokens: llmConfig.SUPERVISOR_MAX_OUTPUT_TOKENS,
      temperature: 0,
      logger,
    });
    if (!llm) {
      return {
        clarification_request: 'Servizio AI non configurato correttamente (API Key mancante).',
        processingStatus: 'error',
      };
    }

    const lastMessage = state.messages[state.messages.length - 1];
    const messageText = lastMessage && 'content' in lastMessage ? String(lastMessage.content) : '';

    // Convert tool definitions for LangChain
    const context = {
      userId: state.userId,
      userRole: state.agent_context?.user_role || 'user',
      actingContext: state.agent_context?.acting_context,
    };

    // Usa i tool specifici per questo worker
    // NON usiamo toolRegistry.toLangChainTools(context) perché vogliamo SOLO i tool dei listini qui
    // per evitare confusione con altri tool.
    const tools = [
      toolRegistry.toLangChainTool(searchMasterPriceListsTool),
      toolRegistry.toLangChainTool(clonePriceListTool),
      toolRegistry.toLangChainTool(assignPriceListTool),
    ];

    // Bind tools to LLM (ChatOpenAI e ChatGoogleGenerativeAI supportano entrambi bindTools)
    const llmWithTools = llm.bindTools!(tools);

    const systemPrompt = `Sei un assistente specializzato nella gestione dei listini prezzi per SpedireSicuro.
Il tuo compito è aiutare Superadmin e Reseller (autorizzati) a gestire i listini.

Tools disponibili:
- search_master_price_lists: Cerca listini master disponibili.
- clone_price_list: Clona un listino master per creare una versione custom (es. per un reseller).
- assign_price_list: Assegna un listino a un utente specifico.

Regole:
- Se l'utente chiede di creare/clonare un listino, chiedi prima QUALE master usare se non specificato.
- Se l'operazione richiede un utente target (es. assegnazione), chiedi l'ID o nome se non fornito.
- Sii preciso e conferma sempre l'operazione eseguita.

Contesto Utente:
- ID: ${state.userId}
- Ruolo: ${state.agent_context?.user_role || 'N/A'}
`;

    // Invoca LLM
    const messages = [new SystemMessage(systemPrompt), new HumanMessage(messageText)];

    logger.log(`🤖 [Price List Worker] Invoco LLM con ${tools.length} tools...`);
    const result = await llmWithTools.invoke(messages);

    // Controlla se il modello ha deciso di chiamare un tool
    if (result.tool_calls && result.tool_calls.length > 0) {
      logger.log(`🛠️ [Price List Worker] Tool call richiesta: ${result.tool_calls[0].name}`);

      // Esegui i tool (uno per volta per semplicità in questo worker base)
      const toolCall = result.tool_calls[0];
      const selectedTool = [
        searchMasterPriceListsTool,
        clonePriceListTool,
        assignPriceListTool,
      ].find((t) => t.name === toolCall.name);

      let toolOutput = 'Errore: Tool non trovato';

      if (selectedTool) {
        try {
          // Esegui il tool passando il contesto
          toolOutput = await selectedTool.execute(toolCall.args, context);
        } catch (e: any) {
          toolOutput = `Errore esecuzione tool: ${e.message}`;
        }
      }

      // Ritorna il risultato
      return {
        price_list_result: {
          success: !toolOutput.startsWith('Error') && !toolOutput.startsWith('PERMISSION_DENIED'),
          message: toolOutput,
        },
        next_step: 'END', // O potremmo fare un loop se vogliamo multi-step
        // Usiamo clarification_request come output generico per l'utente se non c'è un campo specifico user_message
        clarification_request: toolOutput,
      };
    }

    // Se no tool calls, ritorna la risposta testuale
    return {
      clarification_request: result.content.toString(),
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
