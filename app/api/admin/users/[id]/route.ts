/**
 * API Route: Admin User Management
 * 
 * DELETE /api/admin/users/[id] - Cancella utente (solo admin)
 * 
 * ⚠️ SOLO PER ADMIN: Verifica che l'utente sia admin prima di eseguire operazioni
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // 2. Verifica che l'utente sia admin
    const adminUser = await findUserByEmail(session.user.email);
    
    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accesso negato. Solo gli admin possono cancellare utenti.' },
        { status: 403 }
      );
    }

    // 3. Ottieni ID utente da cancellare
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'ID utente mancante' },
        { status: 400 }
      );
    }

    // 4. Verifica che l'utente esista
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Supabase non configurato' },
        { status: 503 }
      );
    }

    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // 5. Impedisci cancellazione di altri admin (opzionale - per sicurezza)
    if (targetUser.role === 'admin' && targetUser.email !== session.user.email) {
      return NextResponse.json(
        { error: 'Non puoi cancellare altri admin' },
        { status: 403 }
      );
    }

    // 6. Impedisci auto-cancellazione
    if (targetUser.email === session.user.email) {
      return NextResponse.json(
        { error: 'Non puoi cancellare il tuo stesso account' },
        { status: 403 }
      );
    }

    // 7. Cancella utente (hard delete - elimina completamente)
    // Prima cancella tutte le dipendenze (user_features, shipments, ecc.)
    
    // Cancella user_features
    await supabaseAdmin
      .from('user_features')
      .delete()
      .eq('user_email', targetUser.email);

    // Soft delete spedizioni (non hard delete per mantenere storico)
    await supabaseAdmin
      .from('shipments')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: adminUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // Cancella user_profiles se esiste
    await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('email', targetUser.email);

    // Infine cancella l'utente
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Errore cancellazione utente:', deleteError);
      return NextResponse.json(
        { error: 'Errore durante la cancellazione dell\'utente' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Utente ${targetUser.email} cancellato con successo`,
    });

  } catch (error: any) {
    console.error('Errore API admin delete user:', error);
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    );
  }
}

