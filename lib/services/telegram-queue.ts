/**
 * Telegram Message Queue with Redis (Upstash)
 *
 * Centralizzato message queueing system per Telegram Bot API.
 * TUTTI i messaggi Telegram passano attraverso questa queue.
 *
 * Features:
 * - Rate limiting: 120 messaggi/minuto (globale)
 * - Delay minimo tra messaggi consecutivi
 * - Persistenza con Redis (Upstash free tier)
 * - Retry logic per messaggi falliti
 * - Priority queue support
 *
 * Architecture (secondo specifiche Dario):
 * - Funzione base sendTelegramMessage() è SINCRONA
 * - Queue gestisce asincronia
 * - Pattern: enqueueMessage(chatId, text, options)
 *
 * Milestone: M5 - Telegram Notifications
 * Cost: €0/month (Upstash Free Tier: 10K commands/day)
 */

import { Redis } from '@upstash/redis';

// ============================================================
// Configuration & Constants
// ============================================================

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_MESSAGES_PER_MINUTE: 120, // Telegram best practice
  MIN_DELAY_MS: 500, // Minimum delay between messages (0.5s)
  MAX_RETRIES: 3, // Max retry attempts for failed messages
  RETRY_DELAY_MS: 2000, // Delay before retry (2s)
};

// Queue keys
const QUEUE_KEY = 'telegram:queue';
const LAST_SENT_KEY = 'telegram:last_sent';
const RATE_COUNTER_KEY = 'telegram:rate_counter';

// ============================================================
// Types
// ============================================================

export interface QueuedMessage {
  id: string;
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableNotification?: boolean;
  replyToMessageId?: number;
  priority?: number; // Higher = more important (default: 0)
  retryCount?: number;
  enqueuedAt: number;
}

export interface QueueStats {
  queueLength: number;
  messagesLastMinute: number;
  lastSentTimestamp: number;
}

// ============================================================
// Redis Client
// ============================================================

let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis | null {
  if (!REDIS_URL || !REDIS_TOKEN) {
    console.warn('[TELEGRAM_QUEUE] Redis not configured - queue disabled');
    return null;
  }

  if (!redisClient) {
    // Upstash Redis REST API client
    redisClient = new Redis({
      url: REDIS_URL,
      token: REDIS_TOKEN,
    });

    console.log('[TELEGRAM_QUEUE] Redis client initialized');
  }

  return redisClient;
}

// ============================================================
// Queue Operations
// ============================================================

/**
 * Enqueue a message to be sent via Telegram
 * This is the ONLY way to send messages - centralizzato
 *
 * @returns Message ID if queued, null if failed
 */
export async function enqueueMessage(
  chatId: string,
  text: string,
  options: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableNotification?: boolean;
    replyToMessageId?: number;
    priority?: number;
  } = {}
): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn('[TELEGRAM_QUEUE] Queue not available - message not sent');
    return null;
  }

  const message: QueuedMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    chatId: String(chatId),
    text,
    parseMode: options.parseMode || 'HTML',
    disableNotification: options.disableNotification || false,
    replyToMessageId: options.replyToMessageId,
    priority: options.priority || 0,
    retryCount: 0,
    enqueuedAt: Date.now(),
  };

  // Add to sorted set with priority (higher priority = lower score)
  const score = Date.now() - (message.priority || 0) * 1000000;

  try {
    await redis.zadd(QUEUE_KEY, { score, member: JSON.stringify(message) });
    console.log('[TELEGRAM_QUEUE] Message enqueued:', {
      id: message.id,
      chatId: message.chatId,
      textPreview: text.substring(0, 50),
      priority: message.priority,
    });
    return message.id;
  } catch (err) {
    console.error('[TELEGRAM_QUEUE] Failed to enqueue:', err);
    return null;
  }
}

/**
 * Get next message from queue (respecting rate limits)
 * @returns Message to send, or null if rate limited or queue empty
 */
