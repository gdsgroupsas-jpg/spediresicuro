/**
 * Workspace Types - Architecture V2
 *
 * Tipi TypeScript per il sistema Organization + Workspace
 *
 * REGOLE CRITICHE:
 * 1. NESSUNA fee/margine di default - sempre null/undefined
 * 2. Gerarchia max 3 livelli (depth 0-2)
 * 3. Isolamento dati per workspace_id
 * 4. Un utente puo appartenere a N workspace
 *
 * @module types/workspace
 */

// ============================================
// ORGANIZATION
// ============================================

/**
 * Organization = Entita fiscale/billing
 * Contiene P.IVA, branding, settings
 */
export interface Organization {
  id: string;
  name: string;
  slug: string; // URL-friendly: logistica-milano.spediresicuro.it

  // Fiscal/Billing
  vat_number: string | null; // P.IVA
  fiscal_code: string | null; // Codice Fiscale
  billing_email: string;
  billing_address: BillingAddress | null;

  // Branding (White-label)
  branding: OrganizationBranding;
  white_label_level: WhiteLabelLevel;
  custom_domain: string | null; // Solo livello 3

  // Settings
  settings: OrganizationSettings;

  // Status
  status: OrganizationStatus;

  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BillingAddress {
  via: string;
  citta: string;
  cap: string;
  provincia: string;
  paese: string;
}

export interface OrganizationBranding {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  favicon?: string;
}

export interface OrganizationSettings {
  [key: string]: unknown;
}

export type OrganizationStatus = 'active' | 'suspended' | 'deleted';

/**
 * White-label levels:
 * 1 = Base (logo + colori) - FREE
 * 2 = Subdomain (logistica-milano.spediresicuro.it) - FREE
 * 3 = Custom domain (spedizioni.logisticamilano.it) - PREMIUM
 */
export type WhiteLabelLevel = 1 | 2 | 3;

// ============================================
// WORKSPACE
// ============================================

/**
 * Workspace = Unita operativa
 * Contiene wallet, gerarchia, team
 *
 * REGOLA CRITICA:
 * platform_fee_override e parent_imposed_fee sono SEMPRE null di default!
 * Solo il Superadmin puo configurarli manualmente.
 */
export interface Workspace {
  id: string;
  organization_id: string;

  // Identity
  name: string;
  slug: string;

  // Hierarchy
  type: WorkspaceType;
  depth: WorkspaceDepth;
  parent_workspace_id: string | null;

  // Wallet (per workspace)
  wallet_balance: number;

  // Pricing
  /** Listino che questo workspace USA per pagare (assegnato dal parent) */
  assigned_price_list_id: string | null;
  /** Listino che questo workspace USA per vendere ai sub-workspace (solo reseller) */
  selling_price_list_id: string | null;

  // Courier Config
  assigned_courier_config_id: string | null;

  /**
   * REGOLA CRITICA: FEE SEMPRE NULL DI DEFAULT!
   *
   * Questi campi NON devono MAI avere un valore di default automatico!
   * Il Superadmin DEVE configurarli manualmente per ogni workspace.
   * Se sono null, il sistema deve rifiutare operazioni che richiedono fee.
   */
  platform_fee_override: number | null;
  parent_imposed_fee: number | null;

  // Settings
  settings: WorkspaceSettings;

  // Status
  status: WorkspaceStatus;

  // Timestamps
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Tipo workspace:
 * - platform: SpedireSicuro (depth 0)
 * - reseller: Rivenditore (depth 1)
 * - client: Cliente finale (depth 2)
 */
export type WorkspaceType = 'platform' | 'reseller' | 'client';

/**
 * Depth workspace (max 3 livelli):
 * - 0: Platform
 * - 1: Reseller
 * - 2: Client
 */
export type WorkspaceDepth = 0 | 1 | 2;

export interface WorkspaceSettings {
  [key: string]: unknown;
}

export type WorkspaceStatus = 'active' | 'suspended' | 'deleted';

// ============================================
// WORKSPACE MEMBER
// ============================================

/**
 * Workspace Member = Chi puo accedere al workspace
 *
 * Un utente puo appartenere a N workspace (confermato)
 */
export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;

  // Role & Permissions
  role: WorkspaceMemberRole;
  permissions: WorkspacePermission[];

  // Invitation
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;

