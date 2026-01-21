/**
 * CRON Endpoint: Compensation Queue Cleanup
 *
 * Cleanup automatico di orphan records in compensation_queue.
 * Verifica records con status='pending' e created_at > 7 giorni.
 * Marca come 'expired' per mantenere audit trail.
 *
 * Sicurezza: Authorization Bearer token obbligatorio (stesso pattern CRON esistenti)
 */

import { NextRequest, NextResponse } from 'next/server';
import { processCompensationQueue } from '@/lib/services/compensation/processor';

// Forza rendering dinamico (usa request.headers)
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti max

export async function GET(request: NextRequest) {
  try {
    // Verifica secret token (protezione cron job)
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;

    // Verifica autenticazione cron (fail-closed)
    if (secretToken) {
      if (authHeader !== `Bearer ${secretToken}`) {
        // Se non c'è secret token configurato, permettere solo da Vercel
        const vercelCron = request.headers.get('x-vercel-cron');
        if (!vercelCron) {
          console.warn('⚠️ [CRON Compensation Queue] Tentativo accesso non autorizzato');
          return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
      }
    } else {
      // Se CRON_SECRET_TOKEN non è configurato, permettere solo da Vercel
      const vercelCron = request.headers.get('x-vercel-cron');
      if (!vercelCron) {
        console.warn(
          '⚠️ [CRON Compensation Queue] CRON_SECRET_TOKEN non configurato e richiesta non da Vercel'
        );
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('🧹 [CRON Compensation Queue] Avvio cleanup orphan records...');

    const result = await processCompensationQueue();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Errore durante cleanup',
          details: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cleanup compensation queue completato',
      processed: result.processed,
      expired: result.expired,
      deleted: result.deleted,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [CRON Compensation Queue] Errore:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore durante cleanup',
      },
      { status: 500 }
    );
  }
}
