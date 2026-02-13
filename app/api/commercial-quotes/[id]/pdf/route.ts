/**
 * API Endpoint: Download PDF Preventivo Commerciale
 *
 * GET /api/commercial-quotes/[id]/pdf
 *
 * Scarica il PDF di un preventivo. Se esiste in Storage lo scarica,
 * altrimenti lo genera on-the-fly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { generateCommercialQuotePDF } from '@/lib/commercial-quotes/pdf-generator';
import type { CommercialQuote } from '@/types/commercial-quotes';
import type { OrganizationFooterInfo } from '@/types/workspace';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const { id: quoteId } = await params;
    const workspaceId = wsAuth.workspace.id;

    // Carica preventivo
    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return NextResponse.json({ error: 'Preventivo non trovato' }, { status: 404 });
    }

    // Se PDF esiste in Storage, scarica direttamente
    if (quote.pdf_storage_path) {
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('commercial-quotes')
        .download(quote.pdf_storage_path);

      if (!downloadError && fileData) {
        const arrayBuffer = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const fileName = `preventivo_${quote.prospect_company.replace(/[^a-zA-Z0-9]/g, '_')}_rev${quote.revision}.pdf`;

        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
      // Se errore download, genera al volo come fallback
    }

    // Genera PDF on-the-fly con branding + footer white-label
    const branding = wsAuth.workspace.branding || null;
    let orgInfo: OrganizationFooterInfo | null = null;
    try {
      const { data: orgData } = await supabaseAdmin
        .from('organizations')
        .select('name, vat_number, billing_email, billing_address')
        .eq('id', wsAuth.workspace.organization_id)
        .single();
      if (orgData) {
        orgInfo = {
          name: orgData.name,
          vat_number: orgData.vat_number || null,
          billing_email: orgData.billing_email || '',
          billing_address: orgData.billing_address || null,
        };
      }
    } catch {
      /* fallback: footer SpedireSicuro */
    }
    const pdfBuffer = await generateCommercialQuotePDF(quote as CommercialQuote, branding, orgInfo);

    const fileName = `preventivo_${quote.prospect_company.replace(/[^a-zA-Z0-9]/g, '_')}_rev${quote.revision}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('Errore download PDF preventivo:', error);
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
