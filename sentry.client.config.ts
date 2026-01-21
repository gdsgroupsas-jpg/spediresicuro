import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // FREE TIER: Only errors, no performance monitoring (0 cost)
  // To enable performance: set to 0.1 (costs transactions)
  tracesSampleRate: 0.0,

  // Profiling disabled (requires performance monitoring)
  profilesSampleRate: 0.0,

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Session Replay: DISABLED (costs replay sessions)
  // To enable: set replaysOnErrorSampleRate to 1.0
  replaysSessionSampleRate: 0.0,
  replaysOnErrorSampleRate: 0.0,
});
