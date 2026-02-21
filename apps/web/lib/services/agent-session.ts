/**
 * AgentSession Service
 *
 * Service layer per gestione agent_sessions (astrazione da Supabase).
 * Fornisce cache in-memory per sessioni attive (TTL 5 minuti).
 *
 * P3 Task 3: Abstraction Layer per checkpointer
 */

import { supabaseAdmin } from '@/lib/db/client';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

// ==================== TIPI ====================

export interface AgentSession {
  id: string;
  user_id: string;
  session_id: string;
  conversation_history: BaseMessage[];
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

interface CachedState {
  state: AgentState;
  expires: number;
}

// ==================== SERIALIZZAZIONE ====================

/**
 * Serializza AgentState in formato JSONB per storage.
 * Converte BaseMessage[] in formato serializzabile usando toJSON() di LangChain.
 */
function serializeAgentState(state: AgentState): Record<string, unknown> {
  // Serializza messages usando toJSON() di LangChain
  const serializedMessages = state.messages.map((msg) => {
    // BaseMessage ha metodo toJSON() che restituisce formato standard
    try {
      return msg.toJSON();
    } catch {
      // Fallback: serializzazione manuale
      return {
        lc: 1,
        lc_kwargs: {
          content: msg.content,
          additional_kwargs: msg.additional_kwargs || {},
        },
        id: msg.id || [],
        getType: () => msg.constructor.name,
      };
    }
  });

  // Crea copia dello state senza messages (saranno salvati in conversation_history)
  const { messages, ...stateWithoutMessages } = state;

  return {
    ...stateWithoutMessages,
    // Messages serializzati per metadata (backup)
    _messages_serialized: serializedMessages,
  };
}

/**
 * Deserializza JSONB in AgentState.
 * Ricostruisce BaseMessage[] da formato serializzato usando fromJSON() di LangChain.
 */
function deserializeAgentState(data: Record<string, unknown>): AgentState {
  // Deserializza messages da formato LangChain
  let messages: BaseMessage[] = [];

  // Prova a deserializzare da _messages_serialized
  if (data._messages_serialized && Array.isArray(data._messages_serialized)) {
    messages = (data._messages_serialized as unknown[]).map((msgJson: any) => {
      try {
        // Verifica formato LangChain
        if (msgJson.lc === 1 && msgJson.lc_kwargs) {
          // Formato LangChain standard - ricostruisci manualmente
          const msgType = msgJson.id?.[0] || 'human';
          const content = msgJson.lc_kwargs?.content || '';
          const additional_kwargs = msgJson.lc_kwargs?.additional_kwargs || {};

          if (msgType === 'ai' || msgType === 'AIMessage') {
            return new AIMessage({
              content,
              additional_kwargs,
            });
          }
          if (msgType === 'system' || msgType === 'SystemMessage') {
            return new SystemMessage({
              content,
              additional_kwargs,
            });
          }

          // Default: HumanMessage
          return new HumanMessage({
            content,
            additional_kwargs,
          });
        }

        // Fallback: crea HumanMessage da content
        return new HumanMessage({
          content: msgJson.content || msgJson.lc_kwargs?.content || '',
          additional_kwargs:
            msgJson.additional_kwargs || msgJson.lc_kwargs?.additional_kwargs || {},
        });
      } catch (error) {
        // Fallback: HumanMessage minimale
        return new HumanMessage({
          content: typeof msgJson === 'string' ? msgJson : JSON.stringify(msgJson),
        });
      }
    });
  }

  // Rimuovi _messages_serialized dal state
  const { _messages_serialized, ...stateWithoutSerialized } = data;

  return {
    ...stateWithoutSerialized,
    messages,
  } as AgentState;
}

// ==================== SERVICE ====================

export class AgentSessionService {
  private cache = new Map<string, CachedState>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuti

