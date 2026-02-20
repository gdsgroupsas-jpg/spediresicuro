/**
 * Test: Shipment Creation LLM Module
 *
 * Verifica l'estrazione dati spedizione via LLM (DeepSeek)
 * e la generazione di domande conversazionali naturali.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock della factory LLM (disaccoppia dal provider sottostante)
const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock('@/lib/agent/llm-factory', () => ({
  createGraphLLM: vi.fn().mockReturnValue({
    invoke: mockInvoke,
  }),
}));

vi.mock('@/lib/agent/logger', () => ({
  defaultLogger: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  extractWithLLM,
  type LLMExtractionResult,
} from '@/lib/agent/workers/shipment-creation-llm';
import { createGraphLLM } from '@/lib/agent/llm-factory';

describe('extractWithLLM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ripristina mock factory per ritornare LLM valido
    vi.mocked(createGraphLLM).mockReturnValue({
      invoke: mockInvoke,
    } as never);
  });

  describe('Estrazione completa', () => {
    it('dovrebbe estrarre tutti i dati da un messaggio ricco', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: 'Mario Rossi',
            addressLine1: 'Via Roma 1',
            city: 'Milano',
            postalCode: '20100',
            province: 'MI',
            phone: '3331234567',
            weightKg: 5,
          },
          question: null,
          confidence: 95,
        }),
      });

      const result = await extractWithLLM('Spedire 5kg a Mario Rossi, Via Roma 1, 20100 Milano MI');

      expect(result).not.toBeNull();
      expect(result!.extractedData.recipient?.fullName).toBe('Mario Rossi');
      expect(result!.extractedData.recipient?.addressLine1).toBe('Via Roma 1');
      expect(result!.extractedData.recipient?.city).toBe('Milano');
      expect(result!.extractedData.recipient?.postalCode).toBe('20100');
      expect(result!.extractedData.recipient?.province).toBe('MI');
      expect(result!.extractedData.parcel?.weightKg).toBe(5);
      expect(result!.conversationalQuestion).toBeNull();
      expect(result!.confidence).toBe(95);
    });

    it('dovrebbe normalizzare provincia in maiuscolo', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: 'Test',
            addressLine1: null,
            city: 'Roma',
            postalCode: null,
            province: 'rm',
            phone: null,
            weightKg: null,
          },
          question: 'Mi serve indirizzo e CAP!',
          confidence: 60,
        }),
      });

      const result = await extractWithLLM('Test a Roma rm');

      expect(result!.extractedData.recipient?.province).toBe('RM');
    });

    it('dovrebbe scartare CAP invalido (non 5 cifre)', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: 'Test',
            addressLine1: null,
            city: null,
            postalCode: '123', // invalido
            province: null,
            phone: null,
            weightKg: null,
          },
          question: null,
          confidence: 50,
        }),
      });

      const result = await extractWithLLM('Test 123');

      expect(result!.extractedData.recipient?.postalCode).toBeUndefined();
    });

    it('dovrebbe scartare provincia invalida (non 2 lettere)', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: null,
            addressLine1: null,
            city: null,
            postalCode: null,
            province: 'Milano', // invalido, deve essere MI
            phone: null,
            weightKg: null,
          },
          question: null,
          confidence: 50,
        }),
      });

      const result = await extractWithLLM('Milano');

      expect(result!.extractedData.recipient?.province).toBeUndefined();
    });
  });

  describe('Estrazione parziale con domanda conversazionale', () => {
    it('dovrebbe generare domanda conversazionale quando mancano campi', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: 'Mario Rossi',
            addressLine1: null,
            city: 'Milano',
            postalCode: null,
            province: null,
            phone: null,
            weightKg: 5,
          },
          question: 'Ho capito, 5kg a Mario Rossi a Milano! Mi mancano via e CAP, me li dici?',
          confidence: 70,
        }),
      });

      const result = await extractWithLLM('5kg a Mario Rossi a Milano');

      expect(result!.conversationalQuestion).toBe(
        'Ho capito, 5kg a Mario Rossi a Milano! Mi mancano via e CAP, me li dici?'
      );
      expect(result!.extractedData.recipient?.fullName).toBe('Mario Rossi');
      expect(result!.extractedData.parcel?.weightKg).toBe(5);
    });
  });

  describe('Contesto draft esistente', () => {
    it('dovrebbe passare dati esistenti al LLM come contesto', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: null,
            addressLine1: 'Via Dante 7',
            city: null,
            postalCode: '20100',
            province: 'MI',
            phone: null,
            weightKg: null,
          },
          question: null,
          confidence: 90,
        }),
      });

      const existingDraft = {
        recipient: { fullName: 'Mario Rossi', city: 'Milano' },
        parcel: { weightKg: 5 },
        missingFields: [],
      };

      await extractWithLLM('Via Dante 7, 20100 MI', existingDraft);

      // Verifica che il prompt includa i dati esistenti
      const invokeCall = mockInvoke.mock.calls[0][0];
      const userMessage = invokeCall[1]; // SystemMessage + HumanMessage
      const content = userMessage.content || userMessage.kwargs?.content || '';
      expect(content).toContain('Mario Rossi');
      expect(content).toContain('Milano');
      expect(content).toContain('5 kg');
    });
  });

  describe('Fallback e gestione errori', () => {
    it('dovrebbe ritornare null se LLM non disponibile (API key mancante)', async () => {
      vi.mocked(createGraphLLM).mockReturnValueOnce(null);

      const result = await extractWithLLM('test');

      expect(result).toBeNull();
    });

    it('dovrebbe ritornare null se LLM lancia eccezione', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('API timeout'));

      const result = await extractWithLLM('test');

      expect(result).toBeNull();
    });

    it('dovrebbe ritornare null se LLM ritorna JSON malformato', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: 'questo non e json valido!!!',
      });

      const result = await extractWithLLM('test');

      expect(result).toBeNull();
    });

    it('dovrebbe gestire risposta LLM con backtick markdown', async () => {
      mockInvoke.mockResolvedValueOnce({
        content:
          '```json\n{"extracted":{"fullName":"Test","addressLine1":null,"city":null,"postalCode":null,"province":null,"phone":null,"weightKg":2},"question":"Dove spedisco?","confidence":60}\n```',
      });

      const result = await extractWithLLM('2kg per Test');

      expect(result).not.toBeNull();
      expect(result!.extractedData.recipient?.fullName).toBe('Test');
      expect(result!.extractedData.parcel?.weightKg).toBe(2);
    });

    it('dovrebbe gestire campo extracted mancante nella risposta', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          question: 'Cosa devo spedire?',
          confidence: 30,
        }),
      });

      const result = await extractWithLLM('ciao');

      expect(result).not.toBeNull();
      expect(result!.conversationalQuestion).toBe('Cosa devo spedire?');
      // extracted mancante = tutti i campi undefined
      expect(result!.extractedData.recipient?.fullName).toBeUndefined();
    });
  });

  describe('Conversione tipi', () => {
    it('dovrebbe convertire weightKg stringa a numero', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: null,
            addressLine1: null,
            city: null,
            postalCode: null,
            province: null,
            phone: null,
            weightKg: '3.5', // stringa dal LLM
          },
          question: null,
          confidence: 80,
        }),
      });

      const result = await extractWithLLM('3.5 kg');

      expect(result!.extractedData.parcel?.weightKg).toBe(3.5);
      expect(typeof result!.extractedData.parcel?.weightKg).toBe('number');
    });

    it('dovrebbe gestire confidence come stringa', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: null,
            addressLine1: null,
            city: null,
            postalCode: null,
            province: null,
            phone: null,
            weightKg: null,
          },
          question: null,
          confidence: '85', // stringa
        }),
      });

      const result = await extractWithLLM('test');

      expect(result!.confidence).toBe(85);
    });
  });

  // ==================== GUARDRAIL (Audit fix) ====================

  describe('Guardrail validazione output LLM', () => {
    it('dovrebbe scartare weightKg negativo', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: 'Test',
            addressLine1: null,
            city: null,
            postalCode: null,
            province: null,
            phone: null,
            weightKg: -5,
          },
          question: null,
          confidence: 50,
        }),
      });

      const result = await extractWithLLM('test');

      expect(result!.extractedData.parcel).toBeUndefined();
    });

    it('dovrebbe scartare weightKg Infinity', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: null,
            addressLine1: null,
            city: null,
            postalCode: null,
            province: null,
            phone: null,
            weightKg: 'Infinity',
          },
          question: null,
          confidence: 50,
        }),
      });

      const result = await extractWithLLM('test');

      expect(result!.extractedData.parcel).toBeUndefined();
    });

    it('dovrebbe scartare weightKg NaN (stringa non numerica)', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: null,
            addressLine1: null,
            city: null,
            postalCode: null,
            province: null,
            phone: null,
            weightKg: 'pesante',
          },
          question: null,
          confidence: 50,
        }),
      });

      const result = await extractWithLLM('test');

      expect(result!.extractedData.parcel).toBeUndefined();
    });

    it('dovrebbe troncare domanda conversazionale troppo lunga', async () => {
      const longQuestion = 'A'.repeat(600);
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: null,
            addressLine1: null,
            city: null,
            postalCode: null,
            province: null,
            phone: null,
            weightKg: null,
          },
          question: longQuestion,
          confidence: 50,
        }),
      });

      const result = await extractWithLLM('test');

      expect(result!.conversationalQuestion).not.toBeNull();
      expect(result!.conversationalQuestion!.length).toBeLessThanOrEqual(503); // 500 + "..."
    });

    it('dovrebbe trattare question stringa vuota come null', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: null,
            addressLine1: null,
            city: null,
            postalCode: null,
            province: null,
            phone: null,
            weightKg: null,
          },
          question: '   ', // solo spazi
          confidence: 50,
        }),
      });

      const result = await extractWithLLM('test');

      expect(result!.conversationalQuestion).toBeNull();
    });

    it('dovrebbe impostare country a IT nel recipient', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {
            fullName: 'Test',
            addressLine1: null,
            city: null,
            postalCode: null,
            province: null,
            phone: null,
            weightKg: null,
          },
          question: null,
          confidence: 50,
        }),
      });

      const result = await extractWithLLM('test');

      expect(result!.extractedData.recipient?.country).toBe('IT');
    });

    it('dovrebbe loggare telemetria su successo', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: { fullName: 'Mario' },
          question: null,
          confidence: 90,
        }),
      });

      await extractWithLLM('test');

      const telemetryLog = consoleSpy.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('[TELEMETRY]') &&
          call[0].includes('llm_extraction')
      );
      expect(telemetryLog).toBeDefined();
      expect(telemetryLog![0]).toContain('"status":"success"');
      expect(telemetryLog![0]).toContain('"confidence":90');

      consoleSpy.mockRestore();
    });

    it('dovrebbe loggare telemetria su fallimento', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      mockInvoke.mockRejectedValueOnce(new SyntaxError('Unexpected token'));

      const result = await extractWithLLM('test');

      expect(result).toBeNull();

      const telemetryLog = consoleSpy.mock.calls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('[TELEMETRY]') &&
          call[0].includes('llm_extraction')
      );
      expect(telemetryLog).toBeDefined();
      expect(telemetryLog![0]).toContain('"status":"failure"');
      expect(telemetryLog![0]).toContain('"error_type":"SyntaxError"');

      consoleSpy.mockRestore();
    });

    it('dovrebbe gestire dati LLM completamente vuoti (extracted: {})', async () => {
      mockInvoke.mockResolvedValueOnce({
        content: JSON.stringify({
          extracted: {},
          question: 'Dimmi cosa devo spedire!',
          confidence: 20,
        }),
      });

      const result = await extractWithLLM('ciao');

      expect(result).not.toBeNull();
      expect(result!.extractedData.recipient?.fullName).toBeUndefined();
      expect(result!.extractedData.parcel).toBeUndefined();
      expect(result!.conversationalQuestion).toBe('Dimmi cosa devo spedire!');
    });
  });
});