  // Status
  status: WorkspaceMemberStatus;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Ruoli workspace:
 * - owner: Controllo totale, non rimuovibile
 * - admin: Gestione completa tranne eliminare owner
 * - operator: Operazioni quotidiane (spedizioni, tracking)
 * - viewer: Solo lettura
 */
export type WorkspaceMemberRole = 'owner' | 'admin' | 'operator' | 'viewer';

/**
 * Permessi granulari workspace
 * Formato: 'resource:action'
 */
export type WorkspacePermission =
  // Shipments
  | 'shipments:create'
  | 'shipments:view'
  | 'shipments:edit'
  | 'shipments:delete'
  | 'shipments:track'
  | 'shipments:cancel'
  // Wallet
  | 'wallet:view'
  | 'wallet:manage'
  | 'wallet:recharge'
  // Members
  | 'members:view'
  | 'members:invite'
  | 'members:remove'
  | 'members:edit_role'
  // Settings
  | 'settings:view'
  | 'settings:edit'
  // Price Lists
  | 'pricelists:view'
  | 'pricelists:manage'
  // Contacts
  | 'contacts:view'
  | 'contacts:create'
  | 'contacts:edit'
  | 'contacts:delete'
  // Reports
  | 'reports:view'
  | 'reports:export'
  // Warehouse (magazzino)
  | 'warehouse:view'
  | 'warehouse:manage'
  | 'warehouse:inventory'
  | 'warehouse:pickup'
  | 'warehouse:delivery'
  // Billing (contabilita)
  | 'billing:view'
  | 'billing:manage'
  | 'billing:invoices'
  | 'billing:reconcile'
  // Clients (gestione clienti reseller)
  | 'clients:view'
  | 'clients:create'
  | 'clients:edit'
  | 'clients:delete'
  | 'clients:manage'
  // Quotes (preventivi)
  | 'quotes:view'
  | 'quotes:create'
  | 'quotes:edit'
  | 'quotes:delete';

export type WorkspaceMemberStatus = 'pending' | 'active' | 'suspended' | 'removed';

// ============================================
// WORKSPACE INVITATION
// ============================================

/**
 * Workspace Invitation = Invito per aggiungere membri
 */
export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;

  // Invitation details
  email: string;
  role: Exclude<WorkspaceMemberRole, 'owner'>; // Owner non invitabile
  permissions: WorkspacePermission[];
  message: string | null;

  // Token
  token: string;

  // Status
  status: WorkspaceInvitationStatus;

  // Timestamps
  expires_at: string;
  created_at: string;
  invited_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
}

export type WorkspaceInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

// ============================================
// ACTING CONTEXT EXTENDED
// ============================================

/**
 * Acting Context esteso con workspace
 *
 * Estende ActingContext di safe-auth.ts con contesto workspace
 */
export interface WorkspaceActingContext {
  /** Chi ESEGUE l'azione (SuperAdmin se impersonating) */
  actor: WorkspaceActingUser;

  /** Per CHI viene eseguita l'azione (il cliente) */
  target: WorkspaceActingUser;

  /** Workspace corrente */
  workspace: WorkspaceContextInfo;

  /** Flag impersonation attiva */
  isImpersonating: boolean;

  /** Metadata per audit */
  metadata?: {
    reason?: string;
    requestId?: string;
    ip?: string;
  };
}

export interface WorkspaceActingUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  account_type?: string;
  is_reseller?: boolean;
}

export interface WorkspaceContextInfo {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  depth: WorkspaceDepth;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  wallet_balance: number;
  role: WorkspaceMemberRole;
  permissions: WorkspacePermission[];
  branding: OrganizationBranding;
}

// ============================================
// WORKSPACE WITH RELATIONS
// ============================================

/**
 * Workspace con relazioni caricate
 */
export interface WorkspaceWithOrganization extends Workspace {
  organization: Organization;
}

export interface WorkspaceWithMembers extends Workspace {
  members: WorkspaceMember[];
}

export interface WorkspaceWithHierarchy extends Workspace {
  parent?: Workspace | null;
  children?: Workspace[];
}

export interface WorkspaceFull extends Workspace {
  organization: Organization;
  members: WorkspaceMember[];
  parent?: Workspace | null;
  children?: Workspace[];
}

// ============================================
// CREATE/UPDATE TYPES
// ============================================

/**
 * Input per creazione Organization
 */
export interface CreateOrganizationInput {
  name: string;
  slug?: string; // Auto-generato se non fornito
  vat_number?: string;
  fiscal_code?: string;
  billing_email: string;
  billing_address?: BillingAddress;
  branding?: Partial<OrganizationBranding>;
  white_label_level?: WhiteLabelLevel;
  settings?: OrganizationSettings;
}

/**
 * Input per creazione Workspace
 *
 * NOTA: platform_fee_override e parent_imposed_fee NON sono accettati!
 * Devono essere configurati separatamente dal Superadmin.
 */
export interface CreateWorkspaceInput {
  organization_id: string;
  name: string;
  slug?: string; // Auto-generato se non fornito
  parent_workspace_id?: string; // Se fornito, type e depth sono calcolati automaticamente
  assigned_price_list_id?: string;
  selling_price_list_id?: string;
  assigned_courier_config_id?: string;
  settings?: WorkspaceSettings;
  // NOTA: NO platform_fee_override, NO parent_imposed_fee!
}

