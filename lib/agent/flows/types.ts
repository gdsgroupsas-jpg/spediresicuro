import type { PricingResult } from '@/lib/ai/pricing-engine';

export interface FlowContext {
  message: string;
  userId: string;
  userEmail?: string;
  userRole?: 'admin' | 'user' | 'reseller';
  sessionState?: Record<string, unknown>;
}

export interface FlowResult {
  message: string;
  pricingOptions?: PricingResult[];
  clarificationRequest?: string;
  sessionState?: Record<string, unknown>;
  agentState?: Record<string, unknown>;
  /** Richiesta di conferma esplicita prima di un'azione importante (gestita dall'Intermediary) */
  needsApproval?: string;
  /** Validazione fallita (gestita dall'Intermediary con fallback) */
  validationFailed?: string;
}
