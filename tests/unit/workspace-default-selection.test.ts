/**
 * Workspace Default Selection Tests
 *
 * Verifica la logica di selezione workspace iniziale con priorita' a 3 livelli:
 * 1. localStorage (scelta recente utente)
 * 2. primary_workspace_id dal DB (preferenza server-side)
 * 3. Primo workspace nella lista (fallback finale)
 */

import { describe, it, expect } from 'vitest';

// Interfaccia minima per il test
interface WorkspaceInfo {
  workspace_id: string;
  workspace_name: string;
}

// Replica esatta della logica di selezione in useWorkspace.ts
function selectDefaultWorkspace(
  workspaces: WorkspaceInfo[],
  savedId: string | null,
  dbPrimaryId: string | null
): string | null {
  // Priorita' 1: localStorage valido
  if (savedId && workspaces.some((w) => w.workspace_id === savedId)) {
    return savedId;
  }

  // Priorita' 2: primary_workspace_id dal DB
  if (dbPrimaryId && workspaces.some((w) => w.workspace_id === dbPrimaryId)) {
    return dbPrimaryId;
  }

  // Priorita' 3: primo workspace disponibile
  if (workspaces.length > 0) {
    return workspaces[0].workspace_id;
  }

  return null;
}

// Workspace di test
const WS_PLATFORM = { workspace_id: 'ws-platform-001', workspace_name: 'SpedireSicuro Platform' };
const WS_RESELLER = { workspace_id: 'ws-reseller-002', workspace_name: 'Reseller Alpha' };
const WS_CLIENT = { workspace_id: 'ws-client-003', workspace_name: 'Client Beta' };

const ALL_WORKSPACES = [WS_PLATFORM, WS_RESELLER, WS_CLIENT];

describe('Workspace default selection logic', () => {
  describe('Priorita 1: localStorage', () => {
    it('dovrebbe usare localStorage se valido', () => {
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        WS_RESELLER.workspace_id, // localStorage
        WS_PLATFORM.workspace_id // DB
      );
      expect(result).toBe(WS_RESELLER.workspace_id);
    });

    it('dovrebbe ignorare localStorage se workspace non esiste nella lista', () => {
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        'ws-deleted-999', // localStorage - workspace eliminato
        WS_PLATFORM.workspace_id // DB
      );
      // Deve cadere su priorita' 2 (DB)
      expect(result).toBe(WS_PLATFORM.workspace_id);
    });
  });

  describe('Priorita 2: primary_workspace_id dal DB', () => {
    it('dovrebbe usare primary_workspace_id se localStorage e vuoto', () => {
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        null, // localStorage vuoto (cache pulita)
        WS_PLATFORM.workspace_id // DB
      );
      expect(result).toBe(WS_PLATFORM.workspace_id);
    });

    it('dovrebbe ignorare primary_workspace_id se workspace non esiste nella lista', () => {
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        null, // localStorage vuoto
        'ws-deleted-999' // DB - workspace eliminato
      );
      // Deve cadere su priorita' 3 (primo della lista)
      expect(result).toBe(WS_PLATFORM.workspace_id);
    });
  });

  describe('Priorita 3: fallback al primo workspace', () => {
    it('dovrebbe usare il primo workspace se localStorage e DB sono vuoti', () => {
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        null, // localStorage vuoto
        null // DB vuoto
      );
      expect(result).toBe(WS_PLATFORM.workspace_id);
    });

    it('dovrebbe ritornare null se non ci sono workspace', () => {
      const result = selectDefaultWorkspace([], null, null);
      expect(result).toBeNull();
    });
  });

  describe('Scenario admin@spediresicuro.it', () => {
    it('cache pulita: dovrebbe usare primary_workspace_id dal DB', () => {
      // Scenario: admin cancella cache browser, fa login
      // localStorage vuoto, ma primary_workspace_id settato nel DB
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        null, // cache pulita = localStorage vuoto
        WS_PLATFORM.workspace_id // DB ha il workspace salvato da switch precedente
      );
      expect(result).toBe(WS_PLATFORM.workspace_id);
    });

    it('browser diverso: dovrebbe usare primary_workspace_id dal DB', () => {
      // Scenario: admin usa un browser diverso (senza localStorage)
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        null, // nuovo browser = localStorage vuoto
        WS_CLIENT.workspace_id // DB ha l'ultimo workspace usato
      );
      expect(result).toBe(WS_CLIENT.workspace_id);
    });

    it('navigazione in incognito: dovrebbe usare primary_workspace_id dal DB', () => {
      // Scenario: navigazione privata
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        null, // incognito = localStorage vuoto
        WS_RESELLER.workspace_id // DB ha il workspace dell'admin
      );
      expect(result).toBe(WS_RESELLER.workspace_id);
    });

    it('localStorage ha precedenza su DB (utente ha scelto manualmente)', () => {
      // Scenario: admin ha cambiato workspace nella sessione corrente
      const result = selectDefaultWorkspace(
        ALL_WORKSPACES,
        WS_CLIENT.workspace_id, // localStorage: ultimo switch nella sessione
        WS_PLATFORM.workspace_id // DB: switch precedente (non ancora aggiornato)
      );
      // localStorage vince perche' e' piu' recente
      expect(result).toBe(WS_CLIENT.workspace_id);
    });
  });
});
