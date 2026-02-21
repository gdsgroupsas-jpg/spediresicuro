/**
 * CRM Write Service — Sprint S2
 *
 * Layer di scrittura CRM per Anne. Stessa architettura di crm-data-service.ts
 * ma per operazioni di modifica: aggiornamento stato, note, registrazione contatti.
 *
 * Accetta userId/role/workspaceId direttamente (no contesto HTTP/cookie).
 * Ogni operazione: valida → aggiorna → ricalcola score → crea evento timeline.
 *
 * SICUREZZA:
 * - Reseller DEVE passare workspaceId (fail-fast se mancante)
 * - Filtro workspace_id su FETCH e UPDATE (defense-in-depth, non solo RLS)
 * - Optimistic locking con updated_at per prevenire TOCTOU
 * - Input sanitizzato (strip HTML tags)
 * - Eventi best-effort con error handling (non blocca flusso principale)
 *
 * @module lib/crm/crm-write-service
 */

import { supabaseAdmin } from '@/lib/db/client';
import { calculateLeadScore } from '@/lib/crm/lead-scoring';
import type { LeadScoreInput } from '@/lib/crm/lead-scoring';
import { LEAD_VALID_TRANSITIONS } from '@/types/leads';
import type { LeadStatus, LeadEventType } from '@/types/leads';
import { VALID_TRANSITIONS } from '@/types/reseller-prospects';
import type { ProspectStatus, ProspectEventType } from '@/types/reseller-prospects';
import type { CrmWriteResult } from '@/types/crm-intelligence';

// ============================================
// PARAMETRI INPUT
// ============================================

export interface UpdateStatusParams {
  role: 'admin' | 'user' | 'reseller';
  entityId: string;
  newStatus: string;
  actorId: string;
  workspaceId?: string;
  lostReason?: string;
}

export interface AddNoteParams {
  role: 'admin' | 'user' | 'reseller';
  entityId: string;
  note: string;
  actorId: string;
  workspaceId?: string;
}

export interface RecordContactParams {
  role: 'admin' | 'user' | 'reseller';
  entityId: string;
  contactNote?: string;
  actorId: string;
  workspaceId?: string;
}

// ============================================
// SICUREZZA HELPERS
// ============================================

/**
 * Sanitizza input utente: rimuove tag HTML per prevenire XSS.
 * I dati vanno nel DB come testo, ma se il frontend li renderizza
 * come HTML senza escape, un tag <script> potrebbe eseguire codice.
 */
function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Valida che un reseller abbia workspaceId.
 * Fail-fast: se role=user e workspaceId manca, blocca l'operazione.
 */
function validateWorkspaceRequired(
  role: 'admin' | 'user' | 'reseller',
  workspaceId: string | undefined
): string | null {
  if (role === 'user' && !workspaceId) {
    return 'Workspace non specificato. Operazione non autorizzata.';
  }
  return null;
}

// ============================================
// HELPERS
// ============================================

/**
 * Mappa status lead a status prospect per il calcolo score
 * (la funzione di scoring usa ProspectStatus)
 */
function mapLeadStatusToProspectStatus(
  status: string
): 'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost' {
  const map: Record<string, 'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost'> = {
    new: 'new',
    contacted: 'contacted',
    qualified: 'contacted',
    negotiation: 'negotiating',
    won: 'won',
    lost: 'lost',
  };
  return map[status] || 'new';
}

/**
 * Costruisce input per il calcolo score da un record lead
 */
function buildScoreInputFromLead(lead: Record<string, any>): LeadScoreInput {
  return {
    email: lead.email,
    phone: lead.phone,
    sector: lead.sector,
    estimated_monthly_volume: lead.estimated_monthly_volume,
    status: mapLeadStatusToProspectStatus(lead.status || 'new'),
    email_open_count: lead.email_open_count,
    last_contact_at: lead.last_contact_at,
    created_at: lead.created_at || new Date().toISOString(),
    linked_quote_ids: lead.linked_quote_ids || [],
  };
}

/**
 * Costruisce input per il calcolo score da un record prospect
 */
