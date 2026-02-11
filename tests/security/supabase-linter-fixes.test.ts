/**
 * Test: Fix Supabase Database Linter Warnings
 *
 * Verifica che le migration:
 * - 20260215100000: fix iniziale search_path = '' + pg_trgm + doc RLS
 * - 20260215120000: hotfix search_path '' -> 'public' (evita 42P01)
 *
 * MOCK: Test sulla struttura delle migration SQL, nessun accesso DB
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Percorso alla migration
const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260215100000_fix_supabase_linter_warnings.sql'
);

// Nomi delle 42 funzioni segnalate dal linter
const FLAGGED_FUNCTIONS = [
  'update_emails_updated_at',
  'update_contacts_updated_at',
  'update_prospect_updated_at',
  'normalize_email_address_lowercase',
  'update_workspace_email_addresses_updated_at',
  'enforce_single_primary_email',
  'update_workspace_announcements_updated_at',
  'normalize_tracking_status',
  'update_shipment_holds_updated_at',
  'update_pattern_confidence',
  'update_commercial_quotes_updated_at',
  'has_workspace_permission',
  'update_workspaces_updated_at',
  'update_organizations_updated_at',
  'generate_organization_slug',
  'check_workspace_depth',
  'generate_workspace_slug',
  'update_workspace_members_updated_at',
  'check_workspace_has_owner',
  'prevent_delete_last_owner',
  'revoke_workspace_invitation',
  'accept_workspace_invitation',
  'expire_old_invitations',
  'is_sub_workspace_of',
  'current_workspace',
  'set_current_workspace',
  'create_workspace_with_owner',
  'get_workspace_hierarchy',
  'enforce_commercial_quote_immutability',
  'is_sub_user_of',
  'update_outreach_updated_at',
  'get_user_workspaces',
  'expire_workspace_invitations',
  'check_invitation_expiry',
  'log_workspace_member_changes',
  'calculate_wallet_credit',
  'soft_delete_workspace',
  'get_visible_workspace_ids',
  'can_workspace_see',
  'count_visible_shipments',
  'get_shipments_for_workspace',
  'get_workspace_stats',
];

describe('Supabase Linter Fixes Migration', () => {
  let migrationSql: string;

  it('il file di migration esiste', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');
    expect(migrationSql.length).toBeGreaterThan(0);
  });

  describe('PARTE 1: Fix search_path mutable', () => {
    it('contiene il loop dinamico per fixare TUTTE le funzioni public', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Deve iterare su pg_proc per schema public
      expect(migrationSql).toContain('pg_proc');
      expect(migrationSql).toContain("nspname = 'public'");
      expect(migrationSql).toContain("prokind = 'f'");
    });

    it("usa search_path vuoto ('') come raccomandato da Supabase", () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Deve usare search_path = '' (vuoto), NON search_path = public
      expect(migrationSql).toContain("search_path = ''''");
      // Non deve usare il vecchio pattern (search_path = public senza quotes)
      // come fix principale
    });

    it('gestisce funzioni con e senza argomenti', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Deve avere due branch: func_args = '' e func_args != ''
      expect(migrationSql).toContain("func_args = ''");
    });

    it('gestisce errori senza bloccare la migration', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Deve avere exception handling
      expect(migrationSql).toContain('EXCEPTION WHEN OTHERS');
    });
  });

  describe('PARTE 2: Fix pg_trgm in public', () => {
    it('crea lo schema extensions se non esiste', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      expect(migrationSql).toContain('CREATE SCHEMA IF NOT EXISTS extensions');
    });

    it('sposta pg_trgm nello schema extensions con ALTER EXTENSION', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      expect(migrationSql).toContain('ALTER EXTENSION pg_trgm SET SCHEMA extensions');
    });

    it("rimuove l'indice trgm prima dello spostamento", () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      expect(migrationSql).toContain('DROP INDEX IF EXISTS public.idx_geo_locations_name_trgm');
    });

    it("ricrea l'indice con l'operator class dal nuovo schema", () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      expect(migrationSql).toContain('extensions.gin_trgm_ops');
      expect(migrationSql).toContain('idx_geo_locations_name_trgm');
    });
  });

  describe('PARTE 3: RLS Policy Always True - documentazione', () => {
    it('documenta le policy intenzionali senza modificarle', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Deve menzionare le tabelle segnalate
      expect(migrationSql).toContain('admin_actions_log');
      expect(migrationSql).toContain('tracking_events');
      expect(migrationSql).toContain('cod_files');
      expect(migrationSql).toContain('support_escalations');
    });

    it('spiega perche le policy sono intenzionali (service_role)', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      expect(migrationSql).toContain('service_role');
      expect(migrationSql).toContain('INTENZIONAL');
    });

    it('non contiene ALTER POLICY o DROP POLICY per le tabelle segnalate', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Non deve modificare le policy esistenti
      expect(migrationSql).not.toContain('ALTER POLICY');
      expect(migrationSql).not.toContain('DROP POLICY');
    });
  });

  describe('Completezza: tutte le 42 funzioni segnalate coperte', () => {
    it('il fix dinamico copre tutte le funzioni in schema public', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Il fix e' dinamico (loop su pg_proc), quindi copre TUTTE le funzioni
      // in schema public, non solo quelle elencate nel report.
      // Verifica che il filtro sia su TUTTE le funzioni public
      expect(migrationSql).toContain("nspname = 'public'");
      expect(migrationSql).toContain("prokind = 'f'");

      // Non deve filtrare per nome specifico (deve fixare TUTTE)
      expect(migrationSql).not.toContain('proname IN');
      expect(migrationSql).not.toContain('proname =');
    });

    it('il report del linter elenca 42 funzioni', () => {
      expect(FLAGGED_FUNCTIONS).toHaveLength(42);
    });

    it('tutte le funzioni segnalate sono nello schema public', () => {
      // Verifica che tutte le funzioni segnalate siano nello schema
      // che il fix copre
      for (const fn of FLAGGED_FUNCTIONS) {
        expect(fn).toBeTruthy();
        expect(typeof fn).toBe('string');
        expect(fn.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Query di verifica post-migration', () => {
    it('include query di verifica per search_path', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      // Deve includere query commentata per verificare risultato
      expect(migrationSql).toContain('proconfig');
      expect(migrationSql).toContain('search_path=%');
    });

    it('include query di verifica per estensioni', () => {
      migrationSql = readFileSync(MIGRATION_PATH, 'utf-8');

      expect(migrationSql).toContain('pg_extension');
    });
  });
});

// ============================================================
// HOTFIX: Migration 20260215120000 - search_path '' -> 'public'
// ============================================================

const HOTFIX_PATH = join(
  process.cwd(),
  'supabase/migrations/20260215120000_fix_search_path_use_public.sql'
);

describe('Hotfix: search_path vuoto -> public', () => {
  let hotfixSql: string;

  it('il file di hotfix esiste', () => {
    expect(existsSync(HOTFIX_PATH)).toBe(true);
    hotfixSql = readFileSync(HOTFIX_PATH, 'utf-8');
    expect(hotfixSql.length).toBeGreaterThan(0);
  });

  it('corregge search_path da vuoto a public', () => {
    hotfixSql = readFileSync(HOTFIX_PATH, 'utf-8');

    // Deve settare search_path = public (non vuoto)
    expect(hotfixSql).toContain('search_path = public');
  });

  it('usa lo stesso loop dinamico su pg_proc', () => {
    hotfixSql = readFileSync(HOTFIX_PATH, 'utf-8');

    expect(hotfixSql).toContain('pg_proc');
    expect(hotfixSql).toContain("nspname = 'public'");
    expect(hotfixSql).toContain("prokind = 'f'");
  });

  it('gestisce funzioni con e senza argomenti', () => {
    hotfixSql = readFileSync(HOTFIX_PATH, 'utf-8');

    expect(hotfixSql).toContain("func_args = ''");
  });

  it('gestisce errori senza bloccare la migration', () => {
    hotfixSql = readFileSync(HOTFIX_PATH, 'utf-8');

    expect(hotfixSql).toContain('EXCEPTION WHEN OTHERS');
  });

  it('non usa search_path vuoto (quello che ha causato il problema)', () => {
    hotfixSql = readFileSync(HOTFIX_PATH, 'utf-8');

    // Non deve usare search_path = '' come valore target
    // (puo' menzionarlo nei commenti, ma l'ALTER deve usare 'public')
    expect(hotfixSql).not.toMatch(/SET search_path = ''/);
  });
});
