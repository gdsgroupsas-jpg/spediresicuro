'use client';

import { useCallback, useRef, useState } from 'react';
import type { ErrorData, ErrorAction } from '@/components/feedback';

/**
 * Stato operazione (4-state machine)
 *
 * IDLE → LOADING → SUCCESS | ERROR
 *
 * Design specs (ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md):
 * - 4 explicit states
 * - Form locked during LOADING
 * - Button disabled during LOADING
 * - No re-submit possible
 */
export type OperationState = 'idle' | 'loading' | 'success' | 'error';

export interface OperationData<T = unknown> {
  /** Dati restituiti dall'operazione (solo in success) */
  data: T | null;
  /** Errore strutturato (solo in error) */
  error: ErrorData | null;
  /** Azioni di recovery disponibili (solo in error) */
  errorActions: ErrorAction[];
}

export interface UseOperationStateOptions<T = unknown> {
  /** Stato iniziale (default: idle) */
  initialState?: OperationState;
  /** Dati iniziali */
  initialData?: T | null;
  /** Callback on success */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: ErrorData) => void;
  /** Timeout auto-reset dopo success (ms, 0 = no auto-reset) */
  autoResetOnSuccessMs?: number;
}

export interface UseOperationStateReturn<T = unknown> {
  /** Stato corrente */
  state: OperationState;
  /** Dati operazione */
  data: T | null;
  /** Errore strutturato */
  error: ErrorData | null;
  /** Azioni recovery error */
  errorActions: ErrorAction[];
  /** True se in loading */
  isLoading: boolean;
  /** True se success */
  isSuccess: boolean;
  /** True se error */
  isError: boolean;
  /** True se form deve essere bloccato */
  isFormLocked: boolean;
  /** Messaggio display corrente */
  displayMessage: string | null;
  /** Idempotency key per retry sicuro */
  idempotencyKey: string;
  /** Transizioni stato */
  setIdle: () => void;
  setLoading: (message?: string) => void;
  setSuccess: (data: T, message?: string) => void;
  setError: (error: ErrorData, actions?: ErrorAction[]) => void;
  /** Reset completo */
  reset: () => void;
  /** Genera nuova idempotency key */
  regenerateIdempotencyKey: () => string;
}

/**
 * Genera UUID v4 per idempotency key
 */
function generateIdempotencyKey(): string {
  // Crypto.randomUUID disponibile in browser moderni
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback per browser più vecchi
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * useOperationState - Hook per gestire state machine operazioni async
 *
 * Implementa il pattern 4-state descritto in ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md:
 * - IDLE: Form pronto, button enabled
 * - LOADING: Form locked, button disabled, skeleton visible
 * - SUCCESS: Modal con tracking + actions
 * - ERROR: Dialog con recovery actions + retry
 *
 * Include:
 * - Idempotency key per retry sicuro (protezione double-submit)
 * - Auto-reset opzionale dopo success
 * - Error actions mapping
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   isLoading,
 *   isFormLocked,
 *   setLoading,
 *   setSuccess,
 *   setError,
 *   idempotencyKey,
 * } = useOperationState<ShipmentResult>()
 *
 * const handleSubmit = async () => {
 *   setLoading('Creando spedizione...')
 *   try {
 *     const result = await createShipment({ ...data, idempotencyKey })
 *     setSuccess(result, 'Spedizione creata!')
 *   } catch (e) {
 *     setError({
 *       code: 'API_ERROR',
 *       title: 'Errore',
 *       message: e.message
 *     })
 *   }
 * }
 * ```
 */
export function useOperationState<T = unknown>(
  options: UseOperationStateOptions<T> = {}
): UseOperationStateReturn<T> {
  const {
    initialState = 'idle',
    initialData = null,
    onSuccess,
    onError,
    autoResetOnSuccessMs = 0,
  } = options;

  const [state, setState] = useState<OperationState>(initialState);
  const [data, setData] = useState<T | null>(initialData);
  const [error, setErrorState] = useState<ErrorData | null>(null);
  const [errorActions, setErrorActions] = useState<ErrorAction[]>([]);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());

  // Ref per timeout auto-reset
  const autoResetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout
  const clearAutoResetTimeout = useCallback(() => {
    if (autoResetTimeoutRef.current) {
      clearTimeout(autoResetTimeoutRef.current);
      autoResetTimeoutRef.current = null;
    }
  }, []);

  // Transizione a IDLE
  const setIdle = useCallback(() => {
    clearAutoResetTimeout();
    setState('idle');
    setDisplayMessage(null);
    // Non resettiamo data/error per permettere accesso dopo transizione
  }, [clearAutoResetTimeout]);

  // Transizione a LOADING
  const setLoading = useCallback(
    (message?: string) => {
      clearAutoResetTimeout();
      setState('loading');
      setDisplayMessage(message || 'Operazione in corso...');
      // Reset error/data quando inizia nuova operazione
      setErrorState(null);
      setErrorActions([]);
      // NOTA: Non resettiamo data per permettere optimistic updates
    },
    [clearAutoResetTimeout]
  );

  // Transizione a SUCCESS
  const setSuccess = useCallback(
    (successData: T, message?: string) => {
      clearAutoResetTimeout();
      setState('success');
      setData(successData);
      setDisplayMessage(message || 'Operazione completata');
      setErrorState(null);
      setErrorActions([]);

      // Callback
      onSuccess?.(successData);

      // Auto-reset opzionale
      if (autoResetOnSuccessMs > 0) {
        autoResetTimeoutRef.current = setTimeout(() => {
          setIdle();
          // Genera nuova idempotency key per prossima operazione
          setIdempotencyKey(generateIdempotencyKey());
        }, autoResetOnSuccessMs);
      }
    },
    [clearAutoResetTimeout, onSuccess, autoResetOnSuccessMs, setIdle]
  );

  // Transizione a ERROR
  const setError = useCallback(
    (errorData: ErrorData, actions: ErrorAction[] = []) => {
      clearAutoResetTimeout();
      setState('error');
      setErrorState(errorData);
      setErrorActions(actions);
      setDisplayMessage(errorData.message);

      // Callback
      onError?.(errorData);
    },
    [clearAutoResetTimeout, onError]
  );

  // Reset completo
  const reset = useCallback(() => {
    clearAutoResetTimeout();
    setState('idle');
    setData(null);
    setErrorState(null);
    setErrorActions([]);
    setDisplayMessage(null);
    // Genera nuova idempotency key
    setIdempotencyKey(generateIdempotencyKey());
  }, [clearAutoResetTimeout]);

  // Rigenera idempotency key manualmente
  const regenerateIdempotencyKey = useCallback(() => {
    const newKey = generateIdempotencyKey();
    setIdempotencyKey(newKey);
    return newKey;
  }, []);

  // Computed values
  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  const isError = state === 'error';
  const isFormLocked = state === 'loading';

  return {
    state,
    data,
    error,
    errorActions,
    isLoading,
    isSuccess,
    isError,
    isFormLocked,
    displayMessage,
    idempotencyKey,
    setIdle,
    setLoading,
    setSuccess,
    setError,
    reset,
    regenerateIdempotencyKey,
  };
}

export default useOperationState;
