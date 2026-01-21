/**
 * API Route: Admin Shipment Management
 *
 * DELETE /api/admin/shipments/[id] - Cancella spedizione come admin (qualsiasi utente)
 *
 * ⚠️ SOLO PER ADMIN: Verifica che l'utente sia admin prima di eseguire operazioni
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { findUserByEmail } from '@/lib/database';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. Verifica autenticazione
    const context = await getSafeAuth();

    if (!context || !context.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // 2. Verifica che l'utente sia admin
    const adminUser = await findUserByEmail(context.actor.email);

    if (!adminUser || adminUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Accesso negato. Solo gli admin possono cancellare spedizioni di altri utenti.' },
        { status: 403 }
      );
    }

    // 3. Ottieni ID spedizione
    const shipmentId = params.id;

    if (!shipmentId) {
      return NextResponse.json({ error: 'ID spedizione mancante' }, { status: 400 });
    }

    // 4. Verifica che la spedizione esista
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase non configurato' }, { status: 503 });
    }

    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from('shipments')
      .select('id, user_id, tracking_number, status')
      .eq('id', shipmentId)
      .single();

    if (shipmentError || !shipment) {
      return NextResponse.json({ error: 'Spedizione non trovata' }, { status: 404 });
    }

    // 5. Soft delete spedizione (come admin, può cancellare qualsiasi spedizione)
    const { error: deleteError } = await supabaseAdmin
      .from('shipments')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: adminUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipmentId)
      .eq('deleted', false); // Solo se non è già eliminata

    if (deleteError) {
      console.error('Errore cancellazione spedizione:', deleteError);
      return NextResponse.json(
        { error: 'Errore durante la cancellazione della spedizione' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Spedizione ${shipment.tracking_number || shipmentId} cancellata con successo`,
    });
  } catch (error: any) {
    console.error('Errore API admin delete shipment:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
