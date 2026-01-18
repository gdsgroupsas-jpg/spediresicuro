/**
 * Dependencies Health Check
 *
 * Endpoint: GET /api/health/dependencies
 * Verifica lo stato delle dipendenze esterne (API corrieri, Supabase, Redis, etc.)
 *
 * Milestone: M3 - Uptime & Health Monitoring
 */
import { NextResponse } from "next/server";
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase";

interface DependencyStatus {
  name: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latencyMs?: number;
  message?: string;
  lastChecked: string;
}

interface DependenciesResponse {
  status: "ok" | "degraded" | "unhealthy";
  timestamp: string;
  environment: string;
  dependencies: DependencyStatus[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

async function checkSupabase(): Promise<DependencyStatus> {
  const start = Date.now();
  const name = "supabase";

  if (!isSupabaseConfigured()) {
    return {
      name,
      status: process.env.NODE_ENV === "production" ? "unhealthy" : "degraded",
      message: "Supabase not configured",
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { error } = await supabaseAdmin
      .from("shipments")
      .select("id")
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      return {
        name,
        status: "unhealthy",
        latencyMs,
        message: `Query failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name,
      status: latencyMs > 2000 ? "degraded" : "healthy",
      latencyMs,
      message: latencyMs > 2000 ? "High latency" : "Connected",
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      name,
      status: "unhealthy",
      latencyMs: Date.now() - start,
      message: `Exception: ${error.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkSpedisciOnlineAPI(): Promise<DependencyStatus> {
  const start = Date.now();
  const name = "spediscionline-api";

  const apiKey = process.env.SPEDISCIONLINE_API_KEY;
  const baseUrl = process.env.SPEDISCIONLINE_BASE_URL || "https://api.spediscionline.com";

  if (!apiKey) {
    return {
      name,
      status: "unknown",
      message: "API key not configured",
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    // Use a lightweight endpoint to check API availability
    // We just check if the API responds, not full functionality
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/json",
      },
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (!response) {
      return {
        name,
        status: "degraded",
        latencyMs,
        message: "API not reachable or no health endpoint",
        lastChecked: new Date().toISOString(),
      };
    }

    // Even a 401/403 means API is up, just auth issues
    if (response.status >= 500) {
      return {
        name,
        status: "unhealthy",
        latencyMs,
        message: `Server error: ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name,
      status: latencyMs > 3000 ? "degraded" : "healthy",
      latencyMs,
      message: latencyMs > 3000 ? "High latency" : "Reachable",
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      name,
      status: "degraded",
      latencyMs: Date.now() - start,
      message: error.name === "AbortError" ? "Timeout (5s)" : error.message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  const name = "redis";
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;

  if (!redisUrl) {
    return {
      name,
      status: "unknown",
      message: "Redis not configured (optional)",
      lastChecked: new Date().toISOString(),
    };
  }

  const start = Date.now();

  try {
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${redisUrl}/ping`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - start;

    if (response.ok) {
      return {
        name,
        status: latencyMs > 1000 ? "degraded" : "healthy",
        latencyMs,
        message: latencyMs > 1000 ? "High latency" : "Connected",
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name,
      status: "degraded",
      latencyMs,
      message: `HTTP ${response.status}`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      name,
      status: "degraded",
      latencyMs: Date.now() - start,
      message: error.name === "AbortError" ? "Timeout (3s)" : error.message,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkSlackWebhook(): Promise<DependencyStatus> {
  const name = "slack-webhook";
  const webhookUrl = process.env.SLACK_FINANCIAL_ALERTS_WEBHOOK || process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      name,
      status: "unknown",
      message: "Slack webhook not configured",
      lastChecked: new Date().toISOString(),
    };
  }

  // We don't actually call Slack to avoid sending messages
  // Just verify the URL format is valid
  const isValidUrl = webhookUrl.startsWith("https://hooks.slack.com/");

  return {
    name,
    status: isValidUrl ? "healthy" : "degraded",
    message: isValidUrl ? "Webhook configured" : "Invalid webhook URL format",
    lastChecked: new Date().toISOString(),
  };
}

async function checkSentry(): Promise<DependencyStatus> {
  const name = "sentry";
  const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!sentryDsn) {
    return {
      name,
      status: "unknown",
      message: "Sentry not configured",
      lastChecked: new Date().toISOString(),
    };
  }

  // Validate DSN format
  const isValidDsn = sentryDsn.includes("@") && sentryDsn.includes(".sentry.io");

  return {
    name,
    status: isValidDsn ? "healthy" : "degraded",
    message: isValidDsn ? "DSN configured" : "Invalid DSN format",
    lastChecked: new Date().toISOString(),
  };
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || "development";

  // Run all checks in parallel for speed
  const [supabase, spedisciOnline, redis, slack, sentry] = await Promise.all([
    checkSupabase(),
    checkSpedisciOnlineAPI(),
    checkRedis(),
    checkSlackWebhook(),
    checkSentry(),
  ]);

  const dependencies = [supabase, spedisciOnline, redis, slack, sentry];

  // Calculate summary
  const summary = {
    total: dependencies.length,
    healthy: dependencies.filter((d) => d.status === "healthy").length,
    degraded: dependencies.filter((d) => d.status === "degraded" || d.status === "unknown").length,
    unhealthy: dependencies.filter((d) => d.status === "unhealthy").length,
  };

  // Determine overall status
  let status: "ok" | "degraded" | "unhealthy" = "ok";

  // Critical dependencies that must be healthy
  const criticalDeps = ["supabase"];
  const criticalUnhealthy = dependencies.filter(
    (d) => criticalDeps.includes(d.name) && d.status === "unhealthy"
  );

  if (criticalUnhealthy.length > 0) {
    status = "unhealthy";
  } else if (summary.unhealthy > 0 || summary.degraded > 2) {
    status = "degraded";
  }

  const response: DependenciesResponse = {
    status,
    timestamp,
    environment,
    dependencies,
    summary,
  };

  // In production, return 503 if unhealthy
  const statusCode = status === "unhealthy" && environment === "production" ? 503 : 200;

  return NextResponse.json(response, { status: statusCode });
}
