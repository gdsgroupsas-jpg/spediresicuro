/**
 * useQuoteRequest Hook - Enterprise-Grade Quote Request Management
 * 
 * Gestisce richieste quote con:
 * - Debounce automatico
 * - Request queue (limita chiamate simultanee)
 * - Retry logic
 * - Loading states
 * - Error handling
 */

import { useState, useCallback, useRef } from 'react';

export interface QuoteRequestParams {
  courier: string;
  contractCode?: string;
  weight: number;
  zip?: string;
  province?: string;
  services?: string[];
  insuranceValue?: number;
  codValue?: number;
}

export interface QuoteResult {
  success: boolean;
  rates?: any[];
  error?: string;
  cached?: boolean;
  cacheAge?: number;
}

interface UseQuoteRequestOptions {
  debounceMs?: number;
  maxConcurrent?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

interface PendingRequest {
  params: QuoteRequestParams;
  resolve: (result: QuoteResult) => void;
  reject: (error: Error) => void;
}

export function useQuoteRequest(options: UseQuoteRequestOptions = {}) {
  const {
    debounceMs = 500,
    maxConcurrent = 3,
    retryAttempts = 2,
    retryDelay = 1000,
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<QuoteResult | null>(null);

  const queueRef = useRef<PendingRequest[]>([]);
  const activeRequestsRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingParamsRef = useRef<QuoteRequestParams | null>(null);

  /**
   * Esegue una richiesta quote
   */
  const executeRequest = useCallback(
    async (params: QuoteRequestParams): Promise<QuoteResult> => {
      try {
        setLoading(true);
        setError(null);

        // ✨ ENTERPRISE: Chiama endpoint real-time con cache Redis
        const response = await fetch('/api/quotes/realtime', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            weight: params.weight,
            zip: params.zip,
            province: params.province,
            courier: params.courier,
            contractCode: params.contractCode,
            services: params.services || [],
            insuranceValue: params.insuranceValue || 0,
            codValue: params.codValue || 0,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        
        const result: QuoteResult = {
          success: true,
          rates: data.rates || [], // Endpoint real-time restituisce 'rates', non 'contracts'
          cached: data.details?.cached || false,
          cacheAge: data.details?.cacheAge,
        };

        setLastResult(result);
        return result;
      } catch (err: any) {
        const errorMessage = err.message || 'Errore durante il recupero del preventivo';
        setError(errorMessage);
        
        const result: QuoteResult = {
          success: false,
          error: errorMessage,
        };

        setLastResult(result);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Processa la coda di richieste
   */
  const processQueue = useCallback(async () => {
    while (
      queueRef.current.length > 0 &&
      activeRequestsRef.current < maxConcurrent
    ) {
      const request = queueRef.current.shift();
      if (!request) break;

      activeRequestsRef.current++;

      executeRequest(request.params)
        .then((result) => {
          request.resolve(result);
        })
        .catch((error) => {
          request.reject(error);
        })
        .finally(() => {
          activeRequestsRef.current--;
          // Processa prossima richiesta in coda
          processQueue();
        });
    }
  }, [executeRequest, maxConcurrent]);

  /**
   * Richiedi quote con debounce e queue
   */
  const requestQuote = useCallback(
    (params: QuoteRequestParams): Promise<QuoteResult> => {
      return new Promise((resolve, reject) => {
        // Salva parametri per debounce
        pendingParamsRef.current = params;

        // Cancella debounce precedente
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }

        // Debounce: aspetta prima di eseguire
        debounceTimeoutRef.current = setTimeout(() => {
          const finalParams = pendingParamsRef.current;
          if (!finalParams) {
            reject(new Error('Parametri non disponibili'));
            return;
          }

          // Aggiungi alla coda
          queueRef.current.push({
            params: finalParams,
            resolve,
            reject,
          });

          // Processa coda
          processQueue();
        }, debounceMs);
      });
    },
    [debounceMs, processQueue]
  );

  /**
   * Cancella richieste pendenti
   */
  const cancelPending = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    queueRef.current = [];
    pendingParamsRef.current = null;
  }, []);

  return {
    requestQuote,
    loading,
    error,
    lastResult,
    cancelPending,
  };
}
