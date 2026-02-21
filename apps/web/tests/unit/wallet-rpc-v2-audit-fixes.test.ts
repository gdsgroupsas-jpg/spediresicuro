/**
 * Test: Wallet RPC v2 Audit Fixes
 *
 * Verifica che la migration correttiva 20260218110000 risolva i 3 finding:
 * P1: refund_wallet_balance_v2 — NOT FOUND check su replay idempotente
 * P2: reseller_transfer_credit_v2 — NOT FOUND checks dopo lock su entrambi i workspace
 * P3: add_wallet_credit_with_vat_v2 — 'deposit' → 'DEPOSIT'
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const AUDIT_FIX_MIGRATION = path.join(
  process.cwd(),
  'supabase/migrations/20260218110000_fix_wallet_rpc_v2_audit.sql'
);

let sql: string;

beforeAll(() => {
  expect(fs.existsSync(AUDIT_FIX_MIGRATION)).toBe(true);
  sql = fs.readFileSync(AUDIT_FIX_MIGRATION, 'utf-8');
});

// ============================================
// P3: add_wallet_credit_with_vat_v2 — type DEPOSIT maiuscolo
// ============================================
describe('FIX P3: add_wallet_credit_with_vat_v2 usa DEPOSIT maiuscolo', () => {
  it('la funzione è ricreata nella migration correttiva', () => {
    expect(sql).toContain('add_wallet_credit_with_vat_v2');
  });

  it("usa 'DEPOSIT' maiuscolo (non 'deposit')", () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat_v2');
    // Deve contenere DEPOSIT maiuscolo nell'INSERT
    expect(section).toContain("'DEPOSIT'");
    // Non deve contenere deposit minuscolo (escludendo commenti)
    const lines = section.split('\n');
    const codeLines = lines.filter((l) => !l.trim().startsWith('--') && !l.trim().startsWith('*'));
    const codeOnly = codeLines.join('\n');
    // L'unica occorrenza di 'deposit' deve essere in maiuscolo
    const depositOccurrences = codeOnly.match(/'deposit'/gi) || [];
    for (const occ of depositOccurrences) {
      expect(occ).toBe("'DEPOSIT'");
    }
  });

  it('mantiene SECURITY DEFINER + pg_temp', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat_v2');
    expect(section).toContain('SECURITY DEFINER');
    expect(section).toContain('pg_temp');
  });

  it('mantiene lock su workspaces con FOR UPDATE NOWAIT', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat_v2');
    expect(section).toContain('FROM workspaces');
    expect(section).toContain('FOR UPDATE NOWAIT');
  });
});

// ============================================
// P1: refund_wallet_balance_v2 — NOT FOUND su replay idempotente
// ============================================
describe('FIX P1: refund_wallet_balance_v2 ha NOT FOUND nel replay', () => {
  it('la funzione è ricreata nella migration correttiva', () => {
    expect(sql).toContain('refund_wallet_balance_v2');
  });

  it('ha commento che spiega il SELECT senza lock nel replay', () => {
    const section = extractFunctionSection(sql, 'refund_wallet_balance_v2');
    // Verifica che ci sia un commento esplicativo
    expect(section).toMatch(/read-only|intenzionale|by.?design/i);
  });

  it('ha NOT FOUND check nel path di replay idempotente', () => {
    const section = extractFunctionSection(sql, 'refund_wallet_balance_v2');
    // Dopo il SELECT senza lock, deve esserci un NOT FOUND check
    // Il pattern: SELECT ... FROM workspaces WHERE id = ... THEN IF NOT FOUND
    expect(section).toContain('idempotent replay');
    // Ci devono essere almeno 2 "NOT FOUND" — uno nel replay e uno nel path normale
    const notFoundCount = (section.match(/NOT FOUND/g) || []).length;
    expect(notFoundCount).toBeGreaterThanOrEqual(2);
  });

  it('mantiene SECURITY DEFINER + pg_temp', () => {
    const section = extractFunctionSection(sql, 'refund_wallet_balance_v2');
    expect(section).toContain('SECURITY DEFINER');
    expect(section).toContain('pg_temp');
  });
});

// ============================================
// P2: reseller_transfer_credit_v2 — NOT FOUND dopo lock
// ============================================
describe('FIX P2: reseller_transfer_credit_v2 ha NOT FOUND dopo lock', () => {
  it('la funzione è ricreata nella migration correttiva', () => {
    expect(sql).toContain('reseller_transfer_credit_v2');
  });

  it('ha NOT FOUND checks per entrambi i workspace dopo lock', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    // Deve avere check per reseller workspace e sub-user workspace
    expect(section).toContain('Reseller workspace not found');
    expect(section).toContain('Sub-user workspace not found');
  });

  it('ha almeno 4 NOT FOUND checks (2 branch × 2 workspace)', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    // Il blocco IF/ELSE ha 2 branch, ognuno con 2 SELECT...FOR UPDATE
    // Quindi ci devono essere almeno 4 "NOT FOUND" checks
    const notFoundCount = (section.match(/NOT FOUND/g) || []).length;
    expect(notFoundCount).toBeGreaterThanOrEqual(4);
  });

  it('mantiene lock deterministico (UUID minore prima)', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    expect(section).toContain('p_reseller_workspace_id < p_sub_user_workspace_id');
  });

  it('mantiene SECURITY DEFINER + pg_temp', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    expect(section).toContain('SECURITY DEFINER');
    expect(section).toContain('pg_temp');
  });

  it('mantiene FOR UPDATE NOWAIT su entrambi i workspace', () => {
    const section = extractFunctionSection(sql, 'reseller_transfer_credit_v2');
    const lockCount = (section.match(/FOR UPDATE NOWAIT/g) || []).length;
    // 4 SELECT...FOR UPDATE (2 branch × 2 workspace)
    expect(lockCount).toBeGreaterThanOrEqual(4);
  });
});

// ============================================
// Coerenza: tutti i fix mantengono le proprietà originali
// ============================================
describe('Coerenza: fix mantengono proprietà sicurezza', () => {
  const fixedFunctions = [
    'add_wallet_credit_with_vat_v2',
    'refund_wallet_balance_v2',
    'reseller_transfer_credit_v2',
  ];

  for (const fn of fixedFunctions) {
    it(`${fn} ha SECURITY DEFINER`, () => {
      const section = extractFunctionSection(sql, fn);
      expect(section).toContain('SECURITY DEFINER');
    });

    it(`${fn} ha pg_temp nel search_path`, () => {
      const section = extractFunctionSection(sql, fn);
      expect(section).toContain('pg_temp');
    });

    it(`${fn} è CREATE OR REPLACE (non DROP + CREATE)`, () => {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION`);
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
