/**
 * API Route: Anne Chat Messages
 *
 * GET  - Load chat history for current user
 * POST - Save a new message (used by client after send/receive)
 * DELETE - Clear chat history (new conversation)
 *
 * Phase 4: Multi-device Sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { saveChatMessage, loadChatHistory, clearChatHistory } from '@/lib/services/anne-chat';

export async function GET() {
  const ctx = await getSafeAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const userId = ctx.target.id;
  if (!userId) {
    return NextResponse.json({ error: 'ID utente mancante' }, { status: 401 });
  }

  const messages = await loadChatHistory(userId);
  return NextResponse.json({ success: true, messages });
}

export async function POST(request: NextRequest) {
  const ctx = await getSafeAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const userId = ctx.target.id;
  if (!userId) {
    return NextResponse.json({ error: 'ID utente mancante' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { role, content, metadata } = body;

  if (!role || !content || typeof content !== 'string') {
    return NextResponse.json({ error: 'role e content richiesti' }, { status: 400 });
  }

  if (!['user', 'assistant', 'suggestion'].includes(role)) {
    return NextResponse.json({ error: 'role non valido' }, { status: 400 });
  }

  // Sanitize metadata: strip agentState internals, keep only safe fields
  const safeMetadata: Record<string, unknown> = {};
  if (metadata && typeof metadata === 'object') {
    // Only allow whitelisted metadata keys (prevent agentState leak into DB)
    const allowed = ['cardType', 'source'];
    for (const key of allowed) {
      if (key in metadata) safeMetadata[key] = metadata[key];
    }
  }

  const message = await saveChatMessage({
    userId,
    role,
    content: content.slice(0, 10000), // Limit content length
    metadata: safeMetadata,
  });

  if (!message) {
    return NextResponse.json({ error: 'Errore salvataggio' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message });
}

export async function DELETE() {
  const ctx = await getSafeAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const userId = ctx.target.id;
  if (!userId) {
    return NextResponse.json({ error: 'ID utente mancante' }, { status: 401 });
  }

  await clearChatHistory(userId);
  return NextResponse.json({ success: true });
}
