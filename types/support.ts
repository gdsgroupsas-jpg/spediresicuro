/**
 * Types per Sistema di Assistenza SpedireSecuro
 * 
 * Definizioni TypeScript per ticket, messaggi, allegati e knowledge base
 */

// ============================================
// ENUMS
// ============================================

export const TicketCategory = {
  SPEDIZIONE: 'spedizione',
  GIACENZA: 'giacenza',
  WALLET: 'wallet',
  FATTURA: 'fattura',
  TECNICO: 'tecnico',
  CONFIGURAZIONE: 'configurazione',
  ALTRO: 'altro',
} as const;

export type TicketCategoryType = (typeof TicketCategory)[keyof typeof TicketCategory];

export const TicketPriority = {
  BASSA: 'bassa',
  MEDIA: 'media',
  ALTA: 'alta',
  URGENTE: 'urgente',
} as const;

export type TicketPriorityType = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TicketStatus = {
  NUOVO: 'nuovo',
  IN_LAVORAZIONE: 'in_lavorazione',
  ATTESA_CLIENTE: 'attesa_cliente',
  ATTESA_CORRIERE: 'attesa_corriere',
  RISOLTO: 'risolto',
  CHIUSO: 'chiuso',
} as const;

export type TicketStatusType = (typeof TicketStatus)[keyof typeof TicketStatus];

export const SupportActionType = {
  CREATED: 'created',
  STATUS_CHANGE: 'status_change',
  PRIORITY_CHANGE: 'priority_change',
  ASSIGNMENT: 'assignment',
  SHIPMENT_ACTION: 'shipment_action',
  GIACENZA_ACTION: 'giacenza_action',
  WALLET_ACTION: 'wallet_action',
  NOTE_ADDED: 'note_added',
  RATING_SUBMITTED: 'rating_submitted',
} as const;

export type SupportActionTypeType = (typeof SupportActionType)[keyof typeof SupportActionType];

export const KBCategory = {
  SPEDIZIONI: 'spedizioni',
  GIACENZE: 'giacenze',
  WALLET: 'wallet',
  FATTURE: 'fatture',
  CONFIGURAZIONE: 'configurazione',
  INTEGRAZIONI: 'integrazioni',
  FAQ: 'faq',
} as const;

export type KBCategoryType = (typeof KBCategory)[keyof typeof KBCategory];

// ============================================
// DATABASE TYPES
// ============================================

export interface SupportTicket {
  id: string;
  ticket_number: string;
  
  // Ownership
  user_id: string;
  reseller_id: string | null;
  
  // Classificazione
  category: TicketCategoryType;
  priority: TicketPriorityType;
  status: TicketStatusType;
  
  // Contenuto
  subject: string;
  description: string;
  
  // Riferimenti
  shipment_id: string | null;
  invoice_id: string | null;
  wallet_transaction_id: string | null;
  
  // Assignment
  assigned_to: string | null;
  assigned_at: string | null;
  
  // SLA
  created_at: string;
  first_response_at: string | null;
  first_response_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  
  // Valutazione
  rating: number | null;
  feedback: string | null;
  
  // Metadata
  metadata: Record<string, any>;
  tags: string[];
  
  // Audit
  updated_at: string;
  updated_by: string | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  
  user_id: string;
  user_role: string;
  
  message: string;
  is_internal: boolean;
  
  edited: boolean;
  edited_at: string | null;
  
  created_at: string;
}

export interface SupportAttachment {
  id: string;
  ticket_id: string | null;
  message_id: string | null;
  
  file_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  
  uploaded_by: string;
  created_at: string;
}

export interface SupportAction {
  id: string;
  ticket_id: string;
  user_id: string;
  
  action_type: SupportActionTypeType;
  action_data: Record<string, any>;
  
  success: boolean;
  error_message: string | null;
  
  created_at: string;
}

export interface SupportKBArticle {
  id: string;
  
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  
  category: KBCategoryType;
  tags: string[];
  
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  
  published: boolean;
  published_at: string | null;
  
  meta_description: string | null;
  
