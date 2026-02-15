/**
 * API: Contact Search (Autocomplete)
 *
 * GET /api/contacts/search?q=keyword&limit=10
 * Returns lightweight contact results for autocomplete.
 * Superadmin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const context = await getWorkspaceAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (context.actor.account_type !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    if (!q || q.length < 1) {
      return NextResponse.json({ results: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email, company')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%`)
      .order('last_name', { ascending: true })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      results: (data || []).map((c) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`,
        email: c.email,
        company: c.company,
      })),
    });
  } catch (err: any) {
    console.error('[CONTACTS-SEARCH] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
