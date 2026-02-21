import fs from 'fs/promises';
import path from 'path';

type ParseMode = 'HTML' | 'Markdown' | 'MarkdownV2';

export interface QueueMessageOptions {
  parseMode?: ParseMode;
  disableNotification?: boolean;
  replyToMessageId?: number;
  priority?: number;
}

interface QueueMessage {
  id: string;
  chatId: string;
  text: string;
  options: QueueMessageOptions;
  attempts: number;
  notBefore: number;
  enqueuedAt: number;
  storagePath?: string;
}

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const RATE_LIMIT_MS = Number(process.env.TELEGRAM_RATE_LIMIT_MS || 1100);
const MAX_RETRIES = Number(process.env.TELEGRAM_QUEUE_MAX_RETRIES || 0);
const MAX_QUEUE_SIZE = Number(process.env.TELEGRAM_QUEUE_MAX_SIZE || 500);
const AUTO_START = process.env.TELEGRAM_QUEUE_AUTOSTART !== 'false';
const FAILED_RETRY_MINUTES = Number(process.env.TELEGRAM_QUEUE_FAILED_RETRY_MINUTES || 0);
const RETRY_LOG_INTERVAL_MS = Number(process.env.TELEGRAM_QUEUE_RETRY_LOG_INTERVAL_MS || 30000);

const QUEUE_DIR =
  process.env.TELEGRAM_QUEUE_DIR || path.join(process.cwd(), 'data', 'telegram-queue');
const PENDING_DIR = path.join(QUEUE_DIR, 'pending');
const PROCESSING_DIR = path.join(QUEUE_DIR, 'processing');
const FAILED_DIR = path.join(QUEUE_DIR, 'failed');

const queue: QueueMessage[] = [];
const queueIndex = new Map<string, QueueMessage>();
let processing = false;
let lastSentAt = 0;
let initialized = false;
let failedRetryTimer: NodeJS.Timeout | null = null;
let lastRetryLogAt = 0;
let totalEnqueued = 0;
let totalSent = 0;
let totalRetries = 0;
let totalFailed = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureDirs(): Promise<void> {
  await fs.mkdir(PENDING_DIR, { recursive: true });
  await fs.mkdir(PROCESSING_DIR, { recursive: true });
  await fs.mkdir(FAILED_DIR, { recursive: true });
}

async function safeRename(fromPath: string, toPath: string): Promise<void> {
  await fs.rm(toPath, { force: true });
  try {
    await fs.rename(fromPath, toPath);
  } catch (error) {
    await fs.copyFile(fromPath, toPath);
    await fs.unlink(fromPath);
  }
}

async function persistMessage(message: QueueMessage, dir: string): Promise<void> {
  const fileName = message.storagePath
    ? path.basename(message.storagePath)
    : `${message.enqueuedAt}_${message.id}.json`;
  const finalPath = path.join(dir, fileName);
  const tempPath = `${finalPath}.tmp`;
  const { storagePath, ...payloadMessage } = message;
  const payload = JSON.stringify(payloadMessage, null, 2);
  await fs.writeFile(tempPath, payload, 'utf8');
  await safeRename(tempPath, finalPath);
  message.storagePath = finalPath;
}

async function moveMessage(message: QueueMessage, dir: string): Promise<void> {
  if (!message.storagePath) {
    await persistMessage(message, dir);
    return;
  }
  const fileName = path.basename(message.storagePath);
  const targetPath = path.join(dir, fileName);
  if (message.storagePath === targetPath) return;
  await safeRename(message.storagePath, targetPath);
  message.storagePath = targetPath;
}

function enqueueInternal(message: QueueMessage): void {
  queue.push(message);
  queueIndex.set(message.id, message);
  queue.sort((a, b) => {
    const priorityDiff = (b.options.priority || 0) - (a.options.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.notBefore !== b.notBefore) return a.notBefore - b.notBefore;
    return a.enqueuedAt - b.enqueuedAt;
  });
}

