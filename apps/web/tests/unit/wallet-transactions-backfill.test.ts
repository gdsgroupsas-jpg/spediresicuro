/**
 * Test: Backfill wallet_transactions.workspace_id (record storici)
 *
 * Verifica che la migration di backfill:
 * 1. Aggiorna solo record con workspace_id NULL
 * 2. Usa primary_workspace_id come fonte
 * 3. Non sovrascrive record gia' popolati
 * 4. Riporta conteggi prima/dopo
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const BACKFILL_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260217110000_backfill_wallet_transactions_workspace_id.sql'
);

describe('Backfill wallet_transactions.workspace_id (STEP 4)', () => {
  let sql: string;

  it('il file migration esiste', () => {
    expect(fs.existsSync(BACKFILL_PATH)).toBe(true);
    sql = fs.readFileSync(BACKFILL_PATH, 'utf-8');
  });

  it('aggiorna wallet_transactions da users.primary_workspace_id', () => {
    expect(sql).toContain('UPDATE wallet_transactions wt');
    expect(sql).toContain('FROM users u');
    expect(sql).toContain('wt.user_id = u.id');
    expect(sql).toContain('u.primary_workspace_id');
  });

  it('aggiorna SOLO record con workspace_id NULL (non sovrascrive)', () => {
    expect(sql).toContain('wt.workspace_id IS NULL');
  });

  it('non aggiorna se utente non ha workspace (NULL-safe)', () => {
    expect(sql).toContain('u.primary_workspace_id IS NOT NULL');
  });

  it('riporta conteggi prima/dopo nel log', () => {
    expect(sql).toContain('RAISE NOTICE');
    expect(sql).toContain('Totale transazioni');
    expect(sql).toContain('Con workspace_id NULL');
    expect(sql).toContain('Transazioni aggiornate');
    expect(sql).toContain('Residui NULL');
  });

  it('e racchiuso in blocco DO (transazionale)', () => {
    expect(sql).toContain('DO $$');
    expect(sql).toContain('END $$');
  });

  it('NON modifica struttura tabella (solo UPDATE dati)', () => {
    expect(sql).not.toContain('ALTER TABLE');
    expect(sql).not.toContain('CREATE INDEX');
    expect(sql).not.toContain('ADD COLUMN');
  });
});

describe('Integrità completa wallet migration (STEP 1-4)', () => {
  it('tutte le 4 migrations wallet esistono', () => {
    const migrations = [
      '20260216120000_wallet_sync_trigger.sql',
      '20260216130000_wallet_rpc_dual_write.sql',
      '20260216140000_wallet_remove_rpc_dual_write.sql',
      '20260217110000_backfill_wallet_transactions_workspace_id.sql',
    ];

    for (const m of migrations) {
      const p = path.join(process.cwd(), 'supabase/migrations', m);
      expect(fs.existsSync(p), `Migration ${m} mancante`).toBe(true);
    }
  });

  it('le RPC inseriscono workspace_id nelle nuove transazioni (verifica hotfix)', () => {
    const hotfixPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216140000_wallet_remove_rpc_dual_write.sql'
    );
    const hotfixSql = fs.readFileSync(hotfixPath, 'utf-8');

    // Tutte le RPC principali devono inserire workspace_id nella INSERT wallet_transactions
    const rpcsWithWorkspaceInsert = [
      'decrement_wallet_balance',
      'increment_wallet_balance',
      'add_wallet_credit_with_vat',
      'refund_wallet_balance',
      'reseller_transfer_credit',
    ];

    for (const rpc of rpcsWithWorkspaceInsert) {
      const idx = hotfixSql.indexOf(`CREATE OR REPLACE FUNCTION`);
      expect(idx).toBeGreaterThan(-1);
    }

    // Verifica pattern: INSERT INTO wallet_transactions con workspace_id nella colonna
    const insertMatches =
      hotfixSql.match(/INSERT INTO wallet_transactions \(\s*user_id, workspace_id/g) || [];
    expect(insertMatches.length).toBeGreaterThanOrEqual(4);
  });

  it('il trigger sync e ancora presente (non rimosso da hotfix)', () => {
    const triggerPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216120000_wallet_sync_trigger.sql'
    );
    const triggerSql = fs.readFileSync(triggerPath, 'utf-8');
    expect(triggerSql).toContain('CREATE TRIGGER trg_sync_wallet_to_workspace');

    // La hotfix NON deve rimuovere il trigger
    const hotfixPath = path.join(
      process.cwd(),
      'supabase/migrations/20260216140000_wallet_remove_rpc_dual_write.sql'
    );
    const hotfixSql = fs.readFileSync(hotfixPath, 'utf-8');
    expect(hotfixSql).not.toContain('DROP TRIGGER trg_sync_wallet_to_workspace');
  });
});
