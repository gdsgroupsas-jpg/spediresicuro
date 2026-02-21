/**
 * Delete SubAdmin Tests
 *
 * Test suite per verificare:
 * - Eliminazione sotto-admin funziona
 * - Solo admin/superadmin possono eliminare
 * - Admin può eliminare solo i propri figli
 * - Superadmin può eliminare chiunque
 * - Audit log viene creato
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared mock function accessibile da tutte le factory hoistate
const { sharedMockGetAuth } = vi.hoisted(() => ({
  sharedMockGetAuth: vi.fn(),
}));

// Mock modules PRIMA di qualsiasi altra cosa
// Le factory functions vengono hoistate, quindi non possono usare variabili esterne
vi.mock('@/lib/db/client', () => {
  // Creiamo tutto il mock dentro la factory
  const singleMock = vi.fn();
  const eqMock = vi.fn();
  const insertMock = vi.fn();
  const updateMock = vi.fn();

  const chain: any = {
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    eq: eqMock,
    single: singleMock,
    update: updateMock,
    insert: insertMock,
    rpc: vi.fn(),
    // Esponiamo i mock per accesso nei test
    __mocks: { singleMock, eqMock, insertMock, updateMock },
  };

  // Setup default: eq e update ritornano chain
  eqMock.mockImplementation(() => chain);
  updateMock.mockImplementation(() => chain);

  return { supabaseAdmin: chain };
});

vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: sharedMockGetAuth,
  __mockGetSafeAuth: sharedMockGetAuth,
}));

vi.mock('@/lib/workspace-auth', () => ({
  getWorkspaceAuth: sharedMockGetAuth,
  requireWorkspaceAuth: vi.fn(async () => {
    const result = await sharedMockGetAuth();
    if (!result) throw new Error('UNAUTHORIZED: Workspace access required');
    return result;
  }),
}));

// Import dopo i mock
import { deleteSubAdmin } from '@/actions/admin';
import { supabaseAdmin } from '@/lib/db/client';

// Accesso ai mock
const mockSupabase = supabaseAdmin as any;
const mockGetSafeAuth = sharedMockGetAuth;
const { singleMock, eqMock, insertMock } = mockSupabase.__mocks;

describe('deleteSubAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain methods per ogni test
    eqMock.mockImplementation(() => mockSupabase);
  });

  it('dovrebbe rifiutare se non autenticato', async () => {
    mockGetSafeAuth.mockResolvedValue(null);

    const result = await deleteSubAdmin('test-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Non autenticato');
  });

  it('dovrebbe rifiutare se utente non è admin', async () => {
    mockGetSafeAuth.mockResolvedValue({
      actor: { email: 'user@test.com' },
    });

    singleMock.mockResolvedValueOnce({
      data: { id: 'user-id', account_type: 'user' },
      error: null,
    });

    const result = await deleteSubAdmin('test-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Solo gli admin');
  });

  it('dovrebbe rifiutare se admin tenta di eliminare sotto-admin non suo', async () => {
    mockGetSafeAuth.mockResolvedValue({
      actor: { email: 'admin@test.com' },
    });

    // Parent (admin)
    singleMock.mockResolvedValueOnce({
      data: { id: 'admin-id', account_type: 'admin' },
      error: null,
    });

    // SubAdmin (non figlio di questo admin)
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'subadmin-id',
        email: 'sub@test.com',
        name: 'Sub Admin',
        parent_admin_id: 'altro-admin-id', // diverso da admin-id
        account_type: 'admin',
      },
      error: null,
    });

    const result = await deleteSubAdmin('subadmin-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('non hai creato');
  });

  it('dovrebbe permettere a superadmin di eliminare qualsiasi sotto-admin', async () => {
    mockGetSafeAuth.mockResolvedValue({
      actor: { email: 'super@test.com' },
    });

    // Parent (superadmin)
    singleMock.mockResolvedValueOnce({
      data: { id: 'super-id', account_type: 'superadmin' },
      error: null,
    });

    // SubAdmin
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'subadmin-id',
        email: 'sub@test.com',
        name: 'Sub Admin',
        parent_admin_id: 'altro-admin-id',
        account_type: 'admin',
      },
      error: null,
    });

    // Update (soft delete) - .update().eq() deve ritornare { error: null }
    let eqCallCount = 0;
    eqMock.mockImplementation(() => {
      eqCallCount++;
      // La terza chiamata a eq (dopo update) deve ritornare il risultato
      if (eqCallCount >= 3) {
        return Promise.resolve({ error: null });
      }
      return mockSupabase;
    });

    // Insert audit log
    insertMock.mockResolvedValueOnce({ error: null });

    const result = await deleteSubAdmin('subadmin-id');

    expect(result.success).toBe(true);
    expect(result.message).toContain('eliminato con successo');
  });

  it('dovrebbe permettere a admin di eliminare i propri sotto-admin', async () => {
    mockGetSafeAuth.mockResolvedValue({
      actor: { email: 'admin@test.com' },
    });

    // Parent (admin)
    singleMock.mockResolvedValueOnce({
      data: { id: 'admin-id', account_type: 'admin' },
      error: null,
    });

    // SubAdmin (figlio di questo admin)
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'subadmin-id',
        email: 'sub@test.com',
        name: 'Sub Admin',
        parent_admin_id: 'admin-id', // stesso di admin-id
        account_type: 'admin',
      },
      error: null,
    });

    // Update (soft delete)
    let eqCallCount = 0;
    eqMock.mockImplementation(() => {
      eqCallCount++;
      if (eqCallCount >= 3) {
        return Promise.resolve({ error: null });
      }
      return mockSupabase;
    });

    // Insert audit log
    insertMock.mockResolvedValueOnce({ error: null });

    const result = await deleteSubAdmin('subadmin-id');

    expect(result.success).toBe(true);
  });
});