async function loadPendingFromDisk(): Promise<void> {
  const files = await fs.readdir(PENDING_DIR).catch(() => []);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const fullPath = path.join(PENDING_DIR, file);
    try {
      const raw = await fs.readFile(fullPath, 'utf8');
      const message = JSON.parse(raw) as QueueMessage;
      message.storagePath = fullPath;
      if (!message.id || !message.chatId || !message.text) {
        await moveMessage(message, FAILED_DIR);
        continue;
      }
      message.options = message.options || {};
      message.attempts = message.attempts ?? 0;
      message.notBefore = message.notBefore ?? Date.now();
      message.enqueuedAt = message.enqueuedAt ?? Date.now();
      if (!queueIndex.has(message.id)) {
        enqueueInternal(message);
      }
    } catch (error) {
      const failedPath = path.join(FAILED_DIR, file);
      await safeRename(fullPath, failedPath);
      console.error('[TELEGRAM_QUEUE] Corrupted message moved to failed', {
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function recoverProcessingToPending(): Promise<void> {
  const files = await fs.readdir(PROCESSING_DIR).catch(() => []);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const fromPath = path.join(PROCESSING_DIR, file);
    const toPath = path.join(PENDING_DIR, file);
    await safeRename(fromPath, toPath);
  }
}

export async function requeueFailedMessages(): Promise<number> {
  await ensureDirs();
  const files = await fs.readdir(FAILED_DIR).catch(() => []);
  let requeued = 0;

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const failedPath = path.join(FAILED_DIR, file);
    try {
      const raw = await fs.readFile(failedPath, 'utf8');
      const message = JSON.parse(raw) as QueueMessage;
      message.storagePath = failedPath;
      if (!message.id || !message.chatId || !message.text) {
        continue;
      }
      message.attempts = 0;
      message.notBefore = Date.now();
      await moveMessage(message, PENDING_DIR);
      await persistMessage(message, PENDING_DIR);
      if (!queueIndex.has(message.id)) {
        enqueueInternal(message);
      }
      requeued += 1;
    } catch (error) {
      console.error('[TELEGRAM_QUEUE] Failed to requeue message', {
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (requeued > 0 && AUTO_START) {
    void drainQueue();
  }

  return requeued;
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  await ensureDirs();
  await recoverProcessingToPending();
  await loadPendingFromDisk();
  initialized = true;
  if (queue.length > 0 && AUTO_START) {
    void drainQueue();
  }
  if (FAILED_RETRY_MINUTES > 0 && !failedRetryTimer) {
    failedRetryTimer = setInterval(
      () => {
        void requeueFailedMessages();
      },
      FAILED_RETRY_MINUTES * 60 * 1000
    );
  }
}

async function sendToTelegram(message: QueueMessage): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('Telegram bot token not configured');
  }

  const url = `${TELEGRAM_API_BASE}${botToken}/sendMessage`;
  const payload: Record<string, any> = {
    chat_id: message.chatId,
    text: message.text,
    parse_mode: message.options.parseMode || 'HTML',
    disable_notification: message.options.disableNotification || false,
  };

  if (message.options.replyToMessageId) {
    payload.reply_to_message_id = message.options.replyToMessageId;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const reason = data?.description || `HTTP ${response.status}`;
    throw new Error(`Telegram API error: ${reason}`);
  }
}

async function drainQueue(): Promise<void> {
  await ensureInitialized();
  if (processing) return;
  processing = true;

  try {
    while (queue.length > 0) {
      const now = Date.now();
      const nextIndex = queue.findIndex((msg) => msg.notBefore <= now);

      if (nextIndex === -1) {
        const nextTime = Math.min(...queue.map((msg) => msg.notBefore));
        await sleep(Math.max(0, nextTime - now));
        continue;
      }

      const message = queue.splice(nextIndex, 1)[0];
      queueIndex.delete(message.id);
      await moveMessage(message, PROCESSING_DIR);

      const sinceLast = Date.now() - lastSentAt;
      if (sinceLast < RATE_LIMIT_MS) {
        await sleep(RATE_LIMIT_MS - sinceLast);
      }

      try {
        await sendToTelegram(message);
        lastSentAt = Date.now();
        totalSent += 1;
        if (message.storagePath) {
          await fs.unlink(message.storagePath).catch(() => undefined);
        }
      } catch (error) {
        message.attempts += 1;
        const errorText = error instanceof Error ? error.message : String(error);
        const shouldRetry =
          MAX_RETRIES <= 0 || Number.isNaN(MAX_RETRIES) || message.attempts <= MAX_RETRIES;
        if (shouldRetry) {
          const backoff = Math.min(30000, 1000 * Math.pow(2, message.attempts - 1));
          message.notBefore = Date.now() + backoff;
          totalRetries += 1;
          const now = Date.now();
          if (now - lastRetryLogAt >= RETRY_LOG_INTERVAL_MS) {
            lastRetryLogAt = now;
            console.warn('[TELEGRAM_QUEUE] Retry scheduled', {
              id: message.id,
              chatId: message.chatId,
              attempts: message.attempts,
              nextRetryAt: new Date(message.notBefore).toISOString(),
              pending: queue.length + 1,
            });
          }
          await moveMessage(message, PENDING_DIR);
          await persistMessage(message, PENDING_DIR);
          enqueueInternal(message);
        } else {
          await moveMessage(message, FAILED_DIR);
          await persistMessage(message, FAILED_DIR);
          totalFailed += 1;
          console.error('[TELEGRAM_QUEUE] Message moved to failed', {
            id: message.id,
            chatId: message.chatId,
            attempts: message.attempts,
            error: errorText,
          });
        }
      }
    }
  } finally {
    processing = false;
    if (queue.length > 0 && AUTO_START) {
      setImmediate(() => {
        void drainQueue();
      });
    }
  }
}

export async function enqueueMessage(
  chatId: string,
  text: string,
  options: QueueMessageOptions = {}
): Promise<string | null> {
  await ensureInitialized();

  if (queue.length >= MAX_QUEUE_SIZE) {
    console.warn('[TELEGRAM_QUEUE] Queue size above limit, persisting anyway', {
      pending: queue.length,
      limit: MAX_QUEUE_SIZE,
    });
  }

  const message: QueueMessage = {
    id: generateId(),
    chatId,
    text,
    options,
    attempts: 0,
    notBefore: Date.now(),
    enqueuedAt: Date.now(),
  };

  try {
    await persistMessage(message, PENDING_DIR);
  } catch (error) {
    console.error('[TELEGRAM_QUEUE] Failed to persist message', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  totalEnqueued += 1;
  enqueueInternal(message);
  if (AUTO_START) {
    void drainQueue();
  }
  return message.id;
}

export function getQueueStats(): {
  pending: number;
  processing: boolean;
  lastSentAt: number;
  totals: {
    enqueued: number;
    sent: number;
    retries: number;
    failed: number;
  };
} {
  return {
    pending: queue.length,
    processing,
    lastSentAt,
    totals: {
      enqueued: totalEnqueued,
      sent: totalSent,
      retries: totalRetries,
      failed: totalFailed,
    },
  };
}
