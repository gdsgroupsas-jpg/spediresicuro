/**
 * LangGraph Checkpointer - State Persistence
 * 
 * Implementa MemorySaver pattern per persistenza stato conversazioni multi-turn.
 * Salva AgentState completo in agent_sessions table usando AgentSessionService.
 * 
 * P3 Task 1: State Persistence per conversazioni lunghe
 * 
 * NOTE: LangGraph 1.0.4 usa MemorySaver come base. Questo checkpointer
 * implementa l'interfaccia compatibile con LangGraph compile({ checkpointer }).
 */

import { MemorySaver } from '@langchain/langgraph';
import { RunnableConfig } from '@langchain/core/runnables';
import { agentSessionService } from '@/lib/services/agent-session';
import { AgentState } from './state';

/**
 * Supabase Checkpointer per LangGraph.
 * Estende MemorySaver e salva/recupera stato da agent_sessions.
 * 
 * Usa MemorySaver come base per compatibilità API LangGraph.
 */
export class SupabaseCheckpointer extends MemorySaver {
  /**
   * Override get() per recuperare da Supabase invece di memoria.
   */
  async get(config: RunnableConfig): Promise<Record<string, unknown> | null> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const userId = config.configurable?.user_id as string | undefined;

    if (!threadId || !userId) {
      // Fallback a MemorySaver se mancano parametri
      return super.get(config);
    }

    // Recupera stato da service (usa cache se disponibile)
    const state = await agentSessionService.getSession(userId, threadId);
    
    if (!state) {
      return null;
    }

    // Restituisce state come Record (compatibile con LangGraph)
    return state as unknown as Record<string, unknown>;
  }

  /**
   * Override put() per salvare in Supabase invece di memoria.
   */
  async put(
    config: RunnableConfig,
    checkpoint: Record<string, unknown>
  ): Promise<void> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const userId = config.configurable?.user_id as string | undefined;

    if (!threadId || !userId) {
      // Fallback a MemorySaver se mancano parametri
      await super.put(config, checkpoint);
      return;
    }

    // Converte checkpoint in AgentState
    const state = checkpoint as unknown as AgentState;

    // Salva tramite service (aggiorna cache automaticamente)
    await agentSessionService.updateSession(userId, threadId, state);
  }
}

/**
 * Factory per creare checkpointer con configurazione.
 */
export function createCheckpointer(): SupabaseCheckpointer {
  return new SupabaseCheckpointer();
}

