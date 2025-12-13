'use server';

import { createServerActionClient } from '@/lib/supabase-server';
import { CreateLeadDTO, Lead, LeadStatus, UpdateLeadDTO } from '@/types/leads';
import { revalidatePath } from 'next/cache';

/**
 * Get all leads (Admin view)
 */
export async function getLeads(limit = 100) {
  const supabase = createServerActionClient();
  
  const { data, error } = await supabase
    .from('leads')
    .select('*, assignee:users!leads_assigned_to_fkey(name, email)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Errore caricamento leads: ${error.message}`);
  return data as Lead[];
}

/**
 * Get single lead
 */
export async function getLeadById(id: string) {
  const supabase = createServerActionClient();
  
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as Lead;
}

/**
 * Create new lead
 */
export async function createLead(data: CreateLeadDTO) {
  const supabase = createServerActionClient();
  
  const { data: lead, error } = await supabase
    .from('leads')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  revalidatePath('/dashboard/admin/leads');
  return lead as Lead;
}

/**
 * Update lead
 */
export async function updateLead(id: string, data: UpdateLeadDTO) {
  const supabase = createServerActionClient();
  
  const { data: lead, error } = await supabase
    .from('leads')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  revalidatePath('/dashboard/admin/leads');
  return lead as Lead;
}

/**
 * Delete lead
 */
export async function deleteLead(id: string) {
  const supabase = createServerActionClient();
  
  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/admin/leads');
}

/**
 * Assign lead to agent
 */
export async function assignLead(id: string, agentId: string) {
    return updateLead(id, { assigned_to: agentId });
}

/**
 * Convert lead to user (placeholder logic)
 * In futuro potrebbe creare record in users e invitare via email
 */
export async function convertLeadToUser(id: string) {
    // TODO: Implementare logica conversione reale
    // Per ora settiamo stato a WON
    return updateLead(id, { status: 'won' });
}
