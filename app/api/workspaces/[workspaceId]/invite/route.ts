/**
 * API: Workspace Invitations
 *
 * POST /api/workspaces/[workspaceId]/invite
 * - Invita un utente al workspace
 * - Richiede permesso members:invite
 *
 * GET /api/workspaces/[workspaceId]/invite
 * - Lista inviti pending del workspace
 * - Richiede permesso members:view
 *
 * DELETE /api/workspaces/[workspaceId]/invite?invitationId=xxx
 * - Revoca un invito pending
 * - Richiede permesso members:invite
 *
 * SECURITY:
 * - Autenticazione obbligatoria
 * - Rate limiting (max 10 inviti/ora per workspace)
 * - Validazione email format
 * - Token crypto-random per sicurezza
 * - Audit log per ogni operazione
 * - NESSUNA email nei log (GDPR)
 *
 * @module api/workspaces/[workspaceId]/invite
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';
import {
  memberHasPermission,
  type WorkspaceMemberRole,
  type WorkspacePermission,
} from '@/types/workspace';
import { sendWorkspaceInvitationEmail } from '@/lib/email/resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// Rate limit: max inviti per workspace per ora
const INVITE_RATE_LIMIT = 10;

/**
 * POST: Crea nuovo invito
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const { email, role, permissions, message } = body as {
      email?: string;
      role?: Exclude<WorkspaceMemberRole, 'owner'>;
      permissions?: WorkspacePermission[];
      message?: string;
    };

    // 1. Validazione workspace ID
    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID format' }, { status: 400 });
    }

    // 2. Validazione email
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Email non valida' }, { status: 400 });
    }

    // 3. Validazione ruolo (owner non invitabile)
    const validRoles: Array<Exclude<WorkspaceMemberRole, 'owner'>> = [
      'admin',
      'operator',
      'viewer',
    ];
    const memberRole = role || 'viewer';
    if (!validRoles.includes(memberRole)) {
      return NextResponse.json(
        { error: 'Ruolo non valido. Usa: admin, operator, o viewer' },
        { status: 400 }
      );
    }

    // 4. Autenticazione
    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdminUser = isSuperAdmin(context);

    // 5. Verifica accesso
    const hasAccess = await verifyWorkspaceAccess(
      context.target.id,
      workspaceId,
      'members:invite',
      isSuperAdminUser
    );

    if (!hasAccess.allowed) {
      return NextResponse.json({ error: hasAccess.reason || 'Access denied' }, { status: 403 });
    }

    // 6. Rate limiting
    const rateCheck = await checkInviteRateLimit(workspaceId);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit: max ${INVITE_RATE_LIMIT} inviti per ora. Riprova tra ${rateCheck.retryAfterMinutes} minuti.`,
        },
        { status: 429 }
      );
    }

    // 7. Verifica che l'email non sia già membro
    const normalizedEmail = email.toLowerCase().trim();
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existingUser) {
      // Verifica se già membro
      const { data: existingMember } = await supabaseAdmin
        .from('workspace_members')
        .select('id, status')
        .eq('workspace_id', workspaceId)
        .eq('user_id', existingUser.id)
        .single();

      if (existingMember && existingMember.status !== 'removed') {
        return NextResponse.json(
          { error: 'Questo utente è già membro del workspace' },
          { status: 400 }
        );
      }
    }

    // 8. Verifica che non ci sia già un invito pending per questa email
    const { data: existingInvite } = await supabaseAdmin
      .from('workspace_invitations')
      .select('id, status, expires_at')
      .eq('workspace_id', workspaceId)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Esiste già un invito pending per questo indirizzo email' },
        { status: 400 }
      );
    }

    // 9. Genera token sicuro
    const token = crypto.randomBytes(32).toString('hex');

    // 10. ATOMICITY: Crea invito
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Scade tra 7 giorni

    const { data: invitation, error: insertError } = await supabaseAdmin
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        email: normalizedEmail,
        role: memberRole,
        permissions: permissions || [],
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        invited_by: context.target.id,
      })
      .select('id, role, expires_at, created_at')
      .single();

    if (insertError) {
      console.error('Error creating invitation:', insertError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // 11. Audit log (NO EMAIL per GDPR - usa hash)
    const emailHash = crypto
      .createHash('sha256')
      .update(normalizedEmail)
      .digest('hex')
      .substring(0, 16);
    await supabaseAdmin.from('audit_logs').insert({
      action: 'WORKSPACE_INVITATION_CREATED',
      resource_type: 'workspace_invitation',
      resource_id: invitation.id,
      user_id: context.target.id,
      workspace_id: workspaceId,
      audit_metadata: {
        email_hash: emailHash, // Hash invece di email per GDPR
        role: memberRole,
        expires_at: expiresAt.toISOString(),
        invited_by: context.actor.id,
        is_impersonating: context.isImpersonating,
      },
    });

    // 12. Fetch workspace + organization info per email
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select(
        `
        name,
        organizations!inner (
          name
        )
      `
      )
      .eq('id', workspaceId)
      .single();

    const workspaceName = workspace?.name || 'Workspace';
    const organizationName = (workspace?.organizations as any)?.name || 'Organizzazione';

    // 13. Fetch inviter name
    const { data: inviter } = await supabaseAdmin
      .from('users')
      .select('name, email')
      .eq('id', context.target.id)
      .single();

    const inviterName = inviter?.name || inviter?.email?.split('@')[0] || 'Un membro';

    // 14. Invia email di invito
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://spediresicuro.it'}/invite/${token}`;

    const emailResult = await sendWorkspaceInvitationEmail({
      to: normalizedEmail,
      inviterName,
      workspaceName,
      organizationName,
      role: memberRole,
      inviteUrl,
      expiresAt,
      message: message || undefined,
    });

    if (!emailResult.success) {
      console.warn(
        `⚠️ [INVITE] Email send failed for invitation ${invitation.id}:`,
        emailResult.error
      );
      // Non blocchiamo - l'invito è stato creato, l'email può essere reinviata
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        role: invitation.role,
        expires_at: invitation.expires_at,
        // Token mostrato SOLO una volta per condividere manualmente se email fallisce
        token: token,
        invite_url: inviteUrl,
        workspace_name: workspaceName,
      },
      email_sent: emailResult.success,
      message: emailResult.success
        ? `Invito inviato a ${normalizedEmail}! L'utente riceverà un'email con il link.`
        : `Invito creato! L'email non è stata inviata - condividi il link manualmente.`,
    });
  } catch (error: any) {
    console.error('POST /api/workspaces/[id]/invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET: Lista inviti pending
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    // 1. Validazione
    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID format' }, { status: 400 });
    }

    // 2. Autenticazione
    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Verifica accesso
    const hasAccess = await verifyWorkspaceAccess(
      context.target.id,
      workspaceId,
      'members:view',
      isSuperAdmin(context)
    );

    if (!hasAccess.allowed) {
      return NextResponse.json({ error: hasAccess.reason || 'Access denied' }, { status: 403 });
    }

    // 4. Fetch inviti (email mascherata per privacy)
    const { data: invitations, error } = await supabaseAdmin
      .from('workspace_invitations')
      .select(
        `
        id,
        email,
        role,
        permissions,
        status,
        expires_at,
        created_at,
        invited_by
      `
      )
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'expired'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 5. Mappa con email mascherata
    const mappedInvitations = (invitations || []).map((inv) => ({
      id: inv.id,
      email: maskEmail(inv.email), // Privacy
      role: inv.role,
      permissions: inv.permissions || [],
      status: inv.status,
      expires_at: inv.expires_at,
      created_at: inv.created_at,
      is_expired: new Date(inv.expires_at) < new Date(),
    }));

    return NextResponse.json({
      invitations: mappedInvitations,
      count: mappedInvitations.length,
    });
  } catch (error: any) {
    console.error('GET /api/workspaces/[id]/invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE: Revoca invito
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('invitationId');

    // 1. Validazioni
    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID format' }, { status: 400 });
    }

    if (!invitationId || !isValidUUID(invitationId)) {
      return NextResponse.json(
        { error: 'Invalid or missing invitationId parameter' },
        { status: 400 }
      );
    }

    // 2. Autenticazione
    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Verifica accesso
    const hasAccess = await verifyWorkspaceAccess(
      context.target.id,
      workspaceId,
      'members:invite',
      isSuperAdmin(context)
    );

    if (!hasAccess.allowed) {
      return NextResponse.json({ error: hasAccess.reason || 'Access denied' }, { status: 403 });
    }

    // 4. Verifica che l'invito esista e sia pending
    const { data: invitation, error: fetchError } = await supabaseAdmin
      .from('workspace_invitations')
      .select('id, status, workspace_id')
      .eq('id', invitationId)
      .eq('workspace_id', workspaceId)
      .single();

    if (fetchError || !invitation) {
      return NextResponse.json({ error: 'Invito non trovato' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: 'Solo gli inviti pending possono essere revocati' },
        { status: 400 }
      );
    }

    // 5. ATOMICITY: Revoca invito
    const { error: updateError } = await supabaseAdmin
      .from('workspace_invitations')
      .update({
        status: 'cancelled',
      })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error revoking invitation:', updateError);
      return NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
    }

    // 6. Audit log
    await supabaseAdmin.from('audit_logs').insert({
      action: 'WORKSPACE_INVITATION_REVOKED',
      resource_type: 'workspace_invitation',
      resource_id: invitationId,
      user_id: context.target.id,
      workspace_id: workspaceId,
      audit_metadata: {
        revoked_by: context.actor.id,
        is_impersonating: context.isImpersonating,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Invito revocato con successo',
    });
  } catch (error: any) {
    console.error('DELETE /api/workspaces/[id]/invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verifica accesso al workspace con permesso specifico
 */
