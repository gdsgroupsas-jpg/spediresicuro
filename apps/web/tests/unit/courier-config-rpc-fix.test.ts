/**
 * Test: Fix RPC get_user_owned_courier_configs
 *
 * Bug: colonna "account_type" ambigua (PostgreSQL 42702)
 * Causa: account_type esiste sia nel RETURNS TABLE sia nella tabella users,
 *        e la SELECT FROM users non qualificava con alias.
 *
 * Fix: qualificare tutte le colonne con alias "u" e "cc".
 * Business rule invariata: superadmin vede solo config globali + proprie
 * (privacy reseller rispettata — multi-tenant isolation).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase/migrations/20260218110000_fix_courier_configs_rpc_ambiguous_column.sql'
);

describe('Fix RPC get_user_owned_courier_configs', () => {
  let sql: string;

  it('la migration esiste', () => {
    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  });

  it('usa alias "u" per disambiguare colonne users', () => {
    // Il bug era: SELECT account_type FROM users → ambiguo (42702)
    // Fix: SELECT u.account_type FROM users u
    expect(sql).toContain('FROM users u');
    expect(sql).toContain('u.account_type');
    expect(sql).toContain('u.is_reseller');
    expect(sql).toContain('u.email');
    expect(sql).toContain('u.id = p_user_id');
  });

  it('usa alias "cc" per disambiguare colonne courier_configs', () => {
    expect(sql).toContain('FROM courier_configs cc');
    expect(sql).toContain('cc.account_type');
    expect(sql).toContain('cc.owner_user_id');
  });

  it('superadmin vede solo config globali + proprie (privacy multi-tenant)', () => {
    // Il superadmin NON deve vedere le config private dei reseller
    // Cerchiamo il blocco superadmin: da "IN ('superadmin'" al "-- Reseller: SOLO"
    const superadminStart = sql.indexOf("IN ('superadmin', 'admin')");
    const resellerStart = sql.indexOf('-- Reseller: SOLO');
    const superadminBlock = sql.substring(superadminStart, resellerStart);
    // DEVE avere filtro owner per rispettare privacy reseller
    expect(superadminBlock).toContain('cc.owner_user_id IS NULL');
    expect(superadminBlock).toContain('cc.owner_user_id = p_user_id');
    expect(superadminBlock).toContain('cc.created_by = v_user_email');
  });

  it('reseller vede solo config proprie (privacy totale)', () => {
    const resellerStart = sql.indexOf('-- Reseller: SOLO');
    const normalStart = sql.indexOf('-- Utente normale:');
    const resellerBlock = sql.substring(resellerStart, normalStart);
    expect(resellerBlock).toContain('cc.owner_user_id = p_user_id');
    expect(resellerBlock).toContain('cc.created_by = v_user_email');
  });

  it('è SECURITY DEFINER con search_path sicuro', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('SET search_path = public, pg_temp');
  });
});
