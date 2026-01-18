/**
 * UptimeRobot Webhook Endpoint
 *
 * Receives alerts from UptimeRobot when monitors go down/up.
 * Forwards critical alerts to Slack.
 *
 * Endpoint: POST /api/webhooks/uptimerobot
 *
 * SECURITY: Requires secret token via query param or header
 * Configure in UptimeRobot: https://spediresicuro.it/api/webhooks/uptimerobot?token=YOUR_SECRET
 *
 * Milestone: M3 - Uptime & Health Monitoring
 */
import { NextRequest, NextResponse } from "next/server";

// UptimeRobot alert types
// 1 = Down, 2 = Up, 3 = SSL Certificate expires soon
type AlertType = "1" | "2" | "3" | 1 | 2 | 3;

interface UptimeRobotPayload {
  monitorID: string | number;
  monitorURL: string;
  monitorFriendlyName: string;
  alertType: AlertType;
  alertTypeFriendlyName: string;
  alertDetails: string;
  alertDuration?: string | number; // Duration of downtime in seconds (only on recovery)
}

/**
 * Normalize alertType to string for consistent comparison
 * UptimeRobot may send as number in JSON or string in form data
 */
function normalizeAlertType(alertType: AlertType): "1" | "2" | "3" {
  return String(alertType) as "1" | "2" | "3";
}

/**
 * Verify webhook secret token
 * Checks query param 'token' or header 'x-uptimerobot-token'
 *
 * SECURITY: Fail-closed in production - returns false if secret not configured
 */
function verifyWebhookSecret(request: NextRequest): { valid: boolean; error?: string } {
  const secret = process.env.UPTIMEROBOT_WEBHOOK_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  // FAIL-CLOSED in production: secret MUST be configured
  if (!secret || secret.length === 0) {
    if (isProduction) {
      console.error("[UPTIMEROBOT_WEBHOOK] CRITICAL: UPTIMEROBOT_WEBHOOK_SECRET not configured in production - rejecting request");
      return { valid: false, error: "Webhook secret not configured" };
    }
    // Only allow in development for initial setup
    console.warn("[UPTIMEROBOT_WEBHOOK] UPTIMEROBOT_WEBHOOK_SECRET not configured - allowing in development only");
    return { valid: true };
  }

  // Check query parameter
  const tokenParam = request.nextUrl.searchParams.get("token");
  if (tokenParam === secret) {
    return { valid: true };
  }

  // Check header
  const tokenHeader = request.headers.get("x-uptimerobot-token");
  if (tokenHeader === secret) {
    return { valid: true };
  }

  return { valid: false, error: "Invalid or missing token" };
}

