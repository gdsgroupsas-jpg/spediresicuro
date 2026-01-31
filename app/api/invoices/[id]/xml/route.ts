/**
 * API Route: Download Invoice XML (FatturaPA)
 *
 * GET /api/invoices/[id]/xml
 *
 * Scarica XML FatturaPA per una fattura emessa.
 *
 * SECURITY:
 * - Verifica autenticazione
 * - Utenti vedono solo proprie fatture
 * - Admin vede tutte le fatture
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { getSafeAuth } from '@/lib/safe-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSafeAuth();

    if (!context?.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const { id: invoiceId } = await params;

    // Recupera fattura
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(
        `
        id,
        user_id,
        invoice_number,
        xml_url,
        status,
        user:users(id, email, account_type)
      `
      )
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 });
    }

    // Verifica permessi
    const isAdmin =
      (invoice.user as any)?.account_type === 'admin' ||
      (invoice.user as any)?.account_type === 'superadmin';
    const isOwner = invoice.user_id === context.actor.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    // Verifica che la fattura sia emessa
    if (invoice.status !== 'issued') {
      return NextResponse.json(
        { error: 'Solo fatture emesse hanno XML disponibile' },
        { status: 400 }
      );
    }

    // Se XML non esiste, genera
    if (!invoice.xml_url) {
      const { generateXMLForInvoice } = await import('@/app/actions/invoices');
      const result = await generateXMLForInvoice(invoiceId);

      if (!result.success || !result.xmlUrl) {
        return NextResponse.json(
          { error: result.error || 'Errore generazione XML' },
          { status: 500 }
        );
      }

      // Recupera XML appena generato
      const xmlPath = result.xmlUrl.split('/').slice(-3).join('/'); // Estrai path da URL
      const { data: xmlData, error: downloadError } = await supabaseAdmin.storage
        .from('documents')
        .download(xmlPath);

      if (downloadError || !xmlData) {
        return NextResponse.json({ error: 'Errore download XML' }, { status: 500 });
      }

      const arrayBuffer = await xmlData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="${invoice.invoice_number || 'fattura'}.xml"`,
        },
      });
    }

    // Download XML esistente
    const xmlPath = invoice.xml_url.split('/').slice(-3).join('/');
    const { data: xmlData, error: downloadError } = await supabaseAdmin.storage
      .from('documents')
      .download(xmlPath);

    if (downloadError || !xmlData) {
      return NextResponse.json({ error: 'Errore download XML' }, { status: 500 });
    }

    const arrayBuffer = await xmlData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/xml',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number || 'fattura'}.xml"`,
      },
    });
  } catch (error: any) {
    console.error('Errore download XML fattura:', error);
    return NextResponse.json({ error: error.message || 'Errore sconosciuto' }, { status: 500 });
  }
}