function buildScoreInputFromProspect(prospect: Record<string, any>): LeadScoreInput {
  return {
    email: prospect.email,
    phone: prospect.phone,
    sector: prospect.sector,
    estimated_monthly_volume: prospect.estimated_monthly_volume,
    status: prospect.status || 'new',
    email_open_count: prospect.email_open_count,
    last_contact_at: prospect.last_contact_at,
    created_at: prospect.created_at || new Date().toISOString(),
    linked_quote_ids: prospect.linked_quote_ids || [],
  };
}

/**
 * Inserisce evento timeline best-effort.
 * Non blocca il flusso principale se fallisce.
 */
async function insertEventSafe(eventsTable: string, data: Record<string, unknown>): Promise<void> {
  try {
    await supabaseAdmin.from(eventsTable).insert(data);
  } catch (err) {
    console.warn(
      `[CRM Write] Evento non registrato (${data.event_type}):`,
      err instanceof Error ? err.message : err
    );
  }
}

// ============================================
// UPDATE STATUS
// ============================================

/**
 * Aggiorna lo stato di un lead/prospect nella pipeline.
 * Valida la transizione, aggiorna, ricalcola score, crea evento.
 *
 * Sicurezza:
 * - Reseller: workspaceId obbligatorio, filtrato in fetch E update
 * - Optimistic locking con updated_at
 */
export async function updateEntityStatus(params: UpdateStatusParams): Promise<CrmWriteResult> {
  const { role, entityId, newStatus, actorId, workspaceId, lostReason } = params;
  const isAdmin = role === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const eventsTable = isAdmin ? 'lead_events' : 'prospect_events';
  const fkColumn = isAdmin ? 'lead_id' : 'prospect_id';

  // Sicurezza: reseller DEVE avere workspaceId
  const wsError = validateWorkspaceRequired(role, workspaceId);
  if (wsError) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'status_update',
      details: '',
      error: wsError,
    };
  }

  // 1. Fetch entita' corrente (con filtro workspace per reseller)
  let query = supabaseAdmin.from(table).select('*').eq('id', entityId);
  if (!isAdmin) {
    query = query.eq('workspace_id', workspaceId!);
  }
  const { data: entity, error: fetchError } = await query.single();

  if (fetchError || !entity) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'status_update',
      details: '',
      error: 'Entita non trovata',
    };
  }

  const entityName = entity.company_name || entityId;
  const currentStatus = entity.status;

  // 2. Valida transizione
  if (isAdmin) {
    const validTargets = LEAD_VALID_TRANSITIONS[currentStatus as LeadStatus] || [];
    if (!validTargets.includes(newStatus as LeadStatus)) {
      const validList =
        validTargets.length > 0 ? validTargets.join(', ') : 'nessuna (stato finale)';
      return {
        success: false,
        entityId,
        entityName,
        action: 'status_update',
        details: '',
        error: `Transizione ${currentStatus} → ${newStatus} non valida. Transizioni valide: ${validList}`,
      };
    }
  } else {
    const validTargets = VALID_TRANSITIONS[currentStatus as ProspectStatus] || [];
    if (!validTargets.includes(newStatus as ProspectStatus)) {
      const validList =
        validTargets.length > 0 ? validTargets.join(', ') : 'nessuna (stato finale)';
      return {
        success: false,
        entityId,
        entityName,
        action: 'status_update',
        details: '',
        error: `Transizione ${currentStatus} → ${newStatus} non valida. Transizioni valide: ${validList}`,
      };
    }
  }

  // 3. Prepara dati update
  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'lost' && lostReason) {
    updateData.lost_reason = sanitizeText(lostReason);
  }

  // 4. Ricalcola score
  const merged = { ...entity, ...updateData };
  const scoreInput = isAdmin
    ? buildScoreInputFromLead(merged)
    : buildScoreInputFromProspect(merged);
  const newScore = calculateLeadScore(scoreInput);
  updateData.lead_score = newScore;

  // 5. Esegui update con optimistic locking (updated_at) + filtro workspace
  let updateQuery = supabaseAdmin
    .from(table)
    .update(updateData)
    .eq('id', entityId)
    .eq('updated_at', entity.updated_at);
  if (!isAdmin) {
    updateQuery = updateQuery.eq('workspace_id', workspaceId!);
  }
  const { error: updateError } = await updateQuery;

  if (updateError) {
    return {
      success: false,
      entityId,
      entityName,
      action: 'status_update',
      details: '',
      error: `Errore aggiornamento: ${updateError.message}`,
    };
  }

  // 6. Crea evento timeline (best-effort)
  const eventType = getStatusChangeEventType(newStatus, isAdmin);
  await insertEventSafe(eventsTable, {
    [fkColumn]: entityId,
    event_type: eventType,
    event_data: {
      from_status: currentStatus,
      to_status: newStatus,
      ...(newStatus === 'lost' && lostReason ? { lost_reason: sanitizeText(lostReason) } : {}),
    },
    actor_id: actorId,
  });

  // Evento score changed se delta significativo
  const oldScore = entity.lead_score || 0;
  if (Math.abs(newScore - oldScore) >= 10) {
    await insertEventSafe(eventsTable, {
      [fkColumn]: entityId,
      event_type: 'score_changed',
      event_data: { old_score: oldScore, new_score: newScore },
      actor_id: actorId,
    });
  }

  return {
    success: true,
    entityId,
    entityName,
    action: 'status_update',
    details: `Stato aggiornato da ${currentStatus} a ${newStatus}`,
    newScore,
  };
}

