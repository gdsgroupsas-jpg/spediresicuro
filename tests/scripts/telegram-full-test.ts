import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
type StepResult = {
  name: string;
  command?: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  details?: string;
};

dotenv.config({ path: '.env.local' });
dotenv.config();

function runCommand(command: string): { code: number | null; output: string } {
  const start = Date.now();
  const result = spawnSync(command, {
    shell: true,
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf-8',
  });
  const durationMs = Date.now() - start;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const output = [stdout, stderr].join('\n').trim();
  return { code: result.status, output: output.length ? output : `Completed in ${durationMs}ms` };
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function waitFor(
  condition: () => boolean,
  timeoutMs = 5000,
  intervalMs = 100
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

async function runWebhookFlow(): Promise<void> {
  const { NextRequest } = await import('next/server');
  const { POST: TelegramWebhookPost } = await import('../../app/api/webhooks/telegram/route');
  const { getQueueStats } = await import('../../lib/services/telegram-queue');

  const chatId = process.env.TELEGRAM_CHAT_ID || '1';
  const update = {
    update_id: Date.now(),
    message: {
      message_id: 1,
      from: { id: 123, first_name: 'Tester' },
      chat: { id: Number(chatId), type: 'group' },
      date: Math.floor(Date.now() / 1000),
      text: '/help',
    },
  };

  const request = new NextRequest('http://localhost/api/webhooks/telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(update),
  });

  const response = await TelegramWebhookPost(request);
  if (!response.ok) {
    throw new Error(`Webhook response not ok: ${response.status}`);
  }

  const drained = await waitFor(() => getQueueStats().pending === 0, 5000, 100);
  if (!drained) {
    throw new Error('Queue did not drain in time');
  }

  const completed = await waitFor(
    () => {
      const stats = getQueueStats();
      return stats.pending === 0 && !stats.processing && stats.totals.sent >= 1;
    },
    5000,
    100
  );
  if (!completed) {
    throw new Error('Queue totals did not update as expected');
  }
}

async function runQueueEndpoint(): Promise<void> {
  const { GET: TelegramQueueGet } = await import('../../app/api/telegram/queue/route');
  const response = await TelegramQueueGet();
  if (!response.ok) {
    throw new Error(`Queue endpoint response not ok: ${response.status}`);
  }
  const body = await response.json();
  if (!body?.queue?.totals) {
    throw new Error('Queue endpoint missing totals');
  }
}

async function runPerformanceTest(
  messageCount: number
): Promise<{ elapsedMs: number; rateLimitMs: number }> {
  const rateLimitMs = Number(process.env.TELEGRAM_RATE_LIMIT_MS || 1100);
  const { enqueueMessage, getQueueStats } = await import('../../lib/services/telegram-queue');
  const start = Date.now();
  for (let i = 0; i < messageCount; i += 1) {
    const id = await enqueueMessage(process.env.TELEGRAM_CHAT_ID || '1', `perf-${i}`);
    if (!id) {
      throw new Error('Failed to enqueue perf message');
    }
  }

  const drained = await waitFor(
    () => {
      const stats = getQueueStats();
      return stats.pending === 0 && !stats.processing;
    },
    10000,
    100
  );
  if (!drained) {
    throw new Error('Queue did not drain for perf test');
  }

  const elapsedMs = Date.now() - start;
  const expectedMin = Math.max(0, (messageCount - 1) * rateLimitMs * 0.9);
  if (elapsedMs < expectedMin) {
    throw new Error(`Rate limit not respected: elapsed ${elapsedMs}ms < expected ${expectedMin}ms`);
  }

  return { elapsedMs, rateLimitMs };
}

async function main() {
  const reportDir = process.env.TELEGRAM_TEST_REPORT_DIR || path.join('tests', 'reports');
  ensureDir(reportDir);

  const tempQueueDir = path.join(os.tmpdir(), `telegram-queue-${Date.now()}`);
  process.env.TELEGRAM_QUEUE_DIR = tempQueueDir;
  process.env.TELEGRAM_QUEUE_AUTOSTART = 'true';
  process.env.TELEGRAM_RATE_LIMIT_MS = process.env.TELEGRAM_RATE_LIMIT_MS || '1100';
  process.env.TELEGRAM_QUEUE_MAX_RETRIES = '0';
  process.env.TELEGRAM_QUEUE_RETRY_LOG_INTERVAL_MS = '0';
  process.env.TELEGRAM_QUEUE_FAILED_RETRY_MINUTES = '0';
  process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-token';
  process.env.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '1';

  const useRealTelegram = process.env.TELEGRAM_TEST_REAL === 'true';
  const fetchCalls: Array<{ url: string; body?: string }> = [];

  if (!useRealTelegram) {
    global.fetch = (async (url: any, init?: any) => {
      const body = init?.body ? String(init.body) : undefined;
      fetchCalls.push({ url: String(url), body });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      } as Response;
    }) as typeof fetch;
  }

  const steps: StepResult[] = [];
  let overallStatus: 'passed' | 'failed' = 'passed';

  const unitStart = Date.now();
  const unit = runCommand('vitest run tests/unit/telegram-queue.test.ts');
  steps.push({
    name: 'Telegram queue unit tests',
    command: 'vitest run tests/unit/telegram-queue.test.ts',
    status: unit.code === 0 ? 'passed' : 'failed',
    durationMs: Date.now() - unitStart,
    details: unit.output,
  });
  if (unit.code !== 0) {
    overallStatus = 'failed';
  }

  const webhookStart = Date.now();
  try {
    await runWebhookFlow();
    steps.push({
      name: 'Telegram webhook command flow',
      status: 'passed',
      durationMs: Date.now() - webhookStart,
      details: useRealTelegram
        ? 'Real Telegram enabled'
        : `Mocked fetch calls: ${fetchCalls.length}`,
    });
  } catch (error) {
    overallStatus = 'failed';
    steps.push({
      name: 'Telegram webhook command flow',
      status: 'failed',
      durationMs: Date.now() - webhookStart,
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const queueStart = Date.now();
  try {
    await runQueueEndpoint();
    steps.push({
      name: 'Telegram queue endpoint',
      status: 'passed',
      durationMs: Date.now() - queueStart,
    });
  } catch (error) {
    overallStatus = 'failed';
    steps.push({
      name: 'Telegram queue endpoint',
      status: 'failed',
      durationMs: Date.now() - queueStart,
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const perfStart = Date.now();
  try {
    const messageCount = Number(process.env.TELEGRAM_PERF_MESSAGES || 3);
    const perf = await runPerformanceTest(messageCount);
    steps.push({
      name: 'Telegram queue performance (rate limit)',
      status: 'passed',
      durationMs: Date.now() - perfStart,
      details: `elapsed=${perf.elapsedMs}ms rateLimit=${perf.rateLimitMs}ms messages=${messageCount}`,
    });
  } catch (error) {
    overallStatus = 'failed';
    steps.push({
      name: 'Telegram queue performance (rate limit)',
      status: 'failed',
      durationMs: Date.now() - perfStart,
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const summary = {
    timestamp: new Date().toISOString(),
    overallStatus,
    steps,
  };

  fs.writeFileSync(
    path.join(reportDir, 'telegram-full-report.json'),
    JSON.stringify(summary, null, 2),
    'utf-8'
  );

  const mdLines = [
    '# Telegram Full Test Report',
    `- Timestamp: ${summary.timestamp}`,
    `- Status: ${summary.overallStatus}`,
    '',
    '## Steps',
  ];
  for (const step of steps) {
    mdLines.push(`- ${step.name}: ${step.status} (${step.durationMs} ms)`);
    if (step.command) mdLines.push(`  Command: ${step.command}`);
    if (step.details) mdLines.push(`  Details: ${step.details}`);
  }
  fs.writeFileSync(path.join(reportDir, 'telegram-full-report.md'), mdLines.join('\n'), 'utf-8');

  if (overallStatus === 'failed') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[TELEGRAM_FULL_TEST] Unhandled error:', error);
  process.exit(1);
});
