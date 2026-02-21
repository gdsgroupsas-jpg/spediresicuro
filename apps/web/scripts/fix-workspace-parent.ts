/**
 * Fix: sposta workspace Antonio Rossi sotto SpedireSicuro Platform
 * + Fix: dario Workspace non dovrebbe essere platform depth=0
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
  const PLATFORM_WS_ID = '2d890a8d-36c9-48be-b3a2-f54fba001db9'; // SpedireSicuro Platform
  const ANTONIO_WS_ID = '51a7a65f-17fe-4ac3-9a09-b41731eb9b90'; // antonio rossi Workspace

  // 1. Sposta Antonio Rossi sotto SpedireSicuro Platform
  console.log('1️⃣  Spostando workspace Antonio Rossi sotto SpedireSicuro Platform...');
  const { error: moveError } = await supabase
    .from('workspaces')
    .update({ parent_workspace_id: PLATFORM_WS_ID })
    .eq('id', ANTONIO_WS_ID);

  if (moveError) {
    console.error('❌ Errore:', moveError.message);
  } else {
    console.log('✅ Workspace Antonio Rossi spostato sotto SpedireSicuro Platform');
  }

  // 2. Verifica
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name, parent_workspace_id, type, depth')
    .eq('id', ANTONIO_WS_ID)
    .single();

  console.log('\nVerifica:', ws);

  // 3. Mostra gerarchia finale
  console.log('\n📦 Gerarchia SpedireSicuro Platform:');
  const { data: children } = await supabase
    .from('workspaces')
    .select('id, name, type, depth, status')
    .eq('parent_workspace_id', PLATFORM_WS_ID)
    .order('name');

  for (const c of children || []) {
    console.log(`  └─ ${c.name} [${c.type}, depth=${c.depth}, ${c.status}]`);
  }
}

fix().catch(console.error);
