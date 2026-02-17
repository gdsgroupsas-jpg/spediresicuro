'use server';

/**
 * Workspace Server Actions
 *
 * Server actions per gestione workspace.
 *
 * SECURITY:
 * - Tutte le azioni richiedono autenticazione
 * - Verifica permessi per ogni operazione
 * - Audit log per ogni modifica
 * - NESSUNA FEE DI DEFAULT (regola critica)
 *
 * @module actions/workspace
 */

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import { requireSafeAuth } from '@/lib/safe-auth';
import { requireWorkspaceAuth, logWorkspaceAudit, isSuperAdmin } from '@/lib/workspace-auth';
import type {
  CreateOrganizationInput,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  ConfigureWorkspaceFeeInput,
  InviteToWorkspaceInput,
  Organization,
  Workspace,
  WorkspaceInvitation,
} from '@/types/workspace';

// ============================================
// ORGANIZATION ACTIONS
// ============================================

/**
 * Crea una nuova organization
 *
 * SOLO SUPERADMIN puo creare organization
 */
export async function createOrganization(
  input: CreateOrganizationInput
): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  try {
    const context = await requireSafeAuth();

    // Solo superadmin
    if (!isSuperAdmin(context)) {
      return { success: false, error: 'Solo Superadmin puo creare organization' };
    }

    // Genera slug se non fornito
    const slug = input.slug || (await generateSlug('organizations', input.name));

    // Crea organization
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: input.name,
        slug,
        vat_number: input.vat_number || null,
        fiscal_code: input.fiscal_code || null,
        billing_email: input.billing_email,
        billing_address: input.billing_address || {},
        branding: input.branding || {},
        white_label_level: input.white_label_level || 1,
        settings: input.settings || {},
        created_by: context.actor.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating organization:', error);
      return { success: false, error: error.message };
    }

    // Audit log — recupera workspace dell'attore per isolamento multi-tenant
    const actorWorkspaceId = await getUserWorkspaceId(context.actor.id);
    if (actorWorkspaceId) {
      await workspaceQuery(actorWorkspaceId)
        .from('audit_logs')
        .insert({
          action: 'ORGANIZATION_CREATED',
          resource_type: 'organization',
          resource_id: data.id,
          user_id: context.actor.id,
          actor_id: context.actor.id,
          target_id: context.actor.id,
          workspace_id: actorWorkspaceId,
          audit_metadata: {
            name: input.name,
            slug,
            billing_email: input.billing_email,
          },
        });
    }

    revalidatePath('/dashboard/admin/organizations');

    return { success: true, organization: data };
  } catch (error: any) {
    console.error('createOrganization error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// WORKSPACE ACTIONS
// ============================================

/**
 * Crea un nuovo workspace
 *
 * NOTA: platform_fee_override e parent_imposed_fee sono SEMPRE NULL!
 * Devono essere configurati separatamente dal Superadmin.
 */
export async function createWorkspace(
  input: CreateWorkspaceInput
): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
  try {
    const context = await requireSafeAuth();

    // Verifica permessi
    // - Superadmin: puo creare ovunque
    // - Owner/Admin di workspace parent: puo creare sub-workspace
    const isSA = isSuperAdmin(context);

    if (!isSA && input.parent_workspace_id) {
      // Verifica che sia owner/admin del parent
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', input.parent_workspace_id)
        .eq('user_id', context.actor.id)
        .eq('status', 'active')
        .single();

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return {
          success: false,
          error: 'Non hai i permessi per creare sub-workspace qui',
        };
      }
    } else if (!isSA) {
      return {
        success: false,
        error: 'Solo Superadmin puo creare workspace root',
      };
    }

    // Genera slug
    const slug = input.slug || (await generateWorkspaceSlug(input.organization_id, input.name));

    // Crea workspace usando RPC (atomica con owner)
    const { data, error } = await supabaseAdmin.rpc('create_workspace_with_owner', {
      p_organization_id: input.organization_id,
      p_name: input.name,
      p_slug: slug,
      p_parent_workspace_id: input.parent_workspace_id || null,
      p_owner_user_id: context.actor.id,
      p_assigned_price_list_id: input.assigned_price_list_id || null,
      p_selling_price_list_id: input.selling_price_list_id || null,
      p_assigned_courier_config_id: input.assigned_courier_config_id || null,
    });

    if (error) {
      console.error('Error creating workspace:', error);
      return { success: false, error: error.message };
    }

    // Carica workspace creato
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('id', data)
      .single();

    // Audit log — usa workspaceQuery per isolamento multi-tenant
    await workspaceQuery(data)
      .from('audit_logs')
      .insert({
        action: 'WORKSPACE_CREATED',
        resource_type: 'workspace',
        resource_id: data,
        user_id: context.actor.id,
        actor_id: context.actor.id,
        target_id: context.actor.id,
        workspace_id: data,
        audit_metadata: {
          name: input.name,
          slug,
          organization_id: input.organization_id,
          parent_workspace_id: input.parent_workspace_id,
          // NOTA: fee sono NULL - devono essere configurate separatamente
          fee_note: 'Fee non configurate - Superadmin deve configurare manualmente',
        },
      });

    revalidatePath('/dashboard');

    return { success: true, workspace };
  } catch (error: any) {
    console.error('createWorkspace error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiorna un workspace
 */
export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput
): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
  try {
    const context = await requireWorkspaceAuth();

    // Verifica che sia owner/admin o superadmin
    const isSA = isSuperAdmin(context);
    if (!isSA && !['owner', 'admin'].includes(context.workspace.role)) {
      return { success: false, error: 'Non hai i permessi per modificare questo workspace' };
    }

    // Update
    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .update({
        name: input.name,
        assigned_price_list_id: input.assigned_price_list_id,
        selling_price_list_id: input.selling_price_list_id,
        assigned_courier_config_id: input.assigned_courier_config_id,
        settings: input.settings,
        status: input.status,
        // NOTA: fee NON sono modificabili qui! Usare configureWorkspaceFee
      })
      .eq('id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating workspace:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logWorkspaceAudit(context, 'WORKSPACE_UPDATED', 'workspace', workspaceId, {
      changes: input,
    });

    revalidatePath('/dashboard');

    return { success: true, workspace: data };
  } catch (error: any) {
    console.error('updateWorkspace error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Configura fee per un workspace
 *
 * SOLO SUPERADMIN!
 * Questa e' l'UNICA funzione che puo modificare fee.
 */
export async function configureWorkspaceFee(
  input: ConfigureWorkspaceFeeInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await requireSafeAuth();

    // SOLO SUPERADMIN
    if (!isSuperAdmin(context)) {
      return {
        success: false,
        error: 'FORBIDDEN: Solo Superadmin puo configurare le fee',
      };
    }

    // Carica workspace corrente per audit
    const { data: oldWorkspace } = await supabaseAdmin
      .from('workspaces')
      .select('platform_fee_override, parent_imposed_fee, name')
      .eq('id', input.workspace_id)
      .single();

    // Update fee
    const updateData: any = {};

    if (input.platform_fee_override !== undefined) {
      updateData.platform_fee_override = input.platform_fee_override;
    }

    if (input.parent_imposed_fee !== undefined) {
      updateData.parent_imposed_fee = input.parent_imposed_fee;
    }

    const { error } = await supabaseAdmin
      .from('workspaces')
      .update(updateData)
      .eq('id', input.workspace_id);

    if (error) {
      console.error('Error configuring workspace fee:', error);
      return { success: false, error: error.message };
    }

    // Audit log DETTAGLIATO per fee — usa workspaceQuery per isolamento multi-tenant
    await workspaceQuery(input.workspace_id)
      .from('audit_logs')
      .insert({
        action: 'WORKSPACE_FEE_CONFIGURED',
        resource_type: 'workspace',
        resource_id: input.workspace_id,
        user_id: context.actor.id,
        actor_id: context.actor.id,
        target_id: context.actor.id,
        workspace_id: input.workspace_id,
        audit_metadata: {
          workspace_name: oldWorkspace?.name,
          old_platform_fee: oldWorkspace?.platform_fee_override,
          new_platform_fee: input.platform_fee_override,
          old_parent_fee: oldWorkspace?.parent_imposed_fee,
          new_parent_fee: input.parent_imposed_fee,
          configured_by: context.actor.email,
          // Flag per indicare che e' stata una configurazione manuale
          manual_configuration: true,
        },
      });

    console.log('✅ [FEE-CONFIG] Workspace fee configured:', {
      workspaceId: input.workspace_id,
      workspaceName: oldWorkspace?.name,
      platformFee: input.platform_fee_override,
      parentFee: input.parent_imposed_fee,
      configuredBy: context.actor.email,
    });

    revalidatePath('/dashboard/admin');

    return { success: true };
  } catch (error: any) {
    console.error('configureWorkspaceFee error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// MEMBER ACTIONS
// ============================================

/**
 * Invita un utente al workspace
 */
export async function inviteToWorkspace(
  input: InviteToWorkspaceInput
): Promise<{ success: boolean; invitation?: WorkspaceInvitation; error?: string }> {
  try {
    const context = await requireWorkspaceAuth();

    // Verifica permessi (owner/admin o superadmin)
    const isSA = isSuperAdmin(context);
    if (!isSA && !['owner', 'admin'].includes(context.workspace.role)) {
      return { success: false, error: 'Non hai i permessi per invitare membri' };
    }

    // Verifica che email non sia gia membro
    const { data: existingMember } = await supabaseAdmin
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', input.workspace_id)
      .eq(
        'user_id',
        (await supabaseAdmin.from('users').select('id').eq('email', input.email).single()).data?.id
      )
      .eq('status', 'active')
      .single();

    if (existingMember) {
      return { success: false, error: 'Utente gia membro di questo workspace' };
    }

    // Verifica che non ci sia gia un invito pending
    const { data: existingInvite } = await supabaseAdmin
      .from('workspace_invitations')
      .select('id')
      .eq('workspace_id', input.workspace_id)
      .eq('email', input.email)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return { success: false, error: 'Invito gia inviato a questa email' };
    }

    // Crea invito
    const { data, error } = await supabaseAdmin
      .from('workspace_invitations')
      .insert({
        workspace_id: input.workspace_id,
        email: input.email,
        role: input.role,
        permissions: input.permissions || [],
        message: input.message || null,
        invited_by: context.actor.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating invitation:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logWorkspaceAudit(
      context,
      'WORKSPACE_INVITATION_CREATED',
      'workspace_invitation',
      data.id,
      {
        email: input.email,
        role: input.role,
      }
    );

    // TODO: Inviare email di invito

    revalidatePath('/dashboard/settings/team');

    return { success: true, invitation: data };
  } catch (error: any) {
    console.error('inviteToWorkspace error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Accetta un invito workspace
 */
export async function acceptWorkspaceInvitation(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await requireSafeAuth();

    // Chiama RPC
    const { data, error } = await supabaseAdmin.rpc('accept_workspace_invitation', {
      p_token: token,
      p_user_id: context.target.id,
    });

    if (error) {
      console.error('Error accepting invitation:', error);
      return { success: false, error: error.message };
    }

    // Recupera workspace_id dall'invito per isolamento multi-tenant
    const { data: invitation } = await supabaseAdmin
      .from('workspace_invitations')
      .select('workspace_id')
      .eq('token', token)
      .single();

    const invitationWorkspaceId = invitation?.workspace_id;

    // Audit log — usa workspaceQuery per isolamento multi-tenant
    if (invitationWorkspaceId) {
      await workspaceQuery(invitationWorkspaceId)
        .from('audit_logs')
        .insert({
          action: 'WORKSPACE_INVITATION_ACCEPTED',
          resource_type: 'workspace_member',
          resource_id: data,
          user_id: context.target.id,
          actor_id: context.actor.id,
          target_id: context.target.id,
          workspace_id: invitationWorkspaceId,
          audit_metadata: {
            token_hash: token.substring(0, 8) + '...',
          },
        });
    }

    revalidatePath('/dashboard');

    return { success: true };
  } catch (error: any) {
    console.error('acceptWorkspaceInvitation error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rimuove un membro dal workspace
 */
export async function removeWorkspaceMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await requireWorkspaceAuth();

    // Verifica permessi
    const isSA = isSuperAdmin(context);
    if (!isSA && !['owner', 'admin'].includes(context.workspace.role)) {
      return { success: false, error: 'Non hai i permessi per rimuovere membri' };
    }

    // Carica member per verifiche
    const { data: member } = await supabaseAdmin
      .from('workspace_members')
      .select('user_id, role, workspace_id')
      .eq('id', memberId)
      .single();

    if (!member) {
      return { success: false, error: 'Membro non trovato' };
    }

    // Non puoi rimuovere te stesso
    if (member.user_id === context.target.id) {
      return { success: false, error: 'Non puoi rimuovere te stesso' };
    }

    // Non puoi rimuovere owner (usa trigger DB per protezione extra)
    if (member.role === 'owner') {
      return { success: false, error: 'Non puoi rimuovere il proprietario del workspace' };
    }

    // Soft delete (status = removed)
    const { error } = await supabaseAdmin
      .from('workspace_members')
      .update({ status: 'removed' })
      .eq('id', memberId);

    if (error) {
      console.error('Error removing member:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logWorkspaceAudit(context, 'WORKSPACE_MEMBER_REMOVED', 'workspace_member', memberId, {
      removed_user_id: member.user_id,
    });

    revalidatePath('/dashboard/settings/team');

    return { success: true };
  } catch (error: any) {
    console.error('removeWorkspaceMember error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function generateSlug(table: string, name: string): Promise<string> {
  let baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);

  let slug = baseSlug;
  let counter = 0;

  while (true) {
    const { data } = await supabaseAdmin.from(table).select('id').eq('slug', slug).single();

    if (!data) break;

    counter++;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}

async function generateWorkspaceSlug(orgId: string, name: string): Promise<string> {
  let baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 50);

  let slug = baseSlug;
  let counter = 0;

  while (true) {
    const { data } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId)
      .eq('slug', slug)
      .single();

    if (!data) break;

    counter++;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
}
