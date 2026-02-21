/**
 * Mostra gerarchia completa dei workspace
 * Uso: npx tsx scripts/check-workspace-hierarchy.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function show() {
  // Tutti i workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, type, depth, status, parent_workspace_id, organization_id')
    .order('depth', { ascending: true });

  // Tutti i membri
  const { data: members } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role, status')
    .eq('status', 'active');

  // Tutti gli utenti
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name, account_type, is_reseller, primary_workspace_id');

  if (!workspaces || !members || !users) {
    console.log('Errore caricamento dati');
    return;
  }

  const userMap = new Map(users.map((u) => [u.id, u]));

  console.log('\n🏗️  GERARCHIA WORKSPACE\n');

  for (const ws of workspaces) {
    const indent = '  '.repeat(ws.depth);
    const wsMembers = members.filter((m) => m.workspace_id === ws.id);
    const parentWs = workspaces.find((w) => w.id === ws.parent_workspace_id);

    console.log(`${indent}📦 ${ws.name} [${ws.type}, depth=${ws.depth}, status=${ws.status}]`);
    console.log(`${indent}   ID: ${ws.id}`);
    if (parentWs) {
      console.log(`${indent}   Parent: ${parentWs.name}`);
    }

    if (wsMembers.length > 0) {
      for (const m of wsMembers) {
        const user = userMap.get(m.user_id);
        console.log(`${indent}   👤 ${user?.email || 'N/A'} (${m.role}) — ${user?.name || 'N/A'}`);
      }
    } else {
      console.log(`${indent}   ⚠️  Nessun membro attivo`);
    }
    console.log('');
  }

  // Chi è janossystems0?
  const antonio = users.find((u) => u.email === 'janossystems0@gmail.com');
  if (antonio) {
    console.log('=== DETTAGLIO janossystems0@gmail.com ===');
    console.log('User ID:', antonio.id);
    console.log('Primary workspace:', antonio.primary_workspace_id);
    const antonioWs = workspaces.find((w) => w.id === antonio.primary_workspace_id);
    if (antonioWs) {
      console.log('Workspace name:', antonioWs.name);
      console.log('Workspace type:', antonioWs.type);
      console.log('Workspace parent:', antonioWs.parent_workspace_id);
      const parent = workspaces.find((w) => w.id === antonioWs.parent_workspace_id);
      console.log('Parent name:', parent?.name || 'NESSUNO');
    }
    const antonioMemberships = members.filter((m) => m.user_id === antonio.id);
    console.log('Memberships:', antonioMemberships.length);
    for (const m of antonioMemberships) {
      const ws = workspaces.find((w) => w.id === m.workspace_id);
      console.log(`  - ${ws?.name} (${m.role})`);
    }
  }
}

show().catch(console.error);
