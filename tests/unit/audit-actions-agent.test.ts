/**
 * Unit Tests: AUDIT_ACTIONS per AI Agent
 *
 * Test per verificare:
 * - AUDIT_ACTIONS contiene azioni agent
 * - AUDIT_RESOURCE_TYPES contiene AGENT_SESSION
 * - isValidAuditAction e isValidResourceType funzionano correttamente
 */

import { describe, it, expect } from 'vitest';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  isValidAuditAction,
  isValidResourceType,
  type AuditAction,
  type AuditResourceType,
} from '@/lib/security/audit-actions';

// ==================== TEST SUITE ====================

describe('AUDIT_ACTIONS per AI Agent', () => {
  describe('AUDIT_ACTIONS', () => {
    it('dovrebbe contenere AGENT_QUERY', () => {
      expect(AUDIT_ACTIONS.AGENT_QUERY).toBe('agent_query');
    });

    it('dovrebbe contenere AGENT_MENTOR_RESPONSE', () => {
      expect(AUDIT_ACTIONS.AGENT_MENTOR_RESPONSE).toBe('agent_mentor_response');
    });

    it('dovrebbe contenere AGENT_SESSION_CREATED', () => {
      expect(AUDIT_ACTIONS.AGENT_SESSION_CREATED).toBe('agent_session_created');
    });

    it('dovrebbe contenere AGENT_SESSION_UPDATED', () => {
      expect(AUDIT_ACTIONS.AGENT_SESSION_UPDATED).toBe('agent_session_updated');
    });

    it('dovrebbe mantenere azioni esistenti (non regressione)', () => {
      expect(AUDIT_ACTIONS.CREATE_SHIPMENT).toBe('create_shipment');
      expect(AUDIT_ACTIONS.WALLET_RECHARGE).toBe('wallet_recharge');
      expect(AUDIT_ACTIONS.USER_LOGIN).toBe('user_login');
    });
  });

  describe('AUDIT_RESOURCE_TYPES', () => {
    it('dovrebbe contenere AGENT_SESSION', () => {
      expect(AUDIT_RESOURCE_TYPES.AGENT_SESSION).toBe('agent_session');
    });

    it('dovrebbe mantenere resource types esistenti (non regressione)', () => {
      expect(AUDIT_RESOURCE_TYPES.SHIPMENT).toBe('shipment');
      expect(AUDIT_RESOURCE_TYPES.WALLET).toBe('wallet');
      expect(AUDIT_RESOURCE_TYPES.USER).toBe('user');
    });
  });

  describe('isValidAuditAction', () => {
    it('dovrebbe validare AGENT_QUERY', () => {
      expect(isValidAuditAction(AUDIT_ACTIONS.AGENT_QUERY)).toBe(true);
    });

    it('dovrebbe validare AGENT_MENTOR_RESPONSE', () => {
      expect(isValidAuditAction(AUDIT_ACTIONS.AGENT_MENTOR_RESPONSE)).toBe(true);
    });

    it('dovrebbe validare AGENT_SESSION_CREATED', () => {
      expect(isValidAuditAction(AUDIT_ACTIONS.AGENT_SESSION_CREATED)).toBe(true);
    });

    it('dovrebbe validare AGENT_SESSION_UPDATED', () => {
      expect(isValidAuditAction(AUDIT_ACTIONS.AGENT_SESSION_UPDATED)).toBe(true);
    });

    it('dovrebbe rifiutare azioni non valide', () => {
      expect(isValidAuditAction('invalid_action')).toBe(false);
      expect(isValidAuditAction('')).toBe(false);
    });

    it('dovrebbe validare azioni esistenti (non regressione)', () => {
      expect(isValidAuditAction(AUDIT_ACTIONS.CREATE_SHIPMENT)).toBe(true);
      expect(isValidAuditAction(AUDIT_ACTIONS.WALLET_RECHARGE)).toBe(true);
    });
  });

  describe('isValidResourceType', () => {
    it('dovrebbe validare AGENT_SESSION', () => {
      expect(isValidResourceType(AUDIT_RESOURCE_TYPES.AGENT_SESSION)).toBe(true);
    });

    it('dovrebbe rifiutare resource types non validi', () => {
      expect(isValidResourceType('invalid_resource')).toBe(false);
      expect(isValidResourceType('')).toBe(false);
    });

    it('dovrebbe validare resource types esistenti (non regressione)', () => {
      expect(isValidResourceType(AUDIT_RESOURCE_TYPES.SHIPMENT)).toBe(true);
      expect(isValidResourceType(AUDIT_RESOURCE_TYPES.WALLET)).toBe(true);
    });
  });

  describe('Type safety', () => {
    it('dovrebbe avere tipi corretti per AuditAction', () => {
      const action: AuditAction = AUDIT_ACTIONS.AGENT_QUERY;
      expect(typeof action).toBe('string');
    });

    it('dovrebbe avere tipi corretti per AuditResourceType', () => {
      const resourceType: AuditResourceType = AUDIT_RESOURCE_TYPES.AGENT_SESSION;
      expect(typeof resourceType).toBe('string');
    });
  });
});
