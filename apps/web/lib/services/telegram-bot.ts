/**
 * Telegram Bot Service
 *
 * Provides Telegram notifications for SpediReSicuro alerts.
 * Supports both push notifications and bot commands.
 *
 * Milestone: M5 - Telegram Notifications
 * Cost: €0/month (Telegram Bot API is free)
 *
 * Environment Variables:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_CHAT_ID: Default chat/group ID for alerts
 * - TELEGRAM_ADMIN_CHAT_IDS: Comma-separated admin chat IDs (optional)
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

// Message types for formatting
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface TelegramConfig {
  botToken: string;
  defaultChatId: string;
  adminChatIds?: string[];
}

export interface SendMessageOptions {
  chatId?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableNotification?: boolean;
  replyToMessageId?: number;
}

/**
 * Get Telegram configuration from environment
 */
function getConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !defaultChatId) {
    return null;
  }

  const adminChatIds = process.env.TELEGRAM_ADMIN_CHAT_IDS?.split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    botToken,
    defaultChatId,
    adminChatIds,
  };
}

/**
 * Check if Telegram is configured
 */
export function isTelegramConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Send a message DIRECTLY via Telegram Bot API (no queue)
 *
 * Use this for immediate responses (e.g., bot commands) where
 * the queue-based approach doesn't work (Vercel serverless).
 *
 * @returns Success + messageId if sent, error if fails
 */
