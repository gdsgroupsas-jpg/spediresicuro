/**
 * Smart Suggestions Component - P4 Task 4
 * 
 * Mostra suggerimenti proattivi basati su pattern ricorrenti dell'utente.
 * - Salvare destinatario ricorrente
 * - Impostare corriere predefinito
 * - Usare peso standard
 * 
 * Rate limiting: max 1 suggerimento ogni 24h per tipo.
 */

'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, X, Check, ArrowRight } from 'lucide-react';
import { getSmartSuggestion, markSuggestionShown, shouldShowSuggestion, type Suggestion } from '@/lib/agent/smart-suggestions';

interface SmartSuggestionsProps {
  /** ID utente */
  userId: string;
  /** Callback quando suggerimento viene accettato */
  onAccept?: (suggestion: Suggestion) => void;
  /** Callback quando suggerimento viene rifiutato */
  onDismiss?: (suggestion: Suggestion) => void;
}

export function SmartSuggestions({ userId, onAccept, onDismiss }: SmartSuggestionsProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    async function loadSuggestion() {
      if (!userId) return;

      setIsLoading(true);
      try {
        const suggestion = await getSmartSuggestion(userId);
        
        if (suggestion) {
          // Verifica rate limiting (lato client)
          const canShow = shouldShowSuggestion(userId, suggestion.type);
          
          if (canShow) {
            setSuggestion(suggestion);
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.error('Errore caricamento suggerimento:', err);
      } finally {
        setIsLoading(false);
      }
    }

    // Carica suggerimento dopo un delay (non invasivo)
    const timer = setTimeout(loadSuggestion, 2000);
    return () => clearTimeout(timer);
  }, [userId]);

  const handleAccept = () => {
    if (!suggestion) return;

    // Marca come mostrato (rate limiting)
    markSuggestionShown(userId, suggestion.type);
    
    // Callback
    onAccept?.(suggestion);
    
    // Nascondi
    setIsVisible(false);
    setSuggestion(null);
  };

  const handleDismiss = () => {
    if (!suggestion) return;

    // Marca come mostrato (rate limiting) anche se rifiutato
    markSuggestionShown(userId, suggestion.type);
    
    // Callback
    onDismiss?.(suggestion);
    
    // Nascondi
    setIsVisible(false);
    setSuggestion(null);
  };

  if (isLoading || !isVisible || !suggestion) {
    return null;
  }

  return (
    <div
      className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-3 mb-3 animate-in slide-in-from-right-2 duration-300 flex items-start gap-3"
      role="alert"
    >
      <Lightbulb className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-yellow-900 mb-2">
          {suggestion.message}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-md hover:bg-yellow-700 transition-colors"
          >
            <Check className="w-3 h-3" />
            Accetta
          </button>
          <button
            onClick={handleDismiss}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-md hover:bg-yellow-200 transition-colors"
          >
            <X className="w-3 h-3" />
            Ignora
          </button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-yellow-600 opacity-50 hover:opacity-100 transition-opacity"
        aria-label="Chiudi suggerimento"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

