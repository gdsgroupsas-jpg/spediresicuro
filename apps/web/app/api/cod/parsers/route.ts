/**
 * API: COD Parsers - Lista parser disponibili
 *
 * GET /api/cod/parsers
 */

import { NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { getAvailableParsers } from '@/lib/cod/parsers';
import { rateLimit } from '@/lib/security/rate-limit';
import { isAdminOrAbove } from '@/lib/auth-helpers';

async function requireAdmin() {
  const auth = await getWorkspaceAuth();
  if (!auth) return null;
  if (!isAdminOrAbove(auth.target)) return null;
  return auth;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-parsers', auth.actor.id, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  return NextResponse.json({
    success: true,
    parsers: getAvailableParsers(),
  });
}
