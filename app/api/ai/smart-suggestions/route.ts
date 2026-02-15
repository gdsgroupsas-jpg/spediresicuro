export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireWorkspaceAuth } from '@/lib/workspace-auth';
import { getSmartSuggestion } from '@/lib/agent/smart-suggestions';

export async function GET(request: NextRequest) {
  try {
    const context = await requireWorkspaceAuth();
    const userId = context.target.id;
    const suggestion = await getSmartSuggestion(userId);
    return NextResponse.json({ success: true, suggestion });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Non autenticato' }, { status: 401 });
    }
    console.error('âŒ [Smart Suggestions] Errore:', errorMessage);
    return NextResponse.json(
      { success: false, error: 'Errore generazione suggerimento' },
      { status: 500 }
    );
  }
}
