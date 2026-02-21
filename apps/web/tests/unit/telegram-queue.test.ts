import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

let tempDir: string;

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'telegram-queue-'));
}

describe('Telegram Queue - persistence', () => {
  beforeEach(async () => {
    tempDir = await createTempDir();
    process.env.TELEGRAM_QUEUE_DIR = tempDir;
    process.env.TELEGRAM_QUEUE_AUTOSTART = 'false';
  });

  afterEach(async () => {
    vi.resetModules();
    delete process.env.TELEGRAM_QUEUE_DIR;
    delete process.env.TELEGRAM_QUEUE_AUTOSTART;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('persists enqueued messages to disk', async () => {
    vi.resetModules();
    const { enqueueMessage } = await import('../../lib/services/telegram-queue');

    const messageId = await enqueueMessage('123', 'hello world', { priority: 2 });
    expect(messageId).toBeTypeOf('string');

    const pendingDir = path.join(tempDir, 'pending');
    const files = await fs.readdir(pendingDir);
    expect(files.length).toBe(1);

    const raw = await fs.readFile(path.join(pendingDir, files[0]), 'utf8');
    const stored = JSON.parse(raw);
    expect(stored.id).toBe(messageId);
    expect(stored.chatId).toBe('123');
    expect(stored.text).toBe('hello world');
    expect(stored.options.priority).toBe(2);
  });

  it('recovers processing messages after restart', async () => {
    const processingDir = path.join(tempDir, 'processing');
    await fs.mkdir(processingDir, { recursive: true });

    const message = {
      id: 'recovery-test',
      chatId: '777',
      text: 'recovery',
      options: {},
      attempts: 0,
      notBefore: Date.now(),
      enqueuedAt: Date.now(),
    };
    const fileName = `${message.enqueuedAt}_${message.id}.json`;
    await fs.writeFile(path.join(processingDir, fileName), JSON.stringify(message), 'utf8');

    vi.resetModules();
    const { enqueueMessage } = await import('../../lib/services/telegram-queue');
    await enqueueMessage('999', 'second message');

    const pendingDir = path.join(tempDir, 'pending');
    const pendingFiles = await fs.readdir(pendingDir);
    expect(pendingFiles.length).toBe(2);

    const processingFiles = await fs.readdir(processingDir);
    expect(processingFiles.length).toBe(0);
  });

  it('requeues failed messages when requested', async () => {
    const failedDir = path.join(tempDir, 'failed');
    await fs.mkdir(failedDir, { recursive: true });

    const message = {
      id: 'failed-test',
      chatId: '555',
      text: 'failed message',
      options: {},
      attempts: 3,
      notBefore: Date.now(),
      enqueuedAt: Date.now(),
    };
    const fileName = `${message.enqueuedAt}_${message.id}.json`;
    await fs.writeFile(path.join(failedDir, fileName), JSON.stringify(message), 'utf8');

    vi.resetModules();
    const { requeueFailedMessages, enqueueMessage } =
      await import('../../lib/services/telegram-queue');
    await enqueueMessage('111', 'seed');

    const requeued = await requeueFailedMessages();
    expect(requeued).toBe(1);

    const pendingDir = path.join(tempDir, 'pending');
    const pendingFiles = await fs.readdir(pendingDir);
    expect(pendingFiles.length).toBe(2);
  });
});
