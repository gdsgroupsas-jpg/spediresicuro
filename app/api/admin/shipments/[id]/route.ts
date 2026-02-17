/**
 * API Route: Admin Shipment Management
 *
 * DELETE /api/admin/shipments/[id] - Cancella spedizione come admin (qualsiasi utente)
 *
 * ⚠️ SOLO PER ADMIN: Verifica che l'utente sia admin prima di eseguire operazioni
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { findUserByEmail } from '@/lib/database';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import { workspaceQuery } from '@/lib/db/workspace-query';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verifica autenticazione
    const context = await getWorkspaceAuth();

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
    const { id: shipmentId } = await params;

    if (!shipmentId) {
      return NextResponse.json({ error: 'ID spedizione mancante' }, { status: 400 });
    }

    // 4. Verifica che la spedizione esista
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase non configurato' }, { status: 503 });
    }

    // Isolamento multi-tenant: admin opera nel proprio workspace
    const adminWorkspaceId = context.workspace?.id;
    const wq = adminWorkspaceId ? workspaceQuery(adminWorkspaceId) : supabaseAdmin;

    const { data: shipment, error: shipmentError } = await wq
      .from('shipments')
      .select('id, user_id, tracking_number, shipment_id_external, status, final_price')
      .eq('id', shipmentId)
      .single();

    if (shipmentError || !shipment) {
      return NextResponse.json({ error: 'Spedizione non trovata' }, { status: 404 });
    }

    // 5. Soft delete spedizione (come admin, nel proprio workspace)
    const { error: deleteError } = await wq
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

    // ============================================
    // RIMBORSO WALLET: riaccredita final_price al proprietario
    // ============================================
    let walletRefundResult: { success: boolean; amount?: number; error?: string } | null = null;
    const refundAmount = shipment.final_price;

    if (refundAmount && refundAmount > 0 && shipment.user_id) {
      try {
        // Verifica account_type: superadmin non paga dal wallet, quindi non riceve rimborso
        const { data: shipmentOwner } = await supabaseAdmin
          .from('users')
          .select('account_type')
          .eq('id', shipment.user_id)
          .maybeSingle();

        const ownerIsSuperadmin = shipmentOwner?.account_type?.toLowerCase() === 'superadmin';

        if (ownerIsSuperadmin) {
          console.log(
            'ℹ️ [WALLET] Skip rimborso: proprietario è superadmin (wallet non debitato alla creazione)'
          );
        } else {
          // ✨ FIX CONTABILE: Usa refund_wallet_balance con tipo SHIPMENT_REFUND
          const idempotencyKey = `cancel-${shipmentId}`;
          const trackingRef = shipment.tracking_number || '';
          const refundDescription =
            `Rimborso cancellazione spedizione ${trackingRef} (admin: ${context.actor.email})`.trim();

          // M2 FIX: Usa refund_wallet_balance_v2 (lock su workspaces, source of truth)
          const refundWorkspaceId = await getUserWorkspaceId(shipment.user_id);
          const { data: refundResult, error: refundError } = await supabaseAdmin.rpc(
            'refund_wallet_balance_v2',
            {
              p_workspace_id: refundWorkspaceId,
              p_user_id: shipment.user_id,
              p_amount: refundAmount,
              p_idempotency_key: idempotencyKey,
              p_description: refundDescription,
              p_shipment_id: shipmentId,
            }
          );

          if (refundError) {
            console.error('❌ [WALLET] Errore rimborso admin cancellazione:', refundError.message);
            await supabaseAdmin.from('compensation_queue').insert({
              user_id: shipment.user_id,
              shipment_id_external: shipment.shipment_id_external || 'UNKNOWN',
              tracking_number: shipment.tracking_number || 'UNKNOWN',
              action: 'REFUND',
              original_cost: refundAmount,
              error_context: {
                reason: 'admin_cancellation_refund_failed',
                refund_error: refundError.message,
                admin_email: context.actor.email,
              },
              status: 'PENDING',
            } as any);
            walletRefundResult = {
              success: false,
              amount: refundAmount,
              error: refundError.message,
            };
          } else {
            const isReplay = refundResult?.idempotent_replay;
            console.log(
              `✅ [WALLET] Rimborso admin €${refundAmount} per spedizione ${shipmentId}${isReplay ? ' (idempotent replay)' : ''}`
            );
            walletRefundResult = { success: true, amount: refundAmount };
          }
        }
      } catch (refundErr: any) {
        console.error('❌ [WALLET] Eccezione rimborso admin:', refundErr?.message);
        walletRefundResult = { success: false, amount: refundAmount, error: refundErr?.message };
      }
    }

    return NextResponse.json({
      success: true,
      message: `Spedizione ${shipment.tracking_number || shipmentId} cancellata con successo`,
      walletRefund: walletRefundResult,
    });
  } catch (error: any) {
    console.error('Errore API admin delete shipment:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}
