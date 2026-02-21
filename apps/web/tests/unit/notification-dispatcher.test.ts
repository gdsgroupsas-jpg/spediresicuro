/**
 * Test: Notification Dispatcher per Webhook Tracking
 *
 * Testa le regole di routing: quali eventi generano notifiche e quali no.
 * Usa un approccio semplificato con mock Supabase tramite un builder fluente.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Tracciamo le chiamate insert
const insertedNotifications: any[] = [];

// Mock Supabase con supporto fluent per catene diverse
vi.mock('@supabase/supabase-js', () => {
  const createChain = () => {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.gte = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.insert = vi.fn().mockImplementation((data: any) => {
      insertedNotifications.push(data);
      return Promise.resolve({ error: null });
    });
    return chain;
  };

  return {
    createClient: () => ({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'shipments') {
          const chain = createChain();
          chain.single = vi.fn().mockResolvedValue({
            data: { user_id: 'user-123', workspace_id: null },
            error: null,
          });
          return chain;
        }
        if (table === 'support_notifications') {
          return createChain();
        }
        if (table === 'anne_user_memory') {
          const chain = createChain();
          chain.single = vi.fn().mockResolvedValue({
            data: { preferences: { notification_channels: ['in_app'] } },
            error: null,
          });
          return chain;
        }
        if (table === 'workspaces') {
          const chain = createChain();
          chain.single = vi.fn().mockResolvedValue({
            data: { parent_workspace_id: null },
            error: null,
          });
          return chain;
        }
        return createChain();
      }),
    }),
  };
});

import { dispatchTrackingNotification } from '@/lib/services/tracking/notification-dispatcher';
import type { SpedisciWebhookPayload } from '@/lib/services/tracking/webhook-processor';

describe('dispatchTrackingNotification', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    insertedNotifications.length = 0;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const makePayload = (
    event: SpedisciWebhookPayload['event'],
    status: string
  ): SpedisciWebhookPayload => ({
    event,
    timestamp: Date.now(),
    data: {
      tracking_number: 'TEST123',
      carrier: 'gls',
      status,
      status_description: 'Test description',
      last_update: new Date().toISOString(),
      events: [],
    },
  });

  it('crea notifica per tracking.delivered', async () => {
    const payload = makePayload('tracking.delivered', 'Consegnata');
    await dispatchTrackingNotification(payload, 'shipment-1');

    expect(insertedNotifications.length).toBeGreaterThanOrEqual(1);
    const notification = insertedNotifications[0];
    expect(notification.type).toBe('shipment_delivered');
    expect(notification.user_id).toBe('user-123');
    expect(notification.shipment_id).toBe('shipment-1');
    expect(notification.message).toContain('TEST123');
  });

  it('crea notifica per tracking.exception (giacenza)', async () => {
    const payload = makePayload('tracking.exception', 'In giacenza');
    await dispatchTrackingNotification(payload, 'shipment-2');

    expect(insertedNotifications.length).toBeGreaterThanOrEqual(1);
    const notification = insertedNotifications[0];
    expect(notification.type).toBe('giacenza_detected');
  });

  it('NON crea notifica per in_transit (troppo frequente)', async () => {
    const payload = makePayload('tracking.updated', 'In transito');
    await dispatchTrackingNotification(payload, 'shipment-3');

    expect(insertedNotifications.length).toBe(0);
  });

  it('crea notifica per out_for_delivery', async () => {
    const payload = makePayload('tracking.updated', 'In consegna');
    await dispatchTrackingNotification(payload, 'shipment-4');

    expect(insertedNotifications.length).toBeGreaterThanOrEqual(1);
    const notification = insertedNotifications[0];
    expect(notification.type).toBe('tracking_out_for_delivery');
  });

  it('include channels_delivered con almeno in_app', async () => {
    const payload = makePayload('tracking.delivered', 'Consegnata');
    await dispatchTrackingNotification(payload, 'shipment-5');

    expect(insertedNotifications.length).toBeGreaterThanOrEqual(1);
    const notification = insertedNotifications[0];
    expect(notification.channels_delivered).toContain('in_app');
  });

  it('include metadata con tracking_number e carrier', async () => {
    const payload = makePayload('tracking.delivered', 'Consegnata');
    await dispatchTrackingNotification(payload, 'shipment-6');

    expect(insertedNotifications.length).toBeGreaterThanOrEqual(1);
    const notification = insertedNotifications[0];
    expect(notification.metadata.tracking_number).toBe('TEST123');
    expect(notification.metadata.carrier).toBe('gls');
  });

  it('NON crea notifica per stati intermedi (created, picked_up)', async () => {
    const payload1 = makePayload('tracking.updated', 'Spedizione generata');
    await dispatchTrackingNotification(payload1, 'shipment-7a');

    const payload2 = makePayload('tracking.updated', 'Ritirato');
    await dispatchTrackingNotification(payload2, 'shipment-7b');

    expect(insertedNotifications.length).toBe(0);
  });
});
