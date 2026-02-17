/**
 * CRON Job: OCR Logs Cleanup
 *
 * Enforces GDPR retention policy for OCR processing logs.
 *
 * SCHEDULE: Daily (recommended: 2 AM)
 * RETENTION:
 * - Soft delete: TTL 7 giorni (expires_at < NOW)
 * - Hard delete: Soft deleted da >30 giorni
 *
 * CRITICAL: Questo job DEVE girare per GDPR compliance.
 * Se disabilitato → data minimization violation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti max

export async function GET(request: NextRequest) {
  try {
    // ============================================
    // AUTHORIZATION: Vercel Cron o Secret Token
    // ============================================
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET_TOKEN;

    // Check Vercel cron header (se deploy su Vercel)
    const isVercelCron = request.headers.get('x-vercel-cron-id');

    // Check secret token (se configurato)
    const isAuthorized = isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      console.error('❌ [OCR_CLEANUP] Unauthorized access attempt', {
        hasVercelCron: !!isVercelCron,
        hasCronSecret: !!cronSecret,
        hasAuthHeader: !!authHeader,
      });

      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ============================================
    // RUN CLEANUP
    // ============================================
    console.log('🧹 [OCR_CLEANUP] Starting OCR logs cleanup...');

    const startTime = Date.now();

    const { data, error } = await supabaseAdmin.rpc('cleanup_expired_ocr_logs');

    if (error) {
      console.error('❌ [OCR_CLEANUP] Cleanup failed:', error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    const duration = Date.now() - startTime;

    // Extract results
    const result = (data as any)?.[0] || data || {};
    const softDeleted = result.soft_deleted_count || 0;
    const hardDeleted = result.hard_deleted_count || 0;

    console.log('✅ [OCR_CLEANUP] Cleanup completed', {
      softDeleted,
      hardDeleted,
      durationMs: duration,
    });

    // ============================================
    // AUDIT LOG (optional)
    // ============================================
    if (softDeleted > 0 || hardDeleted > 0) {
      // Operazione di sistema senza workspace — fallback a supabaseAdmin
      const wsId: string | null = null;
      const db = wsId ? workspaceQuery(wsId) : supabaseAdmin;
      await db.from('audit_logs').insert({
        action: 'system_maintenance',
        resource_type: 'system',
        resource_id: 'ocr_cleanup',
        workspace_id: wsId,
        metadata: {
          soft_deleted_count: softDeleted,
          hard_deleted_count: hardDeleted,
          duration_ms: duration,
          scheduled: true,
        },
      });
    }

    // ============================================
    // RESPONSE
    // ============================================
    return NextResponse.json({
      success: true,
      soft_deleted: softDeleted,
      hard_deleted: hardDeleted,
      duration_ms: duration,
      message: `Cleanup completed: ${softDeleted} soft deleted, ${hardDeleted} hard deleted`,
    });
  } catch (error: any) {
    console.error('❌ [OCR_CLEANUP] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
