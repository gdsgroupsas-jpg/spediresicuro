/**
 * Test C3 R2: Guardian — KNOWN LIMITATION commenti presenti nei file
 *
 * Verifica che i commenti documentanti le race condition note
 * siano presenti. Se qualcuno li rimuove, il test fallisce.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

describe('KNOWN LIMITATION documentation (F-ATOM-3, F-ATOM-4)', () => {
  it('F-ATOM-3: commento presente in user-memory.ts sopra upsertUserMemory', () => {
    const content = fs.readFileSync(path.join(ROOT, 'lib/ai/user-memory.ts'), 'utf8');
    expect(content).toContain('KNOWN LIMITATION (F-ATOM-3)');
    expect(content).toContain('read-then-write race condition');
  });

  it('F-ATOM-4: commento presente in supervisor-router.ts sopra audit dedup', () => {
    const content = fs.readFileSync(
      path.join(ROOT, 'lib/agent/orchestrator/supervisor-router.ts'),
      'utf8'
    );
    expect(content).toContain('KNOWN LIMITATION (F-ATOM-4)');
    expect(content).toContain('TOCTOU race condition');
  });
});
