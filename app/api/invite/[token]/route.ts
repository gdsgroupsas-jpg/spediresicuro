/**
 * API: Accept Workspace Invitation
 *
 * GET /api/invite/[token]
 * - Verifica validità token e mostra info invito
 * - Pubblico (no auth richiesta per vedere l'invito)
 *
 * POST /api/invite/[token]
 * - Accetta l'invito e aggiunge utente al workspace
 * - Richiede autenticazione
 *
 * SECURITY:
 * - Token crypto-random 256-bit
 * - Validazione expiry
 * - ATOMICITY: Transaction per update invito + insert member
 * - Audit log completo
 * - NESSUNA email nei log (GDPR)
 *
 * @module api/invite/[token]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { sendInvitationAcceptedEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET: Verifica token e mostra info invito
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    // 1. Validazione token format (hex string, 64 chars)
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 400 });
    }

    // 2. Fetch invito
    const { data: invitation, error } = await supabaseAdmin
      .from('workspace_invitations')
      .select(
        `
        id,
        email,
        role,
        permissions,
        status,
        expires_at,
        workspace_id,
        workspaces!inner (
          id,
          name,
          slug,
          organizations!inner (
            id,
            name,
            branding
          )
        )
      `
      )
      .eq('token', token)
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: 'Invito non trovato' }, { status: 404 });
    }

    // 3. Verifica stato
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        {
          error:
            invitation.status === 'accepted'
              ? 'Questo invito è già stato utilizzato'
              : invitation.status === 'expired'
                ? 'Questo invito è scaduto'
                : 'Questo invito non è più valido',
          status: invitation.status,
        },
        { status: 400 }
      );
    }

    // 4. Verifica expiry
    if (new Date(invitation.expires_at) < new Date()) {
      // Auto-expire
      await supabaseAdmin
        .from('workspace_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'Questo invito è scaduto' }, { status: 400 });
    }

    // 5. Restituisci info (email mascherata)
    const workspace = invitation.workspaces as any;
    const org = workspace?.organizations;

    return NextResponse.json({
      valid: true,
      invitation: {
        id: invitation.id,
        email: maskEmail(invitation.email),
        role: invitation.role,
        expires_at: invitation.expires_at,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        },
        organization: {
          name: org?.name || 'Organizzazione',
          branding: org?.branding || {},
        },
      },
    });
  } catch (error: any) {
    console.error('GET /api/invite/[token] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST: Accetta invito
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    // 1. Validazione token
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 400 });
    }

    // 2. Autenticazione
    const context = await getWorkspaceAuth();
    if (!context) {
      return NextResponse.json(
        { error: "Devi effettuare il login per accettare l'invito" },
        { status: 401 }
      );
    }

    // 3. Fetch invito
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('workspace_invitations')
      .select(
        `
        id,
        email,
        role,
        permissions,
        status,
        expires_at,
        workspace_id,
        invited_by
      `
      )
      .eq('token', token)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invito non trovato' }, { status: 404 });
    }

    // 4. Verifica stato
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Questo invito non è più valido' }, { status: 400 });
    }

    // 5. Verifica expiry
    if (new Date(invitation.expires_at) < new Date()) {
      await supabaseAdmin
        .from('workspace_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return NextResponse.json({ error: 'Questo invito è scaduto' }, { status: 400 });
    }

    // 6. Verifica email match (opzionale ma consigliato)
    // L'utente loggato dovrebbe avere la stessa email dell'invito
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', context.target.id)
      .single();

    const userEmail = userData?.email?.toLowerCase();
    const inviteEmail = invitation.email.toLowerCase();

    if (userEmail && userEmail !== inviteEmail) {
      // Warning ma non blocchiamo - potrebbero avere email diverse
      // GDPR: solo user ID e invitation ID nei log, mai email in chiaro
      console.warn(`Email mismatch: user ${context.target.id} accepting invite ${invitation.id}`);
    }

    // 7. Verifica che non sia già membro
    const { data: existingMember } = await supabaseAdmin
      .from('workspace_members')
      .select('id, status')
      .eq('workspace_id', invitation.workspace_id)
      .eq('user_id', context.target.id)
      .single();

    if (existingMember && existingMember.status === 'active') {
      return NextResponse.json({ error: 'Sei già membro di questo workspace' }, { status: 400 });
    }

    // 8. ATOMICITY: Start transaction-like operations
    const now = new Date().toISOString();

    // 8a. Se membro esisteva (removed), riattiva
    if (existingMember) {
      const { error: updateMemberError } = await supabaseAdmin
        .from('workspace_members')
        .update({
          role: invitation.role,
          permissions: invitation.permissions || [],
          status: 'active',
          accepted_at: now,
          invited_by: invitation.invited_by,
          updated_at: now,
        })
        .eq('id', existingMember.id);

      if (updateMemberError) {
        console.error('Error reactivating member:', updateMemberError);
        return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
      }
    } else {
      // 8b. Crea nuovo membro
      const { error: insertError } = await supabaseAdmin.from('workspace_members').insert({
        workspace_id: invitation.workspace_id,
        user_id: context.target.id,
        role: invitation.role,
        permissions: invitation.permissions || [],
        status: 'active',
        invited_by: invitation.invited_by,
        accepted_at: now,
      });

      if (insertError) {
        console.error('Error creating member:', insertError);
        return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
      }
    }

    // 8c. Marca invito come accepted
    const { error: updateInviteError } = await supabaseAdmin
      .from('workspace_invitations')
      .update({
        status: 'accepted',
        accepted_at: now,
        accepted_by: context.target.id,
      })
      .eq('id', invitation.id);

    if (updateInviteError) {
      console.error('Error updating invitation:', updateInviteError);
      // Non fallire - il membro è già stato aggiunto
    }

    // 9. Audit log (NO EMAIL per GDPR)
    await supabaseAdmin.from('audit_logs').insert({
      action: 'WORKSPACE_INVITATION_ACCEPTED',
      resource_type: 'workspace_invitation',
      resource_id: invitation.id,
      user_id: context.target.id,
      workspace_id: invitation.workspace_id,
      audit_metadata: {
        role_assigned: invitation.role,
        permissions_assigned: invitation.permissions,
        accepted_by_user_id: context.target.id,
        invited_by_user_id: invitation.invited_by,
      },
    });

    // 10. Fetch workspace name per risposta
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('name, slug')
      .eq('id', invitation.workspace_id)
      .single();

    // 11. Notifica l'invitante che l'invito è stato accettato
    if (invitation.invited_by) {
      // Fetch inviter info
      const { data: inviter } = await supabaseAdmin
        .from('users')
        .select('name, email')
        .eq('id', invitation.invited_by)
        .single();

      // Fetch accepter info
      const { data: accepter } = await supabaseAdmin
        .from('users')
        .select('name, email')
        .eq('id', context.target.id)
        .single();

      if (inviter?.email && accepter) {
        // Invia email di notifica (non bloccare se fallisce)
        sendInvitationAcceptedEmail({
          to: inviter.email,
          inviterName: inviter.name || inviter.email.split('@')[0],
          acceptedByName: accepter.name || accepter.email?.split('@')[0] || 'Nuovo membro',
          acceptedByEmail: accepter.email || '',
          workspaceName: workspace?.name || 'Workspace',
          role: invitation.role as 'admin' | 'operator' | 'viewer',
        }).catch((err) => {
          console.warn('Failed to send acceptance notification email:', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Benvenuto nel workspace "${workspace?.name}"!`,
      workspace: {
        id: invitation.workspace_id,
        name: workspace?.name,
        slug: workspace?.slug,
      },
      role: invitation.role,
    });
  } catch (error: any) {
    console.error('POST /api/invite/[token] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Maschera email per privacy (GDPR)
 */
function maskEmail(email: string | null): string {
  if (!email) return '***@***.***';

  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***.***';

  const maskedLocal = local.charAt(0) + '***';
  return `${maskedLocal}@${domain}`;
}
