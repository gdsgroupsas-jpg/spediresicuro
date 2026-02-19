/**
 * Test suite per i fix dell'audit sicurezza feb 2026
 *
 * Copre:
 * - F3: Delete user cross-tenant (workspace scope obbligatorio)
 * - F5: Wallet leak workspace_id.is.null (filtro strict)
 * - F2: Cron/webhook fail-closed (6 endpoint)
 * - F4: Atomicita feature activation (compensazione wallet)
 * - F8: Telegram webhook signature verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================
// F3: Delete user — solo superadmin + workspace scope
// ============================================================
describe('F3: DELETE /api/admin/users/[id] — isolamento tenant', () => {
  // Mock hoisted
  const { mockGetWorkspaceAuth, mockIsSuperAdmin, mockSupabaseChain } = vi.hoisted(() => {
    const mockGetWorkspaceAuth = vi.fn();
    const mockIsSuperAdmin = vi.fn();

    const rpcMock = vi.fn();
    const maybeSingleMock = vi.fn();
    const singleMock = vi.fn();
    const eqMock = vi.fn();
    const selectMock = vi.fn();
    const fromMock = vi.fn();
    const authAdminDeleteUser = vi.fn();

    const chain: any = {
      from: fromMock,
      select: selectMock,
      eq: eqMock,
      single: singleMock,
      maybeSingle: maybeSingleMock,
      rpc: rpcMock,
      auth: { admin: { deleteUser: authAdminDeleteUser } },
      __mocks: {
        fromMock,
        selectMock,
        eqMock,
        singleMock,
        maybeSingleMock,
        rpcMock,
        authAdminDeleteUser,
      },
    };

    fromMock.mockReturnValue(chain);
    selectMock.mockReturnValue(chain);
    eqMock.mockReturnValue(chain);

    return { mockGetWorkspaceAuth, mockIsSuperAdmin, mockSupabaseChain: chain };
  });

  vi.mock('@/lib/workspace-auth', () => ({
    getWorkspaceAuth: mockGetWorkspaceAuth,
  }));

  vi.mock('@/lib/safe-auth', () => ({
    isSuperAdmin: mockIsSuperAdmin,
  }));

  vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: mockSupabaseChain,
    isSupabaseConfigured: () => true,
  }));

  // Non serve piu findUserByEmail
  vi.mock('@/lib/database', () => ({
    findUserByEmail: vi.fn(),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    const { fromMock, selectMock, eqMock } = mockSupabaseChain.__mocks;
    fromMock.mockReturnValue(mockSupabaseChain);
    selectMock.mockReturnValue(mockSupabaseChain);
    eqMock.mockReturnValue(mockSupabaseChain);
  });

  it('rifiuta se non autenticato', async () => {
    mockGetWorkspaceAuth.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/users/test-id', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'test-id' }) });

    expect(res.status).toBe(401);
  });

  it('rifiuta se non superadmin (FIX F3: era admin, ora solo superadmin)', async () => {
    mockGetWorkspaceAuth.mockResolvedValue({
      actor: { id: 'admin-1', email: 'admin@test.com', role: 'admin' },
      workspace: { id: 'ws-1' },
    });
    mockIsSuperAdmin.mockReturnValue(false); // NON superadmin

    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/users/test-id', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'test-id' }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('superadmin');
  });

  it('rifiuta cancellazione cross-tenant: target non nel workspace (FIX F3)', async () => {
    mockGetWorkspaceAuth.mockResolvedValue({
      actor: { id: 'sa-1', email: 'super@test.com', role: 'admin' },
      workspace: { id: 'ws-A' },
    });
    mockIsSuperAdmin.mockReturnValue(true);

    const { singleMock, maybeSingleMock } = mockSupabaseChain.__mocks;

    // target user trovato
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'user-B',
        email: 'user@other.com',
        name: 'Test',
        role: 'user',
        account_type: 'user',
      },
      error: null,
    });

    // membership check: NON trovato (cross-tenant!)
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/users/user-B', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'user-B' }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('workspace');
  });

  it('impedisce cancellazione di un superadmin', async () => {
    mockGetWorkspaceAuth.mockResolvedValue({
      actor: { id: 'sa-1', email: 'super@test.com', role: 'admin' },
      workspace: { id: 'ws-A' },
    });
    mockIsSuperAdmin.mockReturnValue(true);

    const { singleMock } = mockSupabaseChain.__mocks;
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'sa-2',
        email: 'other-super@test.com',
        name: 'SA2',
        role: 'admin',
        account_type: 'superadmin',
      },
      error: null,
    });

    const { DELETE } = await import('@/app/api/admin/users/[id]/route');
    const req = new NextRequest('http://localhost/api/admin/users/sa-2', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'sa-2' }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('superadmin');
  });
});

// ============================================================
// F5: Wallet transactions — no leak workspace_id NULL
// ============================================================
describe('F5: Wallet transactions — filtro workspace strict (no NULL leak)', () => {
  it('filtra per workspace_id ESATTO, senza .is.null', async () => {
    // Verifica che il codice sorgente NON contenga workspace_id.is.null
    const fs = await import('fs');
    const path = await import('path');
    const routePath = path.resolve('app/api/wallet/transactions/route.ts');
    const content = fs.readFileSync(routePath, 'utf-8');

    // DEVE avere eq('workspace_id', workspaceId)
    expect(content).toContain(".eq('workspace_id', workspaceId)");
    // NON DEVE avere workspace_id.is.null
    expect(content).not.toContain('workspace_id.is.null');
  });
});

// ============================================================
// F2: Cron/webhook — tutti fail-closed
// ============================================================
describe('F2: Cron/webhook endpoint fail-closed', () => {
  const cronFiles = [
    'app/api/cron/trigger-sync/route.ts',
    'app/api/cron/telegram-queue/route.ts',
    'app/api/cron/automation-sync/route.ts',
    'app/api/cron/auto-reconciliation/route.ts',
    'app/api/cron/financial-alerts/route.ts',
  ];

  const webhookFiles = ['app/api/webhooks/email-inbound/route.ts'];

  it.each(cronFiles)('cron %s: NON ha pattern fail-open (if secret && ...)', async (file) => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Pattern fail-open: `if (cronSecret &&` o `if (CRON_SECRET &&` o `if (secretToken &&`
    // Questo pattern salta la verifica se il secret e' null/undefined
    const failOpenPattern = /if\s*\(\s*(?:cronSecret|CRON_SECRET|secretToken)\s*&&/;
    expect(content).not.toMatch(failOpenPattern);
  });

  it.each(webhookFiles)('webhook %s: NON ritorna true quando secret manca', async (file) => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Pattern fail-open: return true quando secret non configurato
    expect(content).not.toMatch(/return\s+true;\s*\/\/\s*Permetti/);
  });

  it('tutti i cron hanno fallback a x-vercel-cron o ritornano 503 se secret manca', async () => {
    const fs = await import('fs');
    const path = await import('path');

    for (const file of cronFiles) {
      const filePath = path.resolve(file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Deve avere: check x-vercel-cron O ritornare 503 se secret manca
      const hasVercelCron = content.includes('x-vercel-cron');
      const has503 = content.includes('503');
      expect(hasVercelCron || has503).toBe(true);
    }
  });
});

// ============================================================
// F4: Atomicita feature activation — compensazione wallet
// ============================================================
describe('F4: grantFeature — compensazione wallet su errore upsert', () => {
  it('il codice sorgente contiene logica di compensazione wallet', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('actions/super-admin.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Deve tracciare se il wallet e' stato debitato
    expect(content).toContain('walletDebited');

    // Deve avere compensazione quando upsert fallisce
    expect(content).toContain('Compensazione wallet');
    expect(content).toContain('Rimborso attivazione feature fallita');

    // Deve rimborsare con importo positivo (refund)
    expect(content).toMatch(/manageWallet\(\s*userId,\s*priceInEuros/);
  });
});

// ============================================================
// F8: Telegram webhook — signature verification
// ============================================================
describe('F8: Telegram webhook — autenticazione sorgente', () => {
  it('il codice contiene verifica secret token Telegram', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('app/api/webhooks/telegram/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // Deve avere la funzione di verifica
    expect(content).toContain('verifyTelegramSecret');
    expect(content).toContain('x-telegram-bot-api-secret-token');
    expect(content).toContain('TELEGRAM_WEBHOOK_SECRET');
  });

  it('isAuthorizedChat NON ritorna true quando nessun ID configurato (FIX F8)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve('app/api/webhooks/telegram/route.ts');
    const content = fs.readFileSync(filePath, 'utf-8');

    // NON deve avere il vecchio pattern: authorizedIds.length === 0) return true
    expect(content).not.toMatch(/authorizedIds\.length\s*===\s*0\)\s*return\s+true/);
  });
});
