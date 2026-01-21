/**
 * API Route: Admin User Management
 *
 * DELETE /api/admin/users/[id] - Cancella utente (solo admin)
 *
 * ⚠️ SOLO PER ADMIN: Verifica che l'utente sia admin prima di eseguire operazioni
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { findUserByEmail } from '@/lib/database';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. Verifica autenticazione
    const context = await getSafeAuth();

    if (!context || !context.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Verifica che l'utente sia admin
    const adminUser = await findUserByEmail(context.actor.email);

    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accesso negato. Solo gli admin possono cancellare utenti.' },
        { status: 403 }
      );
    }

    // 3. Ottieni ID utente da cancellare
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ error: 'ID utente mancante' }, { status: 400 });
    }

    // 4. Verifica che l'utente esista
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase non configurato' }, { status: 503 });
    }

    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    // 5. Impedisci cancellazione di altri admin (opzionale - per sicurezza)
    if (targetUser.role === 'admin' && targetUser.email !== context.actor.email) {
      return NextResponse.json({ error: 'Non puoi cancellare altri admin' }, { status: 403 });
    }

    // 6. Impedisci auto-cancellazione
    if (targetUser.email === context.actor.email) {
      return NextResponse.json(
        { error: 'Non puoi cancellare il tuo stesso account' },
        { status: 403 }
      );
    }

    // 7. Cancella utente (hard delete - elimina completamente)
    // ⚠️ IMPORTANTE: Cancellare PRIMA da auth.users (Supabase Auth) per evitare problemi
    // Se l'email rimane in auth.users, non potrà essere riutilizzata!

    // 7a. Cancella da Supabase Auth PRIMA (non può essere fatto in SQL)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('❌ [DELETE USER] Errore cancellazione auth.users:', deleteAuthError);
      return NextResponse.json(
        {
          error: `Errore durante la cancellazione dell'utente da Supabase Auth: ${deleteAuthError.message || 'Errore sconosciuto'}`,
        },
        { status: 500 }
      );
    }

    console.log(`✅ [DELETE USER] Utente cancellato da auth.users: ${targetUser.email}`);

    // 7b. Cancellazione atomica da database pubblico (ENTERPRISE-GRADE)
    // Usa funzione SQL atomica per garantire consistenza completa
    const { data: deleteResult, error: deleteError } = await supabaseAdmin.rpc(
      'delete_user_complete',
      {
        p_user_id: userId,
        p_admin_id: adminUser.id,
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
