import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // FREE TIER: Only errors, no performance monitoring
  // To enable performance: set to 0.1 (costs transactions)
  tracesSampleRate: 0.0,

  // Note: Profiling not available in Edge runtime

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA,
});
