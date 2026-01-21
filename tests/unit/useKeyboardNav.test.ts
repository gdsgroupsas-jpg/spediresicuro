/**
 * useKeyboardNav Hook Tests
 *
 * Test suite per verificare:
 * - Keyboard shortcuts (Arrow Up/Down, Enter, Escape, Home, End)
 * - Mouse interaction detection
 * - Auto-scroll behavior
 * - SSR safety
 * - Feature enable/disable
 * - Custom onNavigate callback
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNav } from '@/hooks/useKeyboardNav';
import type { NavItem } from '@/lib/config/navigationConfig';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock items for testing
const mockItems: NavItem[] = [
  {
    id: 'item-1',
    label: 'Item 1',
    href: '/item-1',
    icon: vi.fn() as any,
  },
  {
    id: 'item-2',
    label: 'Item 2',
    href: '/item-2',
    icon: vi.fn() as any,
  },
  {
    id: 'item-3',
    label: 'Item 3',
    href: '/item-3',
    icon: vi.fn() as any,
  },
  {
    id: 'item-4',
    label: 'Item 4',
    href: '/item-4',
    icon: vi.fn() as any,
  },
  {
    id: 'item-5',
    label: 'Item 5',
    href: '/item-5',
    icon: vi.fn() as any,
  },
];

describe('useKeyboardNav Hook', () => {
  let mockElement: HTMLElement;

  beforeEach(() => {
    // Mock DOM element for scroll testing
    mockElement = {
      scrollIntoView: vi.fn(),
    } as unknown as HTMLElement;

    // Mock document.querySelector
    vi.spyOn(document, 'querySelector').mockReturnValue(mockElement);

    // Mock console.debug to avoid noise in tests
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Initial state', () => {
    it('should initialize with no focus', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      expect(result.current.focusedIndex).toBe(-1);
      expect(result.current.isKeyboardMode).toBe(false);
    });

    it('should work with empty items array', () => {
      const { result } = renderHook(() => useKeyboardNav([]));

      expect(result.current.focusedIndex).toBe(-1);
      expect(result.current.isKeyboardMode).toBe(false);
    });
  });

  describe('ArrowDown navigation', () => {
    it('should increment focusedIndex on ArrowDown', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      // Create a keyboard event on an element inside [data-keyboard-nav]
      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.focusedIndex).toBe(0);
      expect(result.current.isKeyboardMode).toBe(true);

      document.body.removeChild(navElement);
    });

    it('should loop to start when reaching end', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Navigate through all items and loop back
      // With 5 items (indices 0-4), we need 6 presses to loop back to index 0:
      // Press 1: -1 → 0, Press 2: 0 → 1, Press 3: 1 → 2, Press 4: 2 → 3, Press 5: 3 → 4, Press 6: 4 → 0
      for (let i = 0; i < mockItems.length + 1; i++) {
        act(() => {
          const event = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
          });
          Object.defineProperty(event, 'target', {
            value: targetElement,
            configurable: true,
          });
          window.dispatchEvent(event);
        });
      }

      // Should have looped back to first item (index 0)
      expect(result.current.focusedIndex).toBe(0);

      document.body.removeChild(navElement);
    });
  });

  describe('ArrowUp navigation', () => {
    it('should decrement focusedIndex on ArrowUp', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // First go down to item 2
      act(() => {
        const event1 = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event1, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event1);

        const event2 = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event2, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event2);
      });

      expect(result.current.focusedIndex).toBe(1);

      // Now go up
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.focusedIndex).toBe(0);

      document.body.removeChild(navElement);
    });

    it('should loop to end when at start', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Press ArrowUp from initial state (index -1)
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      // Should loop to last item
      expect(result.current.focusedIndex).toBe(mockItems.length - 1);

      document.body.removeChild(navElement);
    });
  });

  describe('Enter key navigation', () => {
    it('should navigate to href on Enter when item is focused', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Focus on item 2
      act(() => {
        const event1 = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event1, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event1);

        const event2 = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event2, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event2);
      });

      expect(result.current.focusedIndex).toBe(1);

      // Press Enter
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockPush).toHaveBeenCalledWith('/item-2');

      document.body.removeChild(navElement);
    });

    it('should NOT navigate on Enter when no item is focused', () => {
      mockPush.mockClear(); // Clear previous calls
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Press Enter without focusing any item
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockPush).not.toHaveBeenCalled();

      document.body.removeChild(navElement);
    });

    it('should call custom onNavigate callback if provided', () => {
      const mockOnNavigate = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardNav(mockItems, { onNavigate: mockOnNavigate })
      );

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Focus on first item
      act(() => {
        const event1 = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event1, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event1);
      });

      // Press Enter
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(mockOnNavigate).toHaveBeenCalledWith(mockItems[0]);

      document.body.removeChild(navElement);
    });
  });

  describe('Escape key', () => {
    it('should clear focus on Escape', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Focus on an item
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.focusedIndex).toBe(0);

      // Press Escape
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.focusedIndex).toBe(-1);
      expect(result.current.isKeyboardMode).toBe(false);

      document.body.removeChild(navElement);
    });
  });

  describe('Home and End keys', () => {
    it('should jump to first item on Home', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Press Home
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'Home',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.focusedIndex).toBe(0);
      expect(result.current.isKeyboardMode).toBe(true);

      document.body.removeChild(navElement);
    });

    it('should jump to last item on End', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Press End
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'End',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.focusedIndex).toBe(mockItems.length - 1);
      expect(result.current.isKeyboardMode).toBe(true);

      document.body.removeChild(navElement);
    });
  });

  describe('Mouse interaction detection', () => {
    it('should reset keyboard mode on mouse movement', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Enter keyboard mode by pressing ArrowDown
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.isKeyboardMode).toBe(true);
      expect(result.current.focusedIndex).toBe(0);

      // Trigger mouse movement
      act(() => {
        const mouseEvent = new MouseEvent('mousemove', { bubbles: true });
        window.dispatchEvent(mouseEvent);
      });

      expect(result.current.isKeyboardMode).toBe(false);
      expect(result.current.focusedIndex).toBe(-1);

      document.body.removeChild(navElement);
    });
  });

  describe('Auto-scroll behavior', () => {
    it('should scroll focused element into view', async () => {
      const mockScrollElement = {
        scrollIntoView: vi.fn(),
      } as unknown as HTMLElement;

      // Mock querySelector to return element with data-nav-index="0"
      const querySelectorSpy = vi
        .spyOn(document, 'querySelector')
        .mockReturnValue(mockScrollElement);

      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Focus on first item
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      // Wait a tick for useEffect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockScrollElement.scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        behavior: 'smooth',
      });

      querySelectorSpy.mockRestore();
      document.body.removeChild(navElement);
    });

    it('should NOT scroll when not in keyboard mode', async () => {
      const mockScrollElement = {
        scrollIntoView: vi.fn(),
      } as unknown as HTMLElement;
      const querySelectorSpy = vi
        .spyOn(document, 'querySelector')
        .mockReturnValue(mockScrollElement);

      const { result } = renderHook(() => useKeyboardNav(mockItems));

      // Manually set focused index without keyboard mode
      act(() => {
        result.current.setFocusedIndex(2);
      });

      // Wait a tick for useEffect to run
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should NOT scroll because not in keyboard mode
      expect(mockScrollElement.scrollIntoView).not.toHaveBeenCalled();

      querySelectorSpy.mockRestore();
    });

    it('should handle missing element gracefully', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Mock querySelector to return null (element not found)
      vi.spyOn(document, 'querySelector').mockReturnValue(null);

      // Focus on first item - should not crash
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      // Should still update state even if element not found
      expect(result.current.focusedIndex).toBe(0);

      document.body.removeChild(navElement);
    });
  });

  describe('Feature enable/disable', () => {
    it('should NOT handle keyboard events when disabled', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems, { enabled: false }));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Try to navigate with ArrowDown
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      // Should remain unfocused
      expect(result.current.focusedIndex).toBe(-1);
      expect(result.current.isKeyboardMode).toBe(false);

      document.body.removeChild(navElement);
    });

    it('should use enabled: true by default', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Navigate with ArrowDown
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      // Should work by default
      expect(result.current.focusedIndex).toBe(0);

      document.body.removeChild(navElement);
    });
  });

  describe('Event listener cleanup', () => {
    it('should remove event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useKeyboardNav(mockItems));

      unmount();

      // Should have called removeEventListener for both keydown and mousemove
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    });
  });

  describe('Keyboard navigation scope', () => {
    it('should only handle events from elements inside [data-keyboard-nav]', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      // Create element OUTSIDE [data-keyboard-nav]
      const outsideElement = document.createElement('button');
      document.body.appendChild(outsideElement);

      // Press ArrowDown on element outside navigation scope
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: outsideElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      // Should NOT navigate
      expect(result.current.focusedIndex).toBe(-1);

      document.body.removeChild(outsideElement);
    });

    it('should handle events from nested children of [data-keyboard-nav]', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const childElement = document.createElement('div');
      const deepChildElement = document.createElement('button');
      childElement.appendChild(deepChildElement);
      navElement.appendChild(childElement);
      document.body.appendChild(navElement);

      // Press ArrowDown on deeply nested element
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: deepChildElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      // Should navigate because it's inside [data-keyboard-nav]
      expect(result.current.focusedIndex).toBe(0);

      document.body.removeChild(navElement);
    });
  });

  describe('Edge cases', () => {
    it('should handle single item array', () => {
      const singleItem = [mockItems[0]];
      const { result } = renderHook(() => useKeyboardNav(singleItem));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Press ArrowDown
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.focusedIndex).toBe(0);

      // Press ArrowDown again - should loop to index 0
      act(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'ArrowDown',
          bubbles: true,
        });
        Object.defineProperty(event, 'target', {
          value: targetElement,
          configurable: true,
        });
        window.dispatchEvent(event);
      });

      expect(result.current.focusedIndex).toBe(0);

      document.body.removeChild(navElement);
    });

    it('should handle rapid key presses', () => {
      const { result } = renderHook(() => useKeyboardNav(mockItems));

      const navElement = document.createElement('div');
      navElement.setAttribute('data-keyboard-nav', 'true');
      const targetElement = document.createElement('button');
      navElement.appendChild(targetElement);
      document.body.appendChild(navElement);

      // Rapidly press ArrowDown 11 times (each in its own act for proper state updates)
      // Starting from -1: after 11 presses we should complete 2 full loops (6 presses per loop)
      // and be back at index 0: -1 → 0 → 1 → 2 → 3 → 4 → 0 → 1 → 2 → 3 → 4 → 0
      for (let i = 0; i < 11; i++) {
        act(() => {
          const event = new KeyboardEvent('keydown', {
            key: 'ArrowDown',
            bubbles: true,
          });
          Object.defineProperty(event, 'target', {
            value: targetElement,
            configurable: true,
          });
          window.dispatchEvent(event);
        });
      }

      // Should be at index 0 after 11 presses (2 complete loops)
      expect(result.current.focusedIndex).toBe(0);

      document.body.removeChild(navElement);
    });
  });
});
