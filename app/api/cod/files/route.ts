/**
 * API: COD Files - Lista file caricati
 *
 * GET /api/cod/files
 */

import { NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { rateLimit } from '@/lib/security/rate-limit';

async function requireAdmin() {
  const auth = await getWorkspaceAuth();
  if (!auth) return null;
  const role = auth.target.role;
  if (role !== 'admin' && role !== 'superadmin') return null;
  return auth;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-files', auth.actor.id, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('cod_files')
      .select('*')
      .order('uploaded_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[COD Files] Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      files: data || [],
    });
  } catch (error: any) {
    console.error('[COD Files] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