  /**
   * Pulisce cache scaduta (chiamare periodicamente o prima di operazioni)
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (cached.expires < now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Genera cache key da userId e sessionId
   */
  private getCacheKey(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`;
  }

  /**
   * Crea una nuova sessione.
   * Se esiste già, aggiorna updated_at.
   */
  async createSession(
    userId: string,
    sessionId: string,
    initialState?: AgentState
  ): Promise<AgentSession> {
    this.cleanExpiredCache();

    const serializedState = initialState ? serializeAgentState(initialState) : {};

    // Usa upsert per creare o aggiornare
    const { data, error } = await supabaseAdmin
      .from('agent_sessions')
      .upsert(
        {
          user_id: userId,
          session_id: sessionId,
          conversation_history: initialState?.messages || [],
          metadata: serializedState,
        },
        {
          onConflict: 'user_id,session_id',
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Errore creazione sessione: ${error.message}`);
    }

    // Aggiorna cache
    if (initialState) {
      const cacheKey = this.getCacheKey(userId, sessionId);
      this.cache.set(cacheKey, {
        state: initialState,
        expires: Date.now() + this.CACHE_TTL_MS,
      });
    }

    return {
      id: data.id,
      user_id: data.user_id,
      session_id: data.session_id,
      conversation_history: (data.conversation_history as BaseMessage[]) || [],
      created_at: data.created_at,
      updated_at: data.updated_at,
      metadata: (data.metadata as Record<string, unknown>) || {},
    };
  }

  /**
   * Recupera sessione (check cache, fallback DB).
   * Restituisce AgentState completo se presente.
   */
  async getSession(userId: string, sessionId: string): Promise<AgentState | null> {
    this.cleanExpiredCache();

    // Check cache
    const cacheKey = this.getCacheKey(userId, sessionId);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.state;
    }

    // Fallback DB - P3 Task 6: Select solo campi necessari
    const { data, error } = await supabaseAdmin
      .from('agent_sessions')
      .select('metadata, conversation_history')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .single();

    if (error || !data) {
      return null;
    }

    // Deserializza AgentState da metadata
    const state = deserializeAgentState(data.metadata as Record<string, unknown>);

    // Aggiorna cache
    this.cache.set(cacheKey, {
      state,
      expires: Date.now() + this.CACHE_TTL_MS,
    });

    return state;
  }

  /**
   * Aggiorna sessione con nuovo AgentState.
   * Invalida cache e salva in DB.
   */
  async updateSession(userId: string, sessionId: string, state: AgentState): Promise<void> {
    this.cleanExpiredCache();

    const serializedState = serializeAgentState(state);

    const { error } = await supabaseAdmin
      .from('agent_sessions')
      .update({
        conversation_history: state.messages,
        metadata: serializedState,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Errore aggiornamento sessione: ${error.message}`);
    }

    // Aggiorna cache
    const cacheKey = this.getCacheKey(userId, sessionId);
    this.cache.set(cacheKey, {
      state,
      expires: Date.now() + this.CACHE_TTL_MS,
    });
  }

  /**
   * Lista sessioni per utente (ordine updated_at DESC).
   */
  async listSessions(userId: string, limit = 10): Promise<AgentSession[]> {
    // P3 Task 6: Select solo campi necessari (ottimizzazione query)
    const { data, error } = await supabaseAdmin
      .from('agent_sessions')
      .select('id, user_id, session_id, conversation_history, created_at, updated_at, metadata')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Errore lista sessioni: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      session_id: row.session_id,
      conversation_history: (row.conversation_history as BaseMessage[]) || [],
      created_at: row.created_at,
      updated_at: row.updated_at,
      metadata: (row.metadata as Record<string, unknown>) || {},
    }));
  }

  /**
   * Elimina sessione (utile per cleanup).
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    this.cleanExpiredCache();

    const { error } = await supabaseAdmin
      .from('agent_sessions')
      .delete()
      .eq('user_id', userId)
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Errore eliminazione sessione: ${error.message}`);
    }

    // Rimuovi da cache
    const cacheKey = this.getCacheKey(userId, sessionId);
    this.cache.delete(cacheKey);
  }
}

// ==================== SINGLETON ====================

/**
 * Istanza singleton del service (riutilizzabile).
 */
export const agentSessionService = new AgentSessionService();
