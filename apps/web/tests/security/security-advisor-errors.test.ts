/**
 * Test: Fix Supabase Security Advisor ERRORS
 *
 * Verifica che la migration 20260215110000_fix_security_advisor_errors.sql:
 * 1. Ricrea v_platform_margin_alerts con security_invoker = true
 * 2. Abilita RLS su users, shipments, couriers, price_lists, platform_provider_costs
 * 3. Crea policy appropriate per ogni tabella
 * 4. Revoca accesso anon su users (colonna password esposta)
 *
 * MOCK: Test sulla struttura della migration SQL, nessun accesso DB
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260215110000_fix_security_advisor_errors.sql'
);

// Tabelle segnalate dal Security Advisor con RLS disabilitato
const TABLES_NEEDING_RLS = [
  'users',
  'shipments',
  'couriers',
  'price_lists',
  'platform_provider_costs',
];

describe('Security Advisor Errors Fix Migration', () => {
  let sql: string;

  it('il file di migration esiste', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    sql = readFileSync(MIGRATION_PATH, 'utf-8');
    expect(sql.length).toBeGreaterThan(0);
  });

  describe('PARTE 1: Fix v_platform_margin_alerts SECURITY DEFINER', () => {
    it('contiene DROP + CREATE della view', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('v_platform_margin_alerts');
      expect(sql).toContain('DROP VIEW IF EXISTS public.v_platform_margin_alerts');
    });

    it('ricrea con security_invoker = true', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('security_invoker = true');
    });

    it('usa pg_get_viewdef per preservare la definizione originale', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('pg_get_viewdef');
    });

    it('gestisce errori senza bloccare la migration', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('EXCEPTION');
      expect(sql).toContain('WHEN OTHERS');
    });
  });

  describe('PARTE 2: ENABLE ROW LEVEL SECURITY su 5 tabelle', () => {
    it('abilita RLS su tutte le 5 tabelle segnalate', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');

      for (const table of TABLES_NEEDING_RLS) {
        expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      }
    });

    it('NON disabilita RLS (non contiene DISABLE)', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).not.toContain('DISABLE ROW LEVEL SECURITY');
    });

    describe('Policy per users', () => {
      it('crea policy superadmin full access', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');
        expect(sql).toContain('Superadmin full access users');
      });

      it('crea policy view own profile', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');
        expect(sql).toContain('Users can view own profile');
        expect(sql).toContain('id = auth.uid()');
      });

      it('crea policy update own profile', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');
        expect(sql).toContain('Users can update own profile');
      });
    });

    describe('Policy per shipments', () => {
      it('abilita RLS senza creare nuove policy (esistono gia)', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');

        // Deve SOLO abilitare RLS, le policy esistono gia
        expect(sql).toContain('ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY');
        // Non deve ricreare policy che esistono gia
        expect(sql).not.toContain('"Users can view own shipments"');
      });
    });

    describe('Policy per couriers', () => {
      it('permette lettura a tutti gli autenticati (catalogo)', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');
        expect(sql).toContain('Authenticated can view couriers');
      });

      it('limita scrittura a superadmin', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');
        expect(sql).toContain('Superadmin can manage couriers');
      });
    });

    describe('Policy per price_lists', () => {
      it('abilita RLS senza creare nuove policy (esistono gia)', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');

        expect(sql).toContain('ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY');
        // Non deve ricreare policy che esistono gia
        expect(sql).not.toContain('"Users can view accessible price_lists"');
      });
    });

    describe('Policy per platform_provider_costs', () => {
      it('crea policy superadmin-only (dati finanziari)', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');
        expect(sql).toContain('Superadmin full access platform_provider_costs');
      });

      it('non crea policy per utenti normali (tabella riservata)', () => {
        sql = readFileSync(MIGRATION_PATH, 'utf-8');

        // Dopo la policy superadmin, non deve esserci policy per Users su questa tabella
        const afterPlatformCosts =
          sql.split('platform_provider_costs')[sql.split('platform_provider_costs').length - 1];
        // Non deve contenere policy per utenti normali su platform_provider_costs
        expect(afterPlatformCosts).not.toContain('Users can view platform_provider_costs');
      });
    });
  });

  describe('PARTE 3: Fix sensitive_columns_exposed', () => {
    it('revoca accesso anon su users', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('REVOKE ALL ON public.users FROM anon');
    });

    it('mantiene accesso SELECT per authenticated', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('GRANT SELECT ON public.users TO authenticated');
    });

    it('mantiene accesso UPDATE per authenticated', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('GRANT UPDATE ON public.users TO authenticated');
    });

    it('non concede INSERT a authenticated (gestito via service_role)', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      // Non deve avere GRANT INSERT ON public.users TO authenticated
      expect(sql).not.toMatch(/GRANT INSERT ON public\.users TO authenticated/);
    });
  });

  describe('Tutte le policy usano account_type superadmin', () => {
    it('il pattern superadmin e consistente', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Tutte le policy superadmin usano lo stesso pattern
      const superadminMatches = sql.match(/raw_user_meta_data->>'account_type' = 'superadmin'/g);
      // Dovrebbero esserci almeno 4 policy superadmin (users, couriers, platform_provider_costs * USING+CHECK)
      expect(superadminMatches).not.toBeNull();
      expect(superadminMatches!.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Query di verifica incluse', () => {
    it('include query verifica RLS', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('relrowsecurity');
    });

    it('include query verifica view', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('reloptions');
    });

    it('include query verifica permessi anon', () => {
      sql = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(sql).toContain('table_privileges');
    });
  });
});
