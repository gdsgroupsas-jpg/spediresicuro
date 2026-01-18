/**
 * UptimeRobot Webhook Endpoint
 *
 * Receives alerts from UptimeRobot when monitors go down/up.
 * Forwards critical alerts to Slack.
 *
 * Endpoint: POST /api/webhooks/uptimerobot
 *
 * Milestone: M3 - Uptime & Health Monitoring
 */
import { NextRequest, NextResponse } from "next/server";

// UptimeRobot alert types
// 1 = Down, 2 = Up, 3 = SSL Certificate expires soon
type AlertType = "1" | "2" | "3";

interface UptimeRobotPayload {
  monitorID: string;
  monitorURL: string;
  monitorFriendlyName: string;
  alertType: AlertType;
  alertTypeFriendlyName: string;
  alertDetails: string;
  alertDuration?: string; // Duration of downtime in seconds (only on recovery)
}

async function sendSlackNotification(payload: UptimeRobotPayload): Promise<boolean> {
  const webhookUrl = process.env.SLACK_FINANCIAL_ALERTS_WEBHOOK || process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn("[UPTIMEROBOT_WEBHOOK] Slack webhook not configured");
    return false;
  }

  const isDown = payload.alertType === "1";
  const isUp = payload.alertType === "2";
  const isSSL = payload.alertType === "3";

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
    const seconds = parseInt(payload.alertDuration, 10);
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

    console.log("[UPTIMEROBOT_WEBHOOK] Received alert:", {
      monitor: payload.monitorFriendlyName,
      type: payload.alertTypeFriendlyName,
      url: payload.monitorURL,
    });

    // Log to console for Better Stack/Logtail ingestion
    const logEntry = {
      event: "uptime_alert",
      source: "uptimerobot",
      monitorId: payload.monitorID,
      monitorName: payload.monitorFriendlyName,
      monitorUrl: payload.monitorURL,
      alertType: payload.alertType,
      alertTypeFriendlyName: payload.alertTypeFriendlyName,
      alertDetails: payload.alertDetails,
      alertDuration: payload.alertDuration,
      timestamp: new Date().toISOString(),
    };

    console.log("[UPTIME_ALERT]", JSON.stringify(logEntry));

    // Forward to Slack for critical alerts (down events)
    if (payload.alertType === "1") {
      await sendSlackNotification(payload);
    }

    // Also notify on recovery if downtime was significant (> 5 minutes)
    if (payload.alertType === "2" && payload.alertDuration) {
      const seconds = parseInt(payload.alertDuration, 10);
      if (seconds > 300) {
        // > 5 minutes
        await sendSlackNotification(payload);
      }
    }

    // SSL expiration warning
    if (payload.alertType === "3") {
      await sendSlackNotification(payload);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Alert received and processed",
        monitorId: payload.monitorID,
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
  return NextResponse.json(
    {
      status: "ok",
      endpoint: "UptimeRobot Webhook",
      description: "Receives UptimeRobot alerts and forwards to Slack",
    },
    { status: 200 }
  );
}
