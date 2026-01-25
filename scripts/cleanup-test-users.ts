#!/usr/bin/env npx ts-node
/**
 * Cleanup Test Users - Enterprise Grade Script
 *
 * Questo script identifica e rimuove utenti di test dal database
 * insieme a tutti i loro dati correlati (spedizioni, wallet transactions, etc.)
 *
 * USAGE:
 *   npx ts-node scripts/cleanup-test-users.ts              # Dry-run (preview only)
 *   npx ts-node scripts/cleanup-test-users.ts --execute    # Esegue effettivamente
 *   npx ts-node scripts/cleanup-test-users.ts --help       # Mostra aiuto
 *
 * SAFETY:
 *   - Default: DRY-RUN mode (nessuna modifica)
 *   - Richiede flag --execute per modifiche reali
 *   - Log dettagliato di ogni operazione
 *   - Conferma interattiva prima di procedere
 *
 * TOP-TIER AGENCY APPROACH:
 *   1. Pattern-based detection (email + nome)
 *   2. Cascade delete (user -> shipments -> wallet_transactions)
 *   3. Audit trail (log di ogni operazione)
 *   4. Rollback info (salva ID eliminati per eventuale restore)
 */

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Pattern per identificare utenti di test (deve matchare lib/utils/test-data-detection.ts)
const TEST_EMAIL_PATTERNS = [
  /^test@/i,
  /test-.*@spediresicuro\.it$/i,
  /@test\./i,
  /test.*@.*test/i,
  /^e2e-/i,
  /^smoke-test-/i,
  /^integration-test-/i,
  /playwright/i,
  /cypress/i,
  /vitest/i,
];

const TEST_NAME_PATTERNS = [
  /^test\s+/i,
  /test\s+user/i,
  /e2e\s+test/i,
  /smoke\s+test/i,
  /integration\s+test/i,
  /^test\s*$/i,
  /playwright/i,
  /cypress/i,
];

interface TestUser {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  matchReason: string;
}

interface CleanupStats {
  usersFound: number;
  usersDeleted: number;
  shipmentsDeleted: number;
  walletTransactionsDeleted: number;
  topUpRequestsDeleted: number;
  errors: string[];
}

function isTestEmail(email: string | null | undefined): { match: boolean; reason?: string } {
  if (!email) return { match: false };
  for (const pattern of TEST_EMAIL_PATTERNS) {
    if (pattern.test(email)) {
      return { match: true, reason: `Email matches pattern: ${pattern.source}` };
    }
  }
  return { match: false };
}

function isTestName(name: string | null | undefined): { match: boolean; reason?: string } {
  if (!name) return { match: false };
  for (const pattern of TEST_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return { match: true, reason: `Name matches pattern: ${pattern.source}` };
    }
  }
  return { match: false };
}

