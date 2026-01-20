import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const lastSent = await redis.get('telegram:last_sent');
const rateCounter = await redis.get('telegram:rate_counter');
const queueLength = await redis.zcard('telegram:queue');

console.log('=== REDIS QUEUE DEBUG ===');
console.log('Queue length:', queueLength);
console.log('Rate counter:', rateCounter || '0');
console.log('Last sent timestamp:', lastSent || 'Never');

if (lastSent) {
  const timeSince = Date.now() - parseInt(lastSent);
  console.log('Time since last sent:', timeSince, 'ms');
  console.log('Rate limit allows send?', timeSince >= 500 ? 'YES' : `NO (need ${500 - timeSince}ms more)`);
}

// Get first message in queue
const messages = await redis.zrange('telegram:queue', 0, 0);
if (messages && messages.length > 0) {
  console.log('\n=== FIRST MESSAGE IN QUEUE (RAW) ===');
  console.log('Type:', typeof messages[0]);
  console.log('Is string?', typeof messages[0] === 'string');
  console.log('Raw value:', messages[0]);

  if (typeof messages[0] === 'string') {
    const msg = JSON.parse(messages[0]);
    console.log('\n=== PARSED MESSAGE ===');
    console.log('ID:', msg.id);
    console.log('Chat ID:', msg.chatId);
    console.log('Text preview:', msg.text.substring(0, 100));
    console.log('Enqueued at:', new Date(msg.enqueuedAt).toISOString());
    console.log('Wait time:', Date.now() - msg.enqueuedAt, 'ms');
  } else {
    console.log('\n=== MESSAGE IS OBJECT (NOT STRING!) ===');
    console.log('Direct access - ID:', messages[0].id);
    console.log('Direct access - chatId:', messages[0].chatId);
  }
}

process.exit(0);
