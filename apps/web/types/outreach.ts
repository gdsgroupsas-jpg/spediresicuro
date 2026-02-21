/**
 * Tipi per il sistema Outreach Multi-Canale (Sprint S3)
 *
 * Sequenze automatiche via Email (Resend), WhatsApp (Meta Cloud API), Telegram (Bot API).
 * Configurazione per workspace, template Handlebars, GDPR consent tracking.
 */

// ============================================
// ENUMS
// ============================================

export type OutreachChannel = 'email' | 'whatsapp' | 'telegram';

export type TemplateCategory = 'intro' | 'followup' | 'quote_reminder' | 'winback' | 'general';

export type StepCondition = 'always' | 'no_reply' | 'no_open' | 'replied' | 'opened';

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'cancelled' | 'bounced';

export type ExecutionStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'replied'
  | 'failed'
  | 'bounced'
  | 'skipped';

export type SequenceTrigger =
  | 'manual'
  | 'new_lead'
  | 'new_prospect'
  | 'status_change'
  | 'stale'
  | 'winback';

export type ConsentSource = 'manual' | 'form' | 'api' | 'import';

export type GdprLegalBasis = 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';

// ============================================
// INTERFACCE — Configurazione
// ============================================

export interface ChannelConfig {
  id: string;
  workspace_id: string;
  channel: OutreachChannel;
  enabled: boolean;
  config: Record<string, unknown>; // es: { telegram_chat_id: '12345' }
  daily_limit: number | null; // null = illimitato
  max_retries: number; // retry policy per provider (default 3)
  supports_open_tracking: boolean; // email: true, whatsapp: parziale, telegram: false
  supports_read_tracking: boolean; // whatsapp: se abilitato, altri: false
  created_at: string;
  updated_at: string;
}

// ============================================
// INTERFACCE — Template
// ============================================

export interface OutreachTemplate {
  id: string;
  workspace_id: string;
  name: string;
  channel: OutreachChannel;
  subject?: string; // solo email
  body: string; // Handlebars template
  category: TemplateCategory;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/** Variabili disponibili per Handlebars */
export interface TemplateVars {
  company_name: string;
  contact_name?: string;
  sector?: string;
  status?: string;
  score?: number;
  [key: string]: unknown;
}

// ============================================
// INTERFACCE — Sequenze
// ============================================

export interface OutreachSequence {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  trigger_on: SequenceTrigger;
  target_statuses: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  steps?: SequenceStep[];
}

export interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  channel: OutreachChannel;
  template_id: string;
  delay_days: number;
  condition: StepCondition;
  created_at: string;
}

// ============================================
// INTERFACCE — Enrollment
// ============================================

export interface Enrollment {
  id: string;
  sequence_id: string;
  entity_type: 'lead' | 'prospect';
  entity_id: string;
  workspace_id: string;
  current_step: number; // 0 = non iniziato
  status: EnrollmentStatus;
  enrolled_at: string;
  next_execution_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  idempotency_key: string;
  updated_at: string;
}

// ============================================
// INTERFACCE — Esecuzioni
// ============================================

export interface Execution {
  id: string;
  enrollment_id: string;
  step_id: string;
  // Denormalizzati per query rate limit/cooldown senza JOIN
  workspace_id: string;
  entity_type: 'lead' | 'prospect';
  entity_id: string;
  channel: OutreachChannel;
  recipient: string;
  template_id: string;
  rendered_subject: string | null;
  rendered_body: string;
  status: ExecutionStatus;
  provider_message_id: string | null;
  error_message: string | null;
  retry_count: number;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// INTERFACCE — Consent GDPR
// ============================================

export interface OutreachConsent {
  id: string;
  entity_type: 'lead' | 'prospect';
  entity_id: string;
  channel: OutreachChannel;
  consented: boolean;
  legal_basis: GdprLegalBasis;
  consented_at: string | null;
  revoked_at: string | null;
  source: ConsentSource;
  collected_by: string | null; // user ID di chi ha raccolto il consenso
  provenance_detail: string | null; // es: "Form contatto sito web 2026-02-10"
  created_at: string;
  updated_at: string;
}

// ============================================
// CHANNEL CAPABILITIES (Gap 2 fix)
// Non tutti i canali supportano le stesse feature
// ============================================

/** Capability map statica per canale — usata dal sequence executor per
 *  decidere se valutare condizioni no_open/opened */
export const CHANNEL_CAPABILITIES: Record<
  OutreachChannel,
  {
    supportsOpenTracking: boolean;
    supportsReadTracking: boolean;
    supportsReplyDetection: boolean;
    maxBodyLength: number;
    defaultMaxRetries: number;
  }
> = {
  email: {
    supportsOpenTracking: true, // tracking pixel
    supportsReadTracking: false,
    supportsReplyDetection: true, // inbound email webhook
    maxBodyLength: 100_000,
    defaultMaxRetries: 2, // Resend: fire-and-forget, retry lato provider
  },
  whatsapp: {
    supportsOpenTracking: false,
    supportsReadTracking: true, // "read" status se abilitato dal destinatario
    supportsReplyDetection: true, // webhook messaggio in arrivo
    maxBodyLength: 4096,
    defaultMaxRetries: 3,
  },
  telegram: {
    supportsOpenTracking: false,
    supportsReadTracking: false, // Telegram non espone read receipts
    supportsReplyDetection: true, // webhook messaggio in arrivo
    maxBodyLength: 4096,
    defaultMaxRetries: 0, // Telegram queue ha propria semantica retry
  },
};

// ============================================
// INTERFACCE — Risultati operazioni
// ============================================

export interface SendResult {
  success: boolean;
  messageId?: string;
  channel: OutreachChannel;
  error?: string;
}

export interface ProcessResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  completed: number;
}

export interface OutreachMetrics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalReplied: number;
  totalFailed: number;
  deliveryRate: number;
  openRate: number;
  replyRate: number;
  byChannel: Record<
    OutreachChannel,
    {
      sent: number;
      delivered: number;
      opened: number;
      replied: number;
      failed: number;
    }
  >;
}
