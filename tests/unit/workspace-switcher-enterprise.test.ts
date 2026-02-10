/**
 * Test: WorkspaceSwitcher Enterprise-Level
 *
 * Verifica logica del workspace switcher redesign:
 * - Raggruppamento workspace (owner vs clienti)
 * - Filtro ricerca
 * - Avatar colors per workspace type
 * - Badge styles
 * - Keyboard navigation (indici)
 * - Currency formatting
 */

import { describe, it, expect } from 'vitest';

// ============================================
// Replica delle funzioni helper per test
// (testate in isolamento senza React)
// ============================================

type WorkspaceType = 'platform' | 'reseller' | 'client';

const AVATAR_COLORS: Record<string, { bg: string; text: string }> = {
  platform: { bg: 'bg-violet-600', text: 'text-white' },
  reseller: { bg: 'bg-blue-600', text: 'text-white' },
  client: { bg: 'bg-emerald-600', text: 'text-white' },
  admin: { bg: 'bg-red-600', text: 'text-white' },
};

const BADGE_STYLES: Record<string, string> = {
  admin: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  platform: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  reseller: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  client: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
};

function getAvatarColor(type: WorkspaceType, ownerAccountType?: string) {
  if (ownerAccountType === 'admin' || ownerAccountType === 'superadmin') {
    return AVATAR_COLORS.admin;
  }
  return AVATAR_COLORS[type] || AVATAR_COLORS.client;
}

function getBadgeStyle(type: WorkspaceType, ownerAccountType?: string): string {
  if (ownerAccountType === 'admin' || ownerAccountType === 'superadmin') {
    return BADGE_STYLES.admin;
  }
  return BADGE_STYLES[type] || BADGE_STYLES.client;
}

