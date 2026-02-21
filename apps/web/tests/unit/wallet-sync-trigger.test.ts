/**
 * Test: Wallet Sync Trigger Migration (STEP 1)
 *
 * Verifica che la migration SQL per il trigger sync
 * users.wallet_balance → workspaces.wallet_balance sia corretta.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260216120000_wallet_sync_trigger.sql'
);

describe('Wallet Sync Trigger Migration (STEP 1)', () => {
  let sql: string;

  it('il file migration esiste', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('crea la funzione sync_wallet_to_workspace', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.sync_wallet_to_workspace()');
    expect(sql).toContain('RETURNS TRIGGER');
    expect(sql).toContain('SECURITY DEFINER');
  });

  it('il trigger si attiva su AFTER UPDATE OF wallet_balance ON users', () => {
    expect(sql).toContain('AFTER UPDATE OF wallet_balance ON users');
    expect(sql).toContain('FOR EACH ROW');
    expect(sql).toContain('EXECUTE FUNCTION public.sync_wallet_to_workspace()');
  });

  it('il trigger ha nome deterministico trg_sync_wallet_to_workspace', () => {
    expect(sql).toContain('CREATE TRIGGER trg_sync_wallet_to_workspace');
  });

  it('propaga solo se wallet_balance è effettivamente cambiato (IS DISTINCT FROM)', () => {
    expect(sql).toContain('NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance');
  });

  it('aggiorna workspaces tramite primary_workspace_id', () => {
    expect(sql).toContain('WHERE id = NEW.primary_workspace_id');
  });

  it('il backfill aggiorna solo righe con valori diversi via primary_workspace_id', () => {
    expect(sql).toContain('UPDATE workspaces w');
    expect(sql).toContain('FROM users u');
    expect(sql).toContain('w.id = u.primary_workspace_id');
    expect(sql).toContain('w.wallet_balance IS DISTINCT FROM u.wallet_balance');
  });

  it('usa DROP TRIGGER IF EXISTS per idempotenza della migration', () => {
    expect(sql).toContain('DROP TRIGGER IF EXISTS trg_sync_wallet_to_workspace ON users');
  });
});
