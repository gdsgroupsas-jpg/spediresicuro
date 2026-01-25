/**
 * EXAMPLE: How to use TestCleanup in your tests
 *
 * This file shows the recommended pattern for creating test users
 * and ensuring they get cleaned up after the test runs.
 *
 * BEFORE (old pattern - leaves garbage in DB):
 *   const user = await createUser();
 *   // test runs...
 *   // user stays in DB forever!
 *
 * AFTER (new pattern - auto cleanup):
 *   const cleanup = new TestCleanup();
 *   const user = await createUser();
 *   cleanup.trackUser(user.id);
 *   // test runs...
 *   afterAll(() => cleanup.execute());
 *   // user is deleted!
 */

import { supabaseAdmin } from '@/lib/db/client';
import { afterAll, describe, expect, it } from 'vitest';
import { TestCleanup } from '../helpers/test-cleanup';

describe('Example: Test with automatic cleanup', () => {
  // Create cleanup instance at describe level
  const cleanup = new TestCleanup({ verbose: true });

  // IMPORTANT: Always add afterAll to execute cleanup
  afterAll(async () => {
    const stats = await cleanup.execute();
    console.log('Cleanup stats:', stats);
  });

  it('should create and track a test user', async () => {
    // 1. Create test user with unique timestamp
    const email = `example-test-${Date.now()}@test.local`;

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'test-password-123',
      email_confirm: true,
    });

    expect(authError).toBeNull();
    expect(authUser?.user).toBeDefined();

    // 2. Track user for cleanup (IMPORTANT!)
    cleanup.trackUser(authUser!.user!.id);

    // 3. Create public user record
    const { data: publicUser, error: publicError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser!.user!.id,
        email,
        name: 'Example Test User',
        account_type: 'user',
      })
      .select()
      .single();

    expect(publicError).toBeNull();
    expect(publicUser).toBeDefined();

    // 4. Your test logic here...
    expect(publicUser.email).toBe(email);
  });

  it('should create multiple users and track them all', async () => {
    const userIds: string[] = [];

    // Create 3 test users
    for (let i = 0; i < 3; i++) {
      const email = `batch-test-${Date.now()}-${i}@test.local`;

      const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: 'test-password-123',
        email_confirm: true,
      });

      if (authUser?.user) {
        userIds.push(authUser.user.id);

        await supabaseAdmin.from('users').insert({
          id: authUser.user.id,
          email,
          name: `Batch User ${i}`,
        });
      }
    }

    // Track all users at once
    cleanup.trackUsers(userIds);

    expect(userIds.length).toBe(3);

    // Check tracked count
    const tracked = cleanup.getTrackedCount();
    expect(tracked.users).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Alternative: Quick cleanup for simple tests
 */
// import { cleanupTestUser, cleanupTestUsers } from '../helpers/test-cleanup';
//
// afterEach(async () => {
//   if (createdUserId) {
//     await cleanupTestUser(createdUserId);
//   }
// });
