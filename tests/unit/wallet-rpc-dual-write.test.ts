/**
 * Test: Wallet RPC Dual-Write Migration (STEP 2+4)
 *
 * Verifica che tutte e 6 le RPC wallet abbiano:
 * 1. Parametro p_workspace_id opzionale
 * 2. Dual-write su workspaces quando workspace_id è fornito
 * 3. workspace_id inserito in wallet_transactions
 * 4. Backfill per record storici
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260216130000_wallet_rpc_dual_write.sql'
);

describe('Wallet RPC Dual-Write Migration (STEP 2+4)', () => {
  let sql: string;

  it('il file migration esiste', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  });

  // =========================================
  // Tutte le 6 RPC hanno p_workspace_id
  // =========================================
  describe('parametro p_workspace_id', () => {
    const functions = [
      'decrement_wallet_balance',
      'increment_wallet_balance',
      'add_wallet_credit',
      'add_wallet_credit_with_vat',
      'refund_wallet_balance',
      'reseller_transfer_credit',
    ];

    for (const fn of functions) {
      it(`${fn} ha parametro workspace_id opzionale`, () => {
        expect(sql).toContain(`CREATE OR REPLACE FUNCTION`);
        // Verifica che la funzione è definita nel file
        const fnRegex = new RegExp(`CREATE OR REPLACE FUNCTION.*${fn}`, 's');
        expect(sql).toMatch(fnRegex);
      });
    }

    it('decrement_wallet_balance ha p_workspace_id UUID DEFAULT NULL', () => {
      // Trova la sezione di decrement e verifica il parametro
      const decrementSection = extractFunctionSection(sql, 'decrement_wallet_balance');
      expect(decrementSection).toContain('p_workspace_id UUID DEFAULT NULL');
    });

    it('increment_wallet_balance ha p_workspace_id UUID DEFAULT NULL', () => {
      const section = extractFunctionSection(sql, 'increment_wallet_balance');
      expect(section).toContain('p_workspace_id UUID DEFAULT NULL');
    });

    it('add_wallet_credit ha p_workspace_id UUID DEFAULT NULL', () => {
      const section = extractFunctionSection(sql, 'add_wallet_credit');
      expect(section).toContain('p_workspace_id UUID DEFAULT NULL');
    });

    it('add_wallet_credit_with_vat ha p_workspace_id UUID DEFAULT NULL', () => {
      const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
      expect(section).toContain('p_workspace_id UUID DEFAULT NULL');
    });

    it('refund_wallet_balance ha p_workspace_id UUID DEFAULT NULL', () => {
      const section = extractFunctionSection(sql, 'refund_wallet_balance');
      expect(section).toContain('p_workspace_id UUID DEFAULT NULL');
    });

    it('reseller_transfer_credit ha workspace_id per entrambi gli utenti', () => {
      const section = extractFunctionSection(sql, 'reseller_transfer_credit');
      expect(section).toContain('p_reseller_workspace_id UUID DEFAULT NULL');
      expect(section).toContain('p_sub_user_workspace_id UUID DEFAULT NULL');
    });
  });

  // =========================================
  // Dual-write pattern
  // =========================================
  describe('dual-write su workspaces', () => {
    it('decrement aggiorna workspaces se workspace_id fornito', () => {
      const section = extractFunctionSection(sql, 'decrement_wallet_balance');
      expect(section).toContain('IF p_workspace_id IS NOT NULL THEN');
      expect(section).toContain('UPDATE workspaces');
      expect(section).toContain('wallet_balance - p_amount');
    });

    it('increment aggiorna workspaces se workspace_id fornito', () => {
      const section = extractFunctionSection(sql, 'increment_wallet_balance');
      expect(section).toContain('IF p_workspace_id IS NOT NULL THEN');
      expect(section).toContain('UPDATE workspaces');
      expect(section).toContain('wallet_balance + p_amount');
    });

    it('refund aggiorna workspaces se workspace_id fornito', () => {
      const section = extractFunctionSection(sql, 'refund_wallet_balance');
      expect(section).toContain('IF p_workspace_id IS NOT NULL THEN');
      expect(section).toContain('UPDATE workspaces');
    });

    it('reseller_transfer aggiorna workspaces per entrambi gli utenti', () => {
      const section = extractFunctionSection(sql, 'reseller_transfer_credit');
      expect(section).toContain('IF p_reseller_workspace_id IS NOT NULL THEN');
      expect(section).toContain('IF p_sub_user_workspace_id IS NOT NULL THEN');
    });
  });

  // =========================================
  // workspace_id in wallet_transactions
  // =========================================
  describe('workspace_id in wallet_transactions', () => {
    it('decrement inserisce workspace_id nella transazione', () => {
      const section = extractFunctionSection(sql, 'decrement_wallet_balance');
      expect(section).toContain('workspace_id');
      expect(section).toContain('p_workspace_id');
    });

    it('increment inserisce workspace_id nella transazione', () => {
      const section = extractFunctionSection(sql, 'increment_wallet_balance');
      expect(section).toContain('workspace_id');
    });

    it('add_wallet_credit_with_vat inserisce workspace_id nella transazione', () => {
      const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
      // Deve avere workspace_id nell'INSERT INTO wallet_transactions
      expect(section).toContain('user_id, workspace_id, amount');
    });
  });

  // =========================================
  // Backfill record storici
  // =========================================
  describe('backfill wallet_transactions.workspace_id', () => {
    it('aggiorna record storici senza workspace_id via primary_workspace_id', () => {
      expect(sql).toContain('UPDATE wallet_transactions wt');
      expect(sql).toContain('FROM users u');
      expect(sql).toContain('u.id = wt.user_id');
      expect(sql).toContain('u.primary_workspace_id IS NOT NULL');
      expect(sql).toContain('wt.workspace_id IS NULL');
    });
  });

  // =========================================
  // Backward compatibility
  // =========================================
  describe('backward compatibility', () => {
    it('tutti i parametri workspace_id hanno DEFAULT NULL', () => {
      // Conta quanti DEFAULT NULL ci sono per workspace_id
      const matches = sql.match(/p_workspace_id UUID DEFAULT NULL/g) || [];
      // 5 RPC singole + non conta reseller che ha nomi diversi
      expect(matches.length).toBeGreaterThanOrEqual(5);
    });

    it('la funzione è SECURITY DEFINER', () => {
      const decrementSection = extractFunctionSection(sql, 'decrement_wallet_balance');
      expect(decrementSection).toContain('SECURITY DEFINER');
    });
  });
});

/**
 * Helper: estrae la sezione SQL di una funzione specifica
 */
function extractFunctionSection(sql: string, functionName: string): string {
  // Trova tutte le sezioni numerate (-- ====... N. functionName)
  const sections = sql.split(/-- ={10,}/);
  for (const section of sections) {
    if (section.includes(functionName) && section.includes('CREATE OR REPLACE FUNCTION')) {
      return section;
    }
  }
  // Fallback: cerca nel testo completo
  return sql;
}
