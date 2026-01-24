/**
 * AnneAssistant UI Tests
 *
 * @vitest-environment happy-dom
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { AnneAssistant } from '@/components/anne/AnneAssistant';

const mockPush = vi.fn();
const mockTrackAction = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/anne/AnneContext', () => ({
  useAnneContext: () => ({
    currentSuggestion: null,
    dismissSuggestion: vi.fn(),
  }),
  useAnneTracking: () => ({
    trackAction: mockTrackAction,
  }),
}));

vi.mock('@/components/agent/AgentDebugPanel', () => ({
  AgentDebugPanel: () => null,
}));

vi.mock('@/components/anne/ValueDashboard', () => ({
  ValueDashboard: () => null,
}));

vi.mock('@/components/anne/HumanError', () => ({
  HumanError: () => null,
}));

vi.mock('@/components/anne/SmartSuggestions', () => ({
  SmartSuggestions: () => null,
}));

vi.mock('@/components/anne/AutoProceedBanner', () => ({
  AutoProceedBanner: () => null,
}));

vi.mock('@/lib/config', () => ({
  autoProceedConfig: {
    CANCELLATION_WINDOW_MS: 5000,
  },
}));

describe('AnneAssistant', () => {
  beforeEach(() => {
    if (!window.matchMedia) {
      window.matchMedia = (query: string) =>
        ({
          matches: false,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList;
    }

    localStorage.clear();
    sessionStorage.clear();
    mockPush.mockClear();
    mockTrackAction.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders minimized button bottom-right and opens on click', () => {
    render(
      <AnneAssistant userId="user-1" userRole="user" userName="Luca" currentPage="/dashboard" />
    );

    const button = screen.getByRole('button');
    const wrapper = button.closest('div');

    expect(wrapper?.className).toContain('bottom-6');
    expect(wrapper?.className).toContain('right-6');
    expect(screen.queryByPlaceholderText('Scrivi ad Anne...')).toBeNull();

    fireEvent.click(button);

    expect(screen.getByPlaceholderText('Scrivi ad Anne...')).toBeTruthy();

    const panel = document.querySelector('.origin-bottom-right');
    expect(panel?.className).toContain('bottom-6');
    expect(panel?.className).toContain('right-6');
  });

  it('shows quick actions when expanded', () => {
    localStorage.setItem('anne-onboarding-completed', 'true');

    render(
      <AnneAssistant userId="user-1" userRole="user" userName="Luca" currentPage="/dashboard" />
    );

    fireEvent.click(screen.getByRole('button'));

    const quickAction = screen.getByTitle('Crea una spedizione');
    expect(quickAction).toBeTruthy();

    fireEvent.click(quickAction);
    expect(mockPush).toHaveBeenCalledWith('/dashboard/spedizioni/nuova');
  });

  it('suppresses pulse animation in silent mode', async () => {
    localStorage.setItem(
      'anne-preferences',
      JSON.stringify({
        silentMode: true,
        showSuggestions: true,
        autoGreet: true,
        notificationLevel: 'normal',
      })
    );

    render(
      <AnneAssistant userId="user-1" userRole="user" userName="Luca" currentPage="/dashboard" />
    );

    await waitFor(() => {
      expect(document.querySelector('.animate-ping')).toBeNull();
    });
  });
});
