/**
 * Hook per Sincronizzazione Real-Time Spedizioni
 * 
 * Ascolta cambiamenti alla tabella shipments e aggiorna automaticamente
 * Permette sincronizzazione multi-dispositivo (mobile → desktop)
 */

import { useEffect, useCallback } from 'react'
import { supabase } from '@/lib/db/client'
import type { Shipment } from '@/types/shipments'

interface UseRealtimeShipmentsOptions {
  userId: string
  onInsert?: (shipment: Shipment) => void
  onUpdate?: (shipment: Shipment) => void
  onDelete?: (shipmentId: string) => void
  enabled?: boolean
}

export function useRealtimeShipments({
  userId,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeShipmentsOptions) {
  useEffect(() => {
    if (!enabled || !userId) return

    // Crea canale Realtime
    const channel = supabase
      .channel(`shipments-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'shipments',
          filter: `user_id=eq.${userId}`, // Solo spedizioni dell'utente
        },
        (payload) => {
          console.log('📦 [Realtime] Nuova spedizione inserita:', payload.new)
          if (onInsert && payload.new) {
            onInsert(payload.new as Shipment)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipments',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('📝 [Realtime] Spedizione aggiornata:', payload.new)
          if (onUpdate && payload.new) {
            onUpdate(payload.new as Shipment)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'shipments',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('🗑️ [Realtime] Spedizione eliminata:', payload.old)
          if (onDelete && payload.old) {
            onDelete((payload.old as any).id)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [Realtime] Connesso al canale shipments')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] Errore canale shipments')
        }
      })

    // Cleanup: rimuovi canale quando componente si smonta
    return () => {
      console.log('🔌 [Realtime] Disconnesso dal canale shipments')
      supabase.removeChannel(channel)
    }
  }, [userId, onInsert, onUpdate, onDelete, enabled])
}

/**
 * Helper per notifica vibrazione su mobile
 */
export function vibrateDevice(pattern: number | number[] = 200) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

/**
 * Helper per suono feedback (beep)
 */
export function playBeepSound() {
  if (typeof window === 'undefined') return
  
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    
    // Crea beep audio
    const audioContext = new AudioContext()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800 // Frequenza beep
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)
  } catch (error) {
    console.warn('Audio non supportato:', error)
  }
}






