/**
 * Financial Alerts Service
 *
 * Servizio per gestione alert finanziari automatici.
 * Invia notifiche quando si verificano condizioni critiche.
 *
 * @module lib/services/financial/financial-alerts-service
 * @since Sprint 3 - Monitoring & Alerting
 */

import { SupabaseClient } from "@supabase/supabase-js";

export type AlertSeverity = "info" | "warning" | "critical";

export interface FinancialAlert {
  type:
    | "negative_margin"
    | "high_discrepancy"
    | "reconciliation_overdue"
    | "cost_spike";
  severity: AlertSeverity;
  title: string;
  message: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface AlertConfig {
  slackWebhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  emailRecipients?: string[];
  emailFrom?: string;
  thresholds: {
    negativeMarginThreshold: number; // €
    discrepancyPercentThreshold: number; // %
    reconciliationOverdueDays: number;
    costSpikePercentThreshold: number; // %
  };
}

const DEFAULT_CONFIG: AlertConfig = {
  thresholds: {
    negativeMarginThreshold: -10, // Alert se margine < -10€
    discrepancyPercentThreshold: 20, // Alert se discrepanza > 20%
    reconciliationOverdueDays: 7, // Alert se pending > 7 giorni
    costSpikePercentThreshold: 50, // Alert se costo +50% vs media
  },
};

/**
 * Servizio per gestione alert finanziari
 */
export class FinancialAlertsService {
  private config: AlertConfig;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient, config: Partial<AlertConfig> = {}) {
    this.supabase = supabase;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Controlla e genera alert per margini negativi
   */
  async checkNegativeMargins(): Promise<FinancialAlert[]> {
    const alerts: FinancialAlert[] = [];

    try {
      const { data: negativeMargins } = await this.supabase
        .from("platform_provider_costs")
        .select(
          `
          id,
          shipment_id,
          shipment_tracking_number,
          billed_amount,
          provider_cost,
          platform_margin,
          courier_code,
          created_at,
          users!platform_provider_costs_billed_user_id_fkey(email)
        `
        )
        .lt("platform_margin", this.config.thresholds.negativeMarginThreshold)
        .eq("reconciliation_status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);

      if (negativeMargins && negativeMargins.length > 0) {
        // Raggruppa per severity
        const critical = negativeMargins.filter(
          (m) => (m.platform_margin || 0) < -50
        );
        const warning = negativeMargins.filter(
          (m) =>
            (m.platform_margin || 0) >= -50 && (m.platform_margin || 0) < -10
        );

        if (critical.length > 0) {
          alerts.push({
            type: "negative_margin",
            severity: "critical",
            title: `🚨 ${critical.length} spedizioni con margine CRITICO`,
            message: `Rilevate ${
              critical.length
            } spedizioni con margine < -50€. Perdita totale: €${Math.abs(
              critical.reduce((s, m) => s + (m.platform_margin || 0), 0)
            ).toFixed(2)}`,
            data: {
              count: critical.length,
              items: critical.slice(0, 5).map((m) => ({
                tracking: m.shipment_tracking_number,
                margin: m.platform_margin,
                courier: m.courier_code,
              })),
              totalLoss: critical.reduce(
                (s, m) => s + (m.platform_margin || 0),
                0
              ),
            },
            timestamp: new Date(),
          });
        }

        if (warning.length > 0) {
          alerts.push({
            type: "negative_margin",
            severity: "warning",
            title: `⚠️ ${warning.length} spedizioni con margine negativo`,
            message: `Rilevate ${warning.length} spedizioni con margine negativo. Verifica configurazione listini.`,
            data: {
              count: warning.length,
              items: warning.slice(0, 5).map((m) => ({
                tracking: m.shipment_tracking_number,
                margin: m.platform_margin,
                courier: m.courier_code,
              })),
            },
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error(
        "[FINANCIAL_ALERTS] Error checking negative margins:",
        error
      );
    }

    return alerts;
  }

  /**
   * Controlla spedizioni da riconciliare scadute
   */
  async checkOverdueReconciliation(): Promise<FinancialAlert[]> {
    const alerts: FinancialAlert[] = [];

    try {
      const daysAgo = new Date();
      daysAgo.setDate(
        daysAgo.getDate() - this.config.thresholds.reconciliationOverdueDays
      );

      const { count } = await this.supabase
        .from("platform_provider_costs")
        .select("*", { count: "exact", head: true })
        .eq("reconciliation_status", "pending")
        .lt("created_at", daysAgo.toISOString());

      if (count && count > 0) {
        const severity: AlertSeverity =
          count > 100 ? "critical" : count > 20 ? "warning" : "info";

        alerts.push({
          type: "reconciliation_overdue",
          severity,
          title: `📋 ${count} spedizioni da riconciliare (>${this.config.thresholds.reconciliationOverdueDays}gg)`,
          message: `Ci sono ${count} spedizioni pending da più di ${this.config.thresholds.reconciliationOverdueDays} giorni. Verificare con corrieri.`,
          data: {
            count,
            daysPending: this.config.thresholds.reconciliationOverdueDays,
          },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error(
        "[FINANCIAL_ALERTS] Error checking overdue reconciliation:",
        error
      );
    }

    return alerts;
  }

  /**
   * Esegue tutti i controlli e restituisce gli alert
   */
  async runAllChecks(): Promise<FinancialAlert[]> {
    const [negativeMarginAlerts, overdueAlerts] = await Promise.all([
      this.checkNegativeMargins(),
      this.checkOverdueReconciliation(),
    ]);

    return [...negativeMarginAlerts, ...overdueAlerts];
  }

  /**
   * Invia alert a Slack (GRATUITO - Piano Free)
   */
  async sendToSlack(alert: FinancialAlert): Promise<boolean> {
    if (!this.config.slackWebhookUrl) {
      return false;
    }

    try {
      const color =
        alert.severity === "critical"
          ? "#dc2626"
          : alert.severity === "warning"
          ? "#f59e0b"
          : "#3b82f6";

      const payload = {
        attachments: [
          {
            color,
            title: alert.title,
            text: alert.message,
            fields: [
              { title: "Tipo", value: alert.type, short: true },
              {
                title: "Severity",
                value: alert.severity.toUpperCase(),
                short: true,
              },
            ],
            footer: "SpedireSicuro Financial Alerts",
            ts: Math.floor(alert.timestamp.getTime() / 1000),
          },
        ],
      };

      const response = await fetch(this.config.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      console.error("[FINANCIAL_ALERTS] Failed to send Slack alert:", error);
      return false;
    }
  }

  /**
   * Invia alert a Telegram Bot (GRATUITO)
   */
  async sendToTelegram(alert: FinancialAlert): Promise<boolean> {
    if (!this.config.telegramBotToken || !this.config.telegramChatId) {
      return false;
    }

    try {
      const emoji =
        alert.severity === "critical"
          ? "🚨"
          : alert.severity === "warning"
          ? "⚠️"
          : "ℹ️";

      const message = `${emoji} *${alert.title}*\n\n${
        alert.message
      }\n\n*Tipo:* ${
        alert.type
      }\n*Severity:* ${alert.severity.toUpperCase()}\n*Timestamp:* ${alert.timestamp.toLocaleString(
        "it-IT"
      )}`;

      const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.telegramChatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });

      const result = await response.json();
      return result.ok === true;
    } catch (error) {
      console.error("[FINANCIAL_ALERTS] Failed to send Telegram alert:", error);
      return false;
    }
  }

  /**
   * Invia alert via Email (GRATUITO con Resend o SMTP)
   */
  async sendToEmail(alert: FinancialAlert): Promise<boolean> {
    if (
      !this.config.emailRecipients ||
      this.config.emailRecipients.length === 0
    ) {
      return false;
    }

    try {
      // Usa Resend se disponibile, altrimenti fallback a SMTP
      const resendApiKey = process.env.RESEND_API_KEY;
      const emailFrom =
        this.config.emailFrom ||
        process.env.EMAIL_FROM ||
        "alerts@spediresicuro.it";

      if (resendApiKey) {
        // Usa Resend API (gratuito fino a 100 email/giorno)
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: this.config.emailRecipients,
            subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: ${
                  alert.severity === "critical"
                    ? "#dc2626"
                    : alert.severity === "warning"
                    ? "#f59e0b"
                    : "#3b82f6"
                }">
                  ${alert.title}
                </h2>
                <p>${alert.message}</p>
                <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
                <p><strong>Tipo:</strong> ${alert.type}</p>
                <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
                <p><strong>Timestamp:</strong> ${alert.timestamp.toLocaleString(
                  "it-IT"
                )}</p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                  SpedireSicuro Financial Alerts
                </p>
              </div>
            `,
          }),
        });

        const result = await response.json();
        return response.ok && result.id;
      } else {
        // Fallback: log per ora (puoi aggiungere SMTP se necessario)
        console.log(
          "[FINANCIAL_ALERTS] Email not sent - RESEND_API_KEY not configured"
        );
        return false;
      }
    } catch (error) {
      console.error("[FINANCIAL_ALERTS] Failed to send email alert:", error);
      return false;
    }
  }

  /**
   * Invia alert a tutti i canali configurati
   */
  async sendToAllChannels(alert: FinancialAlert): Promise<{
    slack: boolean;
    telegram: boolean;
    email: boolean;
  }> {
    const [slack, telegram, email] = await Promise.all([
      this.sendToSlack(alert),
      this.sendToTelegram(alert),
      this.sendToEmail(alert),
    ]);

    return { slack, telegram, email };
  }

  /**
   * Logga alert nel financial_audit_log
   */
  async logAlert(alert: FinancialAlert): Promise<void> {
    try {
      await this.supabase.from("financial_audit_log").insert({
        event_type: "margin_alert",
        amount: alert.data.totalLoss || 0,
        metadata: {
          alert_type: alert.type,
          severity: alert.severity,
          title: alert.title,
          data: alert.data,
        },
      });
    } catch (error) {
      console.error("[FINANCIAL_ALERTS] Failed to log alert:", error);
    }
  }
}

/**
 * Factory function per creare il servizio con config da env
 * Supporta multipli canali: Slack (gratuito), Telegram Bot (gratuito), Email (Resend gratuito)
 */
export function createFinancialAlertsService(
  supabase: SupabaseClient
): FinancialAlertsService {
  return new FinancialAlertsService(supabase, {
    // Slack (GRATUITO - Piano Free)
    slackWebhookUrl: process.env.SLACK_FINANCIAL_ALERTS_WEBHOOK,

    // Telegram Bot (GRATUITO)
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,

    // Email (GRATUITO con Resend - 100 email/giorno)
    emailRecipients: process.env.EMAIL_ALERT_RECIPIENTS?.split(",")
      .map((e) => e.trim())
      .filter(Boolean),
    emailFrom: process.env.EMAIL_FROM,

    thresholds: {
      negativeMarginThreshold:
        Number(process.env.ALERT_NEGATIVE_MARGIN_THRESHOLD) || -10,
      discrepancyPercentThreshold:
        Number(process.env.ALERT_DISCREPANCY_THRESHOLD) || 20,
      reconciliationOverdueDays:
        Number(process.env.ALERT_RECONCILIATION_DAYS) || 7,
      costSpikePercentThreshold:
        Number(process.env.ALERT_COST_SPIKE_THRESHOLD) || 50,
    },
  });
}
