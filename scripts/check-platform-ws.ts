import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const { data: ws } = await s
    .from('workspaces')
    .select('id, name, type, depth, organization_id, status')
    .eq('type', 'platform');
  console.log('Platform workspaces:', JSON.stringify(ws, null, 2));
  const { data: orgs } = await s.from('organizations').select('id, name, slug');
  console.log('\nOrganizations:', JSON.stringify(orgs, null, 2));
}
check();
