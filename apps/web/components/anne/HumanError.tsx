/**
 * Human Error Component - P4 Task 3
 *
 * Mostra errori tecnici tradotti in messaggi umani comprensibili.
 * Usa error-translator.ts per convertire errori tecnici in messaggi user-friendly.
 */

'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X, CheckCircle } from 'lucide-react';
import { translateError } from '@/lib/agent/error-translator';
import type { AgentState } from '@/lib/agent/orchestrator/state';

interface HumanErrorProps {
  /** AgentState corrente (per analizzare errori) */
  agentState: AgentState | null;
  /** Callback quando errore viene risolto */
  onResolved?: () => void;
  /** Callback quando utente chiude errore */
  onDismiss?: () => void;
}

export function HumanError({ agentState, onResolved, onDismiss }: HumanErrorProps) {
  const [humanMessage, setHumanMessage] = useState<{
    message: string;
    actionable: boolean;
    field?: string;
    severity?: 'info' | 'warning' | 'error';
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!agentState) {
      setIsVisible(false);
      setHumanMessage(null);
      return;
    }

    // Traduci errore tecnico in messaggio umano
    const translated = translateError(agentState);

    if (translated) {
      setHumanMessage(translated);
      setIsVisible(true);
    } else {
      // Nessun errore rilevato
      setIsVisible(false);
      setHumanMessage(null);
    }
  }, [agentState]);

  // Auto-risoluzione se errore non è più presente
  useEffect(() => {
    if (!agentState || !humanMessage) return;

    // Se non ci sono più errori, considera risolto
    const hasErrors =
      (agentState.validationErrors && agentState.validationErrors.length > 0) ||
      agentState.processingStatus === 'error' ||
      agentState.booking_result?.status === 'failed';

    if (!hasErrors && humanMessage) {
      // Errore risolto
      setTimeout(() => {
        setIsVisible(false);
        onResolved?.();
      }, 2000); // Mostra per 2 secondi poi nascondi
    }
  }, [agentState, humanMessage, onResolved]);

  if (!isVisible || !humanMessage) {
    return null;
  }

  const severityColors = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error: 'bg-red-50 border-red-200 text-red-800',
  };

  const severityIcons = {
    info: CheckCircle,
    warning: AlertCircle,
    error: AlertCircle,
  };

  const Icon = severityIcons[humanMessage.severity || 'warning'];
  const colorClass = severityColors[humanMessage.severity || 'warning'];

  return (
    <div
      className={`${colorClass} border rounded-lg p-3 mb-3 flex items-start gap-2 animate-in slide-in-from-top-2 duration-300`}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{humanMessage.message}</p>
        {humanMessage.actionable && humanMessage.field && (
          <p className="text-xs mt-1 opacity-75">Campo: {humanMessage.field}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={() => {
            setIsVisible(false);
            onDismiss();
          }}
          className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Chiudi messaggio"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
