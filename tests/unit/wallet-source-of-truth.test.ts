/**
 * Test Guardian: Wallet Source of Truth
 *
 * Verifica che tutti i caller TypeScript usino RPC v2 (workspace source of truth)
 * e che nessuno usi più le RPC v1 per operazioni wallet.
 *
 * Eccezioni:
 * - File di test (*.test.ts) sono esclusi
 * - File nella cartella supabase/migrations (SQL v1 rimangono per rollback)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';

// RPC v1 che NON devono più essere usate nei caller TypeScript
const DEPRECATED_V1_RPCS = [
  'decrement_wallet_balance',
  'increment_wallet_balance',
  // Le seguenti v1 sono deprecate in favore delle v2
  // ma manteniamo il check separato per add_wallet_credit/deduct_wallet_credit/etc.
];

// RPC v1 che devono essere sostituite con _v2
const V1_TO_V2_MAP: Record<string, string> = {
  "rpc('add_wallet_credit'": "rpc('add_wallet_credit_v2'",
  "rpc('add_wallet_credit_with_vat'": "rpc('add_wallet_credit_with_vat_v2'",
  "rpc('deduct_wallet_credit'": "rpc('deduct_wallet_credit_v2'",
  "rpc('refund_wallet_balance'": "rpc('refund_wallet_balance_v2'",
  "rpc('reseller_transfer_credit'": "rpc('reseller_transfer_credit_v2'",
  "rpc('decrement_wallet_balance'": "rpc('deduct_wallet_credit_v2'",
  "rpc('increment_wallet_balance'": "rpc('add_wallet_credit_v2'",
};

// File da controllare (caller wallet)
const WALLET_CALLER_FILES = [
  'lib/shipments/create-shipment-core.ts',
  'app/actions/wallet.ts',
  'actions/super-admin.ts',
  'app/api/stripe/webhook/route.ts',
  'actions/admin-reseller.ts',
  'lib/services/giacenze/giacenze-service.ts',
  'lib/ai/tools/support-tools.ts',
];

describe('Wallet Source of Truth: tutti i caller usano RPC v2', () => {
  for (const relPath of WALLET_CALLER_FILES) {
    const filePath = path.join(process.cwd(), relPath);

    it(`${relPath} non usa RPC v1 deprecate`, () => {
      if (!fs.existsSync(filePath)) {
        // File non esiste ancora o è stato spostato - skip
        return;
      }

      const code = fs.readFileSync(filePath, 'utf-8');

      for (const [v1Pattern, v2Replacement] of Object.entries(V1_TO_V2_MAP)) {
        // Cerca uso di v1 (escludendo commenti)
        const lines = code.split('\n');
        const violations: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          // Ignora commenti
          if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
          if (line.includes(v1Pattern)) {
            // Verifica che non sia già la versione v2
            if (!line.includes(v1Pattern.replace("'", "_v2'"))) {
              violations.push(`Riga ${i + 1}: ${line.substring(0, 100)}`);
            }
          }
        }

        expect(
          violations,
          `${relPath} usa ancora ${v1Pattern} (dovrebbe essere ${v2Replacement}):\n${violations.join('\n')}`
        ).toHaveLength(0);
      }
    });
  }
});

describe('credit-check.ts legge da workspaces (non users)', () => {
  it('checkCreditBeforeBooking accetta workspaceId come parametro', () => {
    const filePath = path.join(process.cwd(), 'lib/wallet/credit-check.ts');
    const code = fs.readFileSync(filePath, 'utf-8');
    expect(code).toContain('workspaceId');
  });

  it('legge wallet_balance da workspaces quando workspaceId è fornito', () => {
    const filePath = path.join(process.cwd(), 'lib/wallet/credit-check.ts');
    const code = fs.readFileSync(filePath, 'utf-8');
    // Deve avere un path che legge da workspaces
    expect(code).toContain("from('workspaces')");
    expect(code).toContain('wallet_balance');
  });
});

describe('/api/user/info legge wallet da workspace', () => {
  it('legge wallet_balance dal workspace primario', () => {
    const filePath = path.join(process.cwd(), 'app/api/user/info/route.ts');
    const code = fs.readFileSync(filePath, 'utf-8');
    // Deve leggere da workspaces
    expect(code).toContain("from('workspaces')");
  });
});
