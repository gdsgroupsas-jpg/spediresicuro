/**
 * Unit Tests: Rate Limit Utility
 * 
 * Test della utility di rate limiting con mock Redis e clock deterministico.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  rateLimit,
  generateKey,
  hashUserId,
  getWindowBucket,
  resetForTesting,
} from '@/lib/security/rate-limit';

// Mock Redis module
vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: vi.fn(),
    expire: vi.fn(),
  })),
}));

describe('Rate Limit Utility', () => {
  beforeEach(() => {
    resetForTesting();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetForTesting();
  });

  describe('hashUserId', () => {
    it('should return consistent hash for same userId', () => {
      const hash1 = hashUserId('user-123');
      const hash2 = hashUserId('user-123');
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different userId', () => {
      const hash1 = hashUserId('user-123');
      const hash2 = hashUserId('user-456');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 12 character hash', () => {
      const hash = hashUserId('user-123');
      expect(hash.length).toBe(12);
    });

    it('should not contain userId in plain text', () => {
      const hash = hashUserId('user-123');
      expect(hash).not.toContain('user');
      expect(hash).not.toContain('123');
    });
  });

  describe('getWindowBucket', () => {
    it('should return same bucket for timestamps in same window', () => {
      const windowSeconds = 60;
      const now = 1703592000000; // Fixed timestamp
      
      const bucket1 = getWindowBucket(windowSeconds, now);
      const bucket2 = getWindowBucket(windowSeconds, now + 30000); // +30s
      
      expect(bucket1).toBe(bucket2);
    });

    it('should return different bucket for timestamps in different windows', () => {
      const windowSeconds = 60;
      const now = 1703592000000;
      
      const bucket1 = getWindowBucket(windowSeconds, now);
      const bucket2 = getWindowBucket(windowSeconds, now + 61000); // +61s
      
      expect(bucket1).not.toBe(bucket2);
    });

    it('should increment bucket by 1 for each window', () => {
      const windowSeconds = 60;
      const now = 1703592000000;
      
      const bucket1 = getWindowBucket(windowSeconds, now);
      const bucket2 = getWindowBucket(windowSeconds, now + 60000);
      
      expect(bucket2 - bucket1).toBe(1);
    });
  });

  describe('generateKey', () => {
    it('should generate key with correct format', () => {
      const key = generateKey('agent-chat', 'user-123', 60, 1703592000000);
      
      expect(key).toMatch(/^rl:agent-chat:[a-f0-9]{12}:\d+$/);
    });

    it('should generate same key for same inputs', () => {
      const nowMs = 1703592000000;
      const key1 = generateKey('agent-chat', 'user-123', 60, nowMs);
      const key2 = generateKey('agent-chat', 'user-123', 60, nowMs);
      
      expect(key1).toBe(key2);
    });

    it('should generate different key for different routes', () => {
      const nowMs = 1703592000000;
      const key1 = generateKey('agent-chat', 'user-123', 60, nowMs);
      const key2 = generateKey('other-route', 'user-123', 60, nowMs);
      
      expect(key1).not.toBe(key2);
    });

    it('should generate different key for different users', () => {
      const nowMs = 1703592000000;
      const key1 = generateKey('agent-chat', 'user-123', 60, nowMs);
      const key2 = generateKey('agent-chat', 'user-456', 60, nowMs);
      
      expect(key1).not.toBe(key2);
    });

    it('should generate different key for different windows', () => {
      const key1 = generateKey('agent-chat', 'user-123', 60, 1703592000000);
      const key2 = generateKey('agent-chat', 'user-123', 60, 1703592061000); // +61s
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('rateLimit (in-memory fallback)', () => {
    it('should allow first request', async () => {
      const result = await rateLimit('test-route', 'user-123', {
        limit: 20,
        windowSeconds: 60,
        nowMs: 1703592000000,
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(19);
      expect(result.source).toBe('memory');
    });

    it('should decrement remaining on each request', async () => {
      const options = { limit: 20, windowSeconds: 60, nowMs: 1703592000000 };

      const result1 = await rateLimit('test-route', 'user-123', options);
      const result2 = await rateLimit('test-route', 'user-123', options);
      const result3 = await rateLimit('test-route', 'user-123', options);

      expect(result1.remaining).toBe(19);
      expect(result2.remaining).toBe(18);
      expect(result3.remaining).toBe(17);
    });

    it('should block after limit exceeded', async () => {
      const options = { limit: 3, windowSeconds: 60, nowMs: 1703592000000 };

      // Make 3 allowed requests
      await rateLimit('test-route', 'user-123', options);
      await rateLimit('test-route', 'user-123', options);
      await rateLimit('test-route', 'user-123', options);

      // 4th request should be blocked
      const result = await rateLimit('test-route', 'user-123', options);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const windowSeconds = 60;
      const now = 1703592000000;

      // Make requests in first window
      await rateLimit('test-route', 'user-123', { limit: 3, windowSeconds, nowMs: now });
      await rateLimit('test-route', 'user-123', { limit: 3, windowSeconds, nowMs: now });
      await rateLimit('test-route', 'user-123', { limit: 3, windowSeconds, nowMs: now });

      // 4th request in same window - blocked
      const blocked = await rateLimit('test-route', 'user-123', { limit: 3, windowSeconds, nowMs: now });
      expect(blocked.allowed).toBe(false);

      // Request in new window - allowed
      const newWindow = await rateLimit('test-route', 'user-123', { 
        limit: 3, 
        windowSeconds, 
        nowMs: now + 61000 // +61 seconds
      });
      expect(newWindow.allowed).toBe(true);
      expect(newWindow.remaining).toBe(2);
    });

    it('should track different users independently', async () => {
      const options = { limit: 3, windowSeconds: 60, nowMs: 1703592000000 };

      // User 1 makes 3 requests
      await rateLimit('test-route', 'user-1', options);
      await rateLimit('test-route', 'user-1', options);
      await rateLimit('test-route', 'user-1', options);

      // User 1 blocked
      const user1Blocked = await rateLimit('test-route', 'user-1', options);
      expect(user1Blocked.allowed).toBe(false);

      // User 2 still allowed
      const user2 = await rateLimit('test-route', 'user-2', options);
      expect(user2.allowed).toBe(true);
      expect(user2.remaining).toBe(2);
    });

    it('should track different routes independently', async () => {
      const options = { limit: 3, windowSeconds: 60, nowMs: 1703592000000 };

      // Route 1 exhausted
      await rateLimit('route-1', 'user-123', options);
      await rateLimit('route-1', 'user-123', options);
      await rateLimit('route-1', 'user-123', options);
      
      const route1Blocked = await rateLimit('route-1', 'user-123', options);
      expect(route1Blocked.allowed).toBe(false);

      // Route 2 still allowed
      const route2 = await rateLimit('route-2', 'user-123', options);
      expect(route2.allowed).toBe(true);
    });

    it('should return resetAt timestamp', async () => {
      const nowMs = 1703592000000;
      const windowSeconds = 60;

      const result = await rateLimit('test-route', 'user-123', {
        limit: 20,
        windowSeconds,
        nowMs,
      });

      expect(result.resetAt).toBeGreaterThan(nowMs);
    });
  });
});

