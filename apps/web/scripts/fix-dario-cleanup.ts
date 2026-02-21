/**
 * Cleanup: disattiva dario Workspace e membership vecchia
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DARIO_USER_ID = '29937e38-5b1b-41a7-9d36-621adea19b8b';
const DARIO_WS_ID = 'd40df183-5ffe-44c9-925e-e8f3a8468a2f';

async function fix() {
  // 1. Disattiva workspace con status valido: 'deleted'
  console.log('1. Disattivando dario Workspace (status=deleted)...');
  const { error: wsErr } = await s
    .from('workspaces')
    .update({ status: 'deleted' })
    .eq('id', DARIO_WS_ID);
  if (wsErr) console.error('   Errore workspace:', wsErr.message);
  else console.log('   OK');

  // 2. Rimuovi membership con status valido: 'removed'
  console.log('2. Rimuovendo membership vecchio workspace...');
  const { error: memErr } = await s
    .from('workspace_members')
    .update({ status: 'removed' })
    .eq('user_id', DARIO_USER_ID)
    .eq('workspace_id', DARIO_WS_ID);
  if (memErr) console.error('   Errore membership:', memErr.message);
  else console.log('   OK');

  // 3. Verifica
  console.log('\n=== VERIFICA ===');
  const { data: ws } = await s
    .from('workspaces')
    .select('name, type, status')
    .eq('id', DARIO_WS_ID)
    .single();
  console.log('dario Workspace:', ws);

  const { data: mem } = await s
    .from('workspace_members')
    .select('workspace_id, role, status')
    .eq('user_id', DARIO_USER_ID);

  for (const m of mem || []) {
    const { data: mws } = await s
      .from('workspaces')
      .select('name')
      .eq('id', m.workspace_id)
      .single();
    console.log(`  ${mws?.name} → ${m.role} (${m.status})`);
  }
}

fix().catch(console.error);
