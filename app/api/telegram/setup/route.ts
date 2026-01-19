/**
 * Telegram Bot Setup Endpoint
 *
 * Configure webhook for the Telegram bot.
 *
 * POST /api/telegram/setup - Set webhook URL
 * DELETE /api/telegram/setup - Remove webhook
 * GET /api/telegram/setup - Get webhook info
 *
 * Security: Requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';
import {
  setWebhook,
  getWebhookInfo,
  deleteWebhook,
  isTelegramConfigured,
  sendTelegramMessage,
} from '@/lib/services/telegram-bot';

const ALLOWED_ROLES = ['admin', 'superadmin', 'SUPERADMIN'];

/**
 * Verify admin access
 */
async function verifyAdmin(): Promise<{ authorized: boolean; error?: string }> {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return { authorized: false, error: 'No session' };
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return { authorized: false, error: 'User not found' };
    }

    const extendedUser = user as typeof user & { account_type?: string };
    const role = extendedUser.account_type || user.role;

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return { authorized: false, error: 'Insufficient permissions' };
    }

    return { authorized: true };
  } catch {
    return { authorized: false, error: 'Auth error' };
  }
}

/**
 * GET - Get webhook info
 */
export async function GET() {
  const authResult = await verifyAdmin();
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        message: 'Telegram not configured',
        required: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
      },
      { status: 200 }
    );
  }

  const webhookInfo = await getWebhookInfo();

  return NextResponse.json({
    configured: true,
    webhook: webhookInfo,
  });
}

/**
 * POST - Set webhook URL
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyAdmin();
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: 'Telegram not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Use provided URL or construct from environment
    let webhookUrl = body.url;

    if (!webhookUrl) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.spediresicuro.it';
      webhookUrl = `${baseUrl}/api/webhooks/telegram`;
    }

    // Validate URL
    if (!webhookUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Webhook URL must use HTTPS' },
        { status: 400 }
      );
    }

    // Set webhook
    const result = await setWebhook(webhookUrl);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to set webhook' },
        { status: 500 }
      );
    }

    // Send test message
    await sendTelegramMessage(
      '✅ <b>Webhook configurato!</b>\n\nIl bot è ora attivo e pronto a ricevere comandi.',
      { disableNotification: true }
    );

    return NextResponse.json({
      success: true,
      webhookUrl,
      message: 'Webhook configured successfully',
    });
  } catch (error) {
    console.error('[TELEGRAM_SETUP] Error:', error);
    return NextResponse.json(
      { error: 'Failed to configure webhook' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove webhook
 */
export async function DELETE() {
  const authResult = await verifyAdmin();
  if (!authResult.authorized) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const result = await deleteWebhook();

  return NextResponse.json({
    success: result.success,
    message: result.success ? 'Webhook removed' : 'Failed to remove webhook',
  });
}
