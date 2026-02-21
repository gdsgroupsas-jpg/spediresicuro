/**
 * Types per Automation Engine
 *
 * Definizione tipi per automazioni governabili.
 * Ogni automazione nasce DISATTIVATA, l'admin la accende/configura.
 */

// Stato di un'automazione run
export type AutomationRunStatus = 'running' | 'success' | 'failure' | 'partial';

// Chi ha triggerato l'esecuzione
export type AutomationTrigger = 'cron' | 'manual' | 'api';

// Record automazione dal DB
export interface Automation {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  schedule: string;
  config: Record<string, unknown>;
  config_schema: Record<string, unknown>;
  last_run_at: string | null;
  last_run_status: AutomationRunStatus | null;
  created_at: string;
  updated_at: string;
}

// Record esecuzione dal DB
export interface AutomationRun {
  id: string;
  automation_id: string;
  triggered_by: AutomationTrigger;
  triggered_by_user_id: string | null;
  status: AutomationRunStatus;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  items_processed: number;
  items_failed: number;
}

// Risultato ritornato da un handler
export interface AutomationResult {
  success: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  details?: Record<string, unknown>;
  error?: string;
}

// Firma di un handler di automazione
export type AutomationHandler = (
  config: Record<string, unknown>,
  automation: Automation
) => Promise<AutomationResult>;

// Per la UI: automazione con info ultimo run
export interface AutomationWithLastRun extends Automation {
  lastRun?: AutomationRun | null;
}
