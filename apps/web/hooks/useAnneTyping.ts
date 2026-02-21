/**
 * useAnneTyping - Hook per typing indicators di ANNE
 *
 * Sottoscrive al canale Supabase Broadcast per ricevere
 * eventi di stato in tempo reale dal supervisor router.
 * Piano Free Supabase - zero costo aggiuntivo.
 *
 * SICUREZZA: Ogni request genera un nonce random.
 * Il canale e' `anne-typing-{userId}-{nonce}`.
 * Solo il client che ha generato il nonce puo' ricevere gli eventi.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/db/client';
import {
  getTypingChannelName,
  generateTypingNonce,
  type TypingEvent,
} from '@/lib/realtime/typing-indicators';

export interface AnneTypingState {
  /** true se ANNE sta elaborando */
  isTyping: boolean;
  /** Messaggio contestuale (es. "Calcolo i prezzi...") */
  statusMessage: string;
  /** Worker attivo (opzionale) */
  activeWorker?: string;
}

export interface UseAnneTypingReturn extends AnneTypingState {
  /**
   * Prepara un canale typing per una nuova request.
   * Restituisce il nonce da inviare nel body della request.
   * Chiamare PRIMA di fetch().
   */
  prepareTyping: () => string;
  /** Cleanup: chiude il canale. Chiamare dopo che la request e' completata. */
  stopTyping: () => void;
}

/**
 * Hook per typing indicators di ANNE.
 *
 * Uso nel componente:
 *   const { isTyping, statusMessage, prepareTyping, stopTyping } = useAnneTyping(userId);
 *   // Prima di fetch:
 *   const nonce = prepareTyping();
 *   // Nel body: { ..., typingNonce: nonce }
 *   // Nel finally: stopTyping();
 */
export function useAnneTyping(userId: string | undefined): UseAnneTypingReturn {
  const [state, setState] = useState<AnneTypingState>({
    isTyping: false,
    statusMessage: '',
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetState = useCallback(() => {
    setState({ isTyping: false, statusMessage: '' });
  }, []);

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    resetState();
  }, [resetState]);

  const prepareTyping = useCallback((): string => {
    if (!userId) return '';

    // Cleanup canale precedente se esiste
    stopTyping();

    const nonce = generateTypingNonce();
    const channelName = getTypingChannelName(userId, nonce);

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const event = payload.payload as TypingEvent;

        // Safety timeout: resetta dopo 30s se "done" non arriva
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (event.status === 'done') {
          setState({ isTyping: false, statusMessage: '' });
        } else {
          setState({
            isTyping: true,
            statusMessage: event.message,
            activeWorker: event.worker,
          });
          timeoutRef.current = setTimeout(resetState, 30000);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return nonce;
  }, [userId, stopTyping, resetState]);

  return {
    ...state,
    prepareTyping,
    stopTyping,
  };
}
