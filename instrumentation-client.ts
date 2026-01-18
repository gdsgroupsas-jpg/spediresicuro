/**
 * Next.js Client Instrumentation Hook
 * M2: Sentry init for client-side (browser)
 *
 * IMPORTANT: This file replaces sentry.client.config.ts
 * Next.js 15+ requires client-side Sentry.init to be called in instrumentation-client.ts
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // M2: Performance monitoring enabled (10% sampling, FREE tier: 10K/month)
  tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

  // Profiling disabled (keep cost at €0)
  profilesSampleRate: 0.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Session Replay: DISABLED (costs replay sessions)
  // To enable: set replaysOnErrorSampleRate to 1.0
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 0.0,

  // Integrations
  integrations: [
    Sentry.browserTracingIntegration({
      // Trace navigation and interactions
      traceFetch: true,
      traceXHR: true,
    }),
  ],
});
