/**
 * API: List Emails
 *
 * GET /api/email?folder=inbox&search=keyword&unread=true
 * Superadmin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (context.actor.account_type !== 'superadmin') {
      return NextResponse.json(
        { error: 'Solo i superadmin possono accedere alla posta' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'inbox';
    const search = searchParams.get('search');
    const unread = searchParams.get('unread');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabaseAdmin
      .from('emails')
      .select(
        'id, message_id, direction, from_address, to_address, subject, body_text, status, read, starred, folder, created_at',
        { count: 'exact' }
      )
      .eq('folder', folder)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread === 'true') {
      query = query.eq('read', false);
    }

    if (search) {
      query = query.or(
        `subject.ilike.%${search}%,from_address.ilike.%${search}%,body_text.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get unread counts per folder
    const { data: unreadCounts } = await supabaseAdmin
      .from('emails')
      .select('folder')
      .eq('read', false);

    const folderCounts: Record<string, number> = {};
    if (unreadCounts) {
      for (const row of unreadCounts) {
        folderCounts[row.folder] = (folderCounts[row.folder] || 0) + 1;
      }
    }

    return NextResponse.json({
      emails: data || [],
      total: count || 0,
      unreadCounts: folderCounts,
    });
  } catch (err: any) {
    console.error('[EMAIL-LIST] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
