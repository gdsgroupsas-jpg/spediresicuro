/**
 * Delegation Context
 *
 * Contesto di delegazione per operazioni "per conto di" un sub-client.
 * Request-scoped: vale SOLO per il messaggio corrente (stateless).
 *
 * SECURITY:
 * - Actor (reseller) preservato per audit
 * - Workspace sovrascritto al sub-client
 * - Target aggiornato al sub-client (per memory write)
 */

import type { WorkspaceActingContext, WorkspaceContextInfo } from '@/types/workspace';

export interface DelegationContext {
  isDelegating: boolean;
  delegatedWorkspaceId: string; // workspace sub-client
  resellerWorkspaceId: string; // workspace reseller (per audit)
  subClientName: string;
  subClientWorkspaceName: string;
  subClientUserId: string; // per memory write sul sub-client
}

/**
 * Costruisce un ActingContext temporaneo per la delegazione.
 *
 * - Actor: resta il RESELLER (chi esegue l'azione)
 * - Target: diventa il SUB-CLIENT (per chi viene eseguita)
 * - Workspace: diventa quello del SUB-CLIENT
 * - isImpersonating: true (per distinguere nei log)
 * - metadata.reason: "delegation:per_conto_di"
 *
 * @param originalContext - Il contesto originale del reseller
 * @param delegation - I dati della delegazione
 * @param subClientWorkspaceInfo - Info workspace del sub-client (opzionale, per override completo)
 */
export function buildDelegatedActingContext(
  originalContext: WorkspaceActingContext,
  delegation: DelegationContext,
  subClientWorkspaceInfo?: Partial<WorkspaceContextInfo>
): WorkspaceActingContext {
  return {
    // Actor: resta il reseller (chi esegue)
    actor: { ...originalContext.actor },

    // Target: diventa il sub-client
    target: {
      id: delegation.subClientUserId,
      email: null, // non serve per le operazioni
      name: delegation.subClientName,
      role: 'user',
    },

    // Workspace: sovrascritto al sub-client
    workspace: {
      ...originalContext.workspace,
      ...subClientWorkspaceInfo,
      id: delegation.delegatedWorkspaceId,
      name: delegation.subClientWorkspaceName,
    },

    // Flag: questa e' un'azione delegata
    isImpersonating: true,

    // Metadata per audit trail
    metadata: {
      ...originalContext.metadata,
      reason: 'delegation:per_conto_di',
    },
  };
}
