/**
 * Telegram Queue Worker
 *
 * Background worker che processa la queue di messaggi Telegram.
 * Viene chiamato da Vercel Cron (ogni 30 secondi) o manualmente.
 *
 * Processo:
 * 1. Dequeue messaggio (rispettando rate limits)
 * 2. Invia via Telegram Bot API
 * 3. Update rate limit counters
 * 4. Retry se fallisce
 *
 * Endpoint: GET /api/cron/telegram-queue
 * Cron Schedule: Every minute (* * * * *)
 *
 * Milestone: M5 - Telegram Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  dequeueMessage,
  updateRateLimitCounters,
  requeueMessage,
  getQueueStats,
} from '@/lib/services/telegram-queue';

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

/**
 * Process messages from the queue
 */
async function processQueueMessages(): Promise<{
  processed: number;
  failed: number;
  remaining: number;
}> {
  let processed = 0;
  let failed = 0;

  const config = {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  };

  if (!config.botToken) {
    console.error('[TELEGRAM_QUEUE_WORKER] Bot token not configured');
    return { processed: 0, failed: 0, remaining: 0 };
  }

  // Process multiple messages in one run (up to 10, respecting rate limits)
  const MAX_MESSAGES_PER_RUN = 10;

  for (let i = 0; i < MAX_MESSAGES_PER_RUN; i++) {
    const message = await dequeueMessage();

    if (!message) {
      // Queue empty or rate limited
      break;
    }

    try {
      // Send message via Telegram Bot API
      const url = `${TELEGRAM_API_BASE}${config.botToken}/sendMessage`;

      const payload = {
        chat_id: message.chatId,
        text: message.text,
        parse_mode: message.parseMode || 'HTML',
        disable_notification: message.disableNotification || false,
        ...(message.replyToMessageId ? { reply_to_message_id: message.replyToMessageId } : {}),
      };

      console.log('[TELEGRAM_QUEUE_WORKER] Sending message:', {
        id: message.id,
        chatId: message.chatId,
        textPreview: message.text.substring(0, 50),
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        console.error('[TELEGRAM_QUEUE_WORKER] Send failed:', {
          id: message.id,
          error: data.description,
        });

        // Re-queue for retry
        await requeueMessage(message);
        failed++;
      } else {
        console.log('[TELEGRAM_QUEUE_WORKER] Message sent successfully:', {
          id: message.id,
          messageId: data.result?.message_id,
        });

        // Update rate limit counters
        await updateRateLimitCounters();
        processed++;
      }
    } catch (error) {
      console.error('[TELEGRAM_QUEUE_WORKER] Error processing message:', {
        id: message.id,
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Re-queue for retry
      await requeueMessage(message);
      failed++;
    }
  }

  // Get remaining queue length
  const stats = await getQueueStats();

  return {
    processed,
    failed,
    remaining: stats.queueLength,
  };
}

/**
 * GET - Process queue (called by Vercel Cron)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET_TOKEN;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[TELEGRAM_QUEUE_WORKER] Unauthorized cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[TELEGRAM_QUEUE_WORKER] Starting queue processing');

  try {
    const result = await processQueueMessages();

    console.log('[TELEGRAM_QUEUE_WORKER] Processing complete:', result);

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[TELEGRAM_QUEUE_WORKER] Worker error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Manual trigger (for testing/debugging)
 */
export async function POST(request: NextRequest) {
  console.log('[TELEGRAM_QUEUE_WORKER] Manual trigger');

  try {
    const result = await processQueueMessages();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
      trigger: 'manual',
    });
  } catch (error) {
    console.error('[TELEGRAM_QUEUE_WORKER] Manual trigger error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
