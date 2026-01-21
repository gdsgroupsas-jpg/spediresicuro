#!/usr/bin/env tsx

/**
 * SMOKE TEST 2:
 * - label OK ma DB insert fallisce → refund + tentativo delete label
 * - se delete label fallisce → enqueue compensation_queue (DELETE)
 *
 * Usage:
 *   npx tsx scripts/smoke-test-no-label-no-credit-db-fail.ts
 */

import type { ActingContext } from '@/lib/safe-auth';
import type { CreateShipmentInput } from '@/lib/validations/shipment';
import {
  createShipmentCore,
  type CourierClient,
  type CourierCreateShippingResult,
} from '@/lib/shipments/create-shipment-core';
import {
  cleanupSmokeTestUser,
  createSmokeTestUser,
  fetchRows,
  getSupabaseAdminClient,
  getWalletBalance,
  loadEnvFromLocal,
} from './smoke-test-helpers';

function buildContext(user: { id: string; email: string }): ActingContext {
  return {
    actor: {
      id: user.id,
      email: user.email,
      name: 'Smoke Test',
      role: 'user',
      account_type: 'user',
      is_reseller: false,
    },
    target: {
      id: user.id,
      email: user.email,
      name: 'Smoke Test',
      role: 'user',
      account_type: 'user',
      is_reseller: false,
    },
    isImpersonating: false,
  };
}

function buildValidShipmentInput(): CreateShipmentInput {
  return {
    sender: {
      name: 'Mittente Test',
      address: 'Via Roma 1',
      city: 'Milano',
      province: 'MI',
      postalCode: '20100',
      country: 'IT',
      phone: '+393401234567',
      email: 'mittente@smoke-test.local',
    },
    recipient: {
      name: 'Destinatario Test',
      address: 'Via Milano 2',
      city: 'Roma',
      province: 'RM',
      postalCode: '00100',
      country: 'IT',
      phone: '+393409876543',
      email: 'dest@smoke-test.local',
    },
    packages: [{ length: 10, width: 10, height: 10, weight: 1 }],
    provider: 'spediscionline',
    carrier: 'GLS',
    notes: 'SMOKE TEST',
  };
}

function makeCourierClientLabelOkDeleteFail(resp: CourierCreateShippingResult): CourierClient {
  return {
    async createShipping() {
      return resp;
    },
    async deleteShipping() {
      throw new Error('FORCED_DELETE_LABEL_FAILURE');
    },
  };
}

async function main() {
  loadEnvFromLocal();
  const supabase = getSupabaseAdminClient();

  console.log('');
  console.log('🧪 SMOKE TEST 2 - Label OK, DB insert fail (No Label, No Credit)');
  console.log('='.repeat(78));

  const user = await createSmokeTestUser({
    supabase,
    initialBalance: 50,
    label: 'db-fail-after-label',
  });
  const ctx = buildContext(user);
  const validated = buildValidShipmentInput();

  const courierResp: CourierCreateShippingResult = {
    cost: 8.0,
    trackingNumber: `SMOKE-${Date.now()}`,
    shipmentId: `ship_${Date.now()}`,
    labelData: 'MOCK_LABEL_DATA',
    labelZPL: null,
  };

  const balanceBefore = await getWalletBalance({ supabase, userId: user.id });

  try {
    const result = await createShipmentCore({
      context: ctx,
      validated,
      deps: {
        supabaseAdmin: supabase,
        getCourierClient: async () => makeCourierClientLabelOkDeleteFail(courierResp),
        overrides: {
          insertShipment: async () => ({
            data: null,
            error: { message: 'FORCED_DB_INSERT_FAILURE' },
          }),
        },
      },
    });

    if (result.status !== 500) throw new Error(`Expected 500, got ${result.status}`);

    // No shipment row
    const shipments = await fetchRows({
      supabase,
      table: 'shipments',
      filter: { user_id: user.id },
      columns: 'id',
    });
    if (shipments.length !== 0) throw new Error(`Expected 0 shipments, got ${shipments.length}`);

    // Wallet refunded back to initial (best-effort)
    const balanceAfter = await getWalletBalance({ supabase, userId: user.id });
    if (Math.abs(balanceAfter - balanceBefore) > 0.01) {
      throw new Error(`Expected wallet refunded. Before=${balanceBefore} After=${balanceAfter}`);
    }

    // Delete label failed → compensation_queue DELETE should exist
    const queue = await fetchRows({
      supabase,
      table: 'compensation_queue',
      filter: { user_id: user.id },
      columns: 'id, action, status, shipment_id_external, tracking_number, error_context',
    });

    const deleteRows = queue.filter((r) => r.action === 'DELETE' && r.status === 'PENDING');
    if (deleteRows.length < 1) {
      throw new Error(
        `Expected DELETE PENDING in compensation_queue, got: ${JSON.stringify(queue)}`
      );
    }

    console.log(
      '✅ TEST PASSATO: label creata ma DB fallisce → refund + enqueue DELETE se delete fallisce'
    );
  } finally {
    await cleanupSmokeTestUser({ supabase, userId: user.id });
  }
}

main().catch((err) => {
  console.error('\n❌ TEST FALLITO:', err?.message || err);
  process.exit(1);
});
