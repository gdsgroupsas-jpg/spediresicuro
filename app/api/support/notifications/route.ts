/**
 * API: Support Notifications
 *
 * GET - Lista notifiche non lette per l'utente corrente
 * PATCH - Segna notifiche come lette
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { rateLimit } from '@/lib/security/rate-limit';

export async function GET(request: NextRequest) {
  const auth = await getSafeAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const userId = auth.target.id;

  const rl = await rateLimit('support-notifications', userId, { limit: 60, windowSeconds: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') !== 'false';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

  let query = supabaseAdmin
    .from('support_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    notifications: data || [],
    unreadCount: data?.filter((n: any) => !n.read).length || 0,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getSafeAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  const userId = auth.target.id;

  const rl = await rateLimit('support-notifications-patch', userId, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  const body = await request.json();
  const { notificationIds, markAllRead } = body;

  if (markAllRead) {
    const { error } = await supabaseAdmin
      .from('support_notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Tutte le notifiche segnate come lette' });
  }

  if (notificationIds && Array.isArray(notificationIds)) {
    const { error } = await supabaseAdmin
      .from('support_notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .in('id', notificationIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${notificationIds.length} notifiche segnate come lette`,
    });
  }

  return NextResponse.json({ error: 'Specificare notificationIds o markAllRead' }, { status: 400 });
}
