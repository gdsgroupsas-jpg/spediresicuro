/**
 * Next.js Instrumentation Hook
 * M2: Sentry init for server-side and edge runtime
 *
 * IMPORTANT: This file replaces sentry.server.config.ts and sentry.edge.config.ts
 * Next.js 15+ requires Sentry.init to be called in instrumentation.ts
 */

export async function register() {
  // Server-side instrumentation (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.SENTRY_DSN,

      // M2: Performance monitoring enabled (10% sampling, FREE tier: 10K/month)
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

      // Profiling disabled (keep cost at €0)
      profilesSampleRate: 0.0,

      // Environment
      environment: process.env.NODE_ENV || 'development',

      // Release tracking
      release: process.env.VERCEL_GIT_COMMIT_SHA,

      // Integrations
      integrations: [
        // Automatic instrumentation for Node.js
        Sentry.httpIntegration(),
      ],
    });
  }

  // Edge runtime instrumentation
  if (process.env.NEXT_RUNTIME === 'edge') {
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.SENTRY_DSN,

      // M2: Performance monitoring enabled (10% sampling, FREE tier: 10K/month)
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

      // Note: Profiling not available in Edge runtime

      // Environment
      environment: process.env.NODE_ENV || 'development',

      // Release tracking
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    });
  }
}
