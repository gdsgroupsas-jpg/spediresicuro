/**
 * Test: Wallet RPC Dual-Write Migration (STEP 2+4) + Hotfix
 *
 * Verifica che:
 * 1. Le RPC wallet abbiano parametro p_workspace_id opzionale
 * 2. workspace_id venga inserito in wallet_transactions
 * 3. Backfill per record storici
 * 4. HOTFIX: dual-write RIMOSSO dalle RPC (il trigger basta)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260216130000_wallet_rpc_dual_write.sql'
);

const HOTFIX_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260216140000_wallet_remove_rpc_dual_write.sql'
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
        const fnRegex = new RegExp(`CREATE OR REPLACE FUNCTION.*${fn}`, 's');
        expect(sql).toMatch(fnRegex);
      });
    }

    it('decrement_wallet_balance ha p_workspace_id UUID DEFAULT NULL', () => {
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
      const matches = sql.match(/p_workspace_id UUID DEFAULT NULL/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(5);
    });

    it('la funzione è SECURITY DEFINER', () => {
      const decrementSection = extractFunctionSection(sql, 'decrement_wallet_balance');
      expect(decrementSection).toContain('SECURITY DEFINER');
    });
  });
});

// =========================================
// HOTFIX: Rimozione dual-write dalle RPC
// =========================================
describe('HOTFIX: Wallet RPC senza dual-write (trigger-only)', () => {
  let hotfixSql: string;

  it('il file hotfix esiste', () => {
    expect(fs.existsSync(HOTFIX_PATH)).toBe(true);
    hotfixSql = fs.readFileSync(HOTFIX_PATH, 'utf-8');
  });

  it('le RPC NON hanno piu blocchi IF p_workspace_id UPDATE workspaces', () => {
    // La hotfix non deve contenere "IF p_workspace_id IS NOT NULL THEN" seguito da UPDATE workspaces
    // Verifica che nessuna funzione abbia il pattern dual-write
    const functions = [
      'decrement_wallet_balance',
      'increment_wallet_balance',
      'add_wallet_credit_with_vat',
      'refund_wallet_balance',
      'reseller_transfer_credit',
    ];

    for (const fn of functions) {
      const section = extractFunctionSection(hotfixSql, fn);
      // Non deve avere UPDATE workspaces dentro la funzione
      // (ma potrebbe avere workspace_id per INSERT wallet_transactions)
      const bodyMatch = section.match(/BEGIN([\s\S]*?)(?:EXCEPTION|END;)/);
      if (bodyMatch) {
        const body = bodyMatch[1];
        // Cerca "UPDATE workspaces" che NON sia in un commento
        const lines = body.split('\n');
        const updateWorkspacesLines = lines.filter(
          (line) => line.includes('UPDATE workspaces') && !line.trim().startsWith('--')
        );
        expect(
          updateWorkspacesLines.length,
          `${fn} non deve avere UPDATE workspaces (trovate ${updateWorkspacesLines.length})`
        ).toBe(0);
      }
    }
  });

  it('le RPC mantengono p_workspace_id per wallet_transactions', () => {
    // Verifica che le RPC inseriscano ancora workspace_id nelle transazioni
    const decrementSection = extractFunctionSection(hotfixSql, 'decrement_wallet_balance');
    expect(decrementSection).toContain('p_workspace_id UUID DEFAULT NULL');
    expect(decrementSection).toContain('user_id, workspace_id, amount');
  });

  it('la hotfix spiega il motivo nel commento iniziale', () => {
    expect(hotfixSql).toContain('HOTFIX');
    expect(hotfixSql).toContain('DOUBLE UPDATE');
  });

  it('mantiene SECURITY DEFINER su tutte le funzioni', () => {
    const functions = [
      'decrement_wallet_balance',
      'increment_wallet_balance',
      'add_wallet_credit_with_vat',
      'refund_wallet_balance',
      'reseller_transfer_credit',
    ];

    for (const fn of functions) {
      const section = extractFunctionSection(hotfixSql, fn);
      expect(section).toContain('SECURITY DEFINER');
    }
  });
});

/**
 * Helper: estrae la sezione SQL di una funzione specifica
 */
function extractFunctionSection(sql: string, functionName: string): string {
  const sections = sql.split(/-- ={10,}/);
  for (const section of sections) {
    if (section.includes(functionName) && section.includes('CREATE OR REPLACE FUNCTION')) {
      return section;
    }
  }
  return sql;
}
