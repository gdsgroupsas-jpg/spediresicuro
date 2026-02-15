/**
 * API: COD Distinta Export - Esporta distinta in Excel
 *
 * GET /api/cod/distinte/export?id=uuid
 */

import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-export', auth.actor.id, {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID distinta richiesto' }, { status: 400 });
    }

    // Fetch distinta
    const { data: distinta, error: dError } = await supabaseAdmin
      .from('cod_distinte')
      .select('*')
      .eq('id', id)
      .single();

    if (dError || !distinta) {
      return NextResponse.json({ error: 'Distinta non trovata' }, { status: 404 });
    }

    // Fetch items della distinta
    const { data: items, error: iError } = await supabaseAdmin
      .from('cod_items')
      .select('ldv, rif_mittente, contrassegno, pagato, destinatario, note, data_ldv, status')
      .eq('distinta_id', id)
      .order('created_at', { ascending: true });

    if (iError) {
      return NextResponse.json({ error: iError.message }, { status: 500 });
    }

    // Genera Excel con xlsx
    const XLSX = await import('xlsx');
    const rows = (items || []).map((item) => ({
      LDV: item.ldv,
      'Rif. Mittente': item.rif_mittente || '',
      Contrassegno: item.contrassegno,
      Pagato: item.pagato,
      Destinatario: item.destinatario || '',
      Note: item.note || '',
      'Data LDV': item.data_ldv ? new Date(item.data_ldv).toLocaleDateString('it-IT') : '',
      Stato: item.status,
    }));

    // Riga totale
    rows.push({
      LDV: 'TOTALE',
      'Rif. Mittente': '',
      Contrassegno: (items || []).reduce((sum, i) => sum + (i.contrassegno || 0), 0),
      Pagato: (items || []).reduce((sum, i) => sum + (i.pagato || 0), 0),
      Destinatario: '',
      Note: '',
      'Data LDV': '',
      Stato: '',
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `Distinta ${distinta.number}`);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="distinta_${distinta.number}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error('[COD Export] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
