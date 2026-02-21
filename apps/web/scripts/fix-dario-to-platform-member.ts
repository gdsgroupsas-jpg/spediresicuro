/**
 * Fix: Dario è il CTO umano di SpedireSicuro, NON un reseller.
 *
 * Azioni:
 * 1. Aggiunge Dario come membro admin di SpedireSicuro Platform
 * 2. Aggiorna il suo primary_workspace_id al Platform workspace
 * 3. Disattiva "dario Workspace" (non serve più)
 * 4. Rimuove membership dal vecchio workspace
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
const PLATFORM_WS_ID = '2d890a8d-36c9-48be-b3a2-f54fba001db9';
const ORG_ID = '1cc28268-1f88-442b-8638-c3dbc7faabdc';

async function fix() {
  console.log('=== FIX: Dario → membro admin di SpedireSicuro Platform ===\n');

  // 1. Verifica stato attuale
  const { data: dario } = await s
    .from('users')
    .select('id, email, name, account_type, is_reseller, primary_workspace_id')
    .eq('id', DARIO_USER_ID)
    .single();

  console.log('1. Stato attuale Dario:', JSON.stringify(dario, null, 2));

  const { data: memberships } = await s
    .from('workspace_members')
    .select('workspace_id, role, status')
    .eq('user_id', DARIO_USER_ID);

  console.log('   Memberships attuali:', JSON.stringify(memberships, null, 2));

  // 2. Verifica se è già membro del Platform
  const existingPlatformMembership = memberships?.find((m) => m.workspace_id === PLATFORM_WS_ID);

  if (existingPlatformMembership) {
    console.log('\n2. Dario è già membro di Platform con ruolo:', existingPlatformMembership.role);
    // Assicurati che sia admin
    if (existingPlatformMembership.role !== 'admin') {
      const { error } = await s
        .from('workspace_members')
        .update({ role: 'admin', status: 'active' })
        .eq('user_id', DARIO_USER_ID)
        .eq('workspace_id', PLATFORM_WS_ID);
      if (error) console.error('   Errore upgrade ruolo:', error.message);
      else console.log('   Ruolo aggiornato ad admin');
    }
  } else {
    console.log('\n2. Aggiungendo Dario come admin di SpedireSicuro Platform...');
    const { error } = await s.from('workspace_members').insert({
      workspace_id: PLATFORM_WS_ID,
      user_id: DARIO_USER_ID,
      role: 'admin',
      status: 'active',
      invited_by: null,
    });
    if (error) console.error('   Errore inserimento:', error.message);
    else console.log('   OK: Dario aggiunto come admin di Platform');
  }

  // 3. Aggiorna primary_workspace_id
  console.log('\n3. Aggiornando primary_workspace_id → Platform...');
  const { error: updateError } = await s
    .from('users')
    .update({ primary_workspace_id: PLATFORM_WS_ID })
    .eq('id', DARIO_USER_ID);

  if (updateError) console.error('   Errore:', updateError.message);
  else console.log('   OK: primary_workspace_id aggiornato');

  // 4. Disattiva "dario Workspace"
  console.log('\n4. Disattivando "dario Workspace"...');
  const { error: wsError } = await s
    .from('workspaces')
    .update({ status: 'archived' })
    .eq('id', DARIO_WS_ID);

  if (wsError) console.error('   Errore:', wsError.message);
  else console.log('   OK: dario Workspace archiviato');

  // 5. Disattiva membership del vecchio workspace
  console.log('\n5. Disattivando membership vecchio workspace...');
  const { error: memberError } = await s
    .from('workspace_members')
    .update({ status: 'inactive' })
    .eq('user_id', DARIO_USER_ID)
    .eq('workspace_id', DARIO_WS_ID);

  if (memberError) console.error('   Errore:', memberError.message);
  else console.log('   OK: membership vecchio workspace disattivata');

  // 6. Verifica finale
  console.log('\n=== VERIFICA FINALE ===');

  const { data: darioFinal } = await s
    .from('users')
    .select('id, email, name, account_type, primary_workspace_id')
    .eq('id', DARIO_USER_ID)
    .single();

  console.log('Dario user:', JSON.stringify(darioFinal, null, 2));

  const { data: finalMemberships } = await s
    .from('workspace_members')
    .select('workspace_id, role, status')
    .eq('user_id', DARIO_USER_ID);

  for (const m of finalMemberships || []) {
    const { data: ws } = await s
      .from('workspaces')
      .select('name, type, status')
      .eq('id', m.workspace_id)
      .single();
    console.log(
      `  ${ws?.name} [${ws?.type}, ${ws?.status}] → ruolo: ${m.role}, status: ${m.status}`
    );
  }

  // Mostra gerarchia Platform
  console.log('\n=== TEAM SPEDIRESICURO PLATFORM ===');
  const { data: platformMembers } = await s
    .from('workspace_members')
    .select('user_id, role, status, users(name, email, account_type)')
    .eq('workspace_id', PLATFORM_WS_ID)
    .eq('status', 'active');

  for (const m of platformMembers || []) {
    const u = m.users as any;
    console.log(`  ${u?.name} (${u?.email}) → ${m.role} [${u?.account_type}]`);
  }
}

fix().catch(console.error);
