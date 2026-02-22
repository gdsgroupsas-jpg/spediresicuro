import { supabaseAdmin } from '@/lib/db/client';

export interface UserMemory {
  preferences?: {
    language?: string;
    tone?: 'professionale' | 'amichevole' | 'diretto';
    verbosity?: 'breve' | 'normale' | 'dettagliato';
  };
  defaultSender?: {
    name?: string;
    company?: string;
    address?: string;
    city?: string;
    zip?: string;
    province?: string;
    phone?: string;
    email?: string;
  };
  preferredCouriers?: string[];
  communicationStyle?: {
    emoji?: boolean;
    tables?: boolean;
  };
  notes?: string;
}

function mergeMemory(existing: UserMemory, patch: UserMemory): UserMemory {
  return {
    preferences: { ...(existing.preferences || {}), ...(patch.preferences || {}) },
    defaultSender: { ...(existing.defaultSender || {}), ...(patch.defaultSender || {}) },
    preferredCouriers: patch.preferredCouriers ?? existing.preferredCouriers,
    communicationStyle: {
      ...(existing.communicationStyle || {}),
      ...(patch.communicationStyle || {}),
    },
    notes: patch.notes ?? existing.notes,
  };
}

export async function getUserMemory(userId: string): Promise<UserMemory | null> {
  const { data, error } = await supabaseAdmin
    .from('anne_user_memory')
    .select('preferences, default_sender, preferred_couriers, communication_style, notes')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    preferences: data.preferences || {},
    defaultSender: data.default_sender || {},
    preferredCouriers: data.preferred_couriers || [],
    communicationStyle: data.communication_style || {},
    notes: data.notes || undefined,
  };
}

// KNOWN LIMITATION (F-ATOM-3): read-then-write race condition.
// Se due richieste concorrenti aggiornano la memory dello stesso utente,
// una potrebbe sovrascrivere l'altra. Fix definitivo: RPC PostgreSQL
// con SELECT ... FOR UPDATE o upsert atomico lato DB. Rimandato a R3.
export async function upsertUserMemory(userId: string, patch: UserMemory): Promise<UserMemory> {
  const existing = (await getUserMemory(userId)) || {};
  const merged = mergeMemory(existing, patch);

  const { error } = await supabaseAdmin.from('anne_user_memory').upsert(
    {
      user_id: userId,
      preferences: merged.preferences || {},
      default_sender: merged.defaultSender || {},
      preferred_couriers: merged.preferredCouriers || [],
      communication_style: merged.communicationStyle || {},
      notes: merged.notes || null,
    },
    {
      onConflict: 'user_id',
    }
  );

  if (error) {
    throw new Error(`Errore salvataggio memoria utente: ${error.message}`);
  }

  return merged;
}
