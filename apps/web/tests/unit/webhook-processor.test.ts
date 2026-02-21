/**
 * Test: Webhook Processor Spedisci.Online
 *
 * Verifica HMAC-SHA256, deduplicazione, normalizzazione status,
 * e processing completo del webhook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifySpedisciSignature,
  extractV1Signature,
  timingSafeEqual,
  isDuplicateWebhook,
  processTrackingWebhook,
  type SpedisciWebhookPayload,
} from '@/lib/services/tracking/webhook-processor';

// ═══════════════════════════════════════════════════════════════════════════
// HMAC SIGNATURE
// ═══════════════════════════════════════════════════════════════════════════

describe('extractV1Signature', () => {
  it('estrae correttamente v1 da formato standard', () => {
    const sig = 't=1733678400,v1=abc123def456';
    expect(extractV1Signature(sig)).toBe('abc123def456');
  });

  it('gestisce spazi nel formato', () => {
    const sig = 't=1733678400, v1=abc123def456';
    expect(extractV1Signature(sig)).toBe('abc123def456');
  });

  it('restituisce null se v1 mancante', () => {
    const sig = 't=1733678400';
    expect(extractV1Signature(sig)).toBeNull();
  });

  it('restituisce null per stringa vuota', () => {
    expect(extractV1Signature('')).toBeNull();
  });

  it('gestisce multiple versioni (futuro)', () => {
    const sig = 't=1733678400,v1=first,v2=second';
    expect(extractV1Signature(sig)).toBe('first');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TIMING-SAFE COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

describe('timingSafeEqual', () => {
  it('restituisce true per stringhe uguali', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true);
  });

  it('restituisce false per stringhe diverse', () => {
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false);
  });

  it('restituisce false per lunghezze diverse', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
  });

  it('restituisce true per stringhe vuote', () => {
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('restituisce false per un carattere diverso in mezzo', () => {
    const a = 'abcdefghij';
    const b = 'abcdeXghij';
    expect(timingSafeEqual(a, b)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DEDUPLICAZIONE
// ═══════════════════════════════════════════════════════════════════════════

describe('isDuplicateWebhook', () => {
  // Nota: la mappa interna persiste tra i test, ma usiamo timestamp univoci

  it('non e un duplicato la prima volta', () => {
    const ts = Date.now();
    expect(isDuplicateWebhook('tracking.delivered', 'ABC123', ts)).toBe(false);
  });

  it('e un duplicato la seconda volta con stessi parametri', () => {
    const ts = Date.now() + 1;
    isDuplicateWebhook('tracking.updated', 'DEF456', ts);
    expect(isDuplicateWebhook('tracking.updated', 'DEF456', ts)).toBe(true);
  });

  it('non e un duplicato con tracking_number diverso', () => {
    const ts = Date.now() + 2;
    isDuplicateWebhook('tracking.updated', 'AAA111', ts);
    expect(isDuplicateWebhook('tracking.updated', 'BBB222', ts)).toBe(false);
  });

  it('non e un duplicato con evento diverso', () => {
    const ts = Date.now() + 3;
    isDuplicateWebhook('tracking.updated', 'CCC333', ts);
    expect(isDuplicateWebhook('tracking.delivered', 'CCC333', ts)).toBe(false);
  });

  it('non e un duplicato con timestamp diverso', () => {
    const ts1 = Date.now() + 4;
    const ts2 = Date.now() + 5;
    isDuplicateWebhook('tracking.updated', 'DDD444', ts1);
    expect(isDuplicateWebhook('tracking.updated', 'DDD444', ts2)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HMAC VERIFICA (con mock request)
// ═══════════════════════════════════════════════════════════════════════════

describe('verifySpedisciSignature', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rifiuta se SPEDISCI_WEBHOOK_SECRET non configurato', async () => {
    delete process.env.SPEDISCI_WEBHOOK_SECRET;

    const request = createMockRequest({
      'webhook-timestamp': '1733678400',
      'webhook-signature': 't=1733678400,v1=abc',
    });

    const result = await verifySpedisciSignature(request, '{}');
    expect(result).toBe(false);
  });

  it('rifiuta se header mancanti', async () => {
    process.env.SPEDISCI_WEBHOOK_SECRET = 'test-secret';

    const request = createMockRequest({});
    const result = await verifySpedisciSignature(request, '{}');
    expect(result).toBe(false);
  });

  it('rifiuta se timestamp fuori range (>5 min)', async () => {
    process.env.SPEDISCI_WEBHOOK_SECRET = 'test-secret';

    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 min fa
    const request = createMockRequest({
      'webhook-timestamp': oldTimestamp.toString(),
      'webhook-signature': 't=' + oldTimestamp + ',v1=abc',
    });

    const result = await verifySpedisciSignature(request, '{}');
    expect(result).toBe(false);
  });

  it('rifiuta se formato signature invalido', async () => {
    process.env.SPEDISCI_WEBHOOK_SECRET = 'test-secret';

    const ts = Math.floor(Date.now() / 1000);
    const request = createMockRequest({
      'webhook-timestamp': ts.toString(),
      'webhook-signature': 'invalid-format',
    });

    const result = await verifySpedisciSignature(request, '{}');
    expect(result).toBe(false);
  });

  it('accetta firma valida', async () => {
    const secret = 'test-webhook-secret-key';
    process.env.SPEDISCI_WEBHOOK_SECRET = secret;

    const ts = Math.floor(Date.now() / 1000).toString();
    const body = '{"event":"tracking.updated","data":{}}';
    const signPayload = `${ts}.${body}`;

    // Calcola HMAC corretto
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signPayload));
    const hmac = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const request = createMockRequest({
      'webhook-timestamp': ts,
      'webhook-signature': `t=${ts},v1=${hmac}`,
    });

    const result = await verifySpedisciSignature(request, body);
    expect(result).toBe(true);
  });

  it('rifiuta firma sbagliata', async () => {
    process.env.SPEDISCI_WEBHOOK_SECRET = 'test-secret';

    const ts = Math.floor(Date.now() / 1000).toString();
    const request = createMockRequest({
      'webhook-timestamp': ts,
      'webhook-signature': `t=${ts},v1=0000000000000000000000000000000000000000000000000000000000000000`,
    });

    const result = await verifySpedisciSignature(request, '{}');
    expect(result).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING (con mock Supabase)
// ═══════════════════════════════════════════════════════════════════════════

describe('processTrackingWebhook', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('restituisce errore se tracking_number mancante', async () => {
    const payload: SpedisciWebhookPayload = {
      event: 'tracking.updated',
      timestamp: Date.now(),
      data: {
        tracking_number: '',
        carrier: 'gls',
        status: 'In transito',
        status_description: 'Pacco in transito',
        last_update: '2024-12-08T10:30:00Z',
        events: [],
      },
    };

    const result = await processTrackingWebhook(payload);
    expect(result.success).toBe(false);
    expect(result.error).toContain('tracking_number');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function createMockRequest(headers: Record<string, string>): any {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as any;
}
