/**
 * Unit Tests: Smart Suggestions (P4 Task 4)
 * 
 * Test per la logica di pattern detection e suggerimenti proattivi.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSmartSuggestion, markSuggestionShown, shouldShowSuggestion, type SuggestionType } from '@/lib/agent/smart-suggestions';
import { supabase } from '@/lib/db/client';

// Mock Supabase
vi.mock('@/lib/db/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Smart Suggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('getSmartSuggestion', () => {
    it('dovrebbe restituire null se non ci sono abbastanza spedizioni', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [
                  { recipient_city: 'Milano', courier_name: 'GLS', weight: 2 },
                  { recipient_city: 'Roma', courier_name: 'DHL', weight: 1 },
                ],
                error: null,
              }),
            }),
          }),
        }),
      });

      (supabase.from as any) = mockFrom;

      const result = await getSmartSuggestion('test-user');
      expect(result).toBeNull();
    });

    it('dovrebbe suggerire salvare destinatario se ricorrente', async () => {
      const mockData = Array(5).fill(null).map(() => ({
        recipient_city: 'Milano',
        courier_name: 'GLS',
        weight: 2,
      }));

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockData,
                error: null,
              }),
            }),
          }),
        }),
      });

      (supabase.from as any) = mockFrom;

      const result = await getSmartSuggestion('test-user');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('save_recipient');
      expect(result?.message).toContain('destinatario');
    });

    it('dovrebbe suggerire corriere predefinito se ricorrente (quando recipient non è ricorrente)', async () => {
      // Se recipient non è ricorrente (meno di 3 volte), courier può essere suggerito
      // Priorità: recipient > courier > weight
      const mockData = Array(5).fill(null).map((_, i) => ({
        recipient_city: `Città${i}`, // Tutti diversi, quindi recipient NON ricorrente
        courier_name: 'GLS', // Sempre GLS, quindi ricorrente (5 volte)
        weight: 2,
      }));

      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockData,
                error: null,
              }),
            }),
          }),
        }),
      });

      (supabase.from as any) = mockFrom;

      const result = await getSmartSuggestion('test-user');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('default_courier');
      expect(result?.message).toContain('GLS');
    });

    it('dovrebbe gestire errori gracefully', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      });

      (supabase.from as any) = mockFrom;

      const result = await getSmartSuggestion('test-user');
      expect(result).toBeNull();
    });
  });

  describe('shouldShowSuggestion', () => {
    it('dovrebbe restituire true se non c\'è cache', () => {
      if (typeof window === 'undefined') {
        // Skip in ambiente Node
        return;
      }
      const result = shouldShowSuggestion('test-user', 'save_recipient');
      expect(result).toBe(true);
    });

    it('dovrebbe restituire false se suggerimento mostrato recentemente', () => {
      if (typeof window === 'undefined') {
        return;
      }
      markSuggestionShown('test-user', 'save_recipient');
      const result = shouldShowSuggestion('test-user', 'save_recipient');
      expect(result).toBe(false);
    });

    it('dovrebbe restituire true se suggerimento mostrato più di 24h fa', () => {
      if (typeof window === 'undefined') {
        return;
      }
      const key = `suggestion_save_recipient_test-user`;
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 ore fa
      localStorage.setItem(key, JSON.stringify({ timestamp: oldTimestamp }));
      
      const result = shouldShowSuggestion('test-user', 'save_recipient');
      expect(result).toBe(true);
    });
  });

  describe('markSuggestionShown', () => {
    it('dovrebbe salvare timestamp in localStorage', () => {
      if (typeof window === 'undefined') {
        return;
      }
      markSuggestionShown('test-user', 'default_courier');
      const key = `suggestion_default_courier_test-user`;
      const cached = localStorage.getItem(key);
      expect(cached).not.toBeNull();
      
      const { timestamp } = JSON.parse(cached!);
      expect(timestamp).toBeGreaterThan(0);
      expect(Date.now() - timestamp).toBeLessThan(1000); // Meno di 1 secondo fa
    });
  });
});