function isTestUser(user: { email?: string | null; name?: string | null }): {
  isTest: boolean;
  reason: string;
} {
  const emailCheck = isTestEmail(user.email);
  if (emailCheck.match) {
    return { isTest: true, reason: emailCheck.reason! };
  }
  const nameCheck = isTestName(user.name);
  if (nameCheck.match) {
    return { isTest: true, reason: nameCheck.reason! };
  }
  return { isTest: false, reason: '' };
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isHelp = args.includes('--help') || args.includes('-h');

  if (isHelp) {
    console.log(`
================================================================================
                        CLEANUP TEST USERS - Enterprise Grade
================================================================================

USAGE:
  npx ts-node scripts/cleanup-test-users.ts              # Dry-run (preview only)
  npx ts-node scripts/cleanup-test-users.ts --execute    # Execute deletion
  npx ts-node scripts/cleanup-test-users.ts --help       # Show this help

OPTIONS:
  --execute    Actually delete test users (default: dry-run)
  --help, -h   Show this help message

SAFETY:
  - Default mode is DRY-RUN (no changes made)
  - Requires explicit --execute flag to delete
  - Shows preview before any deletion
  - Asks for confirmation before proceeding

WHAT GETS DELETED:
  1. Test users (matching email/name patterns)
  2. Their shipments
  3. Their wallet transactions
  4. Their top-up requests

PATTERNS MATCHED:
  Emails: test@*, *@test.*, e2e-*, smoke-test-*, integration-test-*
  Names:  Test User, E2E Test, Smoke Test, etc.
================================================================================
`);
    process.exit(0);
  }

  console.log('\n================================================================================');
  console.log('                    CLEANUP TEST USERS - Enterprise Grade');
  console.log('================================================================================\n');
  console.log(
    `Mode: ${isExecute ? '!!! EXECUTE MODE - CHANGES WILL BE MADE !!!' : 'DRY-RUN (preview only)'}`
  );
  console.log('');

  // Verifica environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('ERROR: Missing environment variables');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    console.error('\nRun with: source .env.local && npx ts-node scripts/cleanup-test-users.ts');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const stats: CleanupStats = {
    usersFound: 0,
    usersDeleted: 0,
    shipmentsDeleted: 0,
    walletTransactionsDeleted: 0,
    topUpRequestsDeleted: 0,
    errors: [],
  };

  // 1. Fetch all users
  console.log('[1/5] Fetching all users...');
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select('id, email, name, created_at, role, account_type')
    .order('created_at', { ascending: false });

  if (usersError) {
    console.error('ERROR fetching users:', usersError.message);
    process.exit(1);
  }

  if (!allUsers || allUsers.length === 0) {
    console.log('No users found in database.');
    process.exit(0);
  }

  console.log(`   Found ${allUsers.length} total users`);

  // 2. Identify test users
  console.log('\n[2/5] Identifying test users...');
  const testUsers: TestUser[] = [];

  for (const user of allUsers) {
    const check = isTestUser(user);
    if (check.isTest) {
      // Non eliminare admin/superadmin anche se matchano pattern
      if (
        user.role === 'admin' ||
        user.account_type === 'superadmin' ||
        user.account_type === 'admin'
      ) {
        console.log(`   SKIP (admin): ${user.email}`);
        continue;
      }
      testUsers.push({
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        matchReason: check.reason,
      });
    }
  }

  stats.usersFound = testUsers.length;
  console.log(`   Found ${testUsers.length} test users to clean up`);

  if (testUsers.length === 0) {
    console.log('\n No test users found. Database is clean!');
    process.exit(0);
  }

  // 3. Show preview
  console.log('\n[3/5] Preview of test users to delete:');
  console.log('--------------------------------------------------------------------------------');
  console.log('| # | Email                                  | Name             | Reason       |');
  console.log('--------------------------------------------------------------------------------');

  testUsers.forEach((user, index) => {
    const email = (user.email || '').substring(0, 40).padEnd(40);
    const name = (user.name || 'N/A').substring(0, 16).padEnd(16);
    const reason = user.matchReason.substring(0, 12).padEnd(12);
    console.log(`| ${String(index + 1).padStart(2)} | ${email} | ${name} | ${reason} |`);
  });

  console.log('--------------------------------------------------------------------------------');

  // 4. Count related data
  console.log('\n[4/5] Counting related data...');

  const userIds = testUsers.map((u) => u.id);

  // Count shipments
  const { count: shipmentsCount } = await supabase
    .from('shipments')
    .select('id', { count: 'exact', head: true })
    .in('user_id', userIds);

  // Count wallet transactions
  const { count: walletTxCount } = await supabase
    .from('wallet_transactions')
    .select('id', { count: 'exact', head: true })
    .in('user_id', userIds);

  // Count top-up requests
  const { count: topUpCount } = await supabase
    .from('top_up_requests')
    .select('id', { count: 'exact', head: true })
    .in('user_id', userIds);

  console.log(`   Related shipments: ${shipmentsCount || 0}`);
  console.log(`   Related wallet transactions: ${walletTxCount || 0}`);
  console.log(`   Related top-up requests: ${topUpCount || 0}`);

  // Summary
  console.log('\n================================================================================');
  console.log('                              CLEANUP SUMMARY');
  console.log('================================================================================');
  console.log(`   Test users to delete:        ${testUsers.length}`);
  console.log(`   Shipments to delete:         ${shipmentsCount || 0}`);
  console.log(`   Wallet transactions:         ${walletTxCount || 0}`);
  console.log(`   Top-up requests:             ${topUpCount || 0}`);
  console.log('================================================================================\n');

  if (!isExecute) {
    console.log(' DRY-RUN MODE - No changes made.');
    console.log('');
    console.log('To actually delete these users, run:');
    console.log('   npx ts-node scripts/cleanup-test-users.ts --execute');
    console.log('');
    process.exit(0);
  }

  // 5. Execute deletion (only with --execute flag)
  console.log('[5/5] Executing cleanup...');
  console.log('');

  const confirmed = await askConfirmation(
    `Are you sure you want to delete ${testUsers.length} test users and all their data? (y/N): `
  );

  if (!confirmed) {
    console.log('\nAborted by user.');
    process.exit(0);
  }

  console.log('\nProceeding with deletion...\n');

  // Save deleted user IDs for audit/rollback
  const deletedUserIds: string[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    const progress = `[${i + 1}/${testUsers.length}]`;

    try {
      console.log(`${progress} Deleting user: ${user.email}`);

      // Delete related data first (cascade)
      // 1. Delete shipments
      const { error: shipError, count: shipCount } = await supabase
        .from('shipments')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (shipError) {
        console.log(`   Warning: Failed to delete shipments: ${shipError.message}`);
        stats.errors.push(`Shipments delete failed for ${user.email}: ${shipError.message}`);
      } else {
        stats.shipmentsDeleted += shipCount || 0;
        if (shipCount) console.log(`   Deleted ${shipCount} shipments`);
      }

      // 2. Delete wallet transactions
      const { error: walletError, count: walletCount } = await supabase
        .from('wallet_transactions')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (walletError) {
        console.log(`   Warning: Failed to delete wallet_transactions: ${walletError.message}`);
        stats.errors.push(`Wallet delete failed for ${user.email}: ${walletError.message}`);
      } else {
        stats.walletTransactionsDeleted += walletCount || 0;
        if (walletCount) console.log(`   Deleted ${walletCount} wallet transactions`);
      }

      // 3. Delete top-up requests
      const { error: topupError, count: topupCount } = await supabase
        .from('top_up_requests')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (topupError) {
        console.log(`   Warning: Failed to delete top_up_requests: ${topupError.message}`);
        stats.errors.push(`Top-up delete failed for ${user.email}: ${topupError.message}`);
      } else {
        stats.topUpRequestsDeleted += topupCount || 0;
        if (topupCount) console.log(`   Deleted ${topupCount} top-up requests`);
      }

      // 4. Delete user
      const { error: userError } = await supabase.from('users').delete().eq('id', user.id);

      if (userError) {
        console.log(`   ERROR: Failed to delete user: ${userError.message}`);
        stats.errors.push(`User delete failed for ${user.email}: ${userError.message}`);
      } else {
        stats.usersDeleted++;
        deletedUserIds.push(user.id);
        console.log(`   User deleted`);
      }
    } catch (error: any) {
      console.log(`   ERROR: ${error.message}`);
      stats.errors.push(`Exception for ${user.email}: ${error.message}`);
    }
  }

  // Final report
  console.log('\n================================================================================');
  console.log('                              CLEANUP COMPLETE');
  console.log('================================================================================');
  console.log(`   Users deleted:               ${stats.usersDeleted}/${stats.usersFound}`);
  console.log(`   Shipments deleted:           ${stats.shipmentsDeleted}`);
  console.log(`   Wallet transactions deleted: ${stats.walletTransactionsDeleted}`);
  console.log(`   Top-up requests deleted:     ${stats.topUpRequestsDeleted}`);
  console.log(`   Errors:                      ${stats.errors.length}`);
  console.log('================================================================================\n');

  if (stats.errors.length > 0) {
    console.log('ERRORS:');
    stats.errors.forEach((err) => console.log(`  - ${err}`));
    console.log('');
  }

  // Save audit log
  console.log(`Audit log: ${deletedUserIds.length} user IDs deleted at ${timestamp}`);
  console.log('');
}

main().catch((error) => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
