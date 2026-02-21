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
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { saveChatMessage, loadChatHistory, clearChatHistory } from '@/lib/services/anne-chat';
import { rateLimit } from '@/lib/security/rate-limit';

// Rate limit: 30 requests/min for GET, 60 for POST, 5 for DELETE
async function checkRateLimit(userId: string, action: string, limit: number) {
  const result = await rateLimit(`chat-messages-${action}`, userId, {
    limit,
    windowSeconds: 60,
  });
  return result;
}

export async function GET() {
  const ctx = await getWorkspaceAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const userId = ctx.target.id;
  if (!userId) {
    return NextResponse.json({ error: 'ID utente mancante' }, { status: 401 });
  }

  const rl = await checkRateLimit(userId, 'get', 30);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppi tentativi, riprova tra poco' }, { status: 429 });
  }

  const messages = await loadChatHistory(userId);
  return NextResponse.json({ success: true, messages });
}

export async function POST(request: NextRequest) {
  const ctx = await getWorkspaceAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const userId = ctx.target.id;
  if (!userId) {
    return NextResponse.json({ error: 'ID utente mancante' }, { status: 401 });
  }

  const rl = await checkRateLimit(userId, 'post', 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppi tentativi, riprova tra poco' }, { status: 429 });
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
    const allowed = ['cardType', 'cardData', 'source'];
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
  const ctx = await getWorkspaceAuth();
  if (!ctx) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const userId = ctx.target.id;
  if (!userId) {
    return NextResponse.json({ error: 'ID utente mancante' }, { status: 401 });
  }

  const rl = await checkRateLimit(userId, 'delete', 5);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppi tentativi, riprova tra poco' }, { status: 429 });
  }

  await clearChatHistory(userId);
  return NextResponse.json({ success: true });
}
