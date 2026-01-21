/**
 * Unit Tests: platform-cost-recorder.ts
 *
 * Test della logica di registrazione costi piattaforma.
 * Coverage:
 * - recordPlatformCost: skip per non-platform, insert via RPC, fallback diretto
 * - updateShipmentApiSource: update corretto del campo
 * - Graceful degradation: errori non bloccano
 * - Audit log per failure
 *
 * @since Sprint 1 - Financial Tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordPlatformCost,
  updateShipmentApiSource,
  type RecordPlatformCostParams,
  type ApiSource,
} from '@/lib/shipments/platform-cost-recorder';

// ==================== MOCK SUPABASE ====================

const createMockSupabase = (
  overrides: {
    rpcResult?: { data: any; error: any };
    insertResult?: { data: any; error: any };
    updateResult?: { error: any };
  } = {}
) => {
  const mockSingle = vi
    .fn()
    .mockResolvedValue(overrides.insertResult || { data: { id: 'fallback-id-123' }, error: null });
  const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
  const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
  const mockEq = vi.fn().mockResolvedValue(overrides.updateResult || { error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = vi.fn().mockReturnValue({
    insert: mockInsert,
    update: mockUpdate,
  });

  return {
    rpc: vi.fn().mockResolvedValue(overrides.rpcResult || { data: 'rpc-id-456', error: null }),
    from: mockFrom,
    _mocks: { mockInsert, mockUpdate, mockEq, mockFrom, mockSingle },
  } as any;
};

// ==================== FIXTURES ====================

const createValidParams = (
  overrides: Partial<RecordPlatformCostParams> = {}
): RecordPlatformCostParams => ({
  shipmentId: 'ship-123',
  trackingNumber: 'TRACK-ABC',
  billedUserId: 'user-456',
  billedAmount: 12.5,
  providerCost: 8.0,
  apiSource: 'platform',
  courierCode: 'BRT',
  serviceType: 'express',
  priceListId: 'pl-789',
  masterPriceListId: 'master-001',
  costSource: 'master_list',
  ...overrides,
});

// ==================== TESTS ====================

describe('platform-cost-recorder', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('recordPlatformCost', () => {
    it('should skip recording for non-platform api_source (reseller_own)', async () => {
      const mockSupabase = createMockSupabase();
      const params = createValidParams({ apiSource: 'reseller_own' });

      const result = await recordPlatformCost(mockSupabase, params);

      expect(result.success).toBe(true);
      expect(result.recordId).toBeUndefined();
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skip: api_source=reseller_own')
      );
    });

    it('should skip recording for non-platform api_source (byoc_own)', async () => {
      const mockSupabase = createMockSupabase();
      const params = createValidParams({ apiSource: 'byoc_own' });

      const result = await recordPlatformCost(mockSupabase, params);

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should record via RPC for platform api_source', async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { data: 'new-record-id', error: null },
      });
      const params = createValidParams();

      const result = await recordPlatformCost(mockSupabase, params);

      expect(result.success).toBe(true);
      expect(result.recordId).toBe('new-record-id');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_platform_provider_cost', {
        p_shipment_id: 'ship-123',
        p_tracking_number: 'TRACK-ABC',
        p_billed_user_id: 'user-456',
        p_billed_amount: 12.5,
        p_provider_cost: 8.0,
        p_api_source: 'platform',
        p_courier_code: 'BRT',
        p_service_type: 'express',
        p_price_list_id: 'pl-789',
        p_master_price_list_id: 'master-001',
        p_cost_source: 'master_list',
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Recorded: shipment=ship-123, margin=4.5')
      );
    });

    it('should use fallback insert when RPC fails', async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { data: null, error: { message: 'RPC error' } },
        insertResult: { data: { id: 'fallback-id' }, error: null },
      });
      const params = createValidParams();

      const result = await recordPlatformCost(mockSupabase, params);

      expect(result.success).toBe(true);
      expect(result.recordId).toBe('fallback-id');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PLATFORM_COST] ❌ Failed to record:',
        expect.objectContaining({ shipmentId: 'ship-123' })
      );
    });

    it('should return error but not throw when both RPC and fallback fail', async () => {
      const mockSupabase = createMockSupabase({
        rpcResult: { data: null, error: { message: 'RPC error' } },
        insertResult: { data: null, error: { message: 'Insert error' } },
      });
      const params = createValidParams();

      const result = await recordPlatformCost(mockSupabase, params);

      // Graceful degradation: non blocca, ma riporta errore
      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC error');
    });

    it('should use default cost_source when not provided', async () => {
      const mockSupabase = createMockSupabase();
      const params = createValidParams();
      delete (params as any).costSource;

      await recordPlatformCost(mockSupabase, params);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'record_platform_provider_cost',
        expect.objectContaining({ p_cost_source: 'estimate' })
      );
    });

    it('should handle null optional fields correctly', async () => {
      const mockSupabase = createMockSupabase();
      const params = createValidParams({
        serviceType: undefined,
        priceListId: undefined,
        masterPriceListId: undefined,
      });

      await recordPlatformCost(mockSupabase, params);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'record_platform_provider_cost',
        expect.objectContaining({
          p_service_type: null,
          p_price_list_id: null,
          p_master_price_list_id: null,
        })
      );
    });

    it('should log margin correctly in success message', async () => {
      const mockSupabase = createMockSupabase();
      const params = createValidParams({
        billedAmount: 20.0,
        providerCost: 15.0,
      });

      await recordPlatformCost(mockSupabase, params);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('margin=5'));
    });
  });

  describe('updateShipmentApiSource', () => {
    it('should update shipment with api_source only', async () => {
      const mockSupabase = createMockSupabase();

      await updateShipmentApiSource(mockSupabase, 'ship-123', 'platform');

      expect(mockSupabase.from).toHaveBeenCalledWith('shipments');
      expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith({
        api_source: 'platform',
      });
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('id', 'ship-123');
    });

    it('should update shipment with api_source and price_list_used_id', async () => {
      const mockSupabase = createMockSupabase();

      await updateShipmentApiSource(mockSupabase, 'ship-123', 'platform', 'pl-456');

      expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith({
        api_source: 'platform',
        price_list_used_id: 'pl-456',
      });
    });

    it('should handle update errors gracefully (no throw)', async () => {
      const mockSupabase = createMockSupabase({
        updateResult: { error: { message: 'Update failed' } },
      });

      // Non deve throwre
      await expect(
        updateShipmentApiSource(mockSupabase, 'ship-123', 'platform')
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PLATFORM_COST] Failed to update shipment api_source:',
        expect.any(Object)
      );
    });

    it('should update for all valid api_source values', async () => {
      const apiSources: ApiSource[] = ['platform', 'reseller_own', 'byoc_own', 'unknown'];

      for (const apiSource of apiSources) {
        const mockSupabase = createMockSupabase();
        await updateShipmentApiSource(mockSupabase, 'ship-123', apiSource);

        expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({ api_source: apiSource })
        );
      }
    });

    it('should log success message', async () => {
      const mockSupabase = createMockSupabase();

      await updateShipmentApiSource(mockSupabase, 'ship-123', 'byoc_own');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[PLATFORM_COST] Updated shipment ship-123 api_source=byoc_own'
      );
    });
  });
});
