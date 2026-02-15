/**
 * API Route: Ricerca Destinatari da Spedizioni Precedenti
 *
 * Endpoint: GET /api/recipients/search?q=query&limit=10
 *
 * Cerca tra i destinatari delle spedizioni precedenti dell'utente.
 * Restituisce destinatari unici ordinati per utilizzo piu recente.
 *
 * Sicurezza: requireWorkspaceAuth() - restituisce solo destinatari dell'utente
 * Cache: 5 min (dati cambiano con nuove spedizioni)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireWorkspaceAuth } from '@/lib/workspace-auth';
import type { SavedRecipient, RecipientSearchResponse } from '@/types/recipients';

export const dynamic = 'force-dynamic';

interface ShipmentRecipientRow {
  recipient_name: string;
  recipient_address: string;
  recipient_city: string;
  recipient_zip: string;
  recipient_province: string;
  recipient_phone: string;
  recipient_email?: string | null;
  created_at: string;
}

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const context = await requireWorkspaceAuth();
    const userId = context.target.id;

    // 2. Parse query params
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

    // 3. Query recente senza filtro se query vuota o corta
    if (query.length < 2) {
      // Restituisce i 5 destinatari piu recenti
      const { data, error } = await supabaseAdmin
        .from('shipments')
        .select(
          `
          recipient_name,
          recipient_address,
          recipient_city,
          recipient_zip,
          recipient_province,
          recipient_phone,
          recipient_email,
          created_at
        `
        )
        .eq('user_id', userId)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .limit(50); // Fetch di piu per deduplicare

      if (error) throw error;

      const recipients = deduplicateRecipients((data as ShipmentRecipientRow[]) || []).slice(0, 5);

      return NextResponse.json<RecipientSearchResponse>({
        results: recipients,
        query: '',
        count: recipients.length,
      });
    }

    // 4. Ricerca con ILIKE
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .select(
        `
        recipient_name,
        recipient_address,
        recipient_city,
        recipient_zip,
        recipient_province,
        recipient_phone,
        recipient_email,
        created_at
      `
      )
      .eq('user_id', userId)
      .eq('deleted', false)
      .ilike('recipient_name', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(100); // Fetch di piu per deduplicare

    if (error) throw error;

    // 5. Deduplica e formatta risultati
    const recipients = deduplicateRecipients((data as ShipmentRecipientRow[]) || []).slice(
      0,
      limit
    );

    return NextResponse.json<RecipientSearchResponse>(
      {
        results: recipients,
        query,
        count: recipients.length,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300', // 5 min cache
        },
      }
    );
  } catch (error) {
    console.error('[API] recipients/search error:', error);

    if (error instanceof Error && error.message.includes('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Errore nella ricerca destinatari' }, { status: 500 });
  }
}

/**
 * Deduplica destinatari per chiave composta nome+indirizzo+citta
 * Mantiene l'occorrenza piu recente e conta gli utilizzi
 */
function deduplicateRecipients(shipments: ShipmentRecipientRow[]): SavedRecipient[] {
  const recipientMap = new Map<string, SavedRecipient & { _count: number }>();

  for (const shipment of shipments) {
    // Salta righe con dati mancanti
    if (!shipment.recipient_name || !shipment.recipient_address || !shipment.recipient_city) {
      continue;
    }

    // Chiave composta per deduplicazione
    const key = `${shipment.recipient_name.toLowerCase()}|${shipment.recipient_address.toLowerCase()}|${shipment.recipient_city.toLowerCase()}`;

    const existing = recipientMap.get(key);

    if (existing) {
      existing._count++;
      existing.usageCount = existing._count;
      // Aggiorna se piu recente
      if (new Date(shipment.created_at) > new Date(existing.lastUsed)) {
        existing.lastUsed = shipment.created_at;
      }
    } else {
      recipientMap.set(key, {
        id: Buffer.from(key).toString('base64').slice(0, 16),
        name: shipment.recipient_name,
        address: shipment.recipient_address,
        city: shipment.recipient_city,
        province: shipment.recipient_province || '',
        zip: shipment.recipient_zip || '',
        phone: shipment.recipient_phone || '',
        email: shipment.recipient_email || undefined,
        lastUsed: shipment.created_at,
        usageCount: 1,
        _count: 1,
      });
    }
  }

  // Converti in array, ordina per recenza poi per frequenza
  return Array.from(recipientMap.values())
    .sort((a, b) => {
      // Primario: piu recenti prima
      const dateDiff = new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
      if (dateDiff !== 0) return dateDiff;
      // Secondario: piu usati prima
      return b.usageCount - a.usageCount;
    })
    .map(({ _count, ...recipient }) => recipient);
}
