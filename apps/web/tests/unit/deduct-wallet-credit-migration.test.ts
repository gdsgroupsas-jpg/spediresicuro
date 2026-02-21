/**
 * Test: Migration deduct_wallet_credit con workspace_id + fix doppia tx
 *
 * Verifica che:
 * 1. La RPC accetta p_workspace_id UUID DEFAULT NULL
 * 2. NON chiama più decrement_wallet_balance (evita doppia tx)
 * 3. Fa lock pessimistico + UPDATE diretto su users
 * 4. Inserisce workspace_id in wallet_transactions
 * 5. È SECURITY DEFINER
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260216150000_deduct_wallet_credit_workspace_id.sql'
);

describe('Migration: deduct_wallet_credit con workspace_id', () => {
  let sql: string;

  it('il file migration esiste', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('droppa vecchia signature per evitare ambiguità', () => {
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.deduct_wallet_credit');
  });

  it('ha parametro p_workspace_id UUID DEFAULT NULL', () => {
    expect(sql).toContain('p_workspace_id UUID DEFAULT NULL');
  });

  it('è SECURITY DEFINER', () => {
    expect(sql).toContain('SECURITY DEFINER');
  });

  it('NON chiama decrement_wallet_balance (evita doppia transazione)', () => {
    // Il fix principale: non delegare più a decrement_wallet_balance
    expect(sql).not.toContain('PERFORM decrement_wallet_balance');
    expect(sql).not.toContain('SELECT decrement_wallet_balance');
  });

  it('fa lock pessimistico diretto con FOR UPDATE NOWAIT', () => {
    expect(sql).toContain('FOR UPDATE NOWAIT');
  });

  it('verifica saldo sufficiente', () => {
    expect(sql).toContain('v_current_balance < p_amount');
    expect(sql).toContain('Insufficient balance');
  });

  it('fa UPDATE diretto su users.wallet_balance', () => {
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('wallet_balance = wallet_balance - p_amount');
  });

  it('inserisce workspace_id in wallet_transactions', () => {
    expect(sql).toContain('workspace_id');
    expect(sql).toContain('p_workspace_id');
    // Verifica che workspace_id sia nella INSERT
    const insertSection = sql.substring(
      sql.indexOf('INSERT INTO wallet_transactions'),
      sql.indexOf('RETURNING id INTO v_transaction_id')
    );
    expect(insertSection).toContain('workspace_id');
    expect(insertSection).toContain('p_workspace_id');
  });

  it('gestisce lock_not_available exception', () => {
    expect(sql).toContain('WHEN lock_not_available THEN');
    expect(sql).toContain('Wallet locked by concurrent operation');
  });

  it('valida importo positivo e massimo', () => {
    expect(sql).toContain('p_amount <= 0');
    expect(sql).toContain('p_amount > 100000.00');
  });

  it('ritorna UUID (transaction_id)', () => {
    expect(sql).toContain('RETURNS UUID');
    expect(sql).toContain('RETURNING id INTO v_transaction_id');
    expect(sql).toContain('RETURN v_transaction_id');
  });
});
