/**
 * API Route: Admin User Management
 *
 * DELETE /api/admin/users/[id] - Cancella utente (solo superadmin, con verifica workspace)
 *
 * SECURITY FIX: Solo superadmin puo cancellare utenti.
 * Il target deve appartenere al workspace corrente (via workspace_members).
 * Superadmin bypassano il check workspace (accesso cross-tenant by design).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verifica autenticazione + workspace
    const context = await getWorkspaceAuth();

    if (!context || !context.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Solo superadmin puo cancellare utenti (FIX F3: era 'admin', ora solo superadmin)
    if (!isSuperAdmin(context)) {
      return NextResponse.json(
        { error: 'Accesso negato. Solo i superadmin possono cancellare utenti.' },
        { status: 403 }
      );
    }

    // 3. Ottieni ID utente da cancellare
    const { id: userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'ID utente mancante' }, { status: 400 });
    }

    // 4. Verifica che l'utente esista
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase non configurato' }, { status: 503 });
    }

    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, account_type')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    // 5. Impedisci cancellazione di altri superadmin
    if (targetUser.account_type === 'superadmin') {
      return NextResponse.json({ error: 'Non puoi cancellare un superadmin' }, { status: 403 });
    }

    // 6. Impedisci auto-cancellazione
    if (targetUser.id === context.actor.id) {
      return NextResponse.json(
        { error: 'Non puoi cancellare il tuo stesso account' },
        { status: 403 }
      );
    }

    // 7. Verifica che il target appartenga al workspace corrente (FIX F3: isolamento tenant)
    const workspaceId = context.workspace?.id;
    if (workspaceId) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!membership) {
        console.warn(
          `[DELETE USER] Tentativo cross-tenant bloccato: admin=${context.actor.email}, target=${targetUser.email}, workspace=${workspaceId}`
        );
        return NextResponse.json(
          { error: 'Utente non appartiene al workspace corrente' },
          { status: 403 }
        );
      }
    }

    // 8. Cancella utente (hard delete - elimina completamente)
    // ⚠️ IMPORTANTE: Cancellare PRIMA da auth.users (Supabase Auth) per evitare problemi
    // Se l'email rimane in auth.users, non potrà essere riutilizzata!

    // 8a. Cancella da Supabase Auth PRIMA (non può essere fatto in SQL)
    // Nota: se l'utente non esiste più in auth.users (già eliminato), continuiamo comunque
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      // Se l'errore è "user not found", l'utente potrebbe essere già stato eliminato da auth
      // In questo caso, continuiamo con la cancellazione dal database pubblico
      const isUserNotFound =
        deleteAuthError.message?.toLowerCase().includes('not found') ||
        deleteAuthError.message?.toLowerCase().includes('user not found');

      if (!isUserNotFound) {
        console.error('❌ [DELETE USER] Errore cancellazione auth.users:', deleteAuthError);
        return NextResponse.json(
          {
            error: `Errore durante la cancellazione dell'utente da Supabase Auth: ${deleteAuthError.message || 'Errore sconosciuto'}`,
          },
          { status: 500 }
        );
      }

      console.log(
        `⚠️ [DELETE USER] Utente già eliminato da auth.users, continuo con database pubblico: ${targetUser.email}`
      );
    } else {
      console.log(`✅ [DELETE USER] Utente cancellato da auth.users: ${targetUser.email}`);
    }

    // 8b. Cancellazione atomica da database pubblico (ENTERPRISE-GRADE)
    // Usa funzione SQL atomica per garantire consistenza completa
    const { data: deleteResult, error: deleteError } = await supabaseAdmin.rpc(
      'delete_user_complete',
      {
        p_user_id: userId,
        p_admin_id: context.actor.id,
        p_admin_email: context.actor.email,
        p_target_user_email: targetUser.email,
        p_target_user_name: targetUser.name || targetUser.email,
      }
    );

    if (deleteError) {
      console.error('❌ [DELETE USER] Errore cancellazione database pubblico:', deleteError);
      return NextResponse.json(
        {
          error: `Errore durante la cancellazione dell'utente dal database: ${deleteError.message || 'Errore sconosciuto'}`,
        },
        { status: 500 }
      );
    }

    console.log(`✅ [DELETE USER] Utente cancellato completamente:`, deleteResult);

    // Costruisci messaggio dettagliato con statistiche
    const stats = deleteResult as {
      deleted_shipments_count?: number;
      deleted_features_count?: number;
      deleted_profiles_count?: number;
      wallet_balance_final?: number;
    };

    const message =
      `Utente ${targetUser.email} cancellato con successo. ` +
      `Spedizioni cancellate: ${stats.deleted_shipments_count || 0}, ` +
      `Features rimosse: ${stats.deleted_features_count || 0}, ` +
      `Profili rimossi: ${stats.deleted_profiles_count || 0}`;

    return NextResponse.json({
      success: true,
      message,
      statistics: stats,
    });
  } catch (error: any) {
    console.error('Errore API admin delete user:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
