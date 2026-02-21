/**
 * Outreach Structured Logger — Sprint S3d Gap Fix
 *
 * Logger strutturato per il sistema outreach.
 * Ogni log include campi contestuali: workspace_id, entity_id, channel, execution_id.
 * Formato JSON per facilita' di parsing in Vercel Logs / Datadog / altro.
 */

// ============================================
// TIPI
// ============================================

export interface OutreachLogContext {
  workspaceId?: string;
  entityType?: string;
  entityId?: string;
  channel?: string;
  executionId?: string;
  enrollmentId?: string;
  sequenceId?: string;
  providerMessageId?: string;
  stepOrder?: number;
  [key: string]: unknown;
}

type LogLevel = 'info' | 'warn' | 'error';

// ============================================
// LOGGER
// ============================================

function formatLog(
  level: LogLevel,
  component: string,
  message: string,
  context?: OutreachLogContext
): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: `outreach:${component}`,
    message,
    ...context,
  };
  return JSON.stringify(entry);
}

/**
 * Log strutturato per il sistema outreach.
 * Ogni metodo accetta un componente, un messaggio e un contesto opzionale.
 */
export const outreachLogger = {
  info(component: string, message: string, ctx?: OutreachLogContext): void {
    console.log(formatLog('info', component, message, ctx));
  },

  warn(component: string, message: string, ctx?: OutreachLogContext): void {
    console.warn(formatLog('warn', component, message, ctx));
  },

  error(component: string, message: string, ctx?: OutreachLogContext): void {
    console.error(formatLog('error', component, message, ctx));
  },

  /**
   * Log specifico per evento di invio.
   */
  logSend(params: {
    workspaceId: string;
    entityType: string;
    entityId: string;
    channel: string;
    enrollmentId: string;
    executionId?: string;
    stepOrder: number;
    success: boolean;
    providerMessageId?: string;
    error?: string;
  }): void {
    const level: LogLevel = params.success ? 'info' : 'error';
    const message = params.success
      ? `Messaggio inviato via ${params.channel}`
      : `Invio fallito via ${params.channel}: ${params.error || 'unknown'}`;

    const ctx: OutreachLogContext = {
      workspaceId: params.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
      channel: params.channel,
      enrollmentId: params.enrollmentId,
      executionId: params.executionId,
      stepOrder: params.stepOrder,
      providerMessageId: params.providerMessageId,
    };

    if (level === 'info') {
      console.log(formatLog('info', 'executor', message, ctx));
    } else {
      console.error(formatLog('error', 'executor', message, ctx));
    }
  },

  /**
   * Log specifico per safety check skip.
   */
  logSafetySkip(params: {
    workspaceId: string;
    entityId: string;
    channel: string;
    enrollmentId: string;
    reason: string;
    stepOrder: number;
  }): void {
    console.warn(
      formatLog('warn', 'executor', `Safety skip: ${params.reason}`, {
        workspaceId: params.workspaceId,
        entityId: params.entityId,
        channel: params.channel,
        enrollmentId: params.enrollmentId,
        stepOrder: params.stepOrder,
      })
    );
  },

  /**
   * Log per delivery status update da webhook.
   */
  logDeliveryUpdate(params: {
    providerMessageId: string;
    newStatus: string;
    source: 'resend' | 'whatsapp';
  }): void {
    console.log(
      formatLog('info', 'delivery-tracker', `Status update: ${params.newStatus}`, {
        providerMessageId: params.providerMessageId,
        channel: params.source === 'resend' ? 'email' : 'whatsapp',
      })
    );
  },
};
