/**
 * API Route: Discrizione da Push Notifications
 * POST /api/notifications/unsubscribe
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAuth, checkSupabaseConfig } from '@/lib/api-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-responses';

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { session } = authResult;

    // 2. Leggi endpoint dal body
    const { endpoint } = await request.json();
    if (!endpoint) {
      return ApiErrors.BAD_REQUEST('Endpoint non fornito');
    }

    const configCheck = checkSupabaseConfig();
    if (configCheck) return configCheck;

    // 3. Elimina la subscription dal database
    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_email', session.user.email);

    if (error) {
      return handleApiError(error, 'POST /api/notifications/unsubscribe - delete subscription');
    }

    console.log('Subscription eliminata:', endpoint);

    return NextResponse.json({
      success: true,
      message: 'Discritto da notifiche push',
    });
  } catch (error: any) {
    return handleApiError(error, 'POST /api/notifications/unsubscribe');
  }
}
