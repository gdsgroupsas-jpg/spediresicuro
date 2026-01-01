import { describe, it, expect } from 'vitest';
import { translateError, translateSpecificError, type AgentError } from '@/lib/agent/error-translator';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { HumanMessage } from '@langchain/core/messages';

describe('Error Translator', () => {
  describe('translateError', () => {
    it('dovrebbe tradurre errori di validazione per CAP', () => {
      const state: AgentState = {
        messages: [new HumanMessage('test')],
        userId: 'test-user',
        userEmail: 'test@example.com',
        shipmentData: {},
        processingStatus: 'idle',
        validationErrors: ['destinationZip: required'],
        confidenceScore: 0,
        needsHumanReview: false,
      };
      const result = translateError(state);
      expect(result).not.toBeNull();
      expect(result?.message).toContain('CAP');
      expect(result?.actionable).toBe(true);
      expect(result?.severity).toBe('warning');
    });
    it('dovrebbe tradurre errori di validazione per peso', () => {
      const state: AgentState = {
        messages: [new HumanMessage('test')],
        userId: 'test-user',
        userEmail: 'test@example.com',
        shipmentData: {},
        processingStatus: 'idle',
        validationErrors: ['weight: required'],
        confidenceScore: 0,
        needsHumanReview: false,
      };
      const result = translateError(state);
      expect(result).not.toBeNull();
      expect(result?.message).toContain('peso');
      expect(result?.actionable).toBe(true);
    });
    it('dovrebbe tradurre confidence score basso', () => {
      const state: AgentState = {
        messages: [new HumanMessage('test')],
        userId: 'test-user',
        userEmail: 'test@example.com',
        shipmentData: {},
        processingStatus: 'idle',
        validationErrors: [],
        confidenceScore: 30,
        needsHumanReview: false,
      };
      const result = translateError(state);
      expect(result).not.toBeNull();
      expect(result?.message).toContain('chiari');
      expect(result?.actionable).toBe(true);
    });
    it('dovrebbe tradurre errori di booking con credito insufficiente', () => {
      const state: AgentState = {
        messages: [new HumanMessage('test')],
        userId: 'test-user',
        userEmail: 'test@example.com',
        shipmentData: {},
        processingStatus: 'error',
        validationErrors: [],
        confidenceScore: 0,
        needsHumanReview: false,
        booking_result: {
          status: 'failed',
          error_code: 'INSUFFICIENT_CREDIT',
          user_message: 'Credito insufficiente',
        },
      };
      const result = translateError(state);
      expect(result).not.toBeNull();
      expect(result?.message).toContain('saldo');
      expect(result?.message).toContain('wallet');
      expect(result?.severity).toBe('error');
    });
    it('dovrebbe restituire null se non ci sono errori', () => {
      const state: AgentState = {
        messages: [new HumanMessage('test')],
        userId: 'test-user',
        userEmail: 'test@example.com',
        shipmentData: {},
        processingStatus: 'complete',
        validationErrors: [],
        confidenceScore: 90,
        needsHumanReview: false,
      };
      const result = translateError(state);
      expect(result).toBeNull();
    });
  });
  describe('translateSpecificError', () => {
    it('dovrebbe tradurre errore di validazione specifico', () => {
      const error: AgentError = {
        type: 'validation',
        field: 'destinationZip',
        technical: 'destinationZip: required',
      };
      const result = translateSpecificError(error);
      expect(result.message).toContain('CAP');
      expect(result.actionable).toBe(true);
      expect(result.field).toBe('destinationZip');
    });
    it('dovrebbe tradurre errore di sistema con fallback reason', () => {
      const error: AgentError = {
        type: 'system',
        technical: 'Graph execution failed',
        fallbackReason: 'graph_error',
      };
      const result = translateSpecificError(error);
      expect(result.message).toContain('problema tecnico');
      expect(result.actionable).toBe(false);
      expect(result.severity).toBe('error');
    });
    it('dovrebbe tradurre errore di confidence', () => {
      const error: AgentError = {
        type: 'confidence',
        technical: 'Low confidence',
        confidenceScore: 40,
      };
      const result = translateSpecificError(error);
      expect(result.message).toContain('chiari');
      expect(result.actionable).toBe(true);
    });
  });
});