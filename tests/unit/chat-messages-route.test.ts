/**
 * Tests: Chat Messages API Route
 * Phase 4: Multi-device Sessions
 *
 * Tests auth, rate limiting, input validation, metadata whitelist.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies before imports
vi.mock('@/lib/workspace-auth', () => ({
  getWorkspaceAuth: vi.fn(),
}));

vi.mock('@/lib/services/anne-chat', () => ({
  saveChatMessage: vi.fn(),
  loadChatHistory: vi.fn(),
  clearChatHistory: vi.fn(),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { saveChatMessage, loadChatHistory, clearChatHistory } from '@/lib/services/anne-chat';
import { rateLimit } from '@/lib/security/rate-limit';

// Dynamic import to apply mocks
let GET: () => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;
let DELETE: () => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();
  (rateLimit as any).mockResolvedValue({ allowed: true });

  // Re-import to get fresh module with mocks applied
  const mod = await import('@/app/api/ai/chat-messages/route');
  GET = mod.GET;
  POST = mod.POST;
  DELETE = mod.DELETE;
});

const mockAuth = (userId = 'user-123') => {
  (getWorkspaceAuth as any).mockResolvedValue({
    target: { id: userId },
    actor: { id: userId },
  });
};

const mockUnauth = () => {
  (getWorkspaceAuth as any).mockResolvedValue(null);
};

describe('Chat Messages API', () => {
  // ==================== AUTH ====================

  describe('Authentication', () => {
    it('GET returns 401 when not authenticated', async () => {
      mockUnauth();
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it('POST returns 401 when not authenticated', async () => {
      mockUnauth();
      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content: 'test' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('DELETE returns 401 when not authenticated', async () => {
      mockUnauth();
      const res = await DELETE();
      expect(res.status).toBe(401);
    });
  });

  // ==================== RATE LIMITING ====================

  describe('Rate Limiting', () => {
    it('GET returns 429 when rate limited', async () => {
      mockAuth();
      (rateLimit as any).mockResolvedValue({ allowed: false });

      const res = await GET();
      expect(res.status).toBe(429);
    });

    it('POST returns 429 when rate limited', async () => {
      mockAuth();
      (rateLimit as any).mockResolvedValue({ allowed: false });

      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content: 'test' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(429);
    });

    it('DELETE returns 429 when rate limited', async () => {
      mockAuth();
      (rateLimit as any).mockResolvedValue({ allowed: false });

      const res = await DELETE();
      expect(res.status).toBe(429);
    });
  });

  // ==================== GET ====================

  describe('GET /api/ai/chat-messages', () => {
    it('returns messages on success', async () => {
      mockAuth();
      const mockMessages = [{ id: '1', content: 'hello' }];
      (loadChatHistory as any).mockResolvedValue(mockMessages);

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.messages).toEqual(mockMessages);
      expect(loadChatHistory).toHaveBeenCalledWith('user-123');
    });
  });

  // ==================== POST ====================

  describe('POST /api/ai/chat-messages', () => {
    it('saves valid user message', async () => {
      mockAuth();
      (saveChatMessage as any).mockResolvedValue({ id: 'msg-1' });

      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content: 'Ciao Anne' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(saveChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          role: 'user',
          content: 'Ciao Anne',
        })
      );
    });

    it('rejects missing role', async () => {
      mockAuth();
      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ content: 'test' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rejects missing content', async () => {
      mockAuth();
      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ role: 'user' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('rejects invalid role', async () => {
      mockAuth();
      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ role: 'admin', content: 'test' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('accepts suggestion role', async () => {
      mockAuth();
      (saveChatMessage as any).mockResolvedValue({ id: 'msg-1' });

      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ role: 'suggestion', content: 'try this' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('truncates content to 10000 chars', async () => {
      mockAuth();
      (saveChatMessage as any).mockResolvedValue({ id: 'msg-1' });

      const longContent = 'a'.repeat(15000);
      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content: longContent }),
      });
      await POST(req);

      expect(saveChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'a'.repeat(10000),
        })
      );
    });

    it('whitelists metadata keys (strips unknown)', async () => {
      mockAuth();
      (saveChatMessage as any).mockResolvedValue({ id: 'msg-1' });

      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({
          role: 'user',
          content: 'test',
          metadata: {
            cardType: 'pricing',
            cardData: { foo: 'bar' },
            source: 'voice',
            agentState: { secret: 'should be stripped' },
            internalData: 'also stripped',
          },
        }),
      });
      await POST(req);

      expect(saveChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            cardType: 'pricing',
            cardData: { foo: 'bar' },
            source: 'voice',
          },
        })
      );
    });

    it('returns 400 on invalid JSON body', async () => {
      mockAuth();
      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: 'not json',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 500 when save fails', async () => {
      mockAuth();
      (saveChatMessage as any).mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/ai/chat-messages', {
        method: 'POST',
        body: JSON.stringify({ role: 'user', content: 'test' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });
  });

  // ==================== DELETE ====================

  describe('DELETE /api/ai/chat-messages', () => {
    it('clears history on success', async () => {
      mockAuth();
      (clearChatHistory as any).mockResolvedValue(undefined);

      const res = await DELETE();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(clearChatHistory).toHaveBeenCalledWith('user-123');
    });
  });
});
