/**
 * Tipi per il CRM Reseller (Livello 2)
 *
 * Pipeline prospect per reseller:
 * new → contacted → quote_sent → negotiating → won → lost
 */

// ============================================
// ENUMS
// ============================================

export type ProspectStatus = 'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost';

export type ProspectSector =
  | 'ecommerce'
  | 'food'
  | 'pharma'
  | 'artigianato'
  | 'industria'
  | 'altro';

export type ProspectEventType =
  | 'created'
  | 'contacted'
  | 'note_added'
  | 'email_sent'
  | 'email_opened'
  | 'quote_created'
  | 'quote_sent'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'converted'
  | 'lost'
  | 'reactivated'
  | 'score_changed';

export type ShipmentType = 'parcel' | 'pallet' | 'envelope';

export type GeographicCorridor = 'IT-IT' | 'IT-EU' | 'EU-EU' | 'IT-EXTRA' | 'EU-EXTRA';

// ============================================
// INTERFACCE PRINCIPALI
// ============================================

export interface ResellerProspect {
  id: string;
  workspace_id: string;

  // Dati contatto
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  sector?: ProspectSector;

  // Qualificazione
  estimated_monthly_volume?: number;
  estimated_monthly_value?: number;
  geographic_corridors?: GeographicCorridor[];
  shipment_types?: ShipmentType[];
  notes?: string;
  tags?: string[];

  // Pipeline
  status: ProspectStatus;
  lost_reason?: string;

  // Scoring
  lead_score: number;

  // Assignment
  assigned_to?: string;

  // Collegamento preventivi
  linked_quote_ids?: string[];

  // Conversione
  converted_user_id?: string;
  converted_workspace_id?: string;
  converted_at?: string;

  // Engagement
  last_contact_at?: string;
  last_email_opened_at?: string;
  email_open_count?: number;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Joins opzionali
  assignee?: { name: string; email: string };
  events?: ProspectEvent[];
}

export interface ProspectEvent {
  id: string;
  prospect_id: string;
  event_type: ProspectEventType;
  event_data?: Record<string, unknown>;
  actor_id?: string;
  created_at: string;
}

// ============================================
// DTO (Data Transfer Objects)
// ============================================

export interface CreateProspectDTO {
  workspace_id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  sector?: ProspectSector;
  estimated_monthly_volume?: number;
  estimated_monthly_value?: number;
  geographic_corridors?: GeographicCorridor[];
  shipment_types?: ShipmentType[];
  notes?: string;
  tags?: string[];
  assigned_to?: string;
}

export interface UpdateProspectDTO {
  company_name?: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  sector?: ProspectSector;
  estimated_monthly_volume?: number;
  estimated_monthly_value?: number;
  geographic_corridors?: GeographicCorridor[];
  shipment_types?: ShipmentType[];
  notes?: string;
  tags?: string[];
  status?: ProspectStatus;
  lost_reason?: string;
  assigned_to?: string;
  last_contact_at?: string;
}

// ============================================
// FILTRI
// ============================================

export interface ProspectFilters {
  status?: ProspectStatus | ProspectStatus[];
  sector?: ProspectSector;
  search?: string;
  assigned_to?: string;
  min_score?: number;
  sort_by?: 'created_at' | 'updated_at' | 'lead_score' | 'company_name' | 'estimated_monthly_value';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// ============================================
// STATISTICHE
// ============================================

export interface ProspectStats {
  total: number;
  by_status: Record<ProspectStatus, number>;
  won_this_month: number;
  pipeline_value: number;
  average_score: number;
}

// ============================================
// TRANSIZIONI STATO VALIDE
// ============================================

export const VALID_TRANSITIONS: Record<ProspectStatus, ProspectStatus[]> = {
  new: ['contacted', 'lost'],
  contacted: ['quote_sent', 'negotiating', 'lost'],
  quote_sent: ['negotiating', 'won', 'lost'],
  negotiating: ['won', 'lost'],
  won: [], // stato finale
  lost: ['new'], // riattivazione
};

// ============================================
// COLORI STATUS (per UI)
// ============================================

export const STATUS_COLORS: Record<ProspectStatus, string> = {
  new: 'blue',
  contacted: 'yellow',
  quote_sent: 'purple',
  negotiating: 'orange',
  won: 'green',
  lost: 'gray',
};

export const STATUS_LABELS: Record<ProspectStatus, string> = {
  new: 'Nuovo',
  contacted: 'Contattato',
  quote_sent: 'Preventivo Inviato',
  negotiating: 'In Negoziazione',
  won: 'Cliente',
  lost: 'Perso',
};

export const SECTOR_LABELS: Record<ProspectSector, string> = {
  ecommerce: 'E-commerce',
  food: 'Food & Beverage',
  pharma: 'Farmaceutico',
  artigianato: 'Artigianato',
  industria: 'Industria',
  altro: 'Altro',
};
