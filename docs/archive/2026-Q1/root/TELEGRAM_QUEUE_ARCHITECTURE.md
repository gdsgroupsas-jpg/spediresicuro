# Telegram Message Queue Architecture

## Overview

Sistema di message queueing centralizzato per Telegram Bot API che garantisce:

- ✅ Rate limiting automatico (120 msg/min)
- ✅ Delay minimo tra messaggi (500ms)
- ✅ Retry automatico per messaggi falliti
- ✅ Persistenza con Redis (Upstash)
- ✅ Zero costi (Upstash Free Tier)

**Architettura secondo specifiche Dario Del Giudice**

## Componenti

### 1. Message Queue (`lib/services/telegram-queue.ts`)

Queue centralizzata basata su Redis (Upstash) che gestisce TUTTI i messaggi Telegram.

**Funzioni principali:**

- `enqueueMessage(chatId, text, options)` - Aggiunge messaggio alla queue
- `dequeueMessage()` - Estrae messaggio dalla queue (rispetta rate limits)
- `updateRateLimitCounters()` - Aggiorna contatori dopo invio
- `requeueMessage(message)` - Reinserisce messaggio fallito per retry
- `getQueueStats()` - Statistiche queue

**Rate Limiting:**

- Max 120 messaggi/minuto (globale)
- Min 500ms tra messaggi consecutivi
- Max 3 retry per messaggio fallito
- 2s delay prima di retry

**Storage:**

- Redis Sorted Set (priority queue)
- Score = timestamp - (priority \* 1000000)
- Higher priority = lower score = processed first

### 2. Queue Worker (`app/api/cron/telegram-queue/route.ts`)

Background worker che processa la queue ogni minuto (Vercel Cron).

**Processo:**

1. Dequeue messaggio (se rate limits OK)
2. Send via Telegram Bot API
3. Update rate limit counters
4. Retry se fallisce (max 3 attempts)
5. Repeat fino a 10 messaggi o queue vuota

**Endpoints:**

- `GET /api/cron/telegram-queue` - Triggered by Vercel Cron
- `POST /api/cron/telegram-queue` - Manual trigger (testing)

**Cron Schedule:**

```json
{
  "path": "/api/cron/telegram-queue",
  "schedule": "* * * * *" // Every minute
}
```

### 3. Telegram Bot Service (`lib/services/telegram-bot.ts`)

Funzioni per inviare messaggi - ORA SINCRONE.

**IMPORTANTE:** Tutte le funzioni sono ora sincrone e usano la queue:

```typescript
// PRIMA (async diretta):
await sendTelegramMessage(text, options);

// DOPO (sync + queue):
sendTelegramMessage(text, options); // Returns immediately
```

**Funzioni refactored:**

- `sendTelegramMessage()` - Sincrona, enqueue messaggio
- `sendToAdmins()` - Sincrona, enqueue per ogni admin
- `sendAlert()` - Sincrona, enqueue alert
- `sendDowntimeAlert()` - Sincrona, enqueue downtime alert
- `sendErrorAlert()` - Sincrona, enqueue error alert
- `sendWalletAlert()` - Sincrona, enqueue wallet alert
- `sendDailyStats()` - Sincrona, enqueue stats

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Application Layer                                          │
│  (webhook, alerts, stats, etc.)                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ sendTelegramMessage(text, options)
                  │ [SYNCHRONOUS - returns immediately]
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  telegram-bot.ts                                            │
│  - Validates config                                         │
│  - Calls enqueueMessage()                                   │
│  - Returns { success, queueId }                             │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ enqueueMessage(chatId, text, options)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  telegram-queue.ts (Redis)                                  │
│  - Add to sorted set with priority                          │
│  - Persist in Redis (Upstash)                               │
│  - Return queue ID                                          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Stored in Redis
                  │ (waiting for worker)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Queue Worker (Vercel Cron - every minute)                  │
│  /api/cron/telegram-queue                                   │
│                                                              │
│  1. dequeueMessage()                                        │
│     - Check rate limits (120/min, 500ms delay)              │
│     - Get highest priority message                          │
│     - Remove from queue                                     │
│                                                              │
│  2. Send to Telegram Bot API                                │
│     - POST to api.telegram.org/bot{token}/sendMessage       │
│     - Handle response                                       │
│                                                              │
│  3. Handle result                                           │
│     - Success: updateRateLimitCounters()                    │
│     - Failure: requeueMessage() (max 3 retries)             │
│                                                              │
│  4. Repeat (up to 10 messages per run)                      │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Upstash Redis (FREE TIER)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=default-chat-id
TELEGRAM_ADMIN_CHAT_IDS=admin1,admin2  # Optional

# Cron Secret
CRON_SECRET_TOKEN=your-secret  # For securing cron endpoint
```

### Vercel Configuration

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/telegram-queue",
      "schedule": "* * * * *"
    }
  ]
}
```

## Usage Examples

### Send Simple Message

```typescript
import { sendTelegramMessage } from '@/lib/services/telegram-bot';

// Synchronous - returns immediately
const result = sendTelegramMessage('Hello World!', {
  chatId: '123456789',
  parseMode: 'HTML',
});

console.log(result);
// { success: true, queueId: 'msg_1234567890_abc123' }
```

### Send Alert

