#!/usr/bin/env tsx

/**
 * Smoke Wallet Runner
 *
 * Esegue in sequenza gli smoke test wallet/idempotency.
 *
 * Usage:
 *   npx tsx scripts/smoke-wallet.ts
 *
 * NPM:
 *   npm run smoke:wallet
 */

import { spawnSync } from 'child_process';

const tests = [
  'scripts/smoke-test-zero-balance.ts',
  'scripts/smoke-test-no-label-no-credit-courier-fail.ts',
  'scripts/smoke-test-no-label-no-credit-db-fail.ts',
  'scripts/smoke-test-idempotency-retry.ts',
];

function run(cmd: string, args: string[]) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  return res.status ?? 1;
}

function main() {
  console.log('');
  console.log('🧪 WALLET SMOKE RUNNER');
  console.log('='.repeat(70));

  for (const testFile of tests) {
    console.log('');
    console.log(`▶ Running: ${testFile}`);
    const code = run('npx', ['--yes', 'tsx', testFile]);
    if (code !== 0) {
      console.error(`\n❌ Wallet smoke runner failed on: ${testFile} (exit ${code})`);
      process.exit(code);
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log('✅ WALLET SMOKE RUNNER: ALL TESTS PASSED');
  console.log('='.repeat(70));
}

main();
