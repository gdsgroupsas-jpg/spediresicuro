/**
 * Hook: Anne Chat Sync (Multi-device)
 *
 * Persiste messaggi chat in DB e sincronizza tra dispositivi
 * tramite Supabase Realtime (postgres_changes su anne_chat_messages).
 *
 * Flow:
 * 1. Mount: carica history da API
 * 2. Subscribe: ascolta INSERT su anne_chat_messages per userId
 * 3. Quando arriva messaggio da altro device → aggiunge a state locale
 * 4. sendMessage/receiveMessage salvano via API e aggiornano state
 *
 * Phase 4: Multi-device Sessions
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/db/client';

export interface SyncedMessage {
  id: string;
  role: 'user' | 'assistant' | 'suggestion';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface UseAnneChatSyncOptions {
  userId: string | undefined;
  enabled?: boolean;
}

interface UseAnneChatSyncReturn {
  messages: SyncedMessage[];
  isLoadingHistory: boolean;
  /** Save a user or assistant message to DB + local state */
  persistMessage: (
    role: 'user' | 'assistant' | 'suggestion',
    content: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  /** Clear all history (new conversation) */
  clearHistory: () => Promise<void>;
}

export function useAnneChatSync({
  userId,
  enabled = true,
}: UseAnneChatSyncOptions): UseAnneChatSyncReturn {
  const [messages, setMessages] = useState<SyncedMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Track message IDs we've already added (prevent duplicates from realtime)
  const knownIds = useRef(new Set<string>());

  // ==================== LOAD HISTORY ====================

  useEffect(() => {
    if (!userId || !enabled) return;

    let cancelled = false;
    setIsLoadingHistory(true);

    fetch('/api/ai/chat-messages')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;

        const loaded: SyncedMessage[] = (data.messages || []).map((m: any) => {
          knownIds.current.add(m.id);
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at),
            metadata: m.metadata,
          };
        });
        setMessages(loaded);
      })
      .catch((err) => {
        console.error('[ANNE_CHAT_SYNC] Load history failed:', err);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  // ==================== REALTIME SUBSCRIPTION ====================

  useEffect(() => {
    if (!userId || !enabled) return;

    const channel = supabase
      .channel(`anne-chat-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'anne_chat_messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (!newMsg?.id) return;

          // Skip if we already know this message (we sent it from this device)
          if (knownIds.current.has(newMsg.id)) return;

          knownIds.current.add(newMsg.id);
          setMessages((prev) => [
            ...prev,
            {
              id: newMsg.id,
              role: newMsg.role,
              content: newMsg.content,
              timestamp: new Date(newMsg.created_at),
              metadata: newMsg.metadata,
            },
          ]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'anne_chat_messages',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // History cleared from another device
          knownIds.current.clear();
          setMessages([]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled]);

  // ==================== PERSIST MESSAGE ====================

  const persistMessage = useCallback(
    async (
      role: 'user' | 'assistant' | 'suggestion',
      content: string,
      metadata?: Record<string, unknown>
    ) => {
      if (!userId) return;

      // Optimistic: add to local state immediately
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimisticMsg: SyncedMessage = {
        id: tempId,
        role,
        content,
        timestamp: new Date(),
        metadata,
      };

      knownIds.current.add(tempId);
      setMessages((prev) => [...prev, optimisticMsg]);

      // Save to DB via API
      try {
        const res = await fetch('/api/ai/chat-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, content, metadata }),
        });

        const data = await res.json();

        if (data.success && data.message?.id) {
          // Replace temp ID with real ID
          knownIds.current.add(data.message.id);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? { ...m, id: data.message.id, timestamp: new Date(data.message.created_at) }
                : m
            )
          );
        }
      } catch (err) {
        console.error('[ANNE_CHAT_SYNC] Persist message failed:', err);
        // Keep optimistic message in UI (best effort)
      }
    },
    [userId]
  );

  // ==================== CLEAR HISTORY ====================

  const clearHistory = useCallback(async () => {
    if (!userId) return;

    knownIds.current.clear();
    setMessages([]);

    try {
      await fetch('/api/ai/chat-messages', { method: 'DELETE' });
    } catch (err) {
      console.error('[ANNE_CHAT_SYNC] Clear history failed:', err);
    }
  }, [userId]);

  return { messages, isLoadingHistory, persistMessage, clearHistory };
}
