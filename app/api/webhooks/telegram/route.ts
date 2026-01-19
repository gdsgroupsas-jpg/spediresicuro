/**
 * Telegram Bot Webhook Endpoint
 *
 * Receives updates from Telegram and processes bot commands.
 *
 * Endpoint: POST /api/webhooks/telegram
 *
 * Supported Commands:
 * - /start - Welcome message
 * - /help - Show available commands
 * - /stats - Today's business stats
 * - /health - Service health status
 * - /id - Get your chat ID (for setup)
 *
 * Milestone: M5 - Telegram Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  TelegramUpdate,
  parseCommand,
  sendTelegramMessage,
  formatHealthStatus,
  isTelegramConfigured,
} from '@/lib/services/telegram-bot';
import { getQuickStats } from '@/lib/metrics/business-metrics';

// Authorized chat IDs (from env)
function getAuthorizedChatIds(): number[] {
  const defaultId = process.env.TELEGRAM_CHAT_ID;
  const adminIds = process.env.TELEGRAM_ADMIN_CHAT_IDS?.split(',').map((id) =>
    parseInt(id.trim(), 10)
  );

  const ids: number[] = [];
  if (defaultId) ids.push(parseInt(defaultId, 10));
  if (adminIds) ids.push(...adminIds.filter((id) => !isNaN(id)));

  return ids;
}

/**
 * Check if a chat is authorized to use bot commands
 */
function isAuthorizedChat(chatId: number): boolean {
  const authorizedIds = getAuthorizedChatIds();

  // If no IDs configured, allow /id command for setup
  if (authorizedIds.length === 0) return true;

  return authorizedIds.includes(chatId);
}

/**
 * Handle /start command
 */
async function handleStart(chatId: number): Promise<string> {
  return `🚀 <b>Benvenuto su SpediReSicuro Bot!</b>

Questo bot ti permette di:
• Ricevere alert critici in tempo reale
• Controllare lo stato dei servizi
• Visualizzare statistiche rapide

Usa /help per vedere i comandi disponibili.`;
}

/**
 * Handle /help command
 */
async function handleHelp(chatId: number): Promise<string> {
  return `📖 <b>Comandi Disponibili</b>

/stats - Statistiche di oggi
/health - Stato dei servizi
/id - Mostra il tuo Chat ID
/help - Questo messaggio

<i>Riceverai automaticamente alert per:
• Errori critici
• Servizi down
• Ricariche in attesa</i>`;
}

/**
 * Handle /stats command
 */
async function handleStats(chatId: number): Promise<string> {
  try {
    const stats = await getQuickStats();

    return `📊 <b>STATISTICHE DI OGGI</b>

📦 Spedizioni: <b>${stats.shipmentsToday}</b>
💰 Fatturato: <b>€${stats.revenueToday.toFixed(2)}</b>
⏳ Ricariche pending: <b>${stats.pendingTopups}</b>
👥 Utenti attivi (30gg): <b>${stats.activeUsers}</b>

<i>Aggiornato: ${new Date().toLocaleTimeString('it-IT')}</i>`;
  } catch (error) {
    console.error('[TELEGRAM] Stats error:', error);
    return '❌ Errore nel recupero delle statistiche. Riprova più tardi.';
  }
}

/**
 * Handle /health command
 */
async function handleHealth(chatId: number): Promise<string> {
  try {
    // Check health of various services
    const services: Array<{
      name: string;
      status: 'ok' | 'error' | 'warning';
      latency?: number;
    }> = [];

    // Check API health - we're running in the API, so it's OK
    services.push({
      name: 'API',
      status: 'ok',
    });

    // Check Supabase by querying the database directly
    const supabaseStart = Date.now();
    try {
      const { supabaseAdmin } = await import('@/lib/supabase');

      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const { data, error } = await supabaseAdmin
        .from('shipments')
        .select('id')
        .limit(1)
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      services.push({
        name: 'Database',
        status: error ? 'error' : 'ok',
        latency: Date.now() - supabaseStart,
      });
    } catch (err) {
      const latency = Date.now() - supabaseStart;
      services.push({
        name: 'Database',
        status: 'error',
        latency: latency > 5000 ? undefined : latency // Don't show latency if timeout
      });
    }

    // Telegram is obviously OK if we're here
    services.push({ name: 'Telegram Bot', status: 'ok' });

    return formatHealthStatus(services);
  } catch (error) {
    console.error('[TELEGRAM] Health check error:', error);
    return '❌ Errore nel controllo dello stato. Riprova più tardi.';
  }
}

