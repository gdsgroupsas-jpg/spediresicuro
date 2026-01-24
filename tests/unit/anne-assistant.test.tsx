/**
 * AnneAssistant UI Tests
 *
 * @vitest-environment happy-dom
 */

import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
// @ts-ignore
global.React = React;
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

  it('renders floating button in fixed position and opens on click', () => {
    render(
      <AnneAssistant userId="user-1" userRole="user" userName="Luca" currentPage="/dashboard" />
    );

    const button = screen.getByRole('button');
    const wrapper = button.closest('div');

    // Button is fixed positioned (currently top-right)
    expect(wrapper?.className).toContain('fixed');
    expect(wrapper?.className).toContain('right-6');
    expect(screen.queryByPlaceholderText('Scrivi ad Anne...')).toBeNull();

    fireEvent.click(button);

    // After click, input should appear
    expect(screen.getByPlaceholderText('Scrivi ad Anne...')).toBeTruthy();
  });

  it('opens expanded panel on click', () => {
    localStorage.setItem('anne-onboarding-completed', 'true');

    render(
      <AnneAssistant userId="user-1" userRole="user" userName="Luca" currentPage="/dashboard" />
    );

    fireEvent.click(screen.getByRole('button'));

    // Panel should be expanded with chat input visible
    expect(screen.getByPlaceholderText('Scrivi ad Anne...')).toBeTruthy();
  });

  it('shows pulse animation by default', async () => {
    render(
      <AnneAssistant userId="user-1" userRole="user" userName="Luca" currentPage="/dashboard" />
    );

    // Animation is visible by default
    await waitFor(() => {
      expect(document.querySelector('.animate-ping')).not.toBeNull();
    });
  });
});
