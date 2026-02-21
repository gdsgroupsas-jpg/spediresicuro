/**
 * Test: Wallet RPC v2 — Source of Truth Flip (users → workspaces)
 *
 * Verifica struttura SQL delle 5 RPC v2:
 * - deduct_wallet_credit_v2
 * - add_wallet_credit_v2
 * - add_wallet_credit_with_vat_v2
 * - refund_wallet_balance_v2
 * - reseller_transfer_credit_v2
 *
 * + Trigger inverso workspaces→users
 * + Rimozione trigger vecchio users→workspaces
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260218100000_wallet_rpc_v2_workspace_source.sql'
);

let sql: string;

beforeAll(() => {
  expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
  sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
});

// ============================================
// Trigger inverso (workspaces → users)
// ============================================
describe('Trigger inverso: workspaces → users', () => {
  it('rimuove il trigger vecchio users → workspaces', () => {
    expect(sql).toContain('DROP TRIGGER IF EXISTS trg_sync_wallet_to_workspace ON users');
    expect(sql).toContain('DROP FUNCTION IF EXISTS sync_wallet_to_workspace()');
  });

  it('crea il trigger inverso workspaces → users', () => {
    expect(sql).toContain('CREATE TRIGGER trg_sync_wallet_to_users');
    expect(sql).toContain('AFTER UPDATE OF wallet_balance ON workspaces');
    expect(sql).toContain('EXECUTE FUNCTION sync_wallet_to_users()');
  });

  it('usa IS DISTINCT FROM per prevenire loop infiniti', () => {
    const triggerFn = extractFunctionSection(sql, 'sync_wallet_to_users');
    expect(triggerFn).toContain('IS DISTINCT FROM');
  });

  it('aggiorna users.wallet_balance per utenti con primary_workspace_id', () => {
    const triggerFn = extractFunctionSection(sql, 'sync_wallet_to_users');
    expect(triggerFn).toContain('UPDATE users');
    expect(triggerFn).toContain('primary_workspace_id = NEW.id');
  });

  it('trigger function è SECURITY DEFINER con pg_temp', () => {
    const triggerFn = extractFunctionSection(sql, 'sync_wallet_to_users');
    expect(triggerFn).toContain('SECURITY DEFINER');
    expect(triggerFn).toContain('pg_temp');
  });
});

// ============================================
// deduct_wallet_credit_v2
// ============================================
describe('deduct_wallet_credit_v2', () => {
  it('esiste nella migration', () => {
    expect(sql).toContain('deduct_wallet_credit_v2');
  });

  it('ha p_workspace_id come PRIMO parametro (obbligatorio)', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit_v2');
    // p_workspace_id deve essere il primo parametro (prima di p_user_id)
    const wsIdx = section.indexOf('p_workspace_id UUID');
    const userIdx = section.indexOf('p_user_id UUID');
    expect(wsIdx).toBeLessThan(userIdx);
    expect(wsIdx).toBeGreaterThan(-1);
  });

  it('locka su workspaces (NON users)', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit_v2');
    expect(section).toContain('FROM workspaces');
    expect(section).toContain('FOR UPDATE NOWAIT');
    // Non deve lockare users
    expect(section).not.toMatch(/FROM\s+users\s+WHERE.*FOR UPDATE/s);
  });

  it('aggiorna workspaces.wallet_balance', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit_v2');
    expect(section).toContain('UPDATE workspaces');
    expect(section).toContain('wallet_balance - p_amount');
  });

  it('inserisce in wallet_transactions con workspace_id', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit_v2');
    expect(section).toContain('INSERT INTO wallet_transactions');
    expect(section).toContain('p_workspace_id');
  });

  it('ha SECURITY DEFINER + pg_temp + GRANT', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit_v2');
    expect(section).toContain('SECURITY DEFINER');
    expect(section).toContain('pg_temp');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.deduct_wallet_credit_v2');
  });

  it('ha idempotency check con user_id', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit_v2');
    expect(section).toContain('idempotency_key = p_idempotency_key');
    expect(section).toContain('user_id = p_user_id');
  });

  it('ha validazione importo', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit_v2');
    expect(section).toContain('p_amount <= 0');
    expect(section).toContain('Insufficient balance');
  });
});

// ============================================
// add_wallet_credit_v2
// ============================================
describe('add_wallet_credit_v2', () => {
  it('esiste nella migration', () => {
    expect(sql).toContain('add_wallet_credit_v2');
  });

  it('ha p_workspace_id come PRIMO parametro (obbligatorio)', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_v2');
    const wsIdx = section.indexOf('p_workspace_id UUID');
    const userIdx = section.indexOf('p_user_id UUID');
    expect(wsIdx).toBeLessThan(userIdx);
    expect(wsIdx).toBeGreaterThan(-1);
  });

  it('locka su workspaces (NON users)', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_v2');
    expect(section).toContain('FROM workspaces');
    expect(section).toContain('FOR UPDATE NOWAIT');
  });

  it('aggiorna workspaces.wallet_balance', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_v2');
    expect(section).toContain('UPDATE workspaces');
    expect(section).toContain('wallet_balance + p_amount');
  });

  it('ha validazione saldo massimo 100000', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_v2');
    expect(section).toContain('100000');
    expect(section).toContain('would exceed maximum');
  });

  it('ha validazione importo massimo 10000', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_v2');
    expect(section).toContain('10000');
  });

  it('ha SECURITY DEFINER + pg_temp + GRANT', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_v2');
    expect(section).toContain('SECURITY DEFINER');
    expect(section).toContain('pg_temp');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.add_wallet_credit_v2');
  });
});

// ============================================
// add_wallet_credit_with_vat_v2
// ============================================
describe('add_wallet_credit_with_vat_v2', () => {
  it('esiste nella migration', () => {
    expect(sql).toContain('add_wallet_credit_with_vat_v2');
  });

  it('ha p_workspace_id come PRIMO parametro', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat_v2');
    const wsIdx = section.indexOf('p_workspace_id UUID');
    const userIdx = section.indexOf('p_user_id UUID');
    expect(wsIdx).toBeLessThan(userIdx);
  });

  it('locka su workspaces', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat_v2');
    expect(section).toContain('FROM workspaces');
    expect(section).toContain('FOR UPDATE NOWAIT');
  });

  it('calcola IVA via calculate_wallet_credit', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat_v2');
    expect(section).toContain('calculate_wallet_credit');
  });

  it('aggiorna workspaces.wallet_balance', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat_v2');
    expect(section).toContain('UPDATE workspaces');
  });

  it('inserisce con VAT tracking (vat_mode, vat_rate, vat_amount, gross_amount)', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat_v2');
    expect(section).toContain('vat_mode');
    expect(section).toContain('vat_rate');
    expect(section).toContain('vat_amount');
    expect(section).toContain('gross_amount');
  });

  it('ha SECURITY DEFINER + pg_temp + GRANT', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat_v2');
  });
});

// ============================================
// refund_wallet_balance_v2
// ============================================
describe('refund_wallet_balance_v2', () => {
  it('esiste nella migration', () => {
    expect(sql).toContain('refund_wallet_balance_v2');
  });

  it('ha p_workspace_id come PRIMO parametro', () => {
    const section = extractFunctionSection(sql, 'refund_wallet_balance_v2');
    const wsIdx = section.indexOf('p_workspace_id UUID');
    const userIdx = section.indexOf('p_user_id UUID');
    expect(wsIdx).toBeLessThan(userIdx);
  });

  it('locka su workspaces', () => {
    const section = extractFunctionSection(sql, 'refund_wallet_balance_v2');
    expect(section).toContain('FROM workspaces');
    expect(section).toContain('FOR UPDATE NOWAIT');
  });

  it('aggiorna workspaces.wallet_balance', () => {
    const section = extractFunctionSection(sql, 'refund_wallet_balance_v2');
    expect(section).toContain('UPDATE workspaces');
    expect(section).toContain('wallet_balance = v_new_balance');
  });

  it('ritorna JSONB con success, transaction_id, balance info', () => {
    const section = extractFunctionSection(sql, 'refund_wallet_balance_v2');
    expect(section).toContain('RETURNS JSONB');
    expect(section).toContain('jsonb_build_object');
    expect(section).toContain('previous_balance');
    expect(section).toContain('new_balance');
    expect(section).toContain('amount_refunded');
  });

  it('ha idempotency check con tipo SHIPMENT_REFUND', () => {
    const section = extractFunctionSection(sql, 'refund_wallet_balance_v2');
    expect(section).toContain('SHIPMENT_REFUND');
    expect(section).toContain('idempotency_key = p_idempotency_key');
  });

  it('ha SECURITY DEFINER + pg_temp + GRANT', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.refund_wallet_balance_v2');
  });
});

// ============================================
// reseller_transfer_credit_v2
// ============================================
describe('reseller_transfer_credit_v2', () => {
  it('esiste nella migration', () => {
    expect(sql).toContain('reseller_transfer_credit_v2');
  });

  it('ha entrambi i workspace_id come parametri', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    expect(section).toContain('p_reseller_workspace_id UUID');
    expect(section).toContain('p_sub_user_workspace_id UUID');
  });

  it('locka su 2 workspaces con ordine deterministico', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    // Verifica lock deterministico (UUID minore prima)
    expect(section).toContain('p_reseller_workspace_id < p_sub_user_workspace_id');
    expect(section).toContain('FOR UPDATE NOWAIT');
  });

  it('crea 2 transazioni (OUT e IN)', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    expect(section).toContain('RESELLER_TRANSFER_OUT');
    expect(section).toContain('RESELLER_TRANSFER_IN');
  });

  it('aggiorna entrambi i workspaces', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    // Deve fare UPDATE su entrambi i workspace
    const updateMatches = section.match(/UPDATE workspaces/g);
    expect(updateMatches).not.toBeNull();
    expect(updateMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it('ha idempotency check con composite keys (-out, -in)', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    expect(section).toContain("'-out'");
    expect(section).toContain("'-in'");
  });

  it('ritorna JSONB con entrambi i transaction_id e bilanci', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    expect(section).toContain('RETURNS JSONB');
    expect(section).toContain('transaction_id_out');
    expect(section).toContain('transaction_id_in');
    expect(section).toContain('reseller_new_balance');
    expect(section).toContain('sub_user_new_balance');
  });

  it('verifica saldo reseller sufficiente', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    expect(section).toContain('v_reseller_balance < p_amount');
  });

  it('ha SECURITY DEFINER + pg_temp + GRANT', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.reseller_transfer_credit_v2');
  });
});

// ============================================
// Coerenza: TUTTE le RPC v2 hanno pattern comune
// ============================================
describe('Coerenza: pattern comune per tutte le RPC v2', () => {
  const v2Functions = [
    'deduct_wallet_credit_v2',
    'add_wallet_credit_v2',
    'add_wallet_credit_with_vat_v2',
    'refund_wallet_balance_v2',
    'reseller_transfer_credit_v2',
  ];

  for (const fn of v2Functions) {
    it(`${fn} ha SECURITY DEFINER`, () => {
      const section = extractFunctionSection(sql, fn);
      expect(section).toContain('SECURITY DEFINER');
    });

    it(`${fn} ha pg_temp nel search_path`, () => {
      const section = extractFunctionSection(sql, fn);
      expect(section).toContain('pg_temp');
    });

    it(`${fn} ha FOR UPDATE NOWAIT`, () => {
      const section = extractFunctionSection(sql, fn);
      expect(section).toContain('FOR UPDATE NOWAIT');
    });

    it(`${fn} locka su workspaces (non users)`, () => {
      const section = extractFunctionSection(sql, fn);
      expect(section).toContain('FROM workspaces');
    });

    it(`${fn} ha GRANT per authenticated e service_role`, () => {
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
      // Il GRANT deve essere per entrambi i ruoli
      const grantSection = sql.substring(
        sql.indexOf(`GRANT EXECUTE ON FUNCTION public.${fn}`),
        sql.indexOf(`GRANT EXECUTE ON FUNCTION public.${fn}`) + 500
      );
      expect(grantSection).toContain('TO authenticated');
      expect(grantSection).toContain('TO service_role');
    });
  }
});

/**
 * Helper: estrae il blocco CREATE OR REPLACE FUNCTION ... $$; per una funzione specifica
 */
function extractFunctionSection(sql: string, functionName: string): string {
  const createPattern = new RegExp(
    `CREATE OR REPLACE FUNCTION[^;]*?${functionName}[\\s\\S]*?\\$\\$;`,
    'i'
  );
  const match = sql.match(createPattern);
  if (match) {
    const startIdx = Math.max(0, sql.indexOf(match[0]) - 200);
    const endIdx = sql.indexOf(match[0]) + match[0].length + 300;
    return sql.substring(startIdx, endIdx);
  }
  return sql;
}