async function sendSlackNotification(payload: UptimeRobotPayload): Promise<boolean> {
  const webhookUrl = process.env.SLACK_FINANCIAL_ALERTS_WEBHOOK || process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[UPTIMEROBOT_WEBHOOK] Slack webhook not configured");
    return false;
  }

  const alertType = normalizeAlertType(payload.alertType);
  const isDown = alertType === "1";
  const isUp = alertType === "2";
  const isSSL = alertType === "3";

  let emoji = "ℹ️";
  let color = "#36a64f"; // green

  if (isDown) {
    emoji = "🔴";
    color = "#dc3545"; // red
  } else if (isUp) {
    emoji = "🟢";
    color = "#28a745"; // green
  } else if (isSSL) {
    emoji = "⚠️";
    color = "#ffc107"; // yellow
  }

  // Format downtime duration
  let downtimeText = "";
  if (isUp && payload.alertDuration) {
    const seconds = typeof payload.alertDuration === 'string'
      ? parseInt(payload.alertDuration, 10)
      : payload.alertDuration;
    if (seconds >= 3600) {
      downtimeText = `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    } else if (seconds >= 60) {
      downtimeText = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    } else {
      downtimeText = `${seconds}s`;
    }
  }

  const slackPayload = {
    attachments: [
      {
        color,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *${payload.alertTypeFriendlyName}*\n*${payload.monitorFriendlyName}*`,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*URL:*\n${payload.monitorURL}`,
              },
              {
                type: "mrkdwn",
                text: `*Status:*\n${payload.alertTypeFriendlyName}`,
              },
              ...(payload.alertDetails
                ? [
                    {
                      type: "mrkdwn",
                      text: `*Details:*\n${payload.alertDetails}`,
                    },
                  ]
                : []),
              ...(downtimeText
                ? [
                    {
                      type: "mrkdwn",
                      text: `*Downtime:*\n${downtimeText}`,
                    },
                  ]
                : []),
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `UptimeRobot Monitor ID: ${payload.monitorID} | ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    });

    return response.ok;
  } catch (error) {
    console.error("[UPTIMEROBOT_WEBHOOK] Failed to send Slack notification:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  // SECURITY: Verify webhook secret (fail-closed in production)
  const authResult = verifyWebhookSecret(request);
  if (!authResult.valid) {
    console.warn("[UPTIMEROBOT_WEBHOOK] Unauthorized request:", authResult.error);
    return NextResponse.json(
      { error: "Unauthorized", message: authResult.error || "Invalid or missing webhook token" },
      { status: 401 }
    );
  }

  try {
    // Parse body - UptimeRobot sends JSON or form data depending on config
    let payload: UptimeRobotPayload;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      payload = {
        monitorID: formData.get("monitorID")?.toString() || "",
        monitorURL: formData.get("monitorURL")?.toString() || "",
        monitorFriendlyName: formData.get("monitorFriendlyName")?.toString() || "",
        alertType: (formData.get("alertType")?.toString() || "1") as AlertType,
        alertTypeFriendlyName: formData.get("alertTypeFriendlyName")?.toString() || "",
        alertDetails: formData.get("alertDetails")?.toString() || "",
        alertDuration: formData.get("alertDuration")?.toString(),
      };
    } else {
      // Try JSON as fallback
      payload = await request.json();
    }

    // Normalize alertType for consistent comparison
    const alertType = normalizeAlertType(payload.alertType);

    console.log("[UPTIMEROBOT_WEBHOOK] Received alert:", {
      monitor: payload.monitorFriendlyName,
      type: payload.alertTypeFriendlyName,
      alertType,
      url: payload.monitorURL,
    });

    // Log to console for Better Stack/Logtail ingestion
    const logEntry = {
      event: "uptime_alert",
      source: "uptimerobot",
      monitorId: String(payload.monitorID),
      monitorName: payload.monitorFriendlyName,
      monitorUrl: payload.monitorURL,
      alertType,
      alertTypeFriendlyName: payload.alertTypeFriendlyName,
      alertDetails: payload.alertDetails,
      alertDuration: payload.alertDuration,
      timestamp: new Date().toISOString(),
    };

    console.log("[UPTIME_ALERT]", JSON.stringify(logEntry));

    // Forward to Slack for critical alerts (down events)
    if (alertType === "1") {
      await sendSlackNotification(payload);
    }

    // Also notify on recovery if downtime was significant (> 5 minutes)
    if (alertType === "2" && payload.alertDuration) {
      const seconds = typeof payload.alertDuration === 'string'
        ? parseInt(payload.alertDuration, 10)
        : payload.alertDuration;
      if (seconds > 300) {
        // > 5 minutes
        await sendSlackNotification(payload);
      }
    }

    // SSL expiration warning
    if (alertType === "3") {
      await sendSlackNotification(payload);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Alert received and processed",
        monitorId: String(payload.monitorID),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPTIMEROBOT_WEBHOOK] Error processing webhook:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      { status: 500 }
    );
  }
}

// Health check for the webhook endpoint itself
export async function GET() {
  // Don't require auth for GET health check, but indicate if secret is configured
  const secretConfigured = !!process.env.UPTIMEROBOT_WEBHOOK_SECRET;

  return NextResponse.json(
    {
      status: "ok",
      endpoint: "UptimeRobot Webhook",
      description: "Receives UptimeRobot alerts and forwards to Slack",
      security: {
        secretConfigured,
        authMethod: secretConfigured ? "query param 'token' or header 'x-uptimerobot-token'" : "WARNING: No secret configured",
      },
    },
    { status: 200 }
  );
}
