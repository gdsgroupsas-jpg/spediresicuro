import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring: 5% di transazioni tracciate (client = più volume)
  tracesSampleRate: 0.05,

  // Replay: cattura sessioni su errore (molto utile per debug UX)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01, // 1% sessioni normali

  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Ignora errori di rete e browser noise
  ignoreErrors: ['ResizeObserver loop', 'Network request failed', 'Load failed', 'AbortError'],
});