export async function sendTelegramMessageDirect(
  text: string,
  options: SendMessageOptions = {}
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const config = getConfig();

  if (!config) {
    console.warn('[TELEGRAM] Bot not configured - skipping message');
    return { success: false, error: 'Telegram not configured' };
  }

  const chatId = String(options.chatId || config.defaultChatId);

  console.log('[TELEGRAM] Sending message directly:', {
    chatId,
    textLength: text.length,
    textPreview: text.substring(0, 50),
  });

  try {
    const url = `${TELEGRAM_API_BASE}${config.botToken}/sendMessage`;
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: text,
      parse_mode: options.parseMode || 'HTML',
      disable_notification: options.disableNotification || false,
    };

    if (options.replyToMessageId) {
      payload.reply_to_message_id = options.replyToMessageId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('[TELEGRAM] API error:', data.description);
      return { success: false, error: data.description };
    }

    console.log('[TELEGRAM] Message sent successfully:', { messageId: data.result?.message_id });
    return { success: true, messageId: data.result?.message_id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TELEGRAM] Send failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send a message via Telegram Bot API (ASYNC with queue)
 *
 * IMPORTANTE: Questa funzione è ASINCRONA e usa la message queue.
 * NON invia messaggi direttamente - li mette in coda per essere processati.
 *
 * NOTE: On Vercel serverless, the queue may not work due to ephemeral filesystem.
 * Use sendTelegramMessageDirect() for immediate responses instead.
 *
 * Architecture (secondo specifiche Dario):
 * - Funzione async: enqueue e attende conferma
 * - Queue gestisce rate limiting
 * - Worker processa la queue in background
 *
 * @returns Success + queueId se enqueued, error se fallisce
 */
export async function sendTelegramMessage(
  text: string,
  options: SendMessageOptions = {}
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  // Lazy import to avoid circular dependencies
  const { enqueueMessage } = require('./telegram-queue');

  const config = getConfig();

  if (!config) {
    console.warn('[TELEGRAM] Bot not configured - skipping message');
    return { success: false, error: 'Telegram not configured' };
  }

  const chatId = String(options.chatId || config.defaultChatId);

  console.log('[TELEGRAM] Enqueuing message:', {
    chatId,
    textLength: text.length,
    textPreview: text.substring(0, 50),
  });

  try {
    // Enqueue message (ASYNC operation - must await!)
    const queueId = await enqueueMessage(chatId, text, {
      parseMode: options.parseMode || 'HTML',
      disableNotification: options.disableNotification || false,
      replyToMessageId: options.replyToMessageId,
      priority: 0, // Default priority (can be customized per message type)
    });

    if (!queueId) {
      console.error('[TELEGRAM] Failed to enqueue message');
      return { success: false, error: 'Queue unavailable' };
    }

    console.log('[TELEGRAM] Message enqueued successfully:', { queueId });
    return { success: true, queueId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[TELEGRAM] Enqueue failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Send message to all admin chats
 */
export async function sendToAdmins(
  text: string,
  options: Omit<SendMessageOptions, 'chatId'> = {}
): Promise<{ success: boolean; sent: number; failed: number }> {
  const config = getConfig();

  if (!config) {
    return { success: false, sent: 0, failed: 0 };
  }

  const chatIds = config.adminChatIds?.length ? config.adminChatIds : [config.defaultChatId];

  let sent = 0;
  let failed = 0;

  for (const chatId of chatIds) {
    const result = await sendTelegramMessage(text, { ...options, chatId });
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { success: failed === 0, sent, failed };
}

// ============================================================
// Formatted Alert Messages
// ============================================================

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  critical: '🚨',
  warning: '⚠️',
  info: 'ℹ️',
  success: '✅',
};

/**
 * Send a formatted alert message
 */
export async function sendAlert(
  severity: AlertSeverity,
  title: string,
  details: Record<string, string | number | boolean>,
  options?: SendMessageOptions
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  const emoji = SEVERITY_EMOJI[severity];
  const detailLines = Object.entries(details)
    .map(([key, value]) => `• <b>${escapeHtml(key)}:</b> ${escapeHtml(String(value))}`)
    .join('\n');

  const message = `${emoji} <b>${escapeHtml(title)}</b>\n\n${detailLines}\n\n<i>${new Date().toISOString()}</i>`;

  return await sendTelegramMessage(message, options);
}

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// Specific Alert Functions
// ============================================================

/**
 * Send downtime alert (from UptimeRobot)
 */
export async function sendDowntimeAlert(
  monitorName: string,
  url: string,
  isDown: boolean,
  details?: string
): Promise<{ success: boolean }> {
  const severity: AlertSeverity = isDown ? 'critical' : 'success';
  const title = isDown ? 'SERVIZIO DOWN' : 'SERVIZIO RIPRISTINATO';

  return await sendAlert(severity, title, {
    Monitor: monitorName,
    URL: url,
    Stato: isDown ? 'Offline' : 'Online',
    ...(details ? { Dettagli: details } : {}),
  });
}

/**
 * Send error alert (from Sentry)
 */
export async function sendErrorAlert(
  errorTitle: string,
  errorMessage: string,
  url?: string,
  count?: number
): Promise<{ success: boolean }> {
  return await sendAlert('critical', 'ERRORE APPLICAZIONE', {
    Errore: errorTitle,
    Messaggio: errorMessage,
    ...(url ? { Link: url } : {}),
    ...(count ? { Occorrenze: count } : {}),
  });
}

/**
 * Send wallet/financial alert
 */
export async function sendWalletAlert(
  type: 'topup_pending' | 'topup_approved' | 'low_balance',
  userEmail: string,
  amount: number,
  details?: Record<string, string | number>
): Promise<{ success: boolean }> {
  const titles: Record<typeof type, string> = {
    topup_pending: 'RICARICA IN ATTESA',
    topup_approved: 'RICARICA APPROVATA',
    low_balance: 'SALDO BASSO',
  };

  const severity: AlertSeverity = type === 'low_balance' ? 'warning' : 'info';

  return await sendAlert(severity, titles[type], {
    Utente: userEmail,
    Importo: `€${amount.toFixed(2)}`,
    ...details,
  });
}

/**
 * Send daily stats summary
 */
export async function sendDailyStats(stats: {
  shipmentsToday: number;
  revenueToday: number;
  newUsers: number;
  pendingTopups: number;
  activeUsers: number;
}): Promise<{ success: boolean }> {
  const message = `📊 <b>RIEPILOGO GIORNALIERO</b>

📦 Spedizioni oggi: <b>${stats.shipmentsToday}</b>
💰 Fatturato oggi: <b>€${stats.revenueToday.toFixed(2)}</b>
👥 Nuovi utenti: <b>${stats.newUsers}</b>
⏳ Ricariche pending: <b>${stats.pendingTopups}</b>
🟢 Utenti attivi (30gg): <b>${stats.activeUsers}</b>

<i>${new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</i>`;

  return await sendTelegramMessage(message, { disableNotification: true });
}

// ============================================================
// Bot Commands Handler
// ============================================================

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
    };
    date: number;
    text?: string;
  };
}

export interface CommandHandler {
  command: string;
  description: string;
  handler: (chatId: number, args: string[]) => Promise<string>;
}

/**
 * Parse command from message text
 */
export function parseCommand(text: string): { command: string; args: string[] } | null {
  if (!text.startsWith('/')) return null;

  const parts = text.split(/\s+/);
  const commandPart = parts[0].split('@')[0]; // Remove @botname if present
  const command = commandPart.substring(1).toLowerCase();
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Format uptime/health status for Telegram
 */
export function formatHealthStatus(
  services: Array<{ name: string; status: 'ok' | 'error' | 'warning'; latency?: number }>
): string {
  const statusEmoji = {
    ok: '🟢',
    warning: '🟡',
    error: '🔴',
  };

  const lines = services.map(
    (s) =>
      `${statusEmoji[s.status]} <b>${escapeHtml(s.name)}</b>${s.latency ? ` (${s.latency}ms)` : ''}`
  );

  return `🏥 <b>STATO SERVIZI</b>\n\n${lines.join('\n')}\n\n<i>${new Date().toISOString()}</i>`;
}

/**
 * Set webhook URL for the bot
 */
export async function setWebhook(
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  const config = getConfig();

  if (!config) {
    return { success: false, error: 'Telegram not configured' };
  }

  const url = `${TELEGRAM_API_BASE}${config.botToken}/setWebhook`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      return { success: false, error: data.description };
    }

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMsg };
  }
}

/**
 * Get webhook info
 */
export async function getWebhookInfo(): Promise<{
  url: string;
  pending_update_count: number;
  last_error_message?: string;
} | null> {
  const config = getConfig();

  if (!config) {
    return null;
  }

  const url = `${TELEGRAM_API_BASE}${config.botToken}/getWebhookInfo`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      return null;
    }

    return data.result;
  } catch {
    return null;
  }
}

/**
 * Delete webhook (for switching to polling)
 */
export async function deleteWebhook(): Promise<{ success: boolean }> {
  const config = getConfig();

  if (!config) {
    return { success: false };
  }

  const url = `${TELEGRAM_API_BASE}${config.botToken}/deleteWebhook`;

  try {
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();
    return { success: data.ok };
  } catch {
    return { success: false };
  }
}
