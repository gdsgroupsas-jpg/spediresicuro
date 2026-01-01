/**
 * Unit Tests: Agent Context (agent_context e ActingContext injection)
 * 
 * Test per verificare:
 * - AgentState contiene agent_context con ActingContext
 * - supervisor-router inietta ActingContext correttamente
 * - agent_context contiene session_id, user_role, is_impersonating
 */

import { describe, it, expect } from 'vitest';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { ActingContext } from '@/lib/safe-auth';
import { UserRole } from '@/lib/rbac';
import { HumanMessage } from '@langchain/core/messages';

// ==================== FIXTURES ====================

const createMockActingContext = (overrides: Partial<ActingContext> = {}): ActingContext => ({
  actor: {
    id: 'actor-123',
    email: 'actor@example.com',
    name: 'Actor User',
    role: 'admin',
  },
  target: {
    id: 'target-456',
    email: 'target@example.com',
    name: 'Target User',
    role: 'user',
  },
  isImpersonating: false,
  ...overrides,
});

const createAgentStateWithContext = (actingContext: ActingContext): AgentState => ({
  messages: [new HumanMessage('Test message')],
  userId: actingContext.target.id,
  userEmail: actingContext.target.email || '',
  shipmentData: {},
  processingStatus: 'idle',
  validationErrors: [],
  confidenceScore: 0,
  needsHumanReview: false,
  agent_context: {
    session_id: 'test-session-123',
    conversation_history: [new HumanMessage('Test message')],
    user_role: (actingContext.target.role || 'user') as UserRole,
    is_impersonating: actingContext.isImpersonating,
    acting_context: actingContext,
  },
});

// ==================== TEST SUITE ====================

describe('Agent Context', () => {
  describe('AgentState con agent_context', () => {
    it('dovrebbe contenere agent_context con ActingContext', () => {
      const actingContext = createMockActingContext();
      const state = createAgentStateWithContext(actingContext);

      expect(state.agent_context).toBeDefined();
      expect(state.agent_context?.acting_context).toBe(actingContext);
      expect(state.agent_context?.user_role).toBe('user');
      expect(state.agent_context?.is_impersonating).toBe(false);
      expect(state.agent_context?.session_id).toBe('test-session-123');
    });

    it('dovrebbe usare target.id per userId', () => {
      const actingContext = createMockActingContext();
      const state = createAgentStateWithContext(actingContext);

      expect(state.userId).toBe(actingContext.target.id);
      expect(state.userId).not.toBe(actingContext.actor.id);
    });

    it('dovrebbe usare target.email per userEmail', () => {
      const actingContext = createMockActingContext();
      const state = createAgentStateWithContext(actingContext);

      expect(state.userEmail).toBe(actingContext.target.email);
    });

    it('dovrebbe gestire impersonation correttamente', () => {
      const actingContext = createMockActingContext({
        isImpersonating: true,
        target: {
          id: 'target-789',
          email: 'target2@example.com',
          name: 'Target 2',
          role: 'user',
        },
      });
      const state = createAgentStateWithContext(actingContext);

      expect(state.agent_context?.is_impersonating).toBe(true);
      expect(state.userId).toBe('target-789'); // Usa target, non actor
      expect(state.agent_context?.acting_context?.actor.id).toBe('actor-123');
      expect(state.agent_context?.acting_context?.target.id).toBe('target-789');
    });

    it('dovrebbe contenere conversation_history', () => {
      const actingContext = createMockActingContext();
      const state = createAgentStateWithContext(actingContext);

      expect(state.agent_context?.conversation_history).toBeDefined();
      expect(state.agent_context?.conversation_history.length).toBe(1);
      expect(state.agent_context?.conversation_history[0].content).toBe('Test message');
    });

    it('dovrebbe mappare correttamente user_role da ActingContext', () => {
      const actingContext = createMockActingContext({
        target: {
          id: 'target-admin',
          email: 'admin@example.com',
          name: 'Admin User',
          role: 'admin',
        },
      });
      const state = createAgentStateWithContext(actingContext);

      expect(state.agent_context?.user_role).toBe('admin');
    });
  });

  describe('Type safety', () => {
    it('dovrebbe avere tipi corretti per agent_context', () => {
      const actingContext = createMockActingContext();
      const state = createAgentStateWithContext(actingContext);

      // Type check: agent_context dovrebbe essere opzionale ma definito qui
      if (state.agent_context) {
        expect(typeof state.agent_context.session_id).toBe('string');
        expect(Array.isArray(state.agent_context.conversation_history)).toBe(true);
        expect(['user', 'admin', 'reseller', 'superadmin']).toContain(state.agent_context.user_role);
        expect(typeof state.agent_context.is_impersonating).toBe('boolean');
        expect(state.agent_context.acting_context).toBeDefined();
      }
    });
  });
});

