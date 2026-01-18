import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Performance Monitoring: 10% of transactions traced
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

  // Profiling: 10% of transactions profiled
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),

  // Environment
  environment: process.env.NODE_ENV || 'development',

  // Release tracking (Vercel auto-populates VERCEL_GIT_COMMIT_SHA)
  release: process.env.VERCEL_GIT_COMMIT_SHA,

  // Filter out health check and cron requests from performance monitoring
  beforeSendTransaction(event) {
    const url = event.request?.url || '';
    if (url.includes('/api/health') || url.includes('/api/cron')) {
      return null; // Don't send health checks to Sentry
    }
    return event;
  },
});