/**
 * Determina il tipo di evento in base al nuovo stato
 */
function getStatusChangeEventType(newStatus: string, isAdmin: boolean): string {
  if (isAdmin) {
    const eventMap: Record<string, LeadEventType> = {
      contacted: 'contacted',
      qualified: 'qualified',
      negotiation: 'negotiation_started',
      won: 'converted',
      lost: 'lost',
      new: 'reactivated',
    };
    return eventMap[newStatus] || 'contacted';
  } else {
    const eventMap: Record<string, ProspectEventType> = {
      contacted: 'contacted',
      quote_sent: 'quote_sent',
      negotiating: 'contacted',
      won: 'converted',
      lost: 'lost',
      new: 'reactivated',
    };
    return eventMap[newStatus] || 'contacted';
  }
}

// ============================================
// ADD NOTE
// ============================================

/**
 * Aggiunge una nota a un lead/prospect.
 * Appendi con timestamp, crea evento note_added.
 */
export async function addEntityNote(params: AddNoteParams): Promise<CrmWriteResult> {
  const { role, entityId, note, actorId, workspaceId } = params;
  const isAdmin = role === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const eventsTable = isAdmin ? 'lead_events' : 'prospect_events';
  const fkColumn = isAdmin ? 'lead_id' : 'prospect_id';

  // Sicurezza: reseller DEVE avere workspaceId
  const wsError = validateWorkspaceRequired(role, workspaceId);
  if (wsError) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'note_added',
      details: '',
      error: wsError,
    };
  }

  // Sanitizza input
  const sanitizedNote = sanitizeText(note);

  // 1. Fetch entita' corrente (con filtro workspace per reseller)
  let query = supabaseAdmin
    .from(table)
    .select('id, company_name, notes, updated_at')
    .eq('id', entityId);
  if (!isAdmin) {
    query = query.eq('workspace_id', workspaceId!);
  }
  const { data: entity, error: fetchError } = await query.single();

  if (fetchError || !entity) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'note_added',
      details: '',
      error: 'Entita non trovata',
    };
  }

  const entityName = entity.company_name || entityId;

  // 2. Appendi nota con timestamp
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const existingNotes = entity.notes || '';
  const updatedNotes = existingNotes
    ? `${existingNotes}\n\n[${timestamp}] ${sanitizedNote}`
    : `[${timestamp}] ${sanitizedNote}`;

  // 3. Esegui update con optimistic locking + filtro workspace
  let updateQuery = supabaseAdmin
    .from(table)
    .update({ notes: updatedNotes })
    .eq('id', entityId)
    .eq('updated_at', entity.updated_at);
  if (!isAdmin) {
    updateQuery = updateQuery.eq('workspace_id', workspaceId!);
  }
  const { error: updateError } = await updateQuery;

  if (updateError) {
    return {
      success: false,
      entityId,
      entityName,
      action: 'note_added',
      details: '',
      error: `Errore aggiornamento: ${updateError.message}`,
    };
  }

  // 4. Crea evento (best-effort)
  await insertEventSafe(eventsTable, {
    [fkColumn]: entityId,
    event_type: 'note_added',
    event_data: { note_preview: sanitizedNote.slice(0, 100) },
    actor_id: actorId,
  });

  return {
    success: true,
    entityId,
    entityName,
    action: 'note_added',
    details: `Nota aggiunta: "${sanitizedNote.slice(0, 80)}${sanitizedNote.length > 80 ? '...' : ''}"`,
  };
}

