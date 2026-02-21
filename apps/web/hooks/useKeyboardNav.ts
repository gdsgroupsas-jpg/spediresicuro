/**
 * useKeyboardNav Hook
 *
 * Aggiunge supporto keyboard navigation per sidebar
 * - Arrow Up/Down: naviga tra items
 * - Enter: attiva item selezionato
 * - Escape: rimuove focus
 * - Tab: normal tab behavior (browser default)
 *
 * Zero breaking changes: se non usato, sidebar funziona come prima
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { NavItem } from '@/lib/config/navigationConfig';

interface UseKeyboardNavOptions {
  enabled?: boolean;
  onNavigate?: (item: NavItem) => void;
}

export function useKeyboardNav(items: NavItem[], options: UseKeyboardNavOptions = {}) {
  const { enabled = true, onNavigate } = options;
  const router = useRouter();
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);

  // Reset keyboard mode on mouse interaction
  useEffect(() => {
    function handleMouseMove() {
      if (isKeyboardMode) {
        setIsKeyboardMode(false);
        setFocusedIndex(-1);
      }
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isKeyboardMode]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Solo se siamo nella sidebar (check via closest)
      const target = e.target as HTMLElement;
      if (!target.closest('[data-keyboard-nav]')) return;

      let handled = false;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setIsKeyboardMode(true);
          setFocusedIndex((prev) => {
            const next = prev + 1;
            return next >= items.length ? 0 : next; // Loop to start
          });
          handled = true;
          break;

        case 'ArrowUp':
          e.preventDefault();
          setIsKeyboardMode(true);
          setFocusedIndex((prev) => {
            const next = prev - 1;
            return next < 0 ? items.length - 1 : next; // Loop to end
          });
          handled = true;
          break;

        case 'Enter':
          if (focusedIndex >= 0 && focusedIndex < items.length) {
            e.preventDefault();
            const item = items[focusedIndex];
            if (onNavigate) {
              onNavigate(item);
            } else {
              router.push(item.href);
            }
            handled = true;
          }
          break;

        case 'Escape':
          setIsKeyboardMode(false);
          setFocusedIndex(-1);
          handled = true;
          break;

        case 'Home':
          e.preventDefault();
          setIsKeyboardMode(true);
          setFocusedIndex(0);
          handled = true;
          break;

        case 'End':
          e.preventDefault();
          setIsKeyboardMode(true);
          setFocusedIndex(items.length - 1);
          handled = true;
          break;
      }

      // Log for debugging (only in dev)
      if (handled && process.env.NODE_ENV === 'development') {
        console.debug('[KeyboardNav]', e.key, 'focusedIndex:', focusedIndex);
      }
    },
    [enabled, focusedIndex, items, onNavigate, router]
  );

  // Register keyboard listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  // Auto-scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && isKeyboardMode) {
      const element = document.querySelector(`[data-nav-index="${focusedIndex}"]`);
      if (element) {
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, isKeyboardMode]);

  return {
    focusedIndex: isKeyboardMode ? focusedIndex : -1,
    isKeyboardMode,
    setFocusedIndex,
  };
}
