export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'negotiation' | 'won' | 'lost';

export type LeadSource =
  | 'direct'
  | 'website_form'
  | 'referral'
  | 'cold_outreach'
  | 'event'
  | 'partner';

export type LeadSector =
  | 'ecommerce'
  | 'food'
  | 'pharma'
  | 'artigianato'
  | 'industria'
  | 'logistica'
  | 'altro';

export type GeographicZone = 'nord' | 'centro' | 'sud' | 'isole';

export type LeadEventType =
  | 'created'
  | 'contacted'
  | 'note_added'
  | 'email_sent'
  | 'email_opened'
  | 'qualified'
  | 'negotiation_started'
  | 'converted'
  | 'lost'
  | 'reactivated'
  | 'score_changed'
  | 'assigned';

// Transizioni stato valide per pipeline leads
export const LEAD_VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['negotiation', 'won', 'lost'],
  negotiation: ['won', 'lost'],
  won: [],
  lost: ['new'],
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nuovo',
  contacted: 'Contattato',
  qualified: 'Qualificato',
  negotiation: 'In Negoziazione',
  won: 'Convertito',
  lost: 'Perso',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'blue',
  contacted: 'indigo',
  qualified: 'orange',
  negotiation: 'purple',
  won: 'green',
  lost: 'gray',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  direct: 'Diretto',
  website_form: 'Form Sito Web',
  referral: 'Referral',
  cold_outreach: 'Cold Outreach',
  event: 'Evento',
  partner: 'Partner',
};

export const LEAD_SECTOR_LABELS: Record<LeadSector, string> = {
  ecommerce: 'E-commerce',
  food: 'Food & Beverage',
  pharma: 'Farmaceutico',
  artigianato: 'Artigianato',
  industria: 'Industria',
  logistica: 'Logistica',
  altro: 'Altro',
};

export const GEOGRAPHIC_ZONE_LABELS: Record<GeographicZone, string> = {
  nord: 'Nord Italia',
  centro: 'Centro Italia',
  sud: 'Sud Italia',
  isole: 'Isole',
};

export interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  estimated_value?: number;
  assigned_to?: string;
  user_id?: string; // Se convertito in utente
  created_at: string;
  updated_at: string;
  last_contact_at?: string;

  // Nuovi campi CRM Livello 1
  workspace_id?: string;
  lead_source?: LeadSource;
  lead_score?: number;
  sector?: LeadSector;
  estimated_monthly_volume?: number;
  geographic_zone?: GeographicZone;
  tags?: string[];
  lost_reason?: string;
  last_email_opened_at?: string;
  email_open_count?: number;
  converted_workspace_id?: string;
  converted_at?: string;

  // Joins
  assignee?: {
    name: string;
    email: string;
  };
  events?: LeadEvent[];
}

export interface LeadEvent {
  id: string;
  lead_id: string;
  event_type: LeadEventType;
  event_data?: Record<string, unknown>;
  actor_id?: string;
  created_at: string;
}

export interface CreateLeadDTO {
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  status?: LeadStatus;
  source?: string;
  notes?: string;
  estimated_value?: number;
  lead_source?: LeadSource;
  sector?: LeadSector;
  estimated_monthly_volume?: number;
  geographic_zone?: GeographicZone;
  tags?: string[];
}

export interface UpdateLeadDTO extends Partial<CreateLeadDTO> {
  assigned_to?: string;
  last_contact_at?: string;
  lost_reason?: string;
}
