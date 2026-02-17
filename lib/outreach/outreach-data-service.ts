/**
 * Outreach Data Service — Sprint S3
 *
 * Layer dati CRUD per il sistema outreach multi-canale.
 * Pattern identico a crm-data-service.ts:
 * - Usa supabaseAdmin (service role, bypassa RLS)
 * - Filtra per workspace_id in codice (defense-in-depth)
 * - Sanitizzazione input
 * - Error handling consistente
 */

import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import type {
  OutreachChannel,
  ChannelConfig,
  OutreachTemplate,
  TemplateCategory,
  OutreachSequence,
  SequenceStep,
} from '@/types/outreach';

// ============================================
// SANITIZZAZIONE
// ============================================

/** Rimuove tag HTML per prevenire stored XSS */
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

// ============================================
// CHANNEL CONFIG
// ============================================

/**
 * Ritorna la configurazione di tutti i canali per un workspace.
 */
export async function getChannelConfig(workspaceId: string): Promise<ChannelConfig[]> {
  const { data, error } = await supabaseAdmin
    .from('outreach_channel_config')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('[outreach-data-service] getChannelConfig error:', error);
    return [];
  }
  return data || [];
}

/**
 * Ritorna la configurazione di un canale specifico.
 */
export async function getChannelConfigByChannel(
  workspaceId: string,
  channel: OutreachChannel
): Promise<ChannelConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('outreach_channel_config')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('channel', channel)
    .maybeSingle();

  if (error) {
    console.error('[outreach-data-service] getChannelConfigByChannel error:', error);
    return null;
  }
  return data;
}

/**
 * Abilita/disabilita un canale per workspace (upsert).
 */
