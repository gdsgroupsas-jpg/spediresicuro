/**
 * Test suite per i fix dell'audit round 2 (feb 2026)
 *
 * Copre:
 * - R2-1: Telegram webhook fail-closed quando TELEGRAM_WEBHOOK_SECRET manca
 * - R2-2: requireAdminRole/requireResellerRole usa account_type (non role)
 * - R2-3: getSpedizioni NON include workspace_id IS NULL (leak cross-workspace)
 * - R2-4: grantFeature accoda refund fallito a compensation_queue
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// R2-1: Telegram webhook — fail-closed quando secret manca
// ============================================================
describe('R2-1: Telegram webhook fail-closed', () => {
  it('verifyTelegramSecret ritorna false quando secret non configurato (fail-closed)', () => {
    const filePath = path.resolve('app/api/webhooks/telegram/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Cerco il blocco della funzione verifyTelegramSecret
    const fnMatch = content.match(
      /function verifyTelegramSecret[\s\S]*?if \(!expectedSecret\) \{[\s\S]*?return (true|false);/
    );
    expect(fnMatch).toBeTruthy();

    // DEVE ritornare false (fail-closed), NON true (fail-open)
    expect(fnMatch![1]).toBe('false');
  });

  it('NON contiene il vecchio pattern fail-open nel blocco !expectedSecret', () => {
    const filePath = path.resolve('app/api/webhooks/telegram/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Estrai il blocco if (!expectedSecret) { ... } (max 5 righe)
    const blockMatch = content.match(/if \(!expectedSecret\) \{[^}]{0,500}\}/);
    expect(blockMatch).toBeTruthy();

    // Il blocco NON deve contenere return true (fail-open)
    expect(blockMatch![0]).not.toContain('return true');
    // Il blocco DEVE contenere return false (fail-closed)
    expect(blockMatch![0]).toContain('return false');
  });
});

// ============================================================
// R2-2: requireAdminRole/requireResellerRole usa account_type
// ============================================================
describe('R2-2: api-middleware usa account_type (non role deprecated)', () => {
  it('requireAdminRole usa isAdminOrAbove (account_type)', () => {
    const filePath = path.resolve('lib/api-middleware.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // DEVE usare isAdminOrAbove dal modulo auth-helpers
    expect(content).toContain(
      "import { isAdminOrAbove, isResellerCheck } from '@/lib/auth-helpers'"
    );

    // DEVE usare isAdminOrAbove(user) nel check admin
    expect(content).toContain('!isAdminOrAbove(user)');

    // NON DEVE usare il vecchio pattern role !== 'admin'
    expect(content).not.toContain("user.role !== 'admin'");
  });

  it('requireResellerRole usa isResellerCheck e isAdminOrAbove (account_type)', () => {
    const filePath = path.resolve('lib/api-middleware.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // DEVE usare isResellerCheck e isAdminOrAbove
    expect(content).toContain('!isResellerCheck(user)');
    expect(content).toContain('!isAdminOrAbove(user)');

    // NON DEVE usare il vecchio pattern role !== 'reseller'
    expect(content).not.toContain("user.role !== 'reseller'");
    expect(content).not.toMatch(/user\.role\s*!==\s*'reseller'/);
  });

  it('findUserByEmail include account_type e is_reseller nel select', () => {
    const filePath = path.resolve('lib/api-middleware.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Default select deve includere account_type e is_reseller
    expect(content).toContain('account_type');
    expect(content).toContain('is_reseller');
  });
});

// ============================================================
// R2-3: getSpedizioni — no workspace_id IS NULL leak
// ============================================================
describe('R2-3: getSpedizioni NON include workspace_id IS NULL', () => {
  it('database/shipments.ts getSpedizioni NON ha workspace_id.is.null nel filtro gerarchico', () => {
    const filePath = path.resolve('lib/database/shipments.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Trova il blocco del filtro gerarchico (visibleIds)
    const hierarchyBlock = content.match(
      /visibleIds && visibleIds\.length > 0[\s\S]*?(?:query\s*=\s*query\.[\s\S]*?;)/
    );
    expect(hierarchyBlock).toBeTruthy();

    // Il blocco NON DEVE contenere workspace_id.is.null
    expect(hierarchyBlock![0]).not.toContain('workspace_id.is.null');
  });

  it('database/shipments.ts usa .in() per filtrare workspace visibili (non .or())', () => {
    const filePath = path.resolve('lib/database/shipments.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Deve usare .in('workspace_id', visibleIds) — piu sicuro di .or()
    expect(content).toContain(".in('workspace_id', visibleIds)");
  });
});

// ============================================================
// R2-4: grantFeature — compensation_queue per refund fallito
// ============================================================
describe('R2-4: grantFeature accoda refund fallito a compensation_queue', () => {
  it('super-admin.ts accoda a compensation_queue quando refund fallisce', () => {
    const filePath = path.resolve('actions/super-admin.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Deve avere INSERT nella compensation_queue
    expect(content).toContain('compensation_queue');
    expect(content).toContain("action: 'REFUND'");

    // Deve avere il contesto dell'errore
    expect(content).toContain('grant_feature_refund_failed');
  });

  it('super-admin.ts cattura errore di accodamento (try/catch)', () => {
    const filePath = path.resolve('actions/super-admin.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Deve avere un try/catch attorno all'insert compensation_queue
    // per non mascherare l'errore originale
    expect(content).toContain('accodamento compensation_queue fallito');
  });

  it('super-admin.ts imposta status PENDING nel record compensation', () => {
    const filePath = path.resolve('actions/super-admin.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Status deve essere PENDING per attivare il retry automatico
    expect(content).toContain("status: 'PENDING'");
  });
});
