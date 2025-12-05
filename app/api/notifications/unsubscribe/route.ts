/**
 * API Route: Discrizione da Push Notifications
 * POST /api/notifications/unsubscribe
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // 2. Leggi endpoint dal body
    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint non fornito' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database non configurato' },
        { status: 500 }
      );
    }

    // 3. Elimina la subscription dal database
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_email', session.user.email);

    if (error) {
      console.error('Errore eliminazione subscription:', error);
      return NextResponse.json(
        { error: 'Errore eliminazione subscription' },
        { status: 500 }
      );
    }

    console.log('Subscription eliminata:', endpoint);

    return NextResponse.json({
      success: true,
      message: 'Discritto da notifiche push',
    });
  } catch (error) {
    console.error('Errore unsubscribe notifications:', error);
    return NextResponse.json(
      { error: 'Errore interno' },
      { status: 500 }
    );
  }
}
