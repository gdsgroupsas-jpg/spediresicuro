/**
 * API: COD Upload - Carica e parsa file contrassegni
 *
 * POST /api/cod/upload
 * Body: multipart/form-data con file + carrier (id parser)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { rateLimit } from '@/lib/security/rate-limit';
import { getParser } from '@/lib/cod/parsers';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';
import { isAdminOrAbove } from '@/lib/auth-helpers';

async function requireAdmin() {
  const auth = await getWorkspaceAuth();
  if (!auth) return null;
  if (!isAdminOrAbove(auth.target)) return null;
  return auth;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-upload', auth.actor.id, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const carrier = formData.get('carrier') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File richiesto' }, { status: 400 });
    }
    if (!carrier) {
      return NextResponse.json({ error: 'Fornitore richiesto' }, { status: 400 });
    }

    const parser = getParser(carrier);
    if (!parser) {
      return NextResponse.json({ error: `Parser non trovato per: ${carrier}` }, { status: 400 });
    }

    // Leggi file come buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parsa il file
    const result = await parser.parse(buffer, file.name);

    if (result.rows.length === 0 && result.errors.length > 0) {
      return NextResponse.json(
        { error: 'Errore parsing file', details: result.errors },
        { status: 400 }
      );
    }

    // Crea record cod_files
    const { data: codFile, error: fileError } = await supabaseAdmin
      .from('cod_files')
      .insert({
        filename: file.name,
        carrier,
        uploaded_by: auth.actor.id,
        total_rows: result.totalRows,
        total_cod_file: result.totalCodFile,
        errors: result.errors.length,
      })
      .select('id')
      .single();

    if (fileError || !codFile) {
      console.error('[COD Upload] Errore creazione file:', fileError);
      return NextResponse.json({ error: 'Errore salvataggio file' }, { status: 500 });
    }

    // Per ogni riga, cerca match con spedizioni e inserisci cod_items
    let processedRows = 0;
    let totalCodSystem = 0;
    let totalCodToPay = 0;
    const insertErrors: string[] = [...result.errors];

    for (const row of result.rows) {
      // Cerca spedizione per ldv (tracking_number o ldv)
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .select('id, user_id, tracking_number, cash_on_delivery_amount')
        .or(`tracking_number.eq.${row.ldv},ldv.eq.${row.ldv}`)
        .limit(1)
        .maybeSingle();

      const shipmentId = shipment?.id || null;
      const clientId = shipment?.user_id || null;
      const systemAmount = shipment?.cash_on_delivery_amount || 0;

      if (shipmentId) {
        totalCodSystem += systemAmount;
        totalCodToPay += row.pagato;
        processedRows++;
      }

      const { data: insertedItem, error: itemError } = await supabaseAdmin
        .from('cod_items')
        .insert({
          cod_file_id: codFile.id,
          ldv: row.ldv,
          rif_mittente: row.rif_mittente,
          contrassegno: row.contrassegno,
          pagato: row.pagato,
          destinatario: row.destinatario,
          note: row.note,
          data_ldv: row.data_ldv,
          shipment_id: shipmentId,
          client_id: clientId,
          status: shipmentId ? 'assegnato' : 'in_attesa',
        })
        .select('id')
        .single();

      if (itemError) {
        insertErrors.push(`Errore riga ${row.ldv}: ${itemError.message}`);
        continue;
      }

      // Auto-crea disputes per discrepanze a livello item
      if (!shipmentId) {
        // LDV non trovato nel sistema
        await supabaseAdmin.from('cod_disputes').insert({
          cod_item_id: insertedItem?.id || null,
          cod_file_id: codFile.id,
          type: 'non_trovato',
          actual_amount: row.pagato,
          ldv: row.ldv,
          description: `LDV ${row.ldv} non trovato tra le spedizioni`,
        });
      } else if (Math.abs(row.pagato - systemAmount) > 0.01) {
        // Importo diverso tra file e sistema
        await supabaseAdmin.from('cod_disputes').insert({
          cod_item_id: insertedItem?.id || null,
          cod_file_id: codFile.id,
          type: 'importo_diverso',
          expected_amount: systemAmount,
          actual_amount: row.pagato,
          difference: Math.round((row.pagato - systemAmount) * 100) / 100,
          ldv: row.ldv,
          description: `Importo file €${row.pagato.toFixed(2)} vs sistema €${systemAmount.toFixed(2)}`,
        });
      }
    }

    // Aggiorna totali nel cod_file
    await supabaseAdmin
      .from('cod_files')
      .update({
        processed_rows: processedRows,
        total_cod_system: Math.round(totalCodSystem * 100) / 100,
        total_cod_to_pay: Math.round(totalCodToPay * 100) / 100,
        errors: insertErrors.length,
      })
      .eq('id', codFile.id);

    // Audit log
    await writeAuditLog({
      context: auth,
      action: AUDIT_ACTIONS.COD_FILE_UPLOADED,
      resourceType: AUDIT_RESOURCE_TYPES.COD_FILE,
      resourceId: codFile.id,
      metadata: {
        filename: file.name,
        carrier,
        totalRows: result.totalRows,
        processedRows,
        totalCodFile: result.totalCodFile,
        totalCodSystem: Math.round(totalCodSystem * 100) / 100,
        hasDiscrepancy: Math.abs(result.totalCodFile - totalCodSystem) > 0.01,
      },
    });

    return NextResponse.json({
      success: true,
      fileId: codFile.id,
      totalRows: result.totalRows,
      processedRows,
      totalCodFile: result.totalCodFile,
      totalCodSystem: Math.round(totalCodSystem * 100) / 100,
      totalCodToPay: Math.round(totalCodToPay * 100) / 100,
      errors: insertErrors,
      // Alert discrepanza
      discrepancy:
        Math.abs(result.totalCodFile - totalCodSystem) > 0.01
          ? {
              alert: true,
              fileTotalCod: result.totalCodFile,
              systemTotalCod: Math.round(totalCodSystem * 100) / 100,
              difference: Math.round((result.totalCodFile - totalCodSystem) * 100) / 100,
            }
          : null,
    });
  } catch (error: any) {
    console.error('[COD Upload] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
