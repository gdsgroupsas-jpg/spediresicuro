import { NextRequest, NextResponse } from 'next/server';

/**
 * CSP Reporting Endpoint
 * 
 * Riceve e logga le violazioni della Content Security Policy.
 * 
 * POST /api/csp-report
 * Body: JSON con report CSP (formato standard browser)
 * 
 * ⚠️ SECURITY:
 * - Non logga dati sensibili (PII)
 * - Rate limiting implicito (browser invia solo violazioni)
 * - Log strutturato per analisi
 */

interface CSPReport {
  'csp-report': {
    'document-uri'?: string;
    'referrer'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'original-policy'?: string;
    'disposition'?: string;
    'blocked-uri'?: string;
    'status-code'?: number;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const report = body as CSPReport;

    // Estrai dati dal report (senza PII)
    const cspReport = report['csp-report'];
    if (!cspReport) {
      return NextResponse.json(
        { success: false, error: 'Formato report non valido' },
        { status: 400 }
      );
    }

    // Sanitizza document-uri (rimuovi query params e hash per privacy)
    const documentUri = cspReport['document-uri'] || '';
    const sanitizedUri = documentUri.split('?')[0].split('#')[0];

    // Log strutturato (no PII)
    const logData = {
      timestamp: new Date().toISOString(),
      type: 'csp-violation',
      violated_directive: cspReport['violated-directive'] || cspReport['effective-directive'],
      blocked_uri: cspReport['blocked-uri'],
      document_uri: sanitizedUri, // Sanitizzato
      source_file: cspReport['source-file'],
      line_number: cspReport['line-number'],
      column_number: cspReport['column-number'],
      status_code: cspReport['status-code'],
      disposition: cspReport['disposition'],
    };

    // Log in console (in produzione, integrare con servizio di logging)
    console.warn('🚨 [CSP-VIOLATION]', JSON.stringify(logData, null, 2));

    // ⚠️ FUTURO: Integrare con servizio di logging (es. Vercel Logs, Sentry, Datadog)
    // await logToService(logData);

    // Rispondi sempre con 204 (No Content) per non bloccare il browser
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    // Errore nel parsing, logga ma non blocca
    console.error('❌ [CSP-REPORT] Errore parsing report:', error);
    return new NextResponse(null, { status: 204 });
  }
}

// Supporta anche GET per test
export async function GET() {
  return NextResponse.json({
    message: 'CSP Reporting endpoint attivo',
    usage: 'POST /api/csp-report con body JSON contenente csp-report',
    example: {
      'csp-report': {
        'document-uri': 'https://example.com/page',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.com/script.js',
      },
    },
  });
}