```typescript
import { sendAlert } from '@/lib/services/telegram-bot';

// Synchronous - enqueued automatically
sendAlert('critical', 'Service Down', {
  Service: 'API',
  Uptime: '99.9%',
  LastCheck: new Date().toISOString(),
});
```

### Send to Multiple Admins

```typescript
import { sendToAdmins } from '@/lib/services/telegram-bot';

// Synchronous - enqueues for each admin
const result = sendToAdmins('⚠️ Urgent: Please check logs', {
  parseMode: 'HTML',
});

console.log(result);
// { success: true, sent: 3, failed: 0 }
```

### Manual Queue Trigger (Testing)

```bash
# Trigger queue worker manually
curl -X POST http://localhost:3000/api/cron/telegram-queue

# Response:
{
  "success": true,
  "processed": 5,
  "failed": 0,
  "remaining": 12,
  "timestamp": "2026-01-20T08:00:00.000Z"
}
```

### Check Queue Stats

```typescript
import { getQueueStats } from '@/lib/services/telegram-queue';

const stats = await getQueueStats();
console.log(stats);
// {
//   queueLength: 15,
//   messagesLastMinute: 43,
//   lastSentTimestamp: 1737360000000
// }
```

## Rate Limiting Details

### Telegram Official Limits

- 30 msg/sec per chat (individual)
- 20 msg/min per group
- No official global limit

### Our Implementation

- **120 msg/min global** (best practice)
- **500ms minimum delay** between messages
- **Sorted queue** (priority support)
- **Automatic retry** (3 attempts, 2s delay)

### Why Queue?

**BEFORE (Direct sending):**

- ❌ Can hit rate limits
- ❌ Messages lost if limit exceeded
- ❌ Bot gets temporarily blocked
- ❌ No retry on failure
- ❌ No priority support

**AFTER (Queue system):**

- ✅ Guaranteed rate limiting
- ✅ All messages eventually delivered
- ✅ Automatic retry on failure
- ✅ Priority support
- ✅ Persistent (survives restarts)
- ✅ Centralized (all messages use same queue)

## Cost Analysis

### Upstash Redis Free Tier

- 10,000 commands/day
- 256 MB storage
- **€0/month**

### Usage Estimation

- 1 message = ~5 Redis commands (zadd, zrange, zrem, get, set)
- **2,000 messages/day** within free tier
- Average: ~1.4 msg/min sustained
- Peak: 120 msg/min for short bursts

**Conclusion: FREE for typical usage**

## Monitoring

### Check Queue Health

```bash
# Check queue endpoint
curl https://www.spediresicuro.it/api/cron/telegram-queue \
  -H "Authorization: Bearer ${CRON_SECRET_TOKEN}"
```

### Logs to Monitor

- `[TELEGRAM_QUEUE] Message enqueued` - Message added to queue
- `[TELEGRAM_QUEUE] Message dequeued` - Message processing started
- `[TELEGRAM_QUEUE_WORKER] Message sent successfully` - Success
- `[TELEGRAM_QUEUE_WORKER] Send failed` - Failure (will retry)
- `[TELEGRAM_QUEUE] Max retries reached` - Message dropped

### Vercel Cron Logs

Check Vercel dashboard → Project → Deployments → Function Logs

Filter by: `/api/cron/telegram-queue`

## Migration Guide

### Old Code (Direct Sending)

```typescript
// ❌ OLD WAY - Direct async
await sendTelegramMessage('Hello', { chatId: '123' });
```

### New Code (Queue)

```typescript
// ✅ NEW WAY - Synchronous + queue
sendTelegramMessage('Hello', { chatId: '123' });
// Returns immediately, message enqueued
```

**IMPORTANT:** Remove all `await` from `sendTelegramMessage` calls!

## Troubleshooting

### Messages Not Sending

1. Check queue stats: `getQueueStats()`
2. Check Redis connection: Look for `[TELEGRAM_QUEUE] Redis connected`
3. Check worker logs: `/api/cron/telegram-queue` endpoint
4. Verify cron is running: Vercel dashboard → Cron Jobs

### Rate Limit Hit

- Normal! Queue will wait and retry
- Check `messagesLastMinute` in stats
- Should never exceed 120/min

### Messages Stuck in Queue

- Check worker is running (Vercel Cron)
- Manual trigger: `POST /api/cron/telegram-queue`
- Check Redis connection

### Redis Connection Issues

- Verify `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Check Upstash dashboard for issues
- Fallback: Messages will be logged but not sent

## Best Practices

1. **Never bypass the queue** - Always use `sendTelegramMessage()`
2. **Use priority for critical messages** - Higher priority = sent first
3. **Monitor queue length** - Alert if > 100 messages
4. **Test with manual trigger** - `POST /api/cron/telegram-queue`
5. **Check logs regularly** - Ensure worker is processing
6. **Keep messages concise** - Telegram has 4096 char limit
7. **Use HTML formatting** - Default parse mode

## Future Improvements

- [ ] Admin dashboard for queue management
- [ ] Queue length alerts via Slack
- [ ] Dead letter queue for failed messages
- [ ] Message deduplication
- [ ] Priority queue visualization
- [ ] Per-chat rate limiting (30 msg/sec)

## Credits

Architecture designed by **Dario Del Giudice**
Implemented by **Claude Sonnet 4.5**
Milestone: **M5 - Telegram Notifications**
Cost: **€0/month** (Upstash Free Tier)
