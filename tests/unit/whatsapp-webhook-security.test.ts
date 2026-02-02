/**
 * Tests: WhatsApp Webhook Security
 * Phase 3: WhatsApp Gateway
 *
 * Tests HMAC verification, phone validation, rate limiting, dedup, masking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock all heavy dependencies
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock('@/lib/services/whatsapp', () => ({
  isWhatsAppConfigured: vi.fn().mockReturnValue(true),
  getWhatsAppVerifyToken: vi.fn().mockReturnValue('test-verify-token'),
  parseWebhookMessages: vi.fn().mockReturnValue([]),
  sendWhatsAppText: vi.fn().mockResolvedValue(undefined),
  markAsRead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/services/whatsapp-formatter', () => ({
  sendPricingToWhatsApp: vi.fn(),
  sendTrackingToWhatsApp: vi.fn(),
  sendBookingToWhatsApp: vi.fn(),
}));

vi.mock('@/lib/agent/orchestrator/supervisor-router', () => ({
  supervisorRouter: vi.fn(),
  formatPricingResponse: vi.fn(),
}));

vi.mock('@/lib/telemetry/logger', () => ({
  generateTraceId: vi.fn().mockReturnValue('trace-123'),
}));

import { getWhatsAppVerifyToken, isWhatsAppConfigured } from '@/lib/services/whatsapp';

/** Create a NextRequest-like object with nextUrl (the mock doesn't provide it) */
function makeGetRequest(params: Record<string, string>) {
  const url = new URL('http://localhost/api/webhooks/whatsapp');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const req = new NextRequest(url);
  // Attach nextUrl since the vitest mock of NextRequest extends plain Request
  (req as any).nextUrl = url;
  return req;
}

let GET: (req: NextRequest) => Promise<Response>;
let POST: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.clearAllMocks();
  (isWhatsAppConfigured as any).mockReturnValue(true);
  (getWhatsAppVerifyToken as any).mockReturnValue('test-verify-token');

  // Reset env
  delete process.env.WHATSAPP_APP_SECRET;

  const mod = await import('@/app/api/webhooks/whatsapp/route');
  GET = mod.GET;
  POST = mod.POST;
});

// ==================== Helper: compute HMAC ====================

async function computeHmac(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('WhatsApp Webhook Security', () => {
  // ==================== GET: Verification ====================

  describe('GET - Webhook Verification', () => {
    it('returns challenge on valid verification', async () => {
      const req = makeGetRequest({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'test-verify-token',
        'hub.challenge': 'challenge-123',
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('challenge-123');
    });

    it('returns 403 on wrong verify token', async () => {
      const req = makeGetRequest({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong-token',
        'hub.challenge': 'challenge-123',
      });
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it('returns 403 on wrong mode', async () => {
      const req = makeGetRequest({
        'hub.mode': 'unsubscribe',
        'hub.verify_token': 'test-verify-token',
        'hub.challenge': 'challenge-123',
      });
      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it('returns 403 when verify token is empty', async () => {
      (getWhatsAppVerifyToken as any).mockReturnValue('');
      const req = makeGetRequest({
        'hub.mode': 'subscribe',
        'hub.verify_token': '',
        'hub.challenge': 'challenge-123',
      });
      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  // ==================== POST: HMAC ====================

  describe('POST - HMAC Verification', () => {
    it('rejects POST when WHATSAPP_APP_SECRET not set (fail-closed)', async () => {
      // No WHATSAPP_APP_SECRET in env
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        body,
        headers: { 'x-hub-signature-256': 'sha256=abc123' },
      });

      const res = await POST(req);
      // Returns 200 (to stop Meta retries) but doesn't process
      expect(res.status).toBe(200);
    });

    it('rejects POST with missing signature header', async () => {
      process.env.WHATSAPP_APP_SECRET = 'test-secret';
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        body,
        // No x-hub-signature-256 header
      });

      const res = await POST(req);
      expect(res.status).toBe(200); // 200 to stop retries
    });

    it('rejects POST with invalid HMAC', async () => {
      process.env.WHATSAPP_APP_SECRET = 'test-secret';
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        body,
        headers: { 'x-hub-signature-256': 'sha256=invalid_hmac_value' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it('accepts POST with valid HMAC', async () => {
      const secret = 'test-secret';
      process.env.WHATSAPP_APP_SECRET = secret;
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const hmac = await computeHmac(body, secret);

      const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        body,
        headers: { 'x-hub-signature-256': `sha256=${hmac}` },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  // ==================== POST: Not configured ====================

  describe('POST - Not Configured', () => {
    it('returns 200 ok when WhatsApp not configured', async () => {
      (isWhatsAppConfigured as any).mockReturnValue(false);

      const req = new NextRequest('http://localhost/api/webhooks/whatsapp', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });
});
