'use server';

/**
 * Server Actions: Platform Leads CRM (Livello 1)
 *
 * Gestione lead per acquisizione reseller.
 * Pipeline: new -> contacted -> qualified -> negotiation -> won|lost
 *
 * Pattern: requireSafeAuth() + isSuperAdmin() + supabaseAdmin
 * Solo admin/superadmin possono gestire i lead.
 *
 * @module app/actions/leads
 */

import { requireSafeAuth } from '@/lib/safe-auth';
import { isSuperAdmin } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import { calculateLeadScore } from '@/lib/crm/lead-scoring';
import type { LeadScoreInput } from '@/lib/crm/lead-scoring';
import { revalidatePath } from 'next/cache';
import type {
  Lead,
  LeadEvent,
  LeadStatus,
  LeadEventType,
  CreateLeadDTO,
  UpdateLeadDTO,
} from '@/types/leads';
import { LEAD_VALID_TRANSITIONS } from '@/types/leads';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  negotiation: number;
  won: number;
  lost: number;
  avgScore: number;
}

interface LeadFilters {
  status?: LeadStatus;
  search?: string;
  sector?: string;
  source?: string;
  zone?: string;
  sortBy?: 'created_at' | 'lead_score' | 'last_contact_at' | 'company_name';
  sortDir?: 'asc' | 'desc';
}

// ============================================
// HELPER: Verifica admin
// ============================================

async function requireAdmin() {
  const context = await requireSafeAuth();
  if (!isSuperAdmin(context)) {
    throw new Error('Solo admin/superadmin possono gestire i lead');
  }
  return context;
}

// ============================================
// HELPER: Calcolo score per lead
// ============================================

function buildLeadScoreInput(lead: Partial<Lead>): LeadScoreInput {
  return {
    email: lead.email,
    phone: lead.phone,
    sector: lead.sector,
    estimated_monthly_volume: lead.estimated_monthly_volume,
    status: mapLeadStatusToProspectStatus(lead.status || 'new'),
    email_open_count: lead.email_open_count,
    last_contact_at: lead.last_contact_at,
    created_at: lead.created_at || new Date().toISOString(),
    linked_quote_ids: [],
  };
}

/**
 * Mappa status lead a status prospect per il calcolo score
 * (la funzione di scoring usa ProspectStatus)
 */
function mapLeadStatusToProspectStatus(
  status: LeadStatus
): 'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost' {
  const map: Record<
    LeadStatus,
    'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost'
  > = {
    new: 'new',
    contacted: 'contacted',
    qualified: 'contacted', // qualificato ~ contattato avanzato
    negotiation: 'negotiating',
    won: 'won',
    lost: 'lost',
  };
  return map[status];
}

// ============================================
// HELPER: Evento timeline
// ============================================

async function addLeadEvent(
  leadId: string,
  eventType: LeadEventType,
  actorId: string,
  eventData?: Record<string, unknown>,
  wsId?: string | null
): Promise<void> {
  const db = wsId ? workspaceQuery(wsId) : supabaseAdmin;
  await db.from('lead_events').insert({
    lead_id: leadId,
    event_type: eventType,
    event_data: eventData || {},
    actor_id: actorId,
  });
}

// ============================================
// READ
// ============================================

/**
 * Lista lead con filtri e statistiche
 */
