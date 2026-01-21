'use client';

import { useCallback, useRef, useState } from 'react';

export interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  requireConfirmation?: boolean;
  confirmationText?: string;
}

interface ConfirmDialogState {
  isOpen: boolean;
  options: ConfirmDialogOptions | null;
}

/**
 * Hook per gestire dialog di conferma in modo imperativo
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    options: null,
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        isOpen: true,
        options: opts,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true);
    setState({
      isOpen: false,
      options: null,
    });
    resolverRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current?.(false);
    setState({
      isOpen: false,
      options: null,
    });
    resolverRef.current = null;
  }, []);

  const close = useCallback(() => {
    resolverRef.current?.(false);
    setState({
      isOpen: false,
      options: null,
    });
    resolverRef.current = null;
  }, []);

  return {
    confirm,
    isOpen: state.isOpen,
    options: state.options,
    handleConfirm,
    handleCancel,
    close,
  };
}
