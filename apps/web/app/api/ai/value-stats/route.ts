export const dynamic = 'force-dynamic';

/**
 * API Route: Value Stats - P4 Task 1
 *
 * Calcola statistiche di valore per l'utente:
 * - Minuti risparmiati (tempo manuale vs tempo con Anne)
 * - Errori evitati (fallback/retry)
 * - Confidence media
 *
 * ⚠️ SICUREZZA:
 * - RLS enforcement: usa requireWorkspaceAuth()
 * - NO PII: solo aggregazioni, mai dati raw
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceAuth } from '@/lib/workspace-auth';
import { calculateValueStats } from '@/lib/services/value-stats';

/**
 * GET /api/ai/value-stats
 *
 * Restituisce statistiche di valore per l'utente corrente
 */
export async function GET(request: NextRequest) {
  try {
    // ⚠️ SICUREZZA: Usa requireWorkspaceAuth() per Acting Context
    const context = await requireWorkspaceAuth();
    const userId = context.target.id;

    // Calcola statistiche
    const stats = await calculateValueStats(userId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [Value Stats] Errore:', errorMessage);

    // Se non autenticato, ritorna 401
    if (errorMessage.includes('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 });
    }

    return NextResponse.json(
      { success: false, error: 'Errore calcolo statistiche' },
      { status: 500 }
    );
  }
}
