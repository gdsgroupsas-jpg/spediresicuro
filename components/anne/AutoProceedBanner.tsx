/**
 * Auto-Proceed Banner Component - P4 Task 2
 *
 * Mostra banner quando Anne procede automaticamente (confidence > 85%).
 * Permette annullamento entro finestra di tempo configurabile.
 *
 * ⚠️ CRITICO: Auto-proceed SOLO per operazioni sicure (pricing, address normalization).
 * MAI per booking, wallet, LDV, giacenze (sempre richiedono conferma umana).
 */

'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, X, AlertCircle } from 'lucide-react';

interface AutoProceedBannerProps {
  /** Messaggio da mostrare */
  message: string;
  /** Finestra di annullamento in millisecondi */
  cancellationWindowMs?: number;
  /** Callback quando utente annulla */
  onCancel: () => void;
  /** Callback quando auto-proceed completa */
  onComplete?: () => void;
  /** Tipo di operazione (per logging) */
  operationType?: 'pricing' | 'address' | 'other';
}

export function AutoProceedBanner({
  message,
  cancellationWindowMs = 5000,
  onCancel,
  onComplete,
  operationType = 'other',
}: AutoProceedBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState(cancellationWindowMs);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (isCancelled || isComplete) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 100;
        if (newTime <= 0) {
          // Auto-proceed completato
          setIsComplete(true);
          onComplete?.();
          return 0;
        }
        return newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isCancelled, isComplete, onComplete]);

  const handleCancel = () => {
    setIsCancelled(true);
    onCancel();
  };

  if (isCancelled) {
    return null; // Non mostrare se annullato
  }

  if (isComplete) {
    // Mostra conferma per 2 secondi poi nascondi
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
        <p className="text-sm font-medium text-green-900 flex-1">{message}</p>
      </div>
    );
  }

  const secondsRemaining = Math.ceil(timeRemaining / 1000);

  return (
    <div
      className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 flex items-start gap-2 animate-in slide-in-from-top-2 duration-300"
      role="alert"
    >
      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-blue-900 mb-1">{message}</p>
        <p className="text-xs text-blue-700 mb-2">Annullabile entro {secondsRemaining} secondi</p>
        <button
          onClick={handleCancel}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-md hover:bg-blue-200 transition-colors"
        >
          <X className="w-3 h-3" />
          Annulla
        </button>
      </div>
    </div>
  );
}
