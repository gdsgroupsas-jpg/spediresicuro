/**
 * LangGraph Checkpointer - State Persistence
 *
 * Implementa BaseCheckpointSaver per persistenza stato conversazioni multi-turn.
 * Salva AgentState completo in agent_sessions table usando AgentSessionService.
 *
 * P3 Task 1: State Persistence per conversazioni lunghe
 *
 * NOTE: Implementa BaseCheckpointSaver direttamente per compatibilità con LangGraph API.
 * Il checkpointer è opzionale - se non configurato, il graph funziona senza persistenza.
 */

import {
  BaseCheckpointSaver,
  Checkpoint,
  CheckpointTuple,
  CheckpointListOptions,
  CheckpointMetadata,
  ChannelVersions,
} from '@langchain/langgraph-checkpoint';
import { RunnableConfig } from '@langchain/core/runnables';
import { agentSessionService } from '@/lib/services/agent-session';
import { AgentState } from './state';
import { emptyCheckpoint, copyCheckpoint } from '@langchain/langgraph-checkpoint';

/**
 * Supabase Checkpointer per LangGraph.
 * Implementa BaseCheckpointSaver e salva/recupera stato da agent_sessions.
 */
export class SupabaseCheckpointer extends BaseCheckpointSaver {
  /**
   * Recupera checkpoint da Supabase.
   */
  async get(config: RunnableConfig): Promise<Checkpoint | undefined> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const userId = config.configurable?.user_id as string | undefined;

    if (!threadId || !userId) {
      return undefined;
    }

    // Recupera stato da service (usa cache se disponibile)
    const state = await agentSessionService.getSession(userId, threadId);

    if (!state) {
      return undefined;
    }

    // Converte AgentState in Checkpoint format
    const checkpoint: Checkpoint = {
      v: 1,
      id: threadId,
      ts: new Date().toISOString(),
      channel_values: state as unknown as Record<string, unknown>,
      channel_versions: {},
      versions_seen: {},
    };

    return checkpoint;
  }

  /**
   * Recupera CheckpointTuple (richiesto da BaseCheckpointSaver).
   */
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const checkpoint = await this.get(config);
    if (!checkpoint) {
      return undefined;
    }

    return {
      config,
      checkpoint,
    };
  }

  /**
   * Lista checkpoint per thread.
   */
  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const userId = config.configurable?.user_id as string | undefined;

    if (!threadId || !userId) {
      return;
    }

    // Per ora, restituiamo solo il checkpoint corrente
    // TODO: Implementare lista completa se necessario
    const checkpoint = await this.get(config);
    if (checkpoint) {
      yield {
        config,
        checkpoint,
      };
    }
  }

  /**
   * Salva checkpoint in Supabase.
   */
  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id as string | undefined;
    const userId = config.configurable?.user_id as string | undefined;

    if (!threadId || !userId) {
      throw new Error('thread_id e user_id richiesti per salvare checkpoint');
    }

    // Converte Checkpoint in AgentState
    const state = checkpoint.channel_values as unknown as AgentState;

    // Salva tramite service (aggiorna cache automaticamente)
    await agentSessionService.updateSession(userId, threadId, state);

    return config;
  }

  /**
   * Salva writes intermedi (non implementato per ora).
   */
  async putWrites(config: RunnableConfig, writes: any[], taskId: string): Promise<void> {
    // TODO: Implementare se necessario per writes intermedi
    // Per ora, non necessario per il nostro use case
  }

  /**
   * Elimina thread (cancella tutte le sessioni per un utente).
   */
  async deleteThread(threadId: string): Promise<void> {
    // TODO: Implementare se necessario
    // Per ora, usiamo agentSessionService.deleteSession() se serve
  }
}

/**
 * Factory per creare checkpointer con configurazione.
 */
export function createCheckpointer(): SupabaseCheckpointer {
  return new SupabaseCheckpointer();
}
