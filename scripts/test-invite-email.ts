/**
 * Script di test per verificare il template email invito workspace.
 * Uso: npx tsx scripts/test-invite-email.ts
 *
 * Richiede RESEND_API_KEY in .env.local
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Carica .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { sendWorkspaceInvitationEmail } from '../lib/email/resend';

async function main() {
  const to = 'salvatore.squillante@gmail.com';

  console.log(`Invio email di test invito workspace a: ${to}`);
  console.log(`RESEND_API_KEY presente: ${!!process.env.RESEND_API_KEY}`);

  const result = await sendWorkspaceInvitationEmail({
    to,
    inviterName: 'Marco Rossi',
    workspaceName: 'GDS Group SAS',
    organizationName: 'SpedireSicuro',
    role: 'operator',
    inviteUrl: 'https://spediresicuro.it/invite/test-token-abc123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 giorni
    message: 'Ciao! Ti ho aggiunto al team per gestire le spedizioni insieme.',
  });

  console.log('Risultato:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
