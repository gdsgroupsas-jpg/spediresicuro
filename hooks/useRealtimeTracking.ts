/**
 * Hook per Tracking Real-Time di una Singola Spedizione
 *
 * Sottoscrive Supabase Realtime sulla tabella tracking_events
 * filtrata per shipment_id. Quando arriva un nuovo evento via webhook,
 * il callback viene invocato istantaneamente.
 *
 * Pattern: hooks/useRealtimeShipments.ts
 */

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/db/client';
import { vibrateDevice, playBeepSound } from './useRealtimeShipments';

export interface RealtimeTrackingEvent {
  id: string;
  shipment_id: string;
  tracking_number: string;
  event_date: string;
  status: string;
  status_normalized: string;
  location: string | null;
  description: string | null;
  carrier: string | null;
  provider: string | null;
  created_at: string | null;
  fetched_at: string | null;
}

interface UseRealtimeTrackingOptions {
  shipmentId: string;
  onNewEvent?: (event: RealtimeTrackingEvent) => void;
  onStatusChange?: (newStatus: string, previousStatus: string | null) => void;
  enabled?: boolean;
}

interface UseRealtimeTrackingReturn {
  isConnected: boolean;
  lastEvent: RealtimeTrackingEvent | null;
}

export function useRealtimeTracking({
  shipmentId,
  onNewEvent,
  onStatusChange,
  enabled = true,
}: UseRealtimeTrackingOptions): UseRealtimeTrackingReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeTrackingEvent | null>(null);
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !shipmentId) return;

    const channel = supabase
      .channel(`tracking-events-${shipmentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tracking_events',
          filter: `shipment_id=eq.${shipmentId}`,
        },
        (payload) => {
          const event = payload.new as RealtimeTrackingEvent;
          setLastEvent(event);

          // Callback nuovo evento
          if (onNewEvent) {
            onNewEvent(event);
          }

          // Rileva cambio di stato
          const newStatus = event.status_normalized;
          const previousStatus = lastStatusRef.current;

          if (newStatus && newStatus !== previousStatus) {
            lastStatusRef.current = newStatus;

            if (onStatusChange) {
              onStatusChange(newStatus, previousStatus);
            }

            // Feedback aptico e sonoro per stati importanti
            provideHapticFeedback(newStatus);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
        }
      });

    return () => {
      setIsConnected(false);
      supabase.removeChannel(channel);
    };
  }, [shipmentId, onNewEvent, onStatusChange, enabled]);

  return { isConnected, lastEvent };
}

/**
 * Feedback aptico e sonoro differenziato per stato.
 */
function provideHapticFeedback(status: string): void {
  switch (status) {
    case 'delivered':
      // Vibrazione breve di successo + suono positivo
      vibrateDevice([100, 50, 100]);
      playNotificationSound(800, 0.15);
      break;
    case 'in_giacenza':
    case 'exception':
      // Vibrazione lunga di warning
      vibrateDevice([200, 100, 200, 100, 200]);
      playNotificationSound(400, 0.2);
      break;
    case 'out_for_delivery':
      // Vibrazione breve informativa
      vibrateDevice(150);
      playNotificationSound(600, 0.1);
      break;
    default:
      // Nessun feedback per stati minori
      break;
  }
}

/**
 * Suono notifica con frequenza e durata configurabili.
 * Versione migliorata di playBeepSound() con parametri.
 */
function playNotificationSound(frequency: number, duration: number): void {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const audioContext = new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Audio non supportato — silenzioso
  }
}