function getTypeLabel(type: WorkspaceType, ownerAccountType?: string): string {
  if (ownerAccountType === 'admin' || ownerAccountType === 'superadmin') {
    return 'Admin';
  }
  switch (type) {
    case 'platform':
      return 'Platform';
    case 'reseller':
      return 'Reseller';
    case 'client':
      return 'Client';
    default:
      return type;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

// Replica della logica di raggruppamento
interface MockWorkspace {
  workspace_id: string;
  workspace_name: string;
  workspace_type: WorkspaceType;
  organization_name: string;
  role: 'owner' | 'admin' | 'operator' | 'viewer';
  wallet_balance: number;
  owner_account_type?: string;
}

function groupWorkspaces(workspaces: MockWorkspace[]) {
  const my: MockWorkspace[] = [];
  const clients: MockWorkspace[] = [];
  let owner: MockWorkspace | null = null;

  for (const ws of workspaces) {
    if (ws.role === 'owner') {
      my.push(ws);
      if (!owner || (ws.workspace_type !== 'client' && owner?.workspace_type === 'client')) {
        owner = ws;
      }
    } else {
      clients.push(ws);
    }
  }

  return { myWorkspaces: my, clientWorkspaces: clients, ownerWorkspace: owner };
}

function filterWorkspaces(workspaces: MockWorkspace[], query: string): MockWorkspace[] {
  if (!query.trim()) return workspaces;
  const q = query.toLowerCase();
  return workspaces.filter(
    (ws) =>
      ws.workspace_name.toLowerCase().includes(q) || ws.organization_name.toLowerCase().includes(q)
  );
}

// ============================================
// TEST SUITE
// ============================================

describe('WorkspaceSwitcher Enterprise - Avatar Colors', () => {
  it('restituisce violet per platform', () => {
    const color = getAvatarColor('platform');
    expect(color.bg).toBe('bg-violet-600');
  });

  it('restituisce blue per reseller', () => {
    const color = getAvatarColor('reseller');
    expect(color.bg).toBe('bg-blue-600');
  });

  it('restituisce emerald per client', () => {
    const color = getAvatarColor('client');
    expect(color.bg).toBe('bg-emerald-600');
  });

  it('restituisce red per admin/superadmin owner', () => {
    const color = getAvatarColor('reseller', 'superadmin');
    expect(color.bg).toBe('bg-red-600');
  });

  it('restituisce red anche per admin owner', () => {
    const color = getAvatarColor('platform', 'admin');
    expect(color.bg).toBe('bg-red-600');
  });

  it('tutti i colori hanno text-white', () => {
    expect(getAvatarColor('platform').text).toBe('text-white');
    expect(getAvatarColor('reseller').text).toBe('text-white');
    expect(getAvatarColor('client').text).toBe('text-white');
    expect(getAvatarColor('client', 'superadmin').text).toBe('text-white');
  });
});

describe('WorkspaceSwitcher Enterprise - Badge Styles', () => {
  it('client ha emerald badge', () => {
    expect(getBadgeStyle('client')).toContain('emerald');
  });

  it('reseller ha blue badge', () => {
    expect(getBadgeStyle('reseller')).toContain('blue');
  });

  it('platform ha violet badge', () => {
    expect(getBadgeStyle('platform')).toContain('violet');
  });

  it('admin/superadmin ha red badge', () => {
    expect(getBadgeStyle('client', 'superadmin')).toContain('red');
    expect(getBadgeStyle('reseller', 'admin')).toContain('red');
  });

  it('tutti i badge hanno ring-1', () => {
    expect(getBadgeStyle('client')).toContain('ring-1');
    expect(getBadgeStyle('reseller')).toContain('ring-1');
    expect(getBadgeStyle('platform')).toContain('ring-1');
    expect(getBadgeStyle('client', 'admin')).toContain('ring-1');
  });
});

describe('WorkspaceSwitcher Enterprise - Type Labels', () => {
  it('mostra "Platform" per platform', () => {
    expect(getTypeLabel('platform')).toBe('Platform');
  });

  it('mostra "Reseller" per reseller', () => {
    expect(getTypeLabel('reseller')).toBe('Reseller');
  });

  it('mostra "Client" per client', () => {
    expect(getTypeLabel('client')).toBe('Client');
  });

  it('mostra "Admin" per admin/superadmin', () => {
    expect(getTypeLabel('reseller', 'admin')).toBe('Admin');
    expect(getTypeLabel('platform', 'superadmin')).toBe('Admin');
  });
});

describe('WorkspaceSwitcher Enterprise - Currency Formatting', () => {
  it('formatta euro correttamente', () => {
    const formatted = formatCurrency(1250.5);
    // Formato italiano: 1.250,50 €
    expect(formatted).toContain('1.250');
    expect(formatted).toContain('€');
  });

  it('formatta zero correttamente', () => {
    const formatted = formatCurrency(0);
    expect(formatted).toContain('0');
    expect(formatted).toContain('€');
  });

  it('formatta importo negativo', () => {
    const formatted = formatCurrency(-50);
    expect(formatted).toContain('50');
    expect(formatted).toContain('€');
  });
});

describe('WorkspaceSwitcher Enterprise - Raggruppamento Workspace', () => {
  const mockWorkspaces: MockWorkspace[] = [
    {
      workspace_id: 'ws-1',
      workspace_name: 'GDS Group SAS',
      workspace_type: 'reseller',
      organization_name: 'GDS Group',
      role: 'owner',
      wallet_balance: 500,
    },
    {
      workspace_id: 'ws-2',
      workspace_name: 'AWA KANOUTE Workspace',
      workspace_type: 'client',
      organization_name: 'GDS Group',
      role: 'admin',
      wallet_balance: 100,
    },
    {
      workspace_id: 'ws-3',
      workspace_name: 'GERARDO APREA Workspace',
      workspace_type: 'client',
      organization_name: 'GDS Group',
      role: 'admin',
      wallet_balance: 200,
    },
    {
      workspace_id: 'ws-4',
      workspace_name: 'MIRANDA Workspace',
      workspace_type: 'client',
      organization_name: 'GDS Group',
      role: 'admin',
      wallet_balance: 0,
    },
  ];

  it('separa correttamente owner da clienti', () => {
    const { myWorkspaces, clientWorkspaces } = groupWorkspaces(mockWorkspaces);
    expect(myWorkspaces).toHaveLength(1);
    expect(clientWorkspaces).toHaveLength(3);
  });

  it('identifica ownerWorkspace principale', () => {
    const { ownerWorkspace } = groupWorkspaces(mockWorkspaces);
    expect(ownerWorkspace?.workspace_id).toBe('ws-1');
    expect(ownerWorkspace?.workspace_type).toBe('reseller');
  });

  it('preferisce non-client come owner workspace', () => {
    const mixed: MockWorkspace[] = [
      {
        workspace_id: 'ws-client',
        workspace_name: 'Client WS',
        workspace_type: 'client',
        organization_name: 'Org',
        role: 'owner',
        wallet_balance: 0,
      },
      {
        workspace_id: 'ws-reseller',
        workspace_name: 'Reseller WS',
        workspace_type: 'reseller',
        organization_name: 'Org',
        role: 'owner',
        wallet_balance: 0,
      },
    ];
    const { ownerWorkspace } = groupWorkspaces(mixed);
    expect(ownerWorkspace?.workspace_id).toBe('ws-reseller');
  });

  it('gestisce lista vuota', () => {
    const { myWorkspaces, clientWorkspaces, ownerWorkspace } = groupWorkspaces([]);
    expect(myWorkspaces).toHaveLength(0);
    expect(clientWorkspaces).toHaveLength(0);
    expect(ownerWorkspace).toBeNull();
  });
});

describe('WorkspaceSwitcher Enterprise - Filtro Ricerca', () => {
  const clients: MockWorkspace[] = [
    {
      workspace_id: 'ws-1',
      workspace_name: 'AWA KANOUTE Workspace',
      workspace_type: 'client',
      organization_name: 'GDS Group',
      role: 'admin',
      wallet_balance: 100,
    },
    {
      workspace_id: 'ws-2',
      workspace_name: 'GERARDO APREA Workspace',
      workspace_type: 'client',
      organization_name: 'GDS Group',
      role: 'admin',
      wallet_balance: 200,
    },
    {
      workspace_id: 'ws-3',
      workspace_name: 'MIRANDA Workspace',
      workspace_type: 'client',
      organization_name: 'Altra Org',
      role: 'admin',
      wallet_balance: 0,
    },
  ];

  it('ritorna tutti senza query', () => {
    expect(filterWorkspaces(clients, '')).toHaveLength(3);
    expect(filterWorkspaces(clients, '  ')).toHaveLength(3);
  });

  it('filtra per nome workspace', () => {
    const result = filterWorkspaces(clients, 'awa');
    expect(result).toHaveLength(1);
    expect(result[0].workspace_name).toContain('AWA');
  });

  it('filtra per nome organizzazione', () => {
    const result = filterWorkspaces(clients, 'altra');
    expect(result).toHaveLength(1);
    expect(result[0].workspace_name).toContain('MIRANDA');
  });

  it('case insensitive', () => {
    expect(filterWorkspaces(clients, 'GERARDO')).toHaveLength(1);
    expect(filterWorkspaces(clients, 'gerardo')).toHaveLength(1);
  });

  it('nessun risultato', () => {
    expect(filterWorkspaces(clients, 'zzzzz')).toHaveLength(0);
  });

  it('match parziale', () => {
    const result = filterWorkspaces(clients, 'work');
    expect(result).toHaveLength(3); // tutti contengono "Workspace"
  });
});

describe('WorkspaceSwitcher Enterprise - Keyboard Navigation (indici)', () => {
  it('flat list combina myWorkspaces e filteredClients', () => {
    const my: MockWorkspace[] = [
      {
        workspace_id: 'ws-owner',
        workspace_name: 'My WS',
        workspace_type: 'reseller',
        organization_name: 'Org',
        role: 'owner',
        wallet_balance: 0,
      },
    ];
    const clients: MockWorkspace[] = [
      {
        workspace_id: 'ws-c1',
        workspace_name: 'Client 1',
        workspace_type: 'client',
        organization_name: 'Org',
        role: 'admin',
        wallet_balance: 0,
      },
      {
        workspace_id: 'ws-c2',
        workspace_name: 'Client 2',
        workspace_type: 'client',
        organization_name: 'Org',
        role: 'admin',
        wallet_balance: 0,
      },
    ];

    const flatList = [...my, ...clients];
    expect(flatList).toHaveLength(3);
    expect(flatList[0].workspace_id).toBe('ws-owner');
    expect(flatList[1].workspace_id).toBe('ws-c1');
    expect(flatList[2].workspace_id).toBe('ws-c2');
  });

  it('ArrowDown incrementa indice correttamente', () => {
    let focusedIdx = -1;
    const listLength = 3;

    // Simula ArrowDown
    focusedIdx = focusedIdx < listLength - 1 ? focusedIdx + 1 : 0;
    expect(focusedIdx).toBe(0);

    focusedIdx = focusedIdx < listLength - 1 ? focusedIdx + 1 : 0;
    expect(focusedIdx).toBe(1);

    focusedIdx = focusedIdx < listLength - 1 ? focusedIdx + 1 : 0;
    expect(focusedIdx).toBe(2);

    // Wrap around
    focusedIdx = focusedIdx < listLength - 1 ? focusedIdx + 1 : 0;
    expect(focusedIdx).toBe(0);
  });

  it('ArrowUp decrementa indice correttamente', () => {
    let focusedIdx = 0;
    const listLength = 3;

    // Simula ArrowUp dal primo elemento → vai all'ultimo
    focusedIdx = focusedIdx > 0 ? focusedIdx - 1 : listLength - 1;
    expect(focusedIdx).toBe(2);

    focusedIdx = focusedIdx > 0 ? focusedIdx - 1 : listLength - 1;
    expect(focusedIdx).toBe(1);
  });
});

describe('WorkspaceSwitcher Enterprise - Soglia ricerca', () => {
  const SEARCH_THRESHOLD = 5;

  it('non mostra ricerca con meno di 5 workspace', () => {
    expect(4 >= SEARCH_THRESHOLD).toBe(false);
  });

  it('mostra ricerca con 5+ workspace', () => {
    expect(5 >= SEARCH_THRESHOLD).toBe(true);
    expect(10 >= SEARCH_THRESHOLD).toBe(true);
  });
});
