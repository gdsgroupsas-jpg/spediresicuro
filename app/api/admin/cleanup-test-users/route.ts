/**
 * API Route: Cleanup Test Users
 *
 * Endpoint admin per identificare e rimuovere utenti di test.
 *
 * GET  - Preview: mostra utenti di test che verrebbero eliminati
 * POST - Execute: elimina effettivamente gli utenti di test
 *
 * Richiede:
 * - Autenticazione
 * - Ruolo superadmin
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { isTestUser } from '@/lib/utils/test-data-detection';
import { isSuperAdminCheck } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

interface TestUserInfo {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  shipmentsCount: number;
  walletTxCount: number;
}

interface CleanupResult {
  success: boolean;
  mode: 'preview' | 'execute';
  testUsers: TestUserInfo[];
  stats: {
    usersFound: number;
    usersDeleted: number;
    shipmentsDeleted: number;
    walletTransactionsDeleted: number;
    topUpRequestsDeleted: number;
  };
  errors: string[];
}

// GET - Preview mode
export async function GET(
  request: NextRequest
): Promise<NextResponse<CleanupResult | { error: string }>> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();
    if (!context || !context.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Verifica superadmin
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Database non configurato' }, { status: 500 });
    }

    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('email', context.actor.email)
      .single();

    if (!isSuperAdminCheck(adminUser || {})) {
      return NextResponse.json(
        { error: 'Solo i superadmin possono eseguire il cleanup' },
        { status: 403 }
      );
    }

    // 3. Fetch tutti gli utenti
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, created_at, role, account_type')
      .order('created_at', { ascending: false });

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    // 4. Identifica utenti di test (escludi admin/superadmin)
    const testUsers: TestUserInfo[] = [];

    for (const user of allUsers || []) {
      if (isTestUser(user)) {
        // Non includere admin/superadmin
        if (user.account_type === 'superadmin' || user.account_type === 'admin') {
          continue;
        }

        // Conta dati correlati
        const { count: shipmentsCount } = await supabaseAdmin
          .from('shipments')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const { count: walletTxCount } = await supabaseAdmin
          .from('wallet_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        testUsers.push({
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          shipmentsCount: shipmentsCount || 0,
          walletTxCount: walletTxCount || 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      mode: 'preview',
      testUsers,
      stats: {
        usersFound: testUsers.length,
        usersDeleted: 0,
        shipmentsDeleted: 0,
        walletTransactionsDeleted: 0,
        topUpRequestsDeleted: 0,
      },
      errors: [],
    });
  } catch (error: any) {
    console.error('Error in cleanup preview:', error);
    return NextResponse.json(
      { error: 'Errore durante la pulizia utenti di test' },
      { status: 500 }
    );
  }
}

// POST - Execute deletion
export async function POST(
  request: NextRequest
): Promise<NextResponse<CleanupResult | { error: string }>> {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();
    if (!context || !context.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Verifica superadmin
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Database non configurato' }, { status: 500 });
    }

    const { data: adminUser } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('email', context.actor.email)
      .single();

    if (!isSuperAdminCheck(adminUser || {})) {
      return NextResponse.json(
        { error: 'Solo i superadmin possono eseguire il cleanup' },
        { status: 403 }
      );
    }

    // 3. Parse body (optional: lista specifica di user IDs)
    let userIdsToDelete: string[] | null = null;
    try {
      const body = await request.json();
      if (body.userIds && Array.isArray(body.userIds)) {
        userIdsToDelete = body.userIds;
      }
    } catch {
      // Body vuoto = elimina tutti i test users
    }

    // 4. Fetch utenti da eliminare
    const { data: allUsers, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, created_at, role, account_type')
      .order('created_at', { ascending: false });

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    // 5. Filtra utenti di test
    const testUsers: TestUserInfo[] = [];

    for (const user of allUsers || []) {
      // Se specificati IDs, usa quelli
      if (userIdsToDelete && !userIdsToDelete.includes(user.id)) {
        continue;
      }

      if (isTestUser(user)) {
        // Non eliminare admin/superadmin
        if (user.account_type === 'superadmin' || user.account_type === 'admin') {
          continue;
        }

        testUsers.push({
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at,
          shipmentsCount: 0,
          walletTxCount: 0,
        });
      }
    }

    // 6. Esegui eliminazione
    const stats = {
      usersFound: testUsers.length,
      usersDeleted: 0,
      shipmentsDeleted: 0,
      walletTransactionsDeleted: 0,
      topUpRequestsDeleted: 0,
    };
    const errors: string[] = [];

    for (const user of testUsers) {
      try {
        // Delete shipments
        const { count: shipCount, error: shipError } = await supabaseAdmin
          .from('shipments')
          .delete({ count: 'exact' })
          .eq('user_id', user.id);

        if (shipError) {
          errors.push(`Shipments delete failed for ${user.email}: ${shipError.message}`);
        } else {
          stats.shipmentsDeleted += shipCount || 0;
        }

        // Delete wallet transactions
        const { count: walletCount, error: walletError } = await supabaseAdmin
          .from('wallet_transactions')
          .delete({ count: 'exact' })
          .eq('user_id', user.id);

        if (walletError) {
          errors.push(`Wallet delete failed for ${user.email}: ${walletError.message}`);
        } else {
          stats.walletTransactionsDeleted += walletCount || 0;
        }

        // Delete top-up requests
        const { count: topupCount, error: topupError } = await supabaseAdmin
          .from('top_up_requests')
          .delete({ count: 'exact' })
          .eq('user_id', user.id);

        if (topupError) {
          errors.push(`Top-up delete failed for ${user.email}: ${topupError.message}`);
        } else {
          stats.topUpRequestsDeleted += topupCount || 0;
        }

        // Delete user
        const { error: userError } = await supabaseAdmin.from('users').delete().eq('id', user.id);

        if (userError) {
          errors.push(`User delete failed for ${user.email}: ${userError.message}`);
        } else {
          stats.usersDeleted++;
        }
      } catch (error: any) {
        errors.push(`Exception for ${user.email}: ${error.message}`);
      }
    }

    // Log audit
    console.log(
      '[CLEANUP] Test users cleanup executed by:',
      context.actor.id.substring(0, 8) + '...',
      stats
    );

    return NextResponse.json({
      success: true,
      mode: 'execute',
      testUsers,
      stats,
      errors,
    });
  } catch (error: any) {
    console.error('Error in cleanup execute:', error);
    return NextResponse.json(
      { error: 'Errore durante la pulizia utenti di test' },
      { status: 500 }
    );
  }
}
