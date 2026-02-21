/**
 * Login Tracker - Aggiorna last_login_at per metriche Active Users
 *
 * Funzionalita:
 * - Aggiorna last_login_at ad ogni login riuscito
 * - Fail-safe: non blocca il login se l'update fallisce
 * - Feature flag: disattivabile via TRACK_LAST_LOGIN=false
 * - Observability: logging dettagliato + Sentry tracking
 *
 * Rollback: impostare TRACK_LAST_LOGIN=false in env vars
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Aggiorna il campo last_login_at per l'utente specificato.
 *
 * IMPORTANTE: Questa funzione e' progettata per essere fail-safe.
 * Se l'update fallisce, logga l'errore ma NON blocca il login.
 *
 * @param email - Email dell'utente che ha fatto login
 */
export async function updateLastLogin(email: string): Promise<void> {
  // Feature flag: permette rollback istantaneo
  if (process.env.TRACK_LAST_LOGIN === 'false') {
    return;
  }

  // Validazione input
  if (!email || typeof email !== 'string') {
    console.warn('[LOGIN-TRACKER] Invalid email provided, skipping update');
    return;
  }

  const startTime = Date.now();

  try {
    const { supabaseAdmin } = await import('@/lib/db/client');

    const { error } = await supabaseAdmin
      .from('users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('email', email);

    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;
    console.log('[LOGIN-TRACKER] Updated last_login_at', {
      email,
      duration_ms: duration,
    });
  } catch (error: any) {
    // Log error but DON'T block login
    const duration = Date.now() - startTime;
    console.error('[LOGIN-TRACKER] Failed to update last_login_at', {
      email,
      error: error.message,
      code: error.code,
      duration_ms: duration,
    });

    // Track in Sentry for alerting (low severity - non-blocking)
    Sentry.captureException(error, {
      level: 'warning',
      tags: {
        operation: 'update_last_login',
        severity: 'low',
      },
      extra: {
        email,
        duration_ms: duration,
      },
    });

    // NON rilanciare l'errore - il login deve continuare
  }
}
