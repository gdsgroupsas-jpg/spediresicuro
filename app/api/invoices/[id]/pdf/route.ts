/**
 * API Endpoint: Download PDF Fattura
 *
 * GET /api/invoices/[id]/pdf
 *
 * Scarica il PDF di una fattura esistente.
 * RLS: utente può scaricare solo le proprie fatture, admin può scaricare tutte.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerActionClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireWorkspaceAuth } from '@/lib/workspace-auth';
import { isAdminOrAbove } from '@/lib/auth-helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireWorkspaceAuth();
    const { id: invoiceId } = await params;

    // 1. Recupera fattura
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*, user:users(id, email)')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    }

    // 2. Verifica permessi (utente può vedere solo le proprie, admin tutte)
    const isAdmin = isAdminOrAbove(context.actor);
    const isOwner = invoice.user_id === context.target.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    // 3. Se PDF esiste, scarica da storage
    if (invoice.pdf_url) {
      // Estrai path da URL pubblico
      const url = new URL(invoice.pdf_url);
      const pathParts = url.pathname.split('/');
      const bucket = pathParts[pathParts.length - 2];
      const filePath = pathParts[pathParts.length - 1];

      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from(bucket)
        .download(filePath);

      if (downloadError || !fileData) {
        console.error('Errore download PDF:', downloadError);
        return NextResponse.json({ error: 'Errore download PDF' }, { status: 500 });
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="fattura-${invoice.invoice_number || invoiceId}.pdf"`,
        },
      });
    }

    // 4. Se PDF non esiste, genera al volo
    const { generateInvoiceForShipment } = await import('@/app/actions/invoices');

    // Cerca spedizione associata
    const { data: items } = await supabaseAdmin
      .from('invoice_items')
      .select('shipment_id')
      .eq('invoice_id', invoiceId)
      .limit(1)
      .single();

    if (items?.shipment_id) {
      // Rigenera PDF (questo creerà una nuova fattura, quindi meglio non farlo)
      // Per ora ritorna errore
      return NextResponse.json(
        { error: 'PDF non disponibile. Contattare supporto per rigenerazione.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: 'PDF non disponibile' }, { status: 404 });
  } catch (error: any) {
    console.error('Errore download PDF fattura:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
