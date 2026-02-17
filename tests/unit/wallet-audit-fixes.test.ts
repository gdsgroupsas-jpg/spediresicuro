/**
 * Test: Fix audit vulnerabilita wallet RPC (V1-V6)
 *
 * Verifica che tutti i fix dall'audit siano applicati:
 * V1 (P0): giacenze-service usa deduct_wallet_credit (no doppia tx)
 * V2 (P1): add_wallet_credit_with_vat ha FOR UPDATE NOWAIT
 * V3 (P1): add_wallet_credit_with_vat ha validazione importi
 * V4 (P1): deduct_wallet_credit ha p_idempotency_key
 * V5 (P2): createReseller usa RPC (no INSERT diretto)
 * V6 (P2): add_wallet_credit_with_vat ha pg_temp in search_path
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const AUDIT_FIX_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260217120000_fix_wallet_rpc_audit.sql'
);

describe('V1 (P0): giacenze-service.ts — singola wallet_transaction', () => {
  let code: string;

  it('il file esiste', () => {
    const filePath = path.join(process.cwd(), 'lib/services/giacenze/giacenze-service.ts');
    code = fs.readFileSync(filePath, 'utf-8');
  });

  it('usa deduct_wallet_credit (non decrement_wallet_balance) per azioni giacenza', () => {
    // Cerca la sezione del debit wallet nella funzione confirmHoldAction
    const debitSection = code.substring(
      code.indexOf('Debit wallet'),
      code.indexOf('walletTransactionId = result.data')
    );
    expect(debitSection).toContain('deduct_wallet_credit');
    expect(debitSection).not.toContain('decrement_wallet_balance');
  });

  it('passa p_type: GIACENZA_ACTION alla RPC', () => {
    expect(code).toContain("p_type: 'GIACENZA_ACTION'");
  });

  it('passa p_reference_id e p_reference_type', () => {
    expect(code).toContain('p_reference_id: holdId');
    expect(code).toContain("p_reference_type: 'giacenza_action'");
  });

  it('NON ha INSERT manuale in wallet_transactions dopo il debit', () => {
    // Tra il debit e l'update del hold, non deve esserci INSERT diretto
    const debitIdx = code.indexOf('deduct_wallet_credit');
    const updateIdx = code.indexOf('Update hold record');
    const betweenSection = code.substring(debitIdx, updateIdx);
    expect(betweenSection).not.toContain("from('wallet_transactions').insert");
  });
});

describe('V2 (P1): add_wallet_credit_with_vat ha FOR UPDATE NOWAIT', () => {
  let sql: string;

  it('la migration audit fix esiste', () => {
    expect(fs.existsSync(AUDIT_FIX_PATH)).toBe(true);
    sql = fs.readFileSync(AUDIT_FIX_PATH, 'utf-8');
  });

  it('add_wallet_credit_with_vat ha FOR UPDATE NOWAIT', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    expect(section).toContain('FOR UPDATE NOWAIT');
  });

  it('acquisisce lock PRIMA dell INSERT wallet_transactions', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    const lockIdx = section.indexOf('FOR UPDATE NOWAIT');
    const insertIdx = section.indexOf('INSERT INTO wallet_transactions');
    expect(lockIdx).toBeLessThan(insertIdx);
  });
});

describe('V3 (P1): add_wallet_credit_with_vat ha validazione importi', () => {
  let sql: string;

  it('la migration esiste', () => {
    sql = fs.readFileSync(AUDIT_FIX_PATH, 'utf-8');
  });

  it('valida importo positivo', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    expect(section).toContain('p_gross_amount <= 0');
  });

  it('valida importo massimo', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    expect(section).toContain('p_gross_amount > 10000');
  });

  it('valida saldo massimo risultante', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    expect(section).toContain('100000');
    expect(section).toContain('would exceed maximum');
  });
});

describe('V4 (P1): deduct_wallet_credit ha p_idempotency_key', () => {
  let sql: string;

  it('la migration esiste', () => {
    sql = fs.readFileSync(AUDIT_FIX_PATH, 'utf-8');
  });

  it('ha parametro p_idempotency_key', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit');
    expect(section).toContain('p_idempotency_key TEXT DEFAULT NULL');
  });

  it('ha idempotency check con SELECT prima del lock', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit');
    expect(section).toContain('IDEMPOTENCY CHECK');
    expect(section).toContain('WHERE idempotency_key = p_idempotency_key');
  });

  it('inserisce idempotency_key nella wallet_transaction', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit');
    expect(section).toContain('idempotency_key');
    // Deve apparire sia nella colonna INSERT che nel VALUES
    const insertBlock = section.substring(
      section.indexOf('INSERT INTO wallet_transactions'),
      section.indexOf('RETURNING id INTO')
    );
    expect(insertBlock).toContain('idempotency_key');
    expect(insertBlock).toContain('p_idempotency_key');
  });

  it('mantiene lock pessimistico e SECURITY DEFINER', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit');
    expect(section).toContain('FOR UPDATE NOWAIT');
    expect(section).toContain('SECURITY DEFINER');
  });

  it('ha pg_temp nel search_path', () => {
    const section = extractFunctionSection(sql, 'deduct_wallet_credit');
    expect(section).toContain('pg_temp');
  });
});

describe('V5 (P2): createReseller usa RPC (no INSERT diretto)', () => {
  let code: string;

  it('il file esiste', () => {
    const filePath = path.join(process.cwd(), 'actions/super-admin.ts');
    code = fs.readFileSync(filePath, 'utf-8');
  });

  it('usa add_wallet_credit RPC per credito iniziale', () => {
    const creditSection = code.substring(
      code.indexOf('credito iniziale'),
      code.indexOf('credito iniziale') + 600
    );
    expect(creditSection).toContain("rpc('add_wallet_credit'");
  });

  it('NON usa INSERT diretto in wallet_transactions per credito iniziale', () => {
    const creditSection = code.substring(
      code.indexOf('credito iniziale'),
      code.indexOf('credito iniziale') + 600
    );
    expect(creditSection).not.toContain("from('wallet_transactions').insert");
  });

  it('passa p_workspace_id al credito iniziale', () => {
    const creditSection = code.substring(
      code.indexOf('credito iniziale'),
      code.indexOf('credito iniziale') + 600
    );
    expect(creditSection).toContain('p_workspace_id: newResellerWorkspaceId');
  });
});

describe('V6 (P2): add_wallet_credit_with_vat ha pg_temp in search_path', () => {
  it('search_path include pg_temp', () => {
    const sql = fs.readFileSync(AUDIT_FIX_PATH, 'utf-8');
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    expect(section).toContain('pg_temp');
  });
});

// ============================================
// FIX POST-REVIEW: problemi trovati durante security review
// ============================================

const POST_REVIEW_FIX_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260217140000_fix_wallet_rpc_grant_idempotency.sql'
);

describe('V7 (POST-REVIEW): GRANT per deduct_wallet_credit', () => {
  let sql: string;

  it('la migration post-review esiste', () => {
    expect(fs.existsSync(POST_REVIEW_FIX_PATH)).toBe(true);
    sql = fs.readFileSync(POST_REVIEW_FIX_PATH, 'utf-8');
  });

  it('ha GRANT per authenticated', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.deduct_wallet_credit');
    expect(sql).toContain('TO authenticated');
  });

  it('ha GRANT per service_role', () => {
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.deduct_wallet_credit');
    expect(sql).toContain('TO service_role');
  });
});

describe('V8 (POST-REVIEW): idempotency add_wallet_credit_with_vat filtra per user_id', () => {
  let sql: string;

  it('la migration post-review esiste', () => {
    sql = fs.readFileSync(POST_REVIEW_FIX_PATH, 'utf-8');
  });

  it('idempotency check include AND user_id = p_user_id', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    // Deve avere sia idempotency_key che user_id nel check
    expect(section).toContain('idempotency_key = p_idempotency_key');
    expect(section).toContain('user_id = p_user_id');
  });

  it('mantiene SECURITY DEFINER + search_path pg_temp', () => {
    const section = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    expect(section).toContain('SECURITY DEFINER');
    expect(section).toContain('pg_temp');
  });
});

describe('V9 (POST-REVIEW): createReseller NON imposta wallet_balance nell INSERT', () => {
  let code: string;

  it('il file esiste', () => {
    const filePath = path.join(process.cwd(), 'actions/super-admin.ts');
    code = fs.readFileSync(filePath, 'utf-8');
  });

  it('INSERT di users ha wallet_balance: 0 (non initialCredit)', () => {
    // Trova la sezione INSERT in public.users per createReseller
    const insertSection = code.substring(
      code.indexOf('id: authUserId'),
      code.indexOf('id: authUserId') + 800
    );
    // Deve avere wallet_balance: 0 (il credito lo gestisce la RPC add_wallet_credit)
    expect(insertSection).toContain('wallet_balance: 0');
    expect(insertSection).not.toContain('wallet_balance: data.initialCredit');
  });
});

describe('Coerenza: TUTTE le RPC wallet hanno SECURITY DEFINER + FOR UPDATE NOWAIT', () => {
  it('verifica nella migration audit fix', () => {
    const sql = fs.readFileSync(AUDIT_FIX_PATH, 'utf-8');

    // Entrambe le funzioni ri-create devono avere SECURITY DEFINER
    const creditWithVat = extractFunctionSection(sql, 'add_wallet_credit_with_vat');
    const deductCredit = extractFunctionSection(sql, 'deduct_wallet_credit');

    expect(creditWithVat).toContain('SECURITY DEFINER');
    expect(creditWithVat).toContain('FOR UPDATE NOWAIT');

    expect(deductCredit).toContain('SECURITY DEFINER');
    expect(deductCredit).toContain('FOR UPDATE NOWAIT');
  });
});

/**
 * Helper: estrae il blocco CREATE OR REPLACE FUNCTION ... $$; per una funzione specifica
 */
function extractFunctionSection(sql: string, functionName: string): string {
  // Trova il CREATE OR REPLACE FUNCTION che contiene il nome
  const createPattern = new RegExp(
    `CREATE OR REPLACE FUNCTION[^;]*?${functionName}[\\s\\S]*?\\$\\$;`,
    'i'
  );
  const match = sql.match(createPattern);
  if (match) {
    // Includi anche le righe precedenti (DROP, commenti, GRANT) per avere contesto completo
    const startIdx = Math.max(0, sql.indexOf(match[0]) - 500);
    const endIdx = sql.indexOf(match[0]) + match[0].length + 300;
    return sql.substring(startIdx, endIdx);
  }
  return sql;
}
