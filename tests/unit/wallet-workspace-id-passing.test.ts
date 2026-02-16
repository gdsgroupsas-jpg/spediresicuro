/**
 * Test: Wallet Workspace ID Passing (STEP 3)
 *
 * Verifica che tutti i caller TypeScript delle RPC wallet
 * passano p_workspace_id per il dual-write.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Wallet Workspace ID Passing (STEP 3)', () => {
  // =========================================
  // getUserWorkspaceId helper
  // =========================================
  describe('getUserWorkspaceId helper', () => {
    it('esiste in lib/db/user-helpers.ts', () => {
      const filePath = path.join(process.cwd(), 'lib/db/user-helpers.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('export async function getUserWorkspaceId');
      expect(content).toContain('primary_workspace_id');
    });

    it('ritorna null se utente non ha workspace (non blocca il flusso)', () => {
      const filePath = path.join(process.cwd(), 'lib/db/user-helpers.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('return null');
      // Deve avere un catch che ritorna null (fail-safe)
      expect(content).toContain('catch');
    });
  });

  // =========================================
  // Caller: create-shipment-core.ts
  // =========================================
  describe('create-shipment-core.ts', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'lib/shipments/create-shipment-core.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("import { getUserWorkspaceId } from '@/lib/db/user-helpers'");
    });

    it('passa p_workspace_id a decrement_wallet_balance', () => {
      expect(content).toContain('p_workspace_id: targetWorkspaceId');
    });

    it('passa p_workspace_id a refund_wallet_balance', () => {
      // Il refund deve passare workspace_id
      const refundCalls = content.match(/p_workspace_id: targetWorkspaceId/g) || [];
      // Almeno 3: 1 decrement + 2 refund
      expect(refundCalls.length).toBeGreaterThanOrEqual(3);
    });

    it('lookup workspace prima del wallet debit', () => {
      // getUserWorkspaceId deve essere chiamato nel file
      const workspaceIdx = content.indexOf('getUserWorkspaceId(targetId)');
      expect(workspaceIdx).toBeGreaterThan(-1);
      // Il lookup è prima del blocco WALLET DEBIT
      const walletDebitSection = content.indexOf('WALLET DEBIT PRIMA DELLA CHIAMATA CORRIERE');
      expect(workspaceIdx).toBeLessThan(walletDebitSection);
    });
  });

  // =========================================
  // Caller: actions/super-admin.ts
  // =========================================
  describe('actions/super-admin.ts', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'actions/super-admin.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getUserWorkspaceId');
    });

    it('passa p_workspace_id a add_wallet_credit', () => {
      expect(content).toContain('p_workspace_id: targetWorkspaceId');
    });
  });

  // =========================================
  // Caller: app/actions/wallet.ts
  // =========================================
  describe('app/actions/wallet.ts', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'app/actions/wallet.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getUserWorkspaceId');
    });

    it('passa p_workspace_id in entrambe le chiamate add_wallet_credit', () => {
      const matches = content.match(/p_workspace_id:/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================
  // Caller: actions/admin-reseller.ts
  // =========================================
  describe('actions/admin-reseller.ts', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'actions/admin-reseller.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getUserWorkspaceId');
    });

    it('passa workspace_id per entrambi gli utenti a reseller_transfer_credit', () => {
      expect(content).toContain('p_reseller_workspace_id: resellerWorkspaceId');
      expect(content).toContain('p_sub_user_workspace_id: subUserWorkspaceId');
    });
  });

  // =========================================
  // Caller: app/api/stripe/webhook/route.ts
  // =========================================
  describe('app/api/stripe/webhook/route.ts', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'app/api/stripe/webhook/route.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getUserWorkspaceId');
    });

    it('passa p_workspace_id a add_wallet_credit_with_vat', () => {
      expect(content).toContain('p_workspace_id: stripeWorkspaceId');
    });
  });

  // =========================================
  // Caller: actions/wallet.ts (legacy)
  // =========================================
  describe('actions/wallet.ts (legacy)', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'actions/wallet.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getUserWorkspaceId');
    });

    it('passa p_workspace_id a add_wallet_credit', () => {
      expect(content).toContain('p_workspace_id: walletWorkspaceId');
    });
  });

  // =========================================
  // Caller: app/api/spedizioni/route.ts (refund cancellazione)
  // =========================================
  describe('app/api/spedizioni/route.ts', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'app/api/spedizioni/route.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getUserWorkspaceId');
    });

    it('passa p_workspace_id a refund_wallet_balance', () => {
      expect(content).toContain('p_workspace_id: cancelRefundWorkspaceId');
    });
  });

  // =========================================
  // Caller: app/api/admin/shipments/[id]/route.ts (refund admin)
  // =========================================
  describe('app/api/admin/shipments/[id]/route.ts', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'app/api/admin/shipments/[id]/route.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getUserWorkspaceId');
    });

    it('passa p_workspace_id a refund_wallet_balance', () => {
      expect(content).toContain('p_workspace_id: refundWorkspaceId');
    });
  });

  // =========================================
  // Caller: lib/services/giacenze/giacenze-service.ts (debit giacenza)
  // =========================================
  describe('lib/services/giacenze/giacenze-service.ts', () => {
    let content: string;

    it('importa getUserWorkspaceId', () => {
      const filePath = path.join(process.cwd(), 'lib/services/giacenze/giacenze-service.ts');
      content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('getUserWorkspaceId');
    });

    it('passa p_workspace_id a decrement_wallet_balance', () => {
      expect(content).toContain('p_workspace_id: giacenzaWorkspaceId');
    });
  });
});
