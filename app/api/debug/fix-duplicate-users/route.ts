/**
 * API Route: Fix Duplicate Users
 * 
 * POST /api/debug/fix-duplicate-users
 * Unisce utenti duplicati mantenendo quello con più spedizioni
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const userEmail = session.user.email;

    // 1. Trova TUTTI gli utenti con questa email
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', userEmail);

    if (usersError) throw usersError;

    if (!users || users.length <= 1) {
      return NextResponse.json({
        success: true,
        message: 'Nessun duplicato trovato. Utente unico.',
        users: users?.length || 0,
      });
    }

    console.log(`🔧 [FIX-DUPLICATE] Trovati ${users.length} utenti duplicati per:`, userEmail);

    // 2. Conta spedizioni per ogni utente
    const usersWithCounts = await Promise.all(
      users.map(async (user) => {
        const { count } = await supabaseAdmin
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        return {
          ...user,
          shipments_count: count || 0,
        };
      })
    );

    // 3. Trova utente "principale" (quello con più spedizioni, o più vecchio)
    usersWithCounts.sort((a, b) => {
      // Prima ordina per numero spedizioni (desc)
      if (b.shipments_count !== a.shipments_count) {
        return b.shipments_count - a.shipments_count;
      }
      // Poi per data creazione (asc - più vecchio)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const mainUser = usersWithCounts[0];
    const duplicates = usersWithCounts.slice(1);

    console.log('✅ [FIX-DUPLICATE] Utente principale:', {
      id: mainUser.id,
      email: mainUser.email,
      shipments: mainUser.shipments_count,
      account_type: mainUser.account_type,
    });

    // 4. Aggiorna l'utente principale con i privilegi più alti
    const bestAccountType = usersWithCounts.find(u => u.account_type === 'superadmin') 
      ? 'superadmin' 
      : usersWithCounts.find(u => u.account_type === 'admin')
      ? 'admin'
      : 'user';

    const { error: updateMainError } = await supabaseAdmin
      .from('users')
      .update({
        account_type: bestAccountType,
        role: bestAccountType === 'user' ? 'user' : 'admin',
        admin_level: bestAccountType === 'superadmin' ? 0 : bestAccountType === 'admin' ? 1 : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mainUser.id);

    if (updateMainError) {
      console.error('❌ [FIX-DUPLICATE] Errore aggiornamento utente principale:', updateMainError);
      throw updateMainError;
    }

    // 5. Sposta tutte le spedizioni dai duplicati all'utente principale
    let totalMoved = 0;
    for (const duplicate of duplicates) {
      const { count, error: moveError } = await supabaseAdmin
        .from('shipments')
        .update({ user_id: mainUser.id })
        .eq('user_id', duplicate.id)
        .select('*', { count: 'exact' });

      if (moveError) {
        console.error(`❌ [FIX-DUPLICATE] Errore spostamento spedizioni da ${duplicate.id}:`, moveError);
      } else {
        totalMoved += count || 0;
        console.log(`✅ [FIX-DUPLICATE] Spostate ${count} spedizioni da duplicato ${duplicate.id}`);
      }
    }

    // 6. Elimina utenti duplicati
    const duplicateIds = duplicates.map(d => d.id);
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .in('id', duplicateIds);

    if (deleteError) {
      console.error('❌ [FIX-DUPLICATE] Errore eliminazione duplicati:', deleteError);
      throw deleteError;
    }

    console.log(`✅ [FIX-DUPLICATE] Eliminati ${duplicateIds.length} utenti duplicati`);

    return NextResponse.json({
      success: true,
      message: `✅ Duplicati risolti! ${duplicateIds.length} utenti uniti in uno solo.`,
      mainUser: {
        id: mainUser.id,
        email: mainUser.email,
        account_type: bestAccountType,
        role: bestAccountType === 'user' ? 'user' : 'admin',
      },
      duplicatesRemoved: duplicateIds.length,
      shipmentsMoved: totalMoved,
      totalShipments: mainUser.shipments_count + totalMoved,
      nextSteps: [
        'Fai logout completo',
        'Fai login di nuovo',
        'Tutte le tue spedizioni saranno visibili',
        `Avrai permessi: ${bestAccountType.toUpperCase()}`,
      ],
    });

  } catch (error: any) {
    console.error('❌ [FIX-DUPLICATE] Errore:', error);
    return NextResponse.json(
      { 
        error: 'Errore durante il fix dei duplicati',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
