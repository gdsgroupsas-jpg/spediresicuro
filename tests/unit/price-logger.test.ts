/**
 * Test Price Logger - Milestone 4
 *
 * Verifica:
 * 1. Creazione logger con contesto
 * 2. Livelli di log rispettati
 * 3. Child logger eredita contesto
 * 4. Verbose mode configurabile
 * 5. Output formattato correttamente
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createPriceLogger,
  getPriceLogger,
  logPricingDetails,
  logPricingError,
  type PriceLogger,
} from '@/lib/logging/price-logger';

describe('Price Logger - M4', () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
    // Reset env per test
    delete process.env.PRICE_LOG_LEVEL;
    delete process.env.PRICE_LOG_VERBOSE;
    delete process.env.PRICE_LOG_JSON;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Logger Creation', () => {
    it('crea logger con contesto vuoto', () => {
      const logger = createPriceLogger();
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('crea logger con contesto operation', () => {
      const logger = createPriceLogger({ operation: 'calculatePrice' });
      logger.info('Test message');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('CALCULATEPRICE');
    });

    it('crea logger con contesto completo', () => {
      const logger = createPriceLogger({
        operation: 'getApplicablePriceList',
        workspaceId: 'ws-123',
        userId: 'user-456',
        priceListId: 'pl-789',
      });

      logger.info('Test con contesto');

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('workspaceId=ws-123');
      expect(logCall).toContain('userId=user-456');
    });
  });

  describe('Log Levels', () => {
    it('debug() scrive su console.log', () => {
      const logger = createPriceLogger();
      logger.debug('Debug message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('info() scrive su console.log', () => {
      const logger = createPriceLogger();
      logger.info('Info message');
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('warn() scrive su console.warn', () => {
      const logger = createPriceLogger();
      logger.warn('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('error() scrive su console.error', () => {
      const logger = createPriceLogger();
      logger.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('Child Logger', () => {
    it('child() eredita contesto parent', () => {
      const parent = createPriceLogger({
        operation: 'parent',
        workspaceId: 'ws-123',
      });

      const child = parent.child({
        priceListId: 'pl-456',
      });

      child.info('Child message');

      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('workspaceId=ws-123');
      expect(logCall).toContain('priceListId=pl-456');
    });

    it('child() può sovrascrivere contesto parent', () => {
      const parent = createPriceLogger({
        operation: 'parent',
        workspaceId: 'ws-old',
      });

      const child = parent.child({
        workspaceId: 'ws-new',
      });

      child.info('Child message');

      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('workspaceId=ws-new');
      expect(logCall).not.toContain('workspaceId=ws-old');
    });
  });

  describe('Verbose Mode', () => {
    it('verbose() scrive quando PRICE_LOG_VERBOSE non è false', () => {
      const logger = createPriceLogger();
      logger.verbose('Verbose message');

      // In test env (non production), verbose è abilitato di default
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('verbose() non scrive quando PRICE_LOG_VERBOSE=false', () => {
      process.env.PRICE_LOG_VERBOSE = 'false';
      const logger = createPriceLogger();
      logger.verbose('Verbose message');

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });
  });

  describe('Phase Logging', () => {
    it('phase() logga con formato corretto', () => {
      const logger = createPriceLogger({ operation: 'calcPrice' });
      logger.phase('RECUPERO_MASTER', { masterListId: 'ml-123' });

      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[PHASE: RECUPERO_MASTER]');
    });
  });

  describe('Result Logging', () => {
    it('result() logga risultato pricing', () => {
      const logger = createPriceLogger();
      logger.result({
        finalPrice: 12.5,
        supplierPrice: 10.0,
        margin: 2.5,
        vatMode: 'excluded',
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('Calcolo completato');
    });
  });

  describe('Helper Functions', () => {
    it('logPricingDetails() logga dettagli formattati', () => {
      const logger = createPriceLogger();
      logPricingDetails(logger, {
        priceListName: 'Test List',
        priceListType: 'custom',
        basePrice: 10.0,
        surcharges: 1.5,
        totalCost: 11.5,
        supplierPrice: 8.0,
        margin: 3.5,
        vatMode: 'excluded',
      });

      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it('logPricingError() logga errore con stack', () => {
      const logger = createPriceLogger();
      const error = new Error('Test error');

      logPricingError(logger, 'testOperation', error, { extraContext: 'value' });

      expect(consoleSpy.error).toHaveBeenCalled();
      const logCall = consoleSpy.error.mock.calls[0][0];
      expect(logCall).toContain('Test error');
    });

    it('logPricingError() gestisce errori non-Error', () => {
      const logger = createPriceLogger();
      logPricingError(logger, 'testOp', 'string error');

      expect(consoleSpy.error).toHaveBeenCalled();
      const logCall = consoleSpy.error.mock.calls[0][0];
      expect(logCall).toContain('string error');
    });
  });

  describe('Singleton Logger', () => {
    it('getPriceLogger() restituisce logger singleton', () => {
      const logger1 = getPriceLogger();
      const logger2 = getPriceLogger();

      // Verifica che siano lo stesso oggetto (singleton)
      expect(logger1).toBe(logger2);
    });
  });

  describe('Data Logging', () => {
    it('logga data object correttamente', () => {
      const logger = createPriceLogger();
      logger.info('Test with data', {
        price: 10.5,
        weight: 5,
        destination: 'MI',
      });

      expect(consoleSpy.log).toHaveBeenCalled();
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('price');
      expect(logCall).toContain('10.5');
    });
  });
});

describe('Price Logger - Environment Configuration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    delete process.env.PRICE_LOG_LEVEL;
    delete process.env.PRICE_LOG_VERBOSE;
    delete process.env.PRICE_LOG_JSON;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rispetta PRICE_LOG_LEVEL=warn (no debug/info)', () => {
    process.env.PRICE_LOG_LEVEL = 'warn';
    const logger = createPriceLogger();

    logger.debug('Debug');
    logger.info('Info');

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('rispetta PRICE_LOG_LEVEL=error (solo error)', () => {
    process.env.PRICE_LOG_LEVEL = 'error';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createPriceLogger();
    logger.warn('Warning');
    logger.error('Error');

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});
