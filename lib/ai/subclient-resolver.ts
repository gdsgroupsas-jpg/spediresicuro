/**
 * Sub-Client Resolver
 *
 * Risolve un nome/termine di ricerca al workspace di un sub-client
 * appartenente al reseller corrente. Usato per la delegazione "per conto di".
 *
 * SECURITY:
 * - Solo workspace con parent_workspace_id = resellerWsId (figli diretti)
 * - Solo workspace con status = 'active'
 * - Ordinamento deterministico (confidence DESC, workspace_name ASC)
 */

import { supabaseAdmin } from '@/lib/db/client';

/** Soglia centralizzata: sopra questo valore, match considerato sicuro */
export const DELEGATION_CONFIDENCE_THRESHOLD = 0.9;

export interface SubClientResolution {
  workspaceId: string;
  userId: string;
  workspaceName: string;
  userName: string;
  confidence: number; // 0-1
}

/**
 * Cerca nei workspace figli del reseller un sub-client che corrisponda al termine.
 *
 * Scoring:
 * - Match esatto nome workspace → 1.0
 * - Match esatto nome utente → 0.95
 * - Match parziale (ILIKE) workspace → 0.7
 * - Match parziale (ILIKE) utente → 0.6
 *
 * @param resellerWorkspaceId - UUID del workspace reseller (padre)
 * @param searchTerm - Nome o termine di ricerca (es. "Awa Kanoute")
 * @returns Array di match ordinati per confidence DESC, workspace_name ASC
 */
export async function resolveSubClient(
  resellerWorkspaceId: string,
  searchTerm: string
): Promise<SubClientResolution[]> {
  if (!resellerWorkspaceId || !searchTerm?.trim()) {
    return [];
  }

  const normalizedTerm = searchTerm.trim().normalize('NFC');

  // Query: workspace figli diretti del reseller con i loro membri
  // workspaces e workspace_members sono tabelle globali → ok supabaseAdmin
  const { data: childWorkspaces, error } = await supabaseAdmin
    .from('workspaces')
    .select(
      `
      id,
      name,
      workspace_members!inner (
        user_id,
        role,
        users:user_id (
          id,
          name,
          email
        )
      )
    `
    )
    .eq('parent_workspace_id', resellerWorkspaceId)
    .eq('type', 'client')
    .eq('status', 'active');

  if (error || !childWorkspaces || childWorkspaces.length === 0) {
    return [];
  }

  // Calcola confidence per ogni workspace/utente
  const results: SubClientResolution[] = [];

  for (const ws of childWorkspaces) {
    const members = ws.workspace_members as any[];
    if (!members?.length) continue;

    for (const member of members) {
      const user = member.users as any;
      if (!user) continue;

      const wsName = (ws.name || '').trim().normalize('NFC');
      const userName = (user.name || '').trim().normalize('NFC');

      // Calcola confidence
      let confidence = 0;

      // Match esatto nome workspace (case-insensitive)
      if (wsName.toLowerCase() === normalizedTerm.toLowerCase()) {
        confidence = Math.max(confidence, 1.0);
      }
      // Match esatto nome utente (case-insensitive)
      if (userName.toLowerCase() === normalizedTerm.toLowerCase()) {
        confidence = Math.max(confidence, 0.95);
      }
      // Match parziale workspace (contiene il termine)
      if (confidence < 0.7 && wsName.toLowerCase().includes(normalizedTerm.toLowerCase())) {
        confidence = Math.max(confidence, 0.7);
      }
      // Match parziale utente (contiene il termine)
      if (confidence < 0.6 && userName.toLowerCase().includes(normalizedTerm.toLowerCase())) {
        confidence = Math.max(confidence, 0.6);
      }
      // Match inverso: il termine contiene il nome (es. "crea per Awa" contiene "Awa")
      if (
        confidence === 0 &&
        wsName.length >= 3 &&
        normalizedTerm.toLowerCase().includes(wsName.toLowerCase())
      ) {
        confidence = 0.5;
      }
      if (
        confidence === 0 &&
        userName.length >= 3 &&
        normalizedTerm.toLowerCase().includes(userName.toLowerCase())
      ) {
        confidence = 0.5;
      }

      if (confidence > 0) {
        results.push({
          workspaceId: ws.id,
          userId: user.id,
          workspaceName: wsName,
          userName: userName,
          confidence,
        });
      }
    }
  }

  // Dedup: stesso workspace potrebbe avere piu membri che matchano
  // Tieni il match con confidence piu alta per workspace
  const bestByWorkspace = new Map<string, SubClientResolution>();
  for (const r of results) {
    const existing = bestByWorkspace.get(r.workspaceId);
    if (!existing || r.confidence > existing.confidence) {
      bestByWorkspace.set(r.workspaceId, r);
    }
  }

  // Ordinamento deterministico: confidence DESC, workspace_name ASC
  return Array.from(bestByWorkspace.values()).sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.workspaceName.localeCompare(b.workspaceName);
  });
}