async function verifyWorkspaceAccess(
  userId: string,
  workspaceId: string,
  requiredPermission: WorkspacePermission,
  isSuperAdmin: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  if (isSuperAdmin) {
    return { allowed: true };
  }

  const { data: membership, error } = await supabaseAdmin
    .from('workspace_members')
    .select('role, permissions, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    return { allowed: false, reason: 'Non sei membro di questo workspace' };
  }

  if (membership.status !== 'active') {
    return { allowed: false, reason: 'La tua membership non è attiva' };
  }

  const hasPermission = memberHasPermission(
    { role: membership.role as WorkspaceMemberRole, permissions: membership.permissions || [] },
    requiredPermission
  );

  if (!hasPermission) {
    return { allowed: false, reason: `Permesso '${requiredPermission}' richiesto` };
  }

  return { allowed: true };
}

/**
 * Validazione email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Rate limiting per inviti
 */
async function checkInviteRateLimit(
  workspaceId: string
): Promise<{ allowed: boolean; retryAfterMinutes?: number }> {
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  const { count, error } = await supabaseAdmin
    .from('workspace_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', oneHourAgo.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    // In caso di errore, permetti (fail open)
    return { allowed: true };
  }

  if ((count || 0) >= INVITE_RATE_LIMIT) {
    return { allowed: false, retryAfterMinutes: 60 };
  }

  return { allowed: true };
}

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
