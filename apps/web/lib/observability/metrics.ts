/**
 * Business Metrics via Sentry Custom Instrumentation
 *
 * Traccia KPI di business come custom transactions e breadcrumbs.
 * Zero dipendenze aggiuntive — usa Sentry gia' integrato.
 *
 * Sentry v10: usa attributes (non tags), count (non increment)
 */

import * as Sentry from '@sentry/nextjs';

export function trackShipmentCreated(provider: string, durationMs: number, success: boolean) {
  Sentry.metrics.count('shipment.created', 1, {
    attributes: { provider, status: success ? 'success' : 'failure' },
  });
  Sentry.metrics.distribution('shipment.duration_ms', durationMs, {
    attributes: { provider },
    unit: 'millisecond',
  });
}

export function trackExternalApiCall(
  provider: string,
  endpoint: string,
  durationMs: number,
  statusCode: number
) {
  Sentry.metrics.distribution('external_api.duration_ms', durationMs, {
    attributes: { provider, endpoint, status_group: `${Math.floor(statusCode / 100)}xx` },
    unit: 'millisecond',
  });
  if (statusCode >= 500) {
    Sentry.metrics.count('external_api.server_error', 1, {
      attributes: { provider, endpoint },
    });
  }
}

export function trackCircuitBreakerState(provider: string, state: string) {
  Sentry.metrics.gauge('circuit_breaker.state', state === 'OPEN' ? 1 : 0, {
    attributes: { provider },
  });
}

export function trackWalletLowBalance(userId: string, balance: number) {
  if (balance < 10) {
    Sentry.metrics.count('wallet.low_balance', 1, {
      attributes: { threshold: balance < 0 ? 'negative' : 'below_10' },
    });
  }
}
