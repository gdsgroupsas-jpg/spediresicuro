/**
 * API Route: Auto-Promozione Superadmin
 * 
 * POST /api/auth/promote-superadmin
 * Promuove automaticamente email autorizzate a superadmin
 * 
 * ⚠️ SICUREZZA: Solo email hardcoded possono essere promosse
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';

// ⚠️ LISTA SUPERADMIN AUTORIZZATI (hardcoded per sicurezza)
const AUTHORIZED_SUPERADMINS = [
  'sigorn@hotmail.it',
  'gdsgroupsas@gmail.com',
  'admin@spediresicuro.it',
  'salvatore.squillante@gmail.com',
];

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;

    // 2. Verifica che l'email sia autorizzata
    if (!AUTHORIZED_SUPERADMINS.includes(userEmail)) {
      return NextResponse.json(
        { 
          error: 'Non autorizzato',
          message: 'La tua email non è nella lista dei superadmin autorizzati'
        },
        { status: 403 }
      );
    }

    console.log('🔐 [AUTO-PROMOTE] Promozione superadmin per:', userEmail);

    // 3. Aggiorna utente a superadmin
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        account_type: 'superadmin',
        admin_level: 0,
        parent_admin_id: null,
        role: 'admin',
        updated_at: new Date().toISOString(),
      })
      .eq('email', userEmail)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [AUTO-PROMOTE] Errore aggiornamento:', updateError);
      
      // Se l'utente non esiste, crealo
      if (updateError.code === 'PGRST116') {
        console.log('➕ [AUTO-PROMOTE] Utente non esiste, creazione in corso...');
        
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            email: userEmail,
            name: session.user.name || userEmail.split('@')[0],
            role: 'admin',
            account_type: 'superadmin',
            admin_level: 0,
            parent_admin_id: null,
            provider: 'google', // Assume Google OAuth
            password: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createError) {
          throw new Error(`Errore creazione utente: ${createError.message}`);
        }

        console.log('✅ [AUTO-PROMOTE] Utente creato come superadmin:', newUser.email);
        
        return NextResponse.json({
          success: true,
          message: 'Utente creato e promosso a superadmin',
          user: {
            email: newUser.email,
            account_type: newUser.account_type,
            admin_level: newUser.admin_level,
          },
          action: 'created',
        });
      }
      
      throw updateError;
    }

    console.log('✅ [AUTO-PROMOTE] Promozione completata:', updatedUser.email);

    // 4. Log audit
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: updatedUser.id,
        action: 'auto_promote_superadmin',
        severity: 'info',
        message: `Auto-promozione a superadmin: ${userEmail}`,
        metadata: {
          email: userEmail,
          account_type: 'superadmin',
          admin_level: 0,
        },
        created_at: new Date().toISOString(),
      });
    } catch (auditError) {
      console.warn('⚠️ [AUTO-PROMOTE] Errore audit log (non critico):', auditError);
    }

    return NextResponse.json({
      success: true,
      message: 'Promozione a superadmin completata',
      user: {
        email: updatedUser.email,
        account_type: updatedUser.account_type,
        admin_level: updatedUser.admin_level,
        role: updatedUser.role,
      },
      action: 'promoted',
      nextSteps: [
        'Fai LOGOUT dalla piattaforma',
        'Fai LOGIN di nuovo',
        'Accesso a /dashboard/team sarà abilitato',
      ],
    });

  } catch (error: any) {
    console.error('❌ [AUTO-PROMOTE] Errore:', error);
    return NextResponse.json(
      { 
        error: 'Errore durante la promozione',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}
