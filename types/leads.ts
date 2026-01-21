export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'negotiation' | 'won' | 'lost';

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

  // Joins
  assignee?: {
    name: string;
    email: string;
  };
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
}

export interface UpdateLeadDTO extends Partial<CreateLeadDTO> {
  assigned_to?: string;
  last_contact_at?: string;
}
