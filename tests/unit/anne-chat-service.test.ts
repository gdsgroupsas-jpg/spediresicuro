/**
 * Tests: Anne Chat Persistence Service
 * Phase 4: Multi-device Sessions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveChatMessage, loadChatHistory, clearChatHistory } from '@/lib/services/anne-chat';
import { supabaseAdmin } from '@/lib/db/client';

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

describe('Anne Chat Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==================== saveChatMessage ====================

  describe('saveChatMessage', () => {
    it('should insert message and return it', async () => {
      const mockMessage = {
        id: 'msg-1',
        user_id: 'user-1',
        role: 'user',
        content: 'Ciao Anne',
        metadata: {},
        created_at: '2026-02-02T10:00:00Z',
      };

      (supabaseAdmin.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockMessage, error: null }),
          }),
        }),
      });

      const result = await saveChatMessage({
        userId: 'user-1',
        role: 'user',
        content: 'Ciao Anne',
      });

      expect(result).toEqual(mockMessage);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('anne_chat_messages');
    });

    it('should return null on error', async () => {
      (supabaseAdmin.from as any).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'DB error' },
            }),
          }),
        }),
      });

      const result = await saveChatMessage({
        userId: 'user-1',
        role: 'user',
        content: 'test',
      });

      expect(result).toBeNull();
    });

    it('should pass metadata when provided', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
        }),
      });

      (supabaseAdmin.from as any).mockReturnValue({ insert: insertMock });

      await saveChatMessage({
        userId: 'user-1',
        role: 'assistant',
        content: 'response',
        metadata: { cardType: 'pricing', source: 'test' },
      });

      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-1',
        role: 'assistant',
        content: 'response',
        metadata: { cardType: 'pricing', source: 'test' },
      });
    });

    it('should default metadata to empty object', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: '1' }, error: null }),
        }),
      });

      (supabaseAdmin.from as any).mockReturnValue({ insert: insertMock });

      await saveChatMessage({
        userId: 'user-1',
        role: 'user',
        content: 'test',
      });

      expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
    });
  });

  // ==================== loadChatHistory ====================

  describe('loadChatHistory', () => {
    it('should load messages in chronological order', async () => {
      const mockData = [
        { id: '2', content: 'newer', created_at: '2026-02-02T10:01:00Z' },
        { id: '1', content: 'older', created_at: '2026-02-02T10:00:00Z' },
      ];

      const limitMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

      (supabaseAdmin.from as any).mockReturnValue({ select: selectMock });

      const result = await loadChatHistory('user-1');

      // Should be reversed (oldest first)
      expect(result[0].content).toBe('older');
      expect(result[1].content).toBe('newer');
      expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
      expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(limitMock).toHaveBeenCalledWith(50);
    });

    it('should return empty array on error', async () => {
      const limitMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

      (supabaseAdmin.from as any).mockReturnValue({ select: selectMock });

      const result = await loadChatHistory('user-1');
      expect(result).toEqual([]);
    });

    it('should respect custom limit', async () => {
      const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
      const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
      const eqMock = vi.fn().mockReturnValue({ order: orderMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });

      (supabaseAdmin.from as any).mockReturnValue({ select: selectMock });

      await loadChatHistory('user-1', 100);
      expect(limitMock).toHaveBeenCalledWith(100);
    });
  });

  // ==================== clearChatHistory ====================

  describe('clearChatHistory', () => {
    it('should delete all messages for user', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });

      (supabaseAdmin.from as any).mockReturnValue({ delete: deleteMock });

      await clearChatHistory('user-1');

      expect(supabaseAdmin.from).toHaveBeenCalledWith('anne_chat_messages');
      expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('should not throw on error', async () => {
      const eqMock = vi.fn().mockResolvedValue({ error: { message: 'fail' } });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });

      (supabaseAdmin.from as any).mockReturnValue({ delete: deleteMock });

      // Should not throw
      await expect(clearChatHistory('user-1')).resolves.toBeUndefined();
    });
  });
});
