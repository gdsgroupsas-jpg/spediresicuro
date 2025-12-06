/**
 * API Route: Debug Users
 * 
 * GET /api/debug/users
 * Mostra utenti duplicati per diagnostica
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const userEmail = session.user.email;

    // Cerca TUTTI gli utenti con questa email
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', userEmail);

    if (error) {
      throw error;
    }

    // Conta anche le spedizioni per ogni utente
    const usersWithShipments = await Promise.all(
      (users || []).map(async (user) => {
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

    return NextResponse.json({
      success: true,
      email: userEmail,
      totalUsers: users?.length || 0,
      users: usersWithShipments.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        account_type: u.account_type,
        admin_level: u.admin_level,
        provider: u.provider,
        shipments_count: u.shipments_count,
        created_at: u.created_at,
        updated_at: u.updated_at,
      })),
      message: users && users.length > 1 
        ? `⚠️ ATTENZIONE: Trovati ${users.length} utenti duplicati!` 
        : 'Utente unico trovato',
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Errore query utenti', message: error.message },
      { status: 500 }
    );
  }
}