export async function upsertChannelConfig(params: {
  workspaceId: string;
  channel: OutreachChannel;
  enabled: boolean;
  config?: Record<string, unknown>;
  dailyLimit?: number | null;
  maxRetries?: number;
}): Promise<{ success: boolean; error?: string }> {
  const { workspaceId, channel, enabled, config, dailyLimit, maxRetries } = params;

  const wq = workspaceQuery(workspaceId);
  const { error } = await wq.from('outreach_channel_config').upsert(
    {
      channel,
      enabled,
      ...(config !== undefined ? { config } : {}),
      ...(dailyLimit !== undefined ? { daily_limit: dailyLimit } : {}),
      ...(maxRetries !== undefined ? { max_retries: maxRetries } : {}),
    },
    { onConflict: 'workspace_id,channel' }
  );

  if (error) {
    console.error('[outreach-data-service] upsertChannelConfig error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ============================================
// TEMPLATES
// ============================================

/**
 * Lista template per workspace, opzionalmente filtrati per categoria e canale.
 */
export async function getTemplates(
  workspaceId: string,
  options?: { category?: TemplateCategory; channel?: OutreachChannel }
): Promise<OutreachTemplate[]> {
  let query = supabaseAdmin
    .from('outreach_templates')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('category')
    .order('name');

  if (options?.category) {
    query = query.eq('category', options.category);
  }
  if (options?.channel) {
    query = query.eq('channel', options.channel);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[outreach-data-service] getTemplates error:', error);
    return [];
  }
  return data || [];
}

/**
 * Crea un nuovo template.
 */
export async function createTemplate(params: {
  workspaceId: string;
  name: string;
  channel: OutreachChannel;
  body: string;
  subject?: string;
  category?: TemplateCategory;
}): Promise<{ success: boolean; templateId?: string; error?: string }> {
  const { workspaceId, name, channel, body, subject, category } = params;

  const { data, error } = await supabaseAdmin
    .from('outreach_templates')
    .insert({
      workspace_id: workspaceId,
      name: sanitizeText(name),
      channel,
      body, // Il body e' un template Handlebars, non sanitizzare (usato per rendering)
      ...(subject ? { subject: sanitizeText(subject) } : {}),
      ...(category ? { category } : {}),
    })
    .select('id')
    .single();

  if (error) {
    console.error('[outreach-data-service] createTemplate error:', error);
    return { success: false, error: error.message };
  }
  return { success: true, templateId: data.id };
}

/**
 * Aggiorna un template esistente (non di sistema).
 */
export async function updateTemplate(params: {
  templateId: string;
  workspaceId: string;
  body?: string;
  subject?: string;
  name?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { templateId, workspaceId, body, subject, name } = params;

  const updateData: Record<string, unknown> = {};
  if (body !== undefined) updateData.body = body;
  if (subject !== undefined) updateData.subject = sanitizeText(subject);
  if (name !== undefined) updateData.name = sanitizeText(name);

  if (Object.keys(updateData).length === 0) {
    return { success: false, error: 'Nessun campo da aggiornare' };
  }

  const { error } = await supabaseAdmin
    .from('outreach_templates')
    .update(updateData)
    .eq('id', templateId)
    .eq('workspace_id', workspaceId)
    .eq('is_system', false); // Non modificare template di sistema

  if (error) {
    console.error('[outreach-data-service] updateTemplate error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Recupera un singolo template per ID.
 */
export async function getTemplateById(
  templateId: string,
  workspaceId: string
): Promise<OutreachTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('outreach_templates')
    .select('*')
    .eq('id', templateId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    console.error('[outreach-data-service] getTemplateById error:', error);
    return null;
  }
  return data;
}

// ============================================
// SEQUENZE
// ============================================

/**
 * Lista sequenze per workspace.
 */
export async function getSequences(workspaceId: string): Promise<OutreachSequence[]> {
  const { data, error } = await supabaseAdmin
    .from('outreach_sequences')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[outreach-data-service] getSequences error:', error);
    return [];
  }
  return data || [];
}

/**
 * Dettaglio sequenza con i suoi step.
 */
export async function getSequenceWithSteps(
  sequenceId: string,
  workspaceId: string
): Promise<(OutreachSequence & { steps: SequenceStep[] }) | null> {
  const { data: sequence, error: seqError } = await supabaseAdmin
    .from('outreach_sequences')
    .select('*')
    .eq('id', sequenceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (seqError || !sequence) {
    console.error('[outreach-data-service] getSequenceWithSteps error:', seqError);
    return null;
  }

  const { data: steps, error: stepsError } = await supabaseAdmin
    .from('outreach_sequence_steps')
    .select('*')
    .eq('sequence_id', sequenceId)
    .order('step_order');

  if (stepsError) {
    console.error('[outreach-data-service] getSequenceWithSteps steps error:', stepsError);
    return { ...sequence, steps: [] };
  }

  return { ...sequence, steps: steps || [] };
}

/**
 * Crea una sequenza con i relativi step (atomico).
 */
export async function createSequence(params: {
  workspaceId: string;
  name: string;
  description?: string;
  triggerOn?: string;
  targetStatuses?: string[];
  steps: Array<{
    stepOrder: number;
    channel: OutreachChannel;
    templateId: string;
    delayDays: number;
    condition?: string;
  }>;
}): Promise<{ success: boolean; sequenceId?: string; error?: string }> {
  const { workspaceId, name, description, triggerOn, targetStatuses, steps } = params;

  // Crea la sequenza
  const { data: sequence, error: seqError } = await supabaseAdmin
    .from('outreach_sequences')
    .insert({
      workspace_id: workspaceId,
      name: sanitizeText(name),
      ...(description ? { description: sanitizeText(description) } : {}),
      ...(triggerOn ? { trigger_on: triggerOn } : {}),
      ...(targetStatuses ? { target_statuses: targetStatuses } : {}),
    })
    .select('id')
    .single();

  if (seqError || !sequence) {
    console.error('[outreach-data-service] createSequence error:', seqError);
    return { success: false, error: seqError?.message || 'Errore creazione sequenza' };
  }

  // Crea gli step
  if (steps.length > 0) {
    const stepRows = steps.map((s) => ({
      sequence_id: sequence.id,
      step_order: s.stepOrder,
      channel: s.channel,
      template_id: s.templateId,
      delay_days: s.delayDays,
      ...(s.condition ? { condition: s.condition } : {}),
    }));

    const { error: stepsError } = await supabaseAdmin
      .from('outreach_sequence_steps')
      .insert(stepRows);

    if (stepsError) {
      console.error('[outreach-data-service] createSequence steps error:', stepsError);
      // Rollback: elimina la sequenza creata (cascade elimina gli step)
      await workspaceQuery(workspaceId).from('outreach_sequences').delete().eq('id', sequence.id);
      return { success: false, error: stepsError.message };
    }
  }

  return { success: true, sequenceId: sequence.id };
}

/**
 * Cerca sequenze con trigger_on matching per auto-enrollment.
 */
export async function findSequencesByTrigger(
  workspaceId: string,
  trigger: string
): Promise<OutreachSequence[]> {
  const { data, error } = await supabaseAdmin
    .from('outreach_sequences')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('trigger_on', trigger)
    .eq('is_active', true);

  if (error) {
    console.error('[outreach-data-service] findSequencesByTrigger error:', error);
    return [];
  }
  return data || [];
}
