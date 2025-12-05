/**
 * API Route: Sottoscrizione a Push Notifications
 * POST /api/notifications/subscribe
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

    // 2. Leggi subscription dal body
    const { subscription } = await request.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Subscription non valida' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Database non configurato' },
        { status: 500 }
      );
    }

    // 3. Salva la subscription nel database
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_email: session.user.email,
        endpoint: subscription.endpoint,
        auth: subscription.keys?.auth,
        p256dh: subscription.keys?.p256dh,
        user_agent: request.headers.get('user-agent'),
        subscribed_at: new Date().toISOString(),
      }, {
        onConflict: 'endpoint',
      });

    if (error) {
      console.error('Errore salvataggio subscription:', error);
      return NextResponse.json(
        { error: 'Errore salvataggio subscription' },
        { status: 500 }
      );
    }

    console.log('Subscription salvata:', subscription.endpoint);

    // 4. Invia notifica di conferma
    await sendPushNotification(subscription, {
      title: 'Notifiche Abilitate! 🎉',
      body: 'Riceverai aggiornamenti sulle tue spedizioni e messaggi da Anne.',
    });

    return NextResponse.json({
      success: true,
      message: 'Iscritto a notifiche push',
    });
  } catch (error) {
    console.error('Errore subscribe notifications:', error);
    return NextResponse.json(
      { error: 'Errore interno' },
      { status: 500 }
    );
  }
}

/**
 * Funzione di utilità per inviare notifiche push
 */
async function sendPushNotification(
  subscription: PushSubscriptionJSON,
  message: { title: string; body: string; url?: string }
) {
  try {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys non configurate - notifiche disabilitate');
      return;
    }

    // Importa web-push (richiede installazione: npm install web-push)
    // const webpush = await import('web-push');
    // webpush.setVapidDetails(
    //   process.env.VAPID_SUBJECT || 'mailto:support@spediresicuro.it',
    //   vapidPublicKey,
    //   vapidPrivateKey
    // );

    // await webpush.sendNotification(subscription, JSON.stringify(message));
    
    console.log('Push notification sent (mock):', message);
  } catch (error) {
    console.error('Errore invio push notification:', error);
  }
}

export interface PushSubscriptionJSON {
  endpoint: string;
  keys?: {
    auth: string;
    p256dh: string;
  };
}
