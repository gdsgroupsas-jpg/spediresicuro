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

  // Performance Monitoring: 10% sample rate for production insights
  // Adjust based on traffic volume and Sentry quota
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,

  // Profiling: 10% of transactions (requires performance monitoring)
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Session Replay: Capture 100% of error sessions for debugging
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0.0,

  // Integrations for better performance data
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