export async function getLeads(
  filters?: LeadFilters
): Promise<ActionResult<{ leads: Lead[]; stats: LeadStats }>> {
  try {
    await requireAdmin();

    let query = supabaseAdmin
      .from('leads')
      .select('*, assignee:users!leads_assigned_to_fkey(name, email)');

    // Filtri
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.sector) {
      query = query.eq('sector', filters.sector);
    }
    if (filters?.source) {
      query = query.eq('lead_source', filters.source);
    }
    if (filters?.zone) {
      query = query.eq('geographic_zone', filters.zone);
    }
    if (filters?.search) {
      const term = `%${filters.search}%`;
      query = query.or(`company_name.ilike.${term},contact_name.ilike.${term},email.ilike.${term}`);
    }

    // Ordinamento
    const sortBy = filters?.sortBy || 'created_at';
    const sortDir = filters?.sortDir === 'asc';
    query = query.order(sortBy, { ascending: sortDir });

    query = query.limit(200);

    const { data, error } = await query;

    if (error) {
      return { success: false, error: `Errore caricamento leads: ${error.message}` };
    }

    const leads = (data || []) as Lead[];

    // Stats globali: query separata senza filtri per avere numeri reali
    // Leads sono gestiti dal superadmin — cross-workspace (requireAdmin() sopra)
    // Non possiamo usare workspaceQuery: serve vedere TUTTI i lead
    const adminDb = supabaseAdmin;
    const { data: allLeads } = await adminDb.from('leads').select('status, lead_score');

    const all = (allLeads || []) as { status: string; lead_score: number | null }[];
    const stats: LeadStats = {
      total: all.length,
      new: all.filter((l) => l.status === 'new').length,
      contacted: all.filter((l) => l.status === 'contacted').length,
      qualified: all.filter((l) => l.status === 'qualified').length,
      negotiation: all.filter((l) => l.status === 'negotiation').length,
      won: all.filter((l) => l.status === 'won').length,
      lost: all.filter((l) => l.status === 'lost').length,
      avgScore:
        all.length > 0
          ? Math.round(all.reduce((sum, l) => sum + (l.lead_score || 0), 0) / all.length)
          : 0,
    };

    return { success: true, data: { leads, stats } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}

/**
 * Dettaglio lead con eventi timeline
 */
export async function getLeadById(id: string): Promise<ActionResult<Lead>> {
  try {
    await requireAdmin();

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('*, assignee:users!leads_assigned_to_fkey(name, email)')
      .eq('id', id)
      .single();

    if (error || !lead) {
      return { success: false, error: error?.message || 'Lead non trovato' };
    }

    // Carica eventi timeline
    const { data: events } = await supabaseAdmin
      .from('lead_events')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    return {
      success: true,
      data: { ...lead, events: events || [] } as Lead,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}

// ============================================
// CREATE
// ============================================

/**
 * Crea nuovo lead con calcolo score automatico
 */
export async function createLead(input: CreateLeadDTO): Promise<ActionResult<Lead>> {
  try {
    const context = await requireAdmin();
    const actorId = context.actor.id;

    // Calcola score iniziale
    const scoreInput = buildLeadScoreInput({
      ...input,
      created_at: new Date().toISOString(),
    });
    const leadScore = calculateLeadScore(scoreInput);

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        company_name: input.company_name,
        contact_name: input.contact_name,
        email: input.email?.trim().toLowerCase(),
        phone: input.phone?.trim(),
        status: input.status || 'new',
        source: input.source,
        notes: input.notes,
        estimated_value: input.estimated_value,
        lead_source: input.lead_source || 'direct',
        sector: input.sector,
        estimated_monthly_volume: input.estimated_monthly_volume,
        geographic_zone: input.geographic_zone,
        tags: input.tags || [],
        lead_score: leadScore,
      })
      .select()
      .single();

    if (error || !lead) {
      return { success: false, error: error?.message || 'Errore creazione lead' };
    }

    // Evento timeline
    await addLeadEvent(lead.id, 'created', actorId, {
      company_name: input.company_name,
      lead_score: leadScore,
    });

    revalidatePath('/dashboard/admin/leads');
    return { success: true, data: lead as Lead };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}

// ============================================
// UPDATE
// ============================================

/**
 * Aggiorna lead con validazione transizioni stato e ricalcolo score
 */
export async function updateLead(id: string, input: UpdateLeadDTO): Promise<ActionResult<Lead>> {
  try {
    const context = await requireAdmin();
    const actorId = context.actor.id;

    // Carica lead corrente per validazione
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return { success: false, error: 'Lead non trovato' };
    }

    // Sanitizzazione: rimuovi campi pericolosi
    const safeInput = { ...input } as Record<string, unknown>;
    delete safeInput.id;
    delete safeInput.created_at;
    delete safeInput.lead_score;
    delete safeInput.user_id;
    delete safeInput.converted_workspace_id;
    delete safeInput.converted_at;

    // Validazione transizione stato
    const newStatus = input.status as LeadStatus | undefined;
    if (newStatus && newStatus !== current.status) {
      const validTargets = LEAD_VALID_TRANSITIONS[current.status as LeadStatus] || [];
      if (!validTargets.includes(newStatus)) {
        return {
          success: false,
          error: `Transizione ${current.status} → ${newStatus} non valida`,
        };
      }
    }

    // Ricalcola score con i dati aggiornati
    const merged = { ...current, ...safeInput };
    const scoreInput = buildLeadScoreInput(merged as Lead);
    const newScore = calculateLeadScore(scoreInput);
    (safeInput as Record<string, unknown>).lead_score = newScore;

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .update(safeInput)
      .eq('id', id)
      .select()
      .single();

    if (error || !lead) {
      return { success: false, error: error?.message || 'Errore aggiornamento lead' };
    }

    // Eventi timeline per cambio stato
    if (newStatus && newStatus !== current.status) {
      const eventMap: Partial<Record<LeadStatus, LeadEventType>> = {
        contacted: 'contacted',
        qualified: 'qualified',
        negotiation: 'negotiation_started',
        won: 'converted',
        lost: 'lost',
        new: 'reactivated',
      };
      const eventType = eventMap[newStatus];
      if (eventType) {
        await addLeadEvent(id, eventType, actorId, {
          from_status: current.status,
          to_status: newStatus,
          lost_reason: newStatus === 'lost' ? input.lost_reason : undefined,
        });
      }
    }

    // Evento score changed se delta significativo
    const oldScore = current.lead_score || 0;
    if (Math.abs(newScore - oldScore) >= 10) {
      await addLeadEvent(id, 'score_changed', actorId, {
        old_score: oldScore,
        new_score: newScore,
      });
    }

    revalidatePath('/dashboard/admin/leads');
    return { success: true, data: lead as Lead };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}

// ============================================
// DELETE
// ============================================

/**
 * Elimina lead (hard delete)
 */
export async function deleteLead(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();

    // Recupera workspace_id del lead prima di eliminarlo
    const { data: leadData } = await supabaseAdmin
      .from('leads')
      .select('workspace_id')
      .eq('id', id)
      .single();
    const leadWsId = leadData?.workspace_id;
    const db = leadWsId ? workspaceQuery(leadWsId) : supabaseAdmin;

    const { error } = await db.from('leads').delete().eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/admin/leads');
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}

// ============================================
// ASSIGNMENT
// ============================================

/**
 * Assegna lead a un agente
 */
export async function assignLead(id: string, agentId: string): Promise<ActionResult<Lead>> {
  try {
    const context = await requireAdmin();

    const result = await updateLead(id, { assigned_to: agentId });

    if (result.success) {
      await addLeadEvent(id, 'assigned', context.actor.id, {
        assigned_to: agentId,
      });
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}

// ============================================
// NOTES
// ============================================

/**
 * Aggiunge nota al lead + evento timeline
 */
export async function addLeadNote(id: string, note: string): Promise<ActionResult<Lead>> {
  try {
    const context = await requireAdmin();

    // Carica lead corrente
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('notes')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return { success: false, error: 'Lead non trovato' };
    }

    // Appendi nota con timestamp
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const existingNotes = current.notes || '';
    const updatedNotes = existingNotes
      ? `${existingNotes}\n\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .update({ notes: updatedNotes })
      .eq('id', id)
      .select()
      .single();

    if (error || !lead) {
      return { success: false, error: error?.message || 'Errore aggiornamento nota' };
    }

    await addLeadEvent(id, 'note_added', context.actor.id, {
      note_preview: note.slice(0, 100),
    });

    revalidatePath('/dashboard/admin/leads');
    return { success: true, data: lead as Lead };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}

// ============================================
// CONVERSION: Lead -> Reseller
// ============================================

export interface ConvertLeadParams {
  leadId: string;
  resellerName: string;
  resellerEmail: string;
  resellerPassword: string;
  initialCredit?: number;
  assignedPriceListId?: string;
}

/**
 * Converte un lead in un reseller operativo.
 *
 * Flusso:
 * 1. Verifica lead qualificato (status qualified|negotiation)
 * 2. Crea utente in auth.admin + public.users
 * 3. Crea workspace reseller via RPC atomica
 * 4. (Opzionale) Assegna listino
 * 5. Aggiorna lead: status=won, user_id, converted_at
 * 6. Evento 'converted'
 */
export async function convertLeadToReseller(
  params: ConvertLeadParams
): Promise<ActionResult<{ userId: string; workspaceId: string }>> {
  try {
    const context = await requireAdmin();
    const actorId = context.actor.id;

    const { leadId, resellerName, resellerEmail, resellerPassword, initialCredit } = params;

    // 1. Verifica lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return { success: false, error: 'Lead non trovato' };
    }

    if (lead.status === 'won') {
      return { success: false, error: 'Lead gia convertito' };
    }

    if (!['qualified', 'negotiation'].includes(lead.status)) {
      return {
        success: false,
        error: `Lead deve essere qualificato o in negoziazione (attuale: ${lead.status})`,
      };
    }

    // 2. Verifica email non duplicata
    const emailLower = resellerEmail.toLowerCase().trim();
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', emailLower)
      .single();

    if (existingUser) {
      return { success: false, error: `Email ${emailLower} gia registrata` };
    }

    // 3. Crea utente in Supabase Auth
    const { data: authUserData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailLower,
      password: resellerPassword,
      email_confirm: true,
      user_metadata: { name: resellerName.trim() },
      app_metadata: {
        role: 'user',
        account_type: 'reseller',
        provider: 'credentials',
      },
    });

    if (authError || !authUserData?.user) {
      return { success: false, error: `Errore creazione utente auth: ${authError?.message}` };
    }

    const authUserId = authUserData.user.id;

    // 4. Crea record in public.users
    const { error: userError } = await supabaseAdmin.from('users').insert({
      id: authUserId,
      email: emailLower,
      name: resellerName.trim(),
      password: null,
      account_type: 'reseller',
      is_reseller: true,
      reseller_role: 'admin',
      wallet_balance: initialCredit || 0,
      provider: 'credentials',
    });

    if (userError) {
      // Rollback: elimina da auth
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return { success: false, error: `Errore creazione profilo utente: ${userError.message}` };
    }

    // 5. Crea workspace reseller via RPC atomica
    const { data: defaultOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', 'spediresicuro')
      .single();

    if (!defaultOrg) {
      // Rollback
      await supabaseAdmin.from('users').delete().eq('id', authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return { success: false, error: 'Organizzazione default non trovata' };
    }

    // Trova platform workspace come parent
    const { data: platformWs } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('organization_id', defaultOrg.id)
      .eq('type', 'platform')
      .eq('depth', 0)
      .eq('status', 'active')
      .limit(1)
      .single();

    const { data: workspaceId, error: wsError } = await supabaseAdmin.rpc(
      'create_workspace_with_owner',
      {
        p_organization_id: defaultOrg.id,
        p_name: `${resellerName.trim()} Workspace`,
        p_parent_workspace_id: platformWs?.id || null,
        p_owner_user_id: authUserId,
        p_type: 'reseller',
        p_depth: 1,
      }
    );

    if (wsError || !workspaceId) {
      // Rollback
      await supabaseAdmin.from('users').delete().eq('id', authUserId);
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      return { success: false, error: `Errore creazione workspace: ${wsError?.message}` };
    }

    // 6. Aggiorna primary_workspace_id
    await supabaseAdmin
      .from('users')
      .update({ primary_workspace_id: workspaceId })
      .eq('id', authUserId);

    // 7. Credito iniziale wallet
    if (initialCredit && initialCredit > 0) {
      const walletDb = workspaceQuery(workspaceId as string);
      await walletDb.from('wallet_transactions').insert({
        user_id: authUserId,
        amount: initialCredit,
        type: 'admin_gift',
        description: 'Credito iniziale alla conversione da lead',
        created_by: actorId,
      });
    }

    // 8. Assegna listino se specificato
    if (params.assignedPriceListId) {
      await supabaseAdmin
        .from('workspaces')
        .update({ assigned_price_list_id: params.assignedPriceListId })
        .eq('id', workspaceId);
    }

    // 9. Aggiorna lead come convertito
    await supabaseAdmin
      .from('leads')
      .update({
        status: 'won',
        user_id: authUserId,
        converted_workspace_id: workspaceId,
        converted_at: new Date().toISOString(),
      })
      .eq('id', leadId);

    // 10. Evento converted
    await addLeadEvent(leadId, 'converted', actorId, {
      reseller_user_id: authUserId,
      reseller_workspace_id: workspaceId,
      reseller_name: resellerName,
      reseller_email: emailLower,
    });

    revalidatePath('/dashboard/admin/leads');

    return {
      success: true,
      data: { userId: authUserId, workspaceId: workspaceId as string },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}

// ============================================
// TIMELINE
// ============================================

/**
 * Carica eventi timeline per un lead
 */
export async function getLeadEvents(leadId: string): Promise<ActionResult<LeadEvent[]>> {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from('lead_events')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as LeadEvent[] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: message };
  }
}
