/**
 * Unit Tests: mentor-worker.ts
 * 
 * Test REALI della logica del worker in isolamento.
 * Coverage:
 * - detectMentorIntent: pattern matching per domande tecniche
 * - mentorWorker: RAG su documentazione, risposta con sources
 * - Edge cases: domanda senza documenti rilevanti, errore lettura file
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mentorWorker, detectMentorIntent } from '@/lib/agent/workers/mentor';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { HumanMessage } from '@langchain/core/messages';
import { ILogger, NullLogger } from '@/lib/agent/logger';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
}));

// Mock cache service (P3 Task 6)
vi.mock('@/lib/services/cache', () => ({
  agentCache: {
    getRAG: vi.fn(() => null), // Default: no cache hit
    setRAG: vi.fn(),
  },
}));

// ==================== FIXTURES ====================

const createMockAgentState = (overrides: Partial<AgentState> = {}): AgentState => ({
  messages: [new HumanMessage('Come funziona il wallet?')],
  userId: 'test-user-123',
  userEmail: 'test@example.com',
  shipmentData: {},
  processingStatus: 'idle',
  validationErrors: [],
  confidenceScore: 0,
  needsHumanReview: false,
  ...overrides,
});

const MOCK_DOC_CONTENT = `
# Money Flows

## Wallet System

Il wallet è un sistema di credito prepagato che permette agli utenti di addebitare le spedizioni.

### Funzionamento

1. L'utente ricarica il wallet
2. Le spedizioni vengono addebitate automaticamente
3. Il balance viene aggiornato in tempo reale
`;

// ==================== TEST SUITE ====================

describe('mentor-worker', () => {
  let logger: ILogger;
  let agentCache: any;
  
  beforeEach(async () => {
    logger = new NullLogger();
    vi.clearAllMocks();
    
    // Reset cache mock per ogni test
    const cacheModule = await import('@/lib/services/cache');
    agentCache = cacheModule.agentCache;
    vi.mocked(agentCache.getRAG).mockReturnValue(null); // Default: no cache
    vi.mocked(agentCache.setRAG).mockClear();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectMentorIntent', () => {
    it('dovrebbe rilevare intent per "Come funziona"', () => {
      expect(detectMentorIntent('Come funziona il wallet?')).toBe(true);
    });

    it('dovrebbe rilevare intent per "Spiega"', () => {
      expect(detectMentorIntent('Spiega come funziona RLS')).toBe(true);
    });

    it('dovrebbe rilevare intent per "Perché"', () => {
      expect(detectMentorIntent('Perché il wallet non funziona?')).toBe(true);
    });

    it('dovrebbe rilevare intent per "Che cos\'è"', () => {
      expect(detectMentorIntent("Che cos'è il database?")).toBe(true);
    });

    it('dovrebbe rilevare intent per keyword "wallet"', () => {
      expect(detectMentorIntent('Vorrei sapere del wallet')).toBe(true);
    });

    it('dovrebbe rilevare intent per keyword "architettura"', () => {
      expect(detectMentorIntent('Dimmi dell\'architettura del sistema')).toBe(true);
    });

    it('NON dovrebbe rilevare intent per domande normali', () => {
      expect(detectMentorIntent('Vorrei un preventivo per 2kg a Milano')).toBe(false);
    });

    it('NON dovrebbe rilevare intent per messaggi vuoti', () => {
      expect(detectMentorIntent('')).toBe(false);
    });
  });

  describe('mentorWorker', () => {
    it('dovrebbe restituire risposta con sources quando trova documenti rilevanti', async () => {
      // Mock readFile per restituire contenuto documento
      vi.mocked(readFile).mockResolvedValueOnce(MOCK_DOC_CONTENT);
      
      const state = createMockAgentState({
        messages: [new HumanMessage('Come funziona il wallet?')],
      });

      const result = await mentorWorker(state, logger);

      expect(result.mentor_response).toBeDefined();
      expect(result.mentor_response?.answer).toContain('wallet');
      expect(result.mentor_response?.sources).toContain('docs/MONEY_FLOWS.md');
      expect(result.mentor_response?.confidence).toBeGreaterThan(0);
      expect(result.next_step).toBe('END');
    });

    it('dovrebbe restituire clarification quando non trova documenti rilevanti', async () => {
      // Mock readFile per restituire contenuto non rilevante
      vi.mocked(readFile).mockResolvedValueOnce('Contenuto non rilevante');
      
      const state = createMockAgentState({
        messages: [new HumanMessage('Domanda completamente non correlata?')],
      });

      const result = await mentorWorker(state, logger);

      expect(result.mentor_response).toBeDefined();
      expect(result.mentor_response?.answer).toContain('non ho trovato informazioni');
      expect(result.mentor_response?.sources).toEqual([]);
      expect(result.mentor_response?.confidence).toBe(0);
      expect(result.next_step).toBe('END');
    });

    it('dovrebbe gestire errore lettura file gracefully', async () => {
      // Mock readFile per lanciare errore su tutti i documenti
      // readDocument gestisce l'errore silenziosamente e restituisce null
      // quindi searchDocuments restituirà array vuoto
      vi.mocked(readFile).mockRejectedValue(new Error('File not found'));
      
      const state = createMockAgentState({
        messages: [new HumanMessage('Come funziona il wallet?')],
      });

      const result = await mentorWorker(state, logger);

      // Quando tutti i documenti falliscono, searchDocuments restituisce array vuoto
      // generateAnswer restituisce risposta con confidence 0 e sources vuoti
      // Quindi mentor_worker restituisce mentor_response (non clarification_request)
      expect(result.mentor_response).toBeDefined();
      expect(result.mentor_response?.sources).toEqual([]);
      expect(result.mentor_response?.confidence).toBe(0);
      expect(result.mentor_response?.answer).toContain('non ho trovato informazioni');
    });

    it('dovrebbe restituire clarification quando messaggio è vuoto', async () => {
      const state = createMockAgentState({
        messages: [new HumanMessage('')],
      });

      const result = await mentorWorker(state, logger);

      expect(result.clarification_request).toBeDefined();
      expect(result.clarification_request).toContain('riformularla');
    });

    it('dovrebbe cercare in più documenti e combinare risultati', async () => {
      // Mock readFile per restituire contenuti da più documenti
      vi.mocked(readFile)
        .mockResolvedValueOnce(MOCK_DOC_CONTENT)
        .mockResolvedValueOnce('# Architecture\n\nIl sistema usa Next.js e Supabase.');
      
      const state = createMockAgentState({
        messages: [new HumanMessage('Come funziona il sistema?')],
      });

      const result = await mentorWorker(state, logger);

      expect(result.mentor_response).toBeDefined();
      expect(result.mentor_response?.sources.length).toBeGreaterThan(1);
      expect(result.mentor_response?.confidence).toBeGreaterThan(50);
    });
  });
});