/**
 * Input per update Workspace (solo Superadmin puo modificare fee)
 */
export interface UpdateWorkspaceInput {
  name?: string;
  assigned_price_list_id?: string | null;
  selling_price_list_id?: string | null;
  assigned_courier_config_id?: string | null;
  settings?: WorkspaceSettings;
  status?: WorkspaceStatus;
}

/**
 * Input per configurazione fee (SOLO SUPERADMIN)
 */
export interface ConfigureWorkspaceFeeInput {
  workspace_id: string;
  platform_fee_override?: number | null;
  parent_imposed_fee?: number | null;
}

/**
 * Input per invito workspace
 */
export interface InviteToWorkspaceInput {
  workspace_id: string;
  email: string;
  role: Exclude<WorkspaceMemberRole, 'owner'>;
  permissions?: WorkspacePermission[];
  message?: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

/**
 * Risposta get_user_workspaces()
 */
export interface UserWorkspaceInfo {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  workspace_type: WorkspaceType;
  workspace_depth: WorkspaceDepth;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: WorkspaceMemberRole;
  permissions: WorkspacePermission[];
  wallet_balance: number;
  branding: OrganizationBranding;
  member_status: WorkspaceMemberStatus;
  /** Account type dell'owner del workspace (solo per superadmin view) */
  owner_account_type?: string;
}

/**
 * Risposta get_workspace_hierarchy()
 */
export interface WorkspaceHierarchyNode {
  workspace_id: string;
  workspace_name: string;
  workspace_type: WorkspaceType;
  depth: WorkspaceDepth;
  wallet_balance: number;
  assigned_price_list_id: string | null;
  platform_fee_override: number | null;
  parent_imposed_fee: number | null;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Verifica se un ruolo ha un permesso specifico
 */
export function roleHasPermission(
  role: WorkspaceMemberRole,
  permission: WorkspacePermission
): boolean {
  // Owner e Admin hanno tutti i permessi
  if (role === 'owner' || role === 'admin') {
    return true;
  }

  // Permessi impliciti per Operator
  if (role === 'operator') {
    const operatorPermissions: WorkspacePermission[] = [
      'shipments:create',
      'shipments:view',
      'shipments:track',
      'wallet:view',
      'contacts:view',
      'contacts:create',
      'warehouse:view',
      'warehouse:pickup',
      'warehouse:delivery',
      'clients:view',
      'quotes:view',
      'quotes:create',
      'billing:view',
    ];
    return operatorPermissions.includes(permission);
  }

  // Viewer: solo permessi :view
  if (role === 'viewer') {
    return permission.endsWith(':view');
  }

  return false;
}

/**
 * Verifica se un membro ha un permesso
 * Controlla prima il ruolo, poi i permessi espliciti
 */
export function memberHasPermission(
  member: Pick<WorkspaceMember, 'role' | 'permissions'>,
  permission: WorkspacePermission
): boolean {
  // Prima controlla ruolo
  if (roleHasPermission(member.role, permission)) {
    return true;
  }

  // Poi controlla permessi espliciti
  return member.permissions.includes(permission);
}

/**
 * Verifica se un workspace puo avere sub-workspace
 */
export function canHaveSubWorkspaces(workspace: Pick<Workspace, 'depth' | 'type'>): boolean {
  // Solo platform e reseller possono avere sub-workspace
  // Max depth = 2, quindi depth 2 (client) non puo avere figli
  return workspace.depth < 2 && (workspace.type === 'platform' || workspace.type === 'reseller');
}

/**
 * Verifica se le fee sono configurate per un workspace
 *
 * REGOLA CRITICA: Se fee sono null, operazioni che richiedono fee devono fallire!
 */
export function areFeeConfigured(
  workspace: Pick<Workspace, 'platform_fee_override' | 'parent_imposed_fee'>
): boolean {
  // Almeno una fee deve essere configurata
  return workspace.platform_fee_override !== null || workspace.parent_imposed_fee !== null;
}

/**
 * Calcola la fee effettiva per un workspace
 *
 * @throws Error se fee non configurate
 */
export function getEffectiveFee(
  workspace: Pick<Workspace, 'platform_fee_override' | 'parent_imposed_fee'>
): number {
  if (workspace.platform_fee_override !== null) {
    return workspace.platform_fee_override;
  }

  if (workspace.parent_imposed_fee !== null) {
    return workspace.parent_imposed_fee;
  }

  throw new Error(
    'FEE_NOT_CONFIGURED: Le fee per questo workspace non sono state configurate. ' +
      'Contattare il Superadmin per configurare le fee.'
  );
}
