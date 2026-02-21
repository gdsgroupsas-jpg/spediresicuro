/**
 * Anne Chat Persistence Service
 *
 * Salva/carica messaggi chat ANNE in anne_chat_messages.
 * Usato sia dalla route API che dal hook client-side.
 *
 * Phase 4: Multi-device Sessions
 */

import { supabaseAdmin } from '@/lib/db/client';

// ==================== TYPES ====================

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'suggestion';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface SaveMessageInput {
  userId: string;
  role: 'user' | 'assistant' | 'suggestion';
  content: string;
  metadata?: Record<string, unknown>;
}

// ==================== SERVICE ====================

/**
 * Save a chat message. Returns the created message with id and timestamp.
 */
export async function saveChatMessage(input: SaveMessageInput): Promise<ChatMessage | null> {
  const { data, error } = await supabaseAdmin
    .from('anne_chat_messages')
    .insert({
      user_id: input.userId,
      role: input.role,
      content: input.content,
      metadata: input.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('[ANNE_CHAT] Save message error:', error.message);
    return null;
  }

  return data as ChatMessage;
}

/**
 * Load recent chat messages for a user.
 * Returns messages in chronological order (oldest first).
 */
export async function loadChatHistory(userId: string, limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await supabaseAdmin
    .from('anne_chat_messages')
    .select('id, user_id, role, content, metadata, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[ANNE_CHAT] Load history error:', error.message);
    return [];
  }

  // Reverse to chronological order (oldest first)
  return (data as ChatMessage[]).reverse();
}

/**
 * Clear chat history for a user (used for "new conversation").
 */
export async function clearChatHistory(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.from('anne_chat_messages').delete().eq('user_id', userId);

  if (error) {
    console.error('[ANNE_CHAT] Clear history error:', error.message);
  }
}
