/**
 * API Route: Update Platform Fee
 *
 * POST /api/admin/platform-fee/update
 *
 * Body: { userId: string, newFee: number | null, notes?: string }
 *
 * Security:
 * - Requires authentication
 * - Requires SUPERADMIN role
 */

import { NextResponse } from 'next/server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { isSuperAdminCheck } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/db/client';
import { updatePlatformFee } from '@/lib/services/pricing/platform-fee';

export async function POST(request: Request) {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

    if (!context?.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Recupera user ID e verifica ruolo SUPERADMIN
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('id, role, account_type')
      .eq('email', context.actor.email)
      .single();

    if (adminError || !adminUser) {
      console.error('[PlatformFee API] Admin lookup error:', adminError);
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 401 });
    }

    // Verifica ruolo — solo account_type (source of truth)
    const isSuperAdmin = isSuperAdminCheck(adminUser);

    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: 'Accesso negato. Solo SUPERADMIN può modificare le fee.' },
        { status: 403 }
      );
    }

    // 3. Parse e valida body
    const body = await request.json();
    const { userId, newFee, notes } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId richiesto' }, { status: 400 });
    }

    // Valida fee
    if (newFee !== null && newFee !== undefined) {
      if (typeof newFee !== 'number' || isNaN(newFee)) {
        return NextResponse.json({ error: 'newFee deve essere un numero o null' }, { status: 400 });
      }

      if (newFee < 0) {
        return NextResponse.json({ error: 'La fee non può essere negativa' }, { status: 400 });
      }
    }

    // 4. Chiama service function
    const result = await updatePlatformFee(
      {
        targetUserId: userId,
        newFee: newFee ?? null,
        notes: notes || undefined,
      },
      adminUser.id
    );

    // Log operazione (NO PII)
    console.log('[PlatformFee API] Fee updated:', {
      targetUserId: userId.substring(0, 8) + '...',
      adminUserId: adminUser.id.substring(0, 8) + '...',
      newFee: result.newFee,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      previousFee: result.previousFee,
      newFee: result.newFee,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error('[PlatformFee API] Error:', message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
