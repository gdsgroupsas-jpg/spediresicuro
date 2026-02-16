/**
 * Rate Limit Middleware Helper per API Routes
 *
 * Wrapper che integra lib/security/rate-limit.ts nelle Next.js API routes.
 * Fail-open: se il rate limiter ha problemi, la request passa.
 *
 * Uso:
 *   import { withRateLimit } from '@/lib/security/rate-limit-middleware';
 *
 *   // All'inizio del handler:
 *   const rlResult = await withRateLimit(request, 'shipments-create', { limit: 60, windowSeconds: 60 });
 *   if (rlResult) return rlResult; // 429 gia' formattato
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, type RateLimitOptions } from '@/lib/security/rate-limit';
import { auth } from '@/lib/auth-config';

export async function withRateLimit(
  request: NextRequest,
  route: string,
  options: RateLimitOptions = {}
): Promise<NextResponse | null> {
  // Feature flag per disabilitare
  if (process.env.RATE_LIMIT_ENABLED === 'false') return null;

  try {
    // Identifica utente: userId da session, fallback su IP
    const session = await auth();
    const identifier =
      (session?.user as any)?.id ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'anonymous';

    const result = await rateLimit(route, identifier, options);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Troppe richieste. Riprova tra qualche secondo.',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': String(result.remaining),
          },
        }
      );
    }

    return null; // Allowed
  } catch (error) {
    // Fail-open: non bloccare mai per errori del rate limiter
    console.warn('⚠️ [RATE-LIMIT-MW] Error, allowing request:', error);
    return null;
  }
}
