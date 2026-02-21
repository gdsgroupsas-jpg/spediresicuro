import type { RiskLevel, ToolSpec } from '../types/index';

const HIGH_RISK_TOOLS = new Set<string>([
  'create_batch_shipments',
  'analyze_business_health',
  'check_error_logs',
  'manage_hold',
  'cancel_shipment',
  'process_refund',
  'escalate_to_human',
  'update_crm_status',
  'add_crm_note',
  'record_crm_contact',
  'schedule_outreach',
  'manage_outreach_channels',
]);

const CRITICAL_RISK_TOOLS = new Set<string>();

// Coerente con approval.ts: il messaggio deve INIZIARE con parola di conferma
const CONFIRM_REGEX = /^\s*(conferma|confermo|procedi|vai|ok|s[iì]|yes|autorizzo)[\s,.!]*(.*)$/i;

export function inferRiskLevel(toolName: string, fallback: RiskLevel = 'low'): RiskLevel {
  if (CRITICAL_RISK_TOOLS.has(toolName)) return 'critical';
  if (HIGH_RISK_TOOLS.has(toolName)) return 'high';
  return fallback;
}

export function requiresApprovalByPolicy(tool: ToolSpec): boolean {
  if (tool.requiresApproval) return true;
  const inferred = inferRiskLevel(tool.name, tool.riskLevel);
  return inferred === 'high' || inferred === 'critical';
}

export function hasExplicitConfirmation(message: string): boolean {
  return CONFIRM_REGEX.test(message);
}
