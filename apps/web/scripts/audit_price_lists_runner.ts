import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Fix for loading .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function runAudit() {
  console.log('🚀 Starting Price List Audit...\n');
  let hasErrors = false;

  // 1. Verifica Assegnazioni Duplicate Attive
  console.log('1️⃣ Checking for Duplicate Assignments...');
  const { data: assignments, error: err1 } = await supabaseAdmin
    .from('price_list_assignments')
    .select('user_id, price_list_id')
    .is('revoked_at', null);

  if (err1) {
    console.error('Error fetching assignments:', err1);
  } else {
    const map = new Map<string, number>();
    const anomalies: string[] = [];

    assignments?.forEach((a) => {
      const key = `${a.user_id}_${a.price_list_id}`;
      map.set(key, (map.get(key) || 0) + 1);
    });

    map.forEach((count, key) => {
      if (count > 1) anomalies.push(key);
    });

    if (anomalies.length > 0) {
      console.error(`❌ FAIL: Found ${anomalies.length} duplicate assignments:`, anomalies);
      hasErrors = true;
    } else {
      console.log('✅ PASS: No duplicate assignments found.');
    }
  }

  // 2. Verifica Violazione Isolamento "Supplier"
  console.log('\n2️⃣ Checking Supplier List Isolation...');
  // Fetch lists and manually join users or fetch users separately
  const { data: supplierLists, error: err2 } = await supabaseAdmin
    .from('price_lists')
    .select('id, name, created_by')
    .eq('list_type', 'supplier');

  if (err2) {
    console.error('Error fetching supplier lists:', err2);
  } else if (supplierLists) {
    const creatorIds = [...new Set(supplierLists.map((l) => l.created_by).filter((id) => id))];
    if (creatorIds.length > 0) {
      const { data: users, error: errUsers } = await supabaseAdmin
        .from('users')
        .select('id, email, account_type, is_reseller')
        .in('id', creatorIds);

      if (errUsers) {
        console.error('Error fetching users:', errUsers);
      } else {
        const userMap = new Map(users?.map((u) => [u.id, u]));
        const violations = supplierLists.filter((pl) => {
          const u = userMap.get(pl.created_by);
          if (!u) return false; // Orphaned list check is separate
          // Violation if NOT reseller AND NOT byoc AND NOT admin/superadmin
          const isSafe =
            u.is_reseller ||
            u.account_type === 'byoc' ||
            u.account_type === 'admin' ||
            u.account_type === 'superadmin';
          return !isSafe;
        });

        if (violations.length > 0) {
          console.error(
            `❌ FAIL: Found ${violations.length} isolation violations (Supplier list by non-reseller):`
          );
          violations.forEach((v) => {
            const u = userMap.get(v.created_by);
            console.log(`   - List: ${v.name} (${v.id}), User: ${u?.email} (${u?.account_type})`);
          });
          hasErrors = true;
        } else {
          console.log('✅ PASS: All supplier lists are owned by authorized roles.');
        }
      }
    } else {
      console.log('✅ PASS: No supplier lists found to check.');
    }
  }

  // 3. Verifica Listini Orfani
  console.log('\n3️⃣ Checking for Orphaned Price Lists...');
  const { data: allLists, error: err3 } = await supabaseAdmin
    .from('price_lists')
    .select('id, name, created_by');
  if (err3) {
    console.error('Error fetching lists:', err3);
  } else {
    const creatorIds = [...new Set(allLists?.map((l) => l.created_by).filter((id) => id))];
    // Fetch existing users
    // Note: fetching all users might be heavy, but assumed manageable for audit
    const { data: users, error: errUsers } = await supabaseAdmin
      .from('users')
      .select('id')
      .in('id', creatorIds);

    if (errUsers) {
      console.error('Error fetching users:', errUsers);
    } else {
      const existingUserIds = new Set(users?.map((u) => u.id));
      const orphans = allLists?.filter((l) => l.created_by && !existingUserIds.has(l.created_by));

      if (orphans && orphans.length > 0) {
        console.error(`❌ FAIL: Found ${orphans.length} orphaned price lists (creator not found).`);
        // orphans.forEach(o => console.log(`   - ${o.name} (${o.id})`));
        hasErrors = true;
      } else {
        console.log('✅ PASS: No orphaned price lists found.');
      }
    }
  }

  // 4. Verifica Correttezza master_list_id
  console.log('\n4️⃣ Checking Master List Links...');
  const { data: derivedLists, error: err4 } = await supabaseAdmin
    .from('price_lists')
    .select('id, name, master_list_id')
    .not('master_list_id', 'is', null);

  if (err4) {
    console.error('Error fetching derived lists:', err4);
  } else {
    const masterIds = [...new Set(derivedLists?.map((l) => l.master_list_id))];
    if (masterIds.length > 0) {
      const { data: masters, error: errMasters } = await supabaseAdmin
        .from('price_lists')
        .select('id')
        .in('id', masterIds);
      if (errMasters) {
        console.error('Error fetching master lists:', errMasters);
      } else {
        const existingMasters = new Set(masters?.map((m) => m.id));
        const brokenLinks = derivedLists?.filter((l) => !existingMasters.has(l.master_list_id));

        if (brokenLinks && brokenLinks.length > 0) {
          console.error(`❌ FAIL: Found ${brokenLinks.length} broken master list links.`);
          hasErrors = true;
        } else {
          console.log('✅ PASS: All derived lists point to valid master lists.');
        }
      }
    } else {
      console.log('✅ PASS: No derived lists found.');
    }
  }

  console.log('\n=====================================================');
  if (hasErrors) {
    console.log('🔴 AUDIT FAILED - Anomalies detected.');
    process.exit(1);
  } else {
    console.log('🟢 AUDIT PASSED - All checks green.');
    process.exit(0);
  }
}

runAudit().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
