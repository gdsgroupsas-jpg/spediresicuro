/**
 * Test Unit: getResellerClientsBasic - Logica unificata caricamento clienti
 *
 * Verifica che la logica di risoluzione clienti usi sia Workspace V2
 * che il fallback legacy parent_id, con deduplicazione corretta.
 *
 * Bug risolto: la tab "Listini Personalizzati" usava getSubUsers() che
 * cercava solo via parent_id (legacy), ignorando i clienti creati con
 * il sistema Workspace V2. Ora tutti i punti di ingresso usano
 * getResellerClientsBasic() con la stessa logica di getResellerClientsWithListino().
 */

import { describe, expect, it } from 'vitest';

// ---- Pure logic helper: risoluzione clientIds ----

/**
 * Simula la logica di risoluzione clienti dal codice di getResellerClientsBasic.
 * Usa Workspace V2 (workspace figli -> owner) + fallback parent_id legacy.
 */
function resolveClientIds(
  workspaceChildOwners: string[],
  legacyParentIdClients: string[]
): string[] {
  const clientIds = [...workspaceChildOwners];

  for (const legacyId of legacyParentIdClients) {
    if (!clientIds.includes(legacyId)) {
      clientIds.push(legacyId);
    }
  }

  return clientIds;
}

describe('resolveClientIds - logica Workspace V2 + fallback parent_id', () => {
  it('restituisce clienti da workspace V2 quando presenti', () => {
    const wsClients = ['user-a', 'user-b'];
    const legacyClients: string[] = [];

    const result = resolveClientIds(wsClients, legacyClients);
    expect(result).toEqual(['user-a', 'user-b']);
  });

  it('restituisce clienti da parent_id legacy quando non ci sono workspace', () => {
    const wsClients: string[] = [];
    const legacyClients = ['user-c', 'user-d'];

    const result = resolveClientIds(wsClients, legacyClients);
    expect(result).toEqual(['user-c', 'user-d']);
  });

  it('unisce entrambe le fonti senza duplicati', () => {
    const wsClients = ['user-a', 'user-b'];
    const legacyClients = ['user-b', 'user-c']; // user-b presente in entrambi

    const result = resolveClientIds(wsClients, legacyClients);
    expect(result).toEqual(['user-a', 'user-b', 'user-c']);
    // user-b NON duplicato
    expect(result.filter((id) => id === 'user-b')).toHaveLength(1);
  });

  it('restituisce array vuoto se nessuna fonte ha clienti', () => {
    const result = resolveClientIds([], []);
    expect(result).toEqual([]);
  });

  it('gestisce molti clienti legacy con overlap parziale', () => {
    const wsClients = ['ws-1', 'ws-2', 'ws-3'];
    const legacyClients = ['ws-2', 'legacy-1', 'ws-3', 'legacy-2'];

    const result = resolveClientIds(wsClients, legacyClients);
    expect(result).toHaveLength(5);
    expect(result).toEqual(['ws-1', 'ws-2', 'ws-3', 'legacy-1', 'legacy-2']);
  });
});

// ---- Verifica mapping output ----

interface RawClient {
  id: string;
  email: string;
  name: string | null;
}

function mapClientsToBasicOutput(
  clients: RawClient[]
): Array<{ id: string; email: string; name?: string }> {
  return clients.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name || undefined,
  }));
}

describe('mapClientsToBasicOutput - formato output per dropdown', () => {
  it('converte name null in undefined', () => {
    const raw: RawClient[] = [{ id: '1', email: 'a@test.com', name: null }];

    const result = mapClientsToBasicOutput(raw);
    expect(result[0].name).toBeUndefined();
  });

  it('preserva name quando presente', () => {
    const raw: RawClient[] = [{ id: '1', email: 'a@test.com', name: 'Mario Rossi' }];

    const result = mapClientsToBasicOutput(raw);
    expect(result[0].name).toBe('Mario Rossi');
  });

  it('restituisce array vuoto per input vuoto', () => {
    const result = mapClientsToBasicOutput([]);
    expect(result).toEqual([]);
  });

  it('mappa correttamente multipli clienti', () => {
    const raw: RawClient[] = [
      { id: '1', email: 'a@test.com', name: 'Alice' },
      { id: '2', email: 'b@test.com', name: null },
      { id: '3', email: 'c@test.com', name: 'Carlo' },
    ];

    const result = mapClientsToBasicOutput(raw);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: '1', email: 'a@test.com', name: 'Alice' });
    expect(result[1]).toEqual({ id: '2', email: 'b@test.com' });
    expect(result[2]).toEqual({ id: '3', email: 'c@test.com', name: 'Carlo' });
  });
});
