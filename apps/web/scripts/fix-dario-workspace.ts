/**
 * Fix: dario Workspace non dovrebbe essere platform depth=0
 * Lo converte in client depth=1 sotto SpedireSicuro Platform
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: '.env.local' });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fix() {
  const DARIO_WS = 'd40df183-5ffe-44c9-925e-e8f3a8468a2f';
  const PLATFORM_WS = '2d890a8d-36c9-48be-b3a2-f54fba001db9';

  console.log(
    '1️⃣  Convertendo "dario Workspace" da platform→client, parent→SpedireSicuro Platform...'
  );

  const { error } = await s
    .from('workspaces')
    .update({
      type: 'client',
      depth: 1,
      parent_workspace_id: PLATFORM_WS,
    })
    .eq('id', DARIO_WS);

  if (error) {
    console.error('❌ Errore:', error.message);
  } else {
    console.log('✅ dario Workspace convertito a client depth=1');
  }

  // Verifica: ora c'è solo UN platform workspace
  const { data: platforms } = await s
    .from('workspaces')
    .select('id, name, type, depth')
    .eq('type', 'platform');

  console.log('\nPlatform workspaces rimasti:', platforms?.length);
  for (const p of platforms || []) {
    console.log(`  📦 ${p.name} [${p.type}, depth=${p.depth}]`);
  }

  // Mostra gerarchia completa
  console.log('\n📦 Gerarchia SpedireSicuro Platform:');
  const { data: children } = await s
    .from('workspaces')
    .select('id, name, type, depth, status')
    .eq('parent_workspace_id', PLATFORM_WS)
    .order('type')
    .order('name');

  for (const c of children || []) {
    console.log(`  └─ ${c.name} [${c.type}, depth=${c.depth}, ${c.status}]`);
  }
}

fix().catch(console.error);