export async function dequeueMessage(): Promise<QueuedMessage | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    // Check rate limits
    const canSend = await checkRateLimit();
    if (!canSend) {
      console.log('[TELEGRAM_QUEUE] Rate limited - waiting');
      return null;
    }

    // Get message with highest priority (lowest score)
    const messages = await redis.zrange(QUEUE_KEY, 0, 0);

    if (!messages || messages.length === 0) {
      return null; // Queue empty
    }

    const messageData = messages[0];

    // @upstash/redis auto-deserializes JSON, so messageData might be object or string
    const message: QueuedMessage =
      typeof messageData === 'string' ? JSON.parse(messageData) : messageData;

    // Remove from queue (must pass string for zrem)
    const messageString =
      typeof messageData === 'string' ? messageData : JSON.stringify(messageData);
    await redis.zrem(QUEUE_KEY, messageString);

    console.log('[TELEGRAM_QUEUE] Message dequeued:', {
      id: message.id,
      chatId: message.chatId,
      waitTime: Date.now() - message.enqueuedAt,
    });

    return message;
  } catch (error) {
    console.error('[TELEGRAM_QUEUE] Dequeue error:', error);
    return null;
  }
}

/**
 * Check if we can send a message (rate limiting)
 */
async function checkRateLimit(): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const now = Date.now();

  // Check minimum delay between messages
  const lastSent = await redis.get<string>(LAST_SENT_KEY);
  if (lastSent) {
    const timeSinceLastSent = now - parseInt(lastSent);
    if (timeSinceLastSent < RATE_LIMIT.MIN_DELAY_MS) {
      return false; // Too soon
    }
  }

  // Check messages per minute limit
  const messagesLastMinute = await redis.get<string>(RATE_COUNTER_KEY);
  if (messagesLastMinute && parseInt(messagesLastMinute) >= RATE_LIMIT.MAX_MESSAGES_PER_MINUTE) {
    console.warn('[TELEGRAM_QUEUE] Rate limit reached: 120 msg/min');
    return false;
  }

  return true;
}

/**
 * Update rate limiting counters after sending
 */
export async function updateRateLimitCounters(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const now = Date.now();

  // Update last sent timestamp
  await redis.set(LAST_SENT_KEY, now.toString());

  // Increment counter with 60s TTL
  const count = await redis.incr(RATE_COUNTER_KEY);
  if (count === 1) {
    // First message in this minute - set expiry
    await redis.expire(RATE_COUNTER_KEY, 60);
  }
}

/**
 * Re-queue a failed message for retry
 */
export async function requeueMessage(message: QueuedMessage): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  if ((message.retryCount || 0) >= RATE_LIMIT.MAX_RETRIES) {
    console.error('[TELEGRAM_QUEUE] Max retries reached, message dropped:', message.id);
    return;
  }

  message.retryCount = (message.retryCount || 0) + 1;

  // Add back to queue with lower priority (retry messages go to end)
  const score = Date.now() + RATE_LIMIT.RETRY_DELAY_MS;

  await redis.zadd(QUEUE_KEY, { score, member: JSON.stringify(message) });

  console.log('[TELEGRAM_QUEUE] Message requeued for retry:', {
    id: message.id,
    retryCount: message.retryCount,
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const redis = getRedisClient();
  if (!redis) {
    return {
      queueLength: 0,
      messagesLastMinute: 0,
      lastSentTimestamp: 0,
    };
  }

  const [queueLength, messagesLastMinute, lastSent] = await Promise.all([
    redis.zcard(QUEUE_KEY),
    redis.get<string>(RATE_COUNTER_KEY),
    redis.get<string>(LAST_SENT_KEY),
  ]);

  return {
    queueLength: queueLength || 0,
    messagesLastMinute: parseInt(messagesLastMinute || '0'),
    lastSentTimestamp: parseInt(lastSent || '0'),
  };
}

/**
 * Clear entire queue (use with caution)
 */
export async function clearQueue(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  await redis.del(QUEUE_KEY);
  console.log('[TELEGRAM_QUEUE] Queue cleared');
}

// ============================================================
// Graceful Shutdown
// ============================================================

/**
 * Close Redis connection on shutdown
 */
export async function closeQueue(): Promise<void> {
  if (redisClient) {
    // Upstash Redis REST client doesn't need explicit closing
    redisClient = null;
    console.log('[TELEGRAM_QUEUE] Redis connection closed');
  }
}

// Handle process termination
if (typeof process !== 'undefined') {
  process.on('SIGTERM', closeQueue);
  process.on('SIGINT', closeQueue);
}