  created_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface SupportCannedResponse {
  id: string;
  
  title: string;
  shortcut: string;
  content: string;
  
  category: string | null;
  
  usage_count: number;
  
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// EXTENDED TYPES (con relazioni)
// ============================================

export interface SupportTicketWithRelations extends SupportTicket {
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
  reseller?: {
    id: string;
    name: string | null;
  };
  assigned_to_user?: {
    id: string;
    name: string | null;
  };
  shipment?: {
    id: string;
    tracking_number: string;
  };
  messages?: SupportMessage[];
  attachments?: SupportAttachment[];
  actions?: SupportAction[];
  _count?: {
    messages: number;
    attachments: number;
  };
}

export interface SupportMessageWithUser extends SupportMessage {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

// ============================================
// INPUT TYPES (per form e validazione)
// ============================================

export interface CreateTicketInput {
  category: TicketCategoryType;
  priority?: TicketPriorityType;
  subject: string;
  description: string;
  
  // Riferimenti opzionali
  shipment_id?: string;
  invoice_id?: string;
  wallet_transaction_id?: string;
  
  tags?: string[];
}

export interface UpdateTicketInput {
  status?: TicketStatusType;
  priority?: TicketPriorityType;
  assigned_to?: string | null;
  rating?: number;
  feedback?: string;
  tags?: string[];
}

export interface CreateMessageInput {
  ticket_id: string;
  message: string;
  is_internal?: boolean;
}

export interface CreateAttachmentInput {
  ticket_id?: string;
  message_id?: string;
  file: File;
}

export interface CreateKBArticleInput {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category: KBCategoryType;
  tags?: string[];
  published?: boolean;
  meta_description?: string;
}

export interface UpdateKBArticleInput {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  category?: KBCategoryType;
  tags?: string[];
  published?: boolean;
  meta_description?: string;
}

// ============================================
// FILTER TYPES
// ============================================

export interface TicketFilters {
  status?: TicketStatusType | TicketStatusType[];
  category?: TicketCategoryType | TicketCategoryType[];
  priority?: TicketPriorityType | TicketPriorityType[];
  assigned_to?: string | null;
  user_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface TicketListParams extends TicketFilters {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'priority';
  sort_order?: 'asc' | 'desc';
}

// ============================================
// STATISTICS TYPES
// ============================================

export interface SupportStats {
  total_tickets: number;
  open_tickets: number;
  awaiting_customer: number;
  resolved_tickets: number;
  closed_tickets: number;
  avg_rating: number | null;
  urgent_tickets: number;
}

export interface SupportSLAMetrics {
  avg_first_response_minutes: number | null;
  avg_resolution_hours: number | null;
  tickets_resolved_in_period: number;
  sla_compliance_rate: number | null;
}

export interface OperatorStats {
  operator_id: string;
  operator_name: string;
  assigned_tickets: number;
  resolved_tickets: number;
  avg_resolution_hours: number | null;
  avg_rating: number | null;
}

// ============================================
// ACTION DATA TYPES
// ============================================

export interface StatusChangeActionData {
  old_status: TicketStatusType;
  new_status: TicketStatusType;
  reason?: string;
}

export interface AssignmentActionData {
  old_assignee?: string;
  new_assignee: string;
  assignee_name: string;
}

export interface GiacenzaActionData {
  action: 'riconsegna' | 'reso' | 'distruzione';
  shipment_id: string;
  cost?: number;
  result?: any;
}

export interface WalletActionData {
  action: 'ricarica' | 'rimborso' | 'verifica';
  amount?: number;
  transaction_id?: string;
  result?: any;
}

export interface ShipmentActionData {
  action: 'cancella' | 'tracking' | 'download_ldv';
  shipment_id: string;
  result?: any;
}

// ============================================
// UTILITY TYPES
// ============================================

export type TicketCategoryLabel = {
  [K in TicketCategoryType]: string;
};

export const TICKET_CATEGORY_LABELS: TicketCategoryLabel = {
  spedizione: 'Spedizione',
  giacenza: 'Giacenza',
  wallet: 'Wallet',
  fattura: 'Fattura',
  tecnico: 'Tecnico',
  configurazione: 'Configurazione',
  altro: 'Altro',
};

export type TicketPriorityLabel = {
  [K in TicketPriorityType]: string;
};

export const TICKET_PRIORITY_LABELS: TicketPriorityLabel = {
  bassa: 'Bassa',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

export type TicketStatusLabel = {
  [K in TicketStatusType]: string;
};

export const TICKET_STATUS_LABELS: TicketStatusLabel = {
  nuovo: 'Nuovo',
  in_lavorazione: 'In Lavorazione',
  attesa_cliente: 'Attesa Cliente',
  attesa_corriere: 'Attesa Corriere',
  risolto: 'Risolto',
  chiuso: 'Chiuso',
};

// ============================================
// RESPONSE TYPES (API)
// ============================================

export interface TicketListResponse {
  tickets: SupportTicketWithRelations[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface TicketDetailResponse {
  ticket: SupportTicketWithRelations;
  messages: SupportMessageWithUser[];
  attachments: SupportAttachment[];
  actions: SupportAction[];
}

export interface KBArticleListResponse {
  articles: SupportKBArticle[];
  total: number;
  page: number;
  limit: number;
}

export interface SupportStatsResponse {
  stats: SupportStats;
  sla_metrics: SupportSLAMetrics;
  operator_stats?: OperatorStats[];
}
