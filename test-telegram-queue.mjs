/**
 * Test script for Telegram Queue System
 *
 * Tests:
 * 1. Redis connection
 * 2. Message enqueue
 * 3. Queue stats
 * 4. Worker endpoint
 */

import Redis from 'ioredis';

// Redis config from .env.local
const REDIS_URL = 'https://humorous-chow-33021.upstash.io';
const REDIS_TOKEN = 'AYD9AAIncDI3NWUzMzkzZDk4N2I0MjUzYTZkNjUyZWQ2NjBjMDU1YnAyMzMwMjE';

console.log('🧪 Testing Telegram Queue System\n');

// Test 1: Redis Connection
console.log('📡 Test 1: Redis Connection');
try {
  const url = new URL(REDIS_URL.replace('https://', 'redis://'));

  const redis = new Redis({
    host: url.hostname,
    port: parseInt(url.port || '6379'),
    password: REDIS_TOKEN,
    tls: {
      rejectUnauthorized: false,
    },
    maxRetriesPerRequest: 3,
  });

  redis.on('error', (err) => {
    console.error('❌ Redis error:', err.message);
    process.exit(1);
  });

  redis.on('connect', async () => {
    console.log('✅ Redis connected successfully!\n');

    // Test 2: Enqueue Test Message
    console.log('📝 Test 2: Enqueue Test Message');
    const testMessage = {
      id: `test_${Date.now()}`,
      chatId: '131071337',
      text: '🧪 Test message from queue system',
      parseMode: 'HTML',
      priority: 0,
      retryCount: 0,
      enqueuedAt: Date.now(),
    };

    const score = Date.now();
    await redis.zadd('telegram:queue', score, JSON.stringify(testMessage));
    console.log('✅ Message enqueued:', testMessage.id);

    // Test 3: Check Queue Stats
    console.log('\n📊 Test 3: Queue Statistics');
    const queueLength = await redis.zcard('telegram:queue');
    const messagesLastMinute = await redis.get('telegram:rate_counter') || '0';
    const lastSent = await redis.get('telegram:last_sent') || '0';

    console.log(`   Queue length: ${queueLength} messages`);
    console.log(`   Messages sent (last min): ${messagesLastMinute}`);
    console.log(`   Last sent: ${lastSent ? new Date(parseInt(lastSent)).toISOString() : 'Never'}`);

    // Test 4: Show Queue Contents
    console.log('\n📋 Test 4: Queue Contents (first 5)');
    const messages = await redis.zrange('telegram:queue', 0, 4);
    if (messages.length === 0) {
      console.log('   Queue is empty');
    } else {
      messages.forEach((msgStr, i) => {
        const msg = JSON.parse(msgStr);
        console.log(`   ${i + 1}. [${msg.id}] ${msg.text.substring(0, 40)}...`);
      });
    }

    // Test 5: Test Worker Endpoint
    console.log('\n🔧 Test 5: Worker Endpoint');
    console.log('   Testing manual trigger...');

    try {
      const response = await fetch('http://localhost:3000/api/cron/telegram-queue', {
        method: 'POST',
      });

      if (!response.ok) {
        console.log(`   ⚠️  Worker endpoint returned ${response.status}`);
        const text = await response.text();
        console.log(`   Response: ${text}`);
      } else {
        const data = await response.json();
        console.log('   ✅ Worker triggered successfully!');
        console.log('   Result:', data);
      }
    } catch (error) {
      console.log('   ⚠️  Could not reach worker (is dev server running?)');
      console.log('   Start with: npm run dev');
    }

    // Cleanup and exit
    console.log('\n✨ All tests completed!');
    console.log('\n📌 Next Steps:');
    console.log('   1. Start dev server: npm run dev');
    console.log('   2. Send test message to bot on Telegram');
    console.log('   3. Check queue: node test-telegram-queue.mjs');
    console.log('   4. Trigger worker: POST http://localhost:3000/api/cron/telegram-queue');
    console.log('   5. Monitor logs for message processing\n');

    await redis.quit();
    process.exit(0);
  });

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error(error);
  process.exit(1);
}
