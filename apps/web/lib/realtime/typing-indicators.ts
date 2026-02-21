/**
 * Typing Indicators - Supabase Realtime Broadcast
 *
 * Emette eventi "typing" dal server verso il client via Supabase Broadcast.
 * Usa il piano Free di Supabase (Broadcast non richiede upgrade).
 * Zero DB writes - solo canali in-memory.
 *
 * SICUREZZA: Il nome canale include un nonce random generato dal client.
 * Solo chi conosce il nonce puo' ricevere gli eventi (non basta conoscere userId).
 * Il nonce viene passato nel body della request e usato server-side.
 *
 * ARCHITETTURA: Un TypingChannel per request.
 * - createTypingChannel() all'inizio della request
 * - channel.emit() per ogni stato intermedio
 * - channel.done() alla fine (cleanup canale)
 */

import { supabaseAdmin } from '@/lib/db/client';

export type TypingStatus = 'thinking' | 'working' | 'done';

export interface TypingEvent {
  status: TypingStatus;
  message: string;
  /** Worker attivo (opzionale) */
  worker?: string;
  timestamp: number;
}

/**
 * Genera nome canale con nonce per sicurezza.
 * Il nonce e' generato dal client e condiviso via request body.
 */
export function getTypingChannelName(userId: string, nonce: string): string {
  return `anne-typing-${userId}-${nonce}`;
}

/**
 * Genera un nonce random (client-side).
 * Usa crypto.randomUUID se disponibile, altrimenti fallback.
 */
export function generateTypingNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback per ambienti senza crypto.randomUUID
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Canale typing persistente per tutta la durata di una request.
 * Creato una volta, riutilizzato per tutti gli eventi, cleanup alla fine.
 */
export class TypingChannel {
  private channel: ReturnType<typeof supabaseAdmin.channel>;
  private subscribed = false;

  constructor(userId: string, nonce: string) {
    const channelName = getTypingChannelName(userId, nonce);
    this.channel = supabaseAdmin.channel(channelName);
  }

  /** Sottoscrive il canale (necessario prima di inviare) */
  async subscribe(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            this.subscribed = true;
            resolve();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            reject(new Error(`Channel subscribe failed: ${status}`));
          }
        });
        // Timeout safety: max 500ms di attesa, poi procedi comunque
        setTimeout(() => {
          this.subscribed = true;
          resolve();
        }, 500);
      });
    } catch {
      console.warn('[TypingChannel] Subscribe failed, events will be skipped');
    }
  }

  /** Emette un evento typing. Fire-and-forget. */
  async emit(status: TypingStatus, message: string, worker?: string): Promise<void> {
    if (!this.subscribed) return;
    try {
      const payload: TypingEvent = { status, message, worker, timestamp: Date.now() };
      await this.channel.send({ type: 'broadcast', event: 'typing', payload });
    } catch {
      // Fire-and-forget
    }
  }

  /** Emette "done" e rimuove il canale. */
  async done(): Promise<void> {
    await this.emit('done', '');
    try {
      await supabaseAdmin.removeChannel(this.channel);
    } catch {
      // Cleanup best-effort
    }
    this.subscribed = false;
  }
}

/**
 * Crea un canale typing per una request.
 * @param userId - ID utente
 * @param nonce - Nonce random dal client (per sicurezza canale)
 */
export async function createTypingChannel(userId: string, nonce: string): Promise<TypingChannel> {
  const ch = new TypingChannel(userId, nonce);
  await ch.subscribe();
  return ch;
}
