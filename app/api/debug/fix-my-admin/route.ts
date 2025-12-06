/**
 * API Route: Fix My Admin Access
 * 
 * POST /api/debug/fix-my-admin
 * Sistema i permessi dell'utente corrente a superadmin
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';

const AUTHORIZED_EMAILS = [
  'sigorn@hotmail.it',
  'gdsgroupsas@gmail.com',
  'admin@spediresicuro.it',
  'salvatore.squillante@gmail.com',
];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const userEmail = session.user.email;

    // Verifica autorizzazione
    if (!AUTHORIZED_EMAILS.includes(userEmail)) {
      return NextResponse.json(
        { error: 'Email non autorizzata', email: userEmail },
        { status: 403 }
      );
    }

    console.log('🔧 [FIX-MY-ADMIN] Fix permessi per:', userEmail);

    // Trova l'utente nel database
    const { data: existingUser, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', userEmail)
      .single();

    if (findError || !existingUser) {
      // Utente non esiste, crealo
      console.log('➕ [FIX-MY-ADMIN] Utente non trovato, creazione...');
      
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          email: userEmail,
          name: session.user.name || userEmail.split('@')[0],
          role: 'admin',
          account_type: 'superadmin',
          admin_level: 0,
          parent_admin_id: null,
          provider: 'google',
          password: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Errore creazione: ${createError.message}`);
      }

      return NextResponse.json({
        success: true,
        action: 'created',
        message: 'Utente creato come superadmin',
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
          account_type: newUser.account_type,
          admin_level: newUser.admin_level,
        },
        nextSteps: [
          'Fai LOGOUT completo',
          'Fai LOGIN di nuovo',
          'Il badge 👑 SUPERADMIN sarà visibile',
          'La sezione Admin sarà accessibile',
        ],
      });
    }

    // Utente esiste, aggiorna i permessi
    console.log('✏️ [FIX-MY-ADMIN] Aggiornamento permessi utente esistente:', existingUser.id);

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        role: 'admin',
        account_type: 'superadmin',
        admin_level: 0,
        parent_admin_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingUser.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Errore aggiornamento: ${updateError.message}`);
    }

    // Conta le spedizioni
    const { count: shipmentsCount } = await supabaseAdmin
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', existingUser.id);

    return NextResponse.json({
      success: true,
      action: 'updated',
      message: 'Permessi superadmin applicati con successo',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        account_type: updatedUser.account_type,
        admin_level: updatedUser.admin_level,
        shipments_count: shipmentsCount || 0,
      },
      changes: {
        before: {
          role: existingUser.role,
          account_type: existingUser.account_type,
          admin_level: existingUser.admin_level,
        },
        after: {
          role: 'admin',
          account_type: 'superadmin',
          admin_level: 0,
        },
      },
      nextSteps: [
        'Fai LOGOUT completo (pulsante Logout)',
        'Fai LOGIN di nuovo con Google',
        'Vedrai il badge 👑 SUPERADMIN',
        'La sezione Admin sarà visibile',
        `Le tue ${shipmentsCount || 0} spedizioni saranno ancora lì`,
      ],
    });

  } catch (error: any) {
    console.error('❌ [FIX-MY-ADMIN] Errore:', error);
    return NextResponse.json(
      { error: 'Errore durante il fix', message: error.message },
      { status: 500 }
    );
  }
}