// ============================================
// RECORD CONTACT
// ============================================

/**
 * Registra un contatto avvenuto con lead/prospect.
 * Aggiorna last_contact_at, auto-avanza da new a contacted, aggiunge nota opzionale.
 */
export async function recordEntityContact(params: RecordContactParams): Promise<CrmWriteResult> {
  const { role, entityId, contactNote, actorId, workspaceId } = params;
  const isAdmin = role === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const eventsTable = isAdmin ? 'lead_events' : 'prospect_events';
  const fkColumn = isAdmin ? 'lead_id' : 'prospect_id';

  // Sicurezza: reseller DEVE avere workspaceId
  const wsError = validateWorkspaceRequired(role, workspaceId);
  if (wsError) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'contact_recorded',
      details: '',
      error: wsError,
    };
  }

  // Sanitizza input
  const sanitizedContactNote = contactNote ? sanitizeText(contactNote) : undefined;

  // 1. Fetch entita' corrente (con filtro workspace per reseller)
  let query = supabaseAdmin
    .from(table)
    .select(
      'id, company_name, notes, status, lead_score, email, phone, sector, estimated_monthly_volume, email_open_count, last_contact_at, created_at, linked_quote_ids, updated_at'
    )
    .eq('id', entityId);
  if (!isAdmin) {
    query = query.eq('workspace_id', workspaceId!);
  }
  const { data: entity, error: fetchError } = await query.single();

  if (fetchError || !entity) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'contact_recorded',
      details: '',
      error: 'Entita non trovata',
    };
  }

  const entityName = entity.company_name || entityId;
  const now = new Date().toISOString();

  // 2. Prepara update
  const updateData: Record<string, unknown> = {
    last_contact_at: now,
  };

  // Auto-avanza da new a contacted
  let statusAdvanced = false;
  if (entity.status === 'new') {
    updateData.status = 'contacted';
    statusAdvanced = true;
  }

  // Aggiunge nota contatto se fornita
  if (sanitizedContactNote) {
    const timestamp = now.slice(0, 16).replace('T', ' ');
    const existingNotes = entity.notes || '';
    updateData.notes = existingNotes
      ? `${existingNotes}\n\n[${timestamp}] Contatto: ${sanitizedContactNote}`
      : `[${timestamp}] Contatto: ${sanitizedContactNote}`;
  }

  // Ricalcola score
  const merged = { ...entity, ...updateData };
  const scoreInput = isAdmin
    ? buildScoreInputFromLead(merged)
    : buildScoreInputFromProspect(merged);
  const newScore = calculateLeadScore(scoreInput);
  updateData.lead_score = newScore;

  // 3. Esegui update con optimistic locking + filtro workspace
  let updateQuery = supabaseAdmin
    .from(table)
    .update(updateData)
    .eq('id', entityId)
    .eq('updated_at', entity.updated_at);
  if (!isAdmin) {
    updateQuery = updateQuery.eq('workspace_id', workspaceId!);
  }
  const { error: updateError } = await updateQuery;

  if (updateError) {
    return {
      success: false,
      entityId,
      entityName,
      action: 'contact_recorded',
      details: '',
      error: `Errore aggiornamento: ${updateError.message}`,
    };
  }

  // 4. Crea evento contacted (best-effort)
  await insertEventSafe(eventsTable, {
    [fkColumn]: entityId,
    event_type: 'contacted',
    event_data: {
      contact_note: sanitizedContactNote?.slice(0, 200),
      status_advanced: statusAdvanced,
    },
    actor_id: actorId,
  });

  // Se nota contatto presente, crea anche evento note_added (best-effort)
  if (sanitizedContactNote) {
    await insertEventSafe(eventsTable, {
      [fkColumn]: entityId,
      event_type: 'note_added',
      event_data: { note_preview: sanitizedContactNote.slice(0, 100) },
      actor_id: actorId,
    });
  }

  const details = statusAdvanced
    ? `Contatto registrato. Stato avanzato da new a contacted.`
    : `Contatto registrato. Ultimo contatto: adesso.`;

  return {
    success: true,
    entityId,
    entityName,
    action: 'contact_recorded',
    details,
    newScore,
  };
}