/**
 * Handle /id command - for setup
 */
async function handleId(chatId: number): Promise<string> {
  return `🆔 <b>Il tuo Chat ID è:</b>

<code>${chatId}</code>

Aggiungi questo ID a TELEGRAM_CHAT_ID o TELEGRAM_ADMIN_CHAT_IDS su Vercel per ricevere notifiche.`;
}

/**
 * Handle unknown command
 */
async function handleUnknown(chatId: number, command: string): Promise<string> {
  return `❓ Comando <code>/${command}</code> non riconosciuto.\n\nUsa /help per vedere i comandi disponibili.`;
}

/**
 * Process incoming Telegram update
 */
async function processUpdate(update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const text = message.text;

  console.log('[TELEGRAM_WEBHOOK] Processing message:', {
    chatId,
    text,
    isTelegramConfigured: isTelegramConfigured(),
    authorizedIds: getAuthorizedChatIds(),
  });

  // Parse command
  const parsed = parseCommand(text);
  if (!parsed) {
    console.log('[TELEGRAM_WEBHOOK] Not a command, skipping');
    return;
  }

  const { command, args } = parsed;

  console.log('[TELEGRAM_WEBHOOK] Parsed command:', { command, chatId });

  // /id is always allowed (for setup)
  if (command !== 'id' && !isAuthorizedChat(chatId)) {
    console.log('[TELEGRAM_WEBHOOK] Chat not authorized:', { chatId });
    await sendTelegramMessage('⛔ Non sei autorizzato ad usare questo bot.', {
      chatId: String(chatId),
    });
    return;
  }

  // Route to handler
  let response: string;

  switch (command) {
    case 'start':
      response = await handleStart(chatId);
      break;
    case 'help':
      response = await handleHelp(chatId);
      break;
    case 'stats':
      response = await handleStats(chatId);
      break;
    case 'health':
      response = await handleHealth(chatId);
      break;
    case 'id':
      response = await handleId(chatId);
      break;
    default:
      response = await handleUnknown(chatId, command);
  }

  // Send response
  console.log('[TELEGRAM_WEBHOOK] Sending response:', {
    command,
    chatId,
    responseLength: response.length,
  });
  const sendResult = await sendTelegramMessage(response, { chatId: String(chatId) });
  console.log('[TELEGRAM_WEBHOOK] Send result:', sendResult);
}

/**
 * POST - Receive webhook updates from Telegram
 */
export async function POST(request: NextRequest) {
  // Verify Telegram is configured
  if (!isTelegramConfigured()) {
    console.warn('[TELEGRAM_WEBHOOK] Bot not configured');
    return NextResponse.json({ ok: true }); // Return OK to stop retries
  }

  try {
    console.log('[TELEGRAM_WEBHOOK] Processing POST request');

    const rawBody = await request.json();
    console.log('[TELEGRAM_WEBHOOK] Raw body received:', {
      keys: Object.keys(rawBody),
      hasMessage: !!rawBody.message,
      hasUpdateId: !!rawBody.update_id,
    });

    const update: TelegramUpdate = rawBody;

    console.log('[TELEGRAM_WEBHOOK] Received update:', {
      updateId: update.update_id,
      chatId: update.message?.chat?.id,
      text: update.message?.text?.substring(0, 50),
    });

    // Process asynchronously - return immediately to Telegram
    console.log('[TELEGRAM_WEBHOOK] Starting async processing');
    processUpdate(update).catch((error) => {
      console.error('[TELEGRAM_WEBHOOK] Processing error:', error);
    });

    console.log('[TELEGRAM_WEBHOOK] Returning ok: true to Telegram');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[TELEGRAM_WEBHOOK] Error parsing request:', error);
    console.error('[TELEGRAM_WEBHOOK] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return OK to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}

/**
 * GET - Health check and webhook info
 */
export async function GET() {
  const configured = isTelegramConfigured();

  return NextResponse.json({
    status: 'ok',
    endpoint: 'Telegram Bot Webhook',
    configured,
    commands: ['/start', '/help', '/stats', '/health', '/id'],
    setupInstructions: !configured
      ? {
          step1: 'Create bot via @BotFather on Telegram',
          step2: 'Get bot token and add as TELEGRAM_BOT_TOKEN',
          step3: 'Send /id to bot and add chat ID as TELEGRAM_CHAT_ID',
          step4: 'Set webhook: POST to /api/telegram/setup',
        }
      : undefined,
  });
}
