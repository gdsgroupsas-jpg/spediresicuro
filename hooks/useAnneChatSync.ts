/**
 * Hook: Anne Chat Sync (Multi-device)
 *
 * Persiste messaggi chat in DB e sincronizza tra dispositivi
 * tramite polling API periodico.
 *
 * Flow:
 * 1. Mount: carica history da API
 * 2. Poll: ogni 30s ricarica history per sync cross-device
 * 3. sendMessage/receiveMessage salvano via API e aggiornano state
 *
 * Phase 4: Multi-device Sessions
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  /** Polling interval in ms (default 30000) */
  pollInterval?: number;
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

function parseMessages(raw: any[]): SyncedMessage[] {
  return raw.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: new Date(m.created_at),
    metadata: m.metadata,
  }));
}

export function useAnneChatSync({
  userId,
  enabled = true,
  pollInterval = 30000,
}: UseAnneChatSyncOptions): UseAnneChatSyncReturn {
  const [messages, setMessages] = useState<SyncedMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Track known message IDs to detect new messages from other devices
  const knownIds = useRef(new Set<string>());
  // Flag to skip polling merge when we just cleared
  const justCleared = useRef(false);

  // ==================== LOAD HISTORY ====================

  const loadHistory = useCallback(async (isInitial: boolean) => {
    try {
      const res = await fetch('/api/ai/chat-messages');
      const data = await res.json();
      if (!data.success) return;

      const loaded = parseMessages(data.messages || []);
      const loadedIds = new Set(loaded.map((m) => m.id));

      if (isInitial) {
        // First load: replace everything
        knownIds.current = loadedIds;
        setMessages(loaded);
      } else {
        // Poll: merge new messages from other devices
        if (justCleared.current) {
          justCleared.current = false;
          return;
        }

        // Check if there are new messages we don't know about
        const hasNew = loaded.some((m) => !knownIds.current.has(m.id));
        // Check if messages were deleted on another device
        const hasDeleted = [...knownIds.current].some(
          (id) => !id.startsWith('temp-') && !loadedIds.has(id)
        );

        if (hasNew || hasDeleted) {
          knownIds.current = loadedIds;
          // Preserve any temp (optimistic) messages not yet confirmed
          setMessages((prev) => {
            const tempMessages = prev.filter((m) => m.id.startsWith('temp-'));
            return [...loaded, ...tempMessages];
          });
        }
      }
    } catch (err) {
      console.error('[ANNE_CHAT_SYNC] Load history failed:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!userId || !enabled) return;

    let cancelled = false;
    setIsLoadingHistory(true);

    loadHistory(true).finally(() => {
      if (!cancelled) setIsLoadingHistory(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, enabled, loadHistory]);

  // ==================== POLLING ====================

  useEffect(() => {
    if (!userId || !enabled || pollInterval <= 0) return;

    const interval = setInterval(() => {
      loadHistory(false);
    }, pollInterval);

    return () => clearInterval(interval);
  }, [userId, enabled, pollInterval, loadHistory]);

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
          knownIds.current.delete(tempId);
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
      }
    },
    [userId]
  );

  // ==================== CLEAR HISTORY ====================

  const clearHistory = useCallback(async () => {
    if (!userId) return;

    justCleared.current = true;
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
