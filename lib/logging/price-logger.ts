/**
 * Pricing Logger - Milestone 4
 *
 * Logger strutturato per il modulo pricing con:
 * - Livelli configurabili (debug, info, warn, error)
 * - Contesto automatico (operation, priceListId, workspaceId, userId)
 * - Output JSON per parsing in produzione
 * - Verbose mode disabilitabile
 *
 * @example
 * const logger = createPriceLogger({ operation: 'calculatePrice', workspaceId: 'ws-123' });
 * logger.info('Calcolo prezzo', { weight: 5, destination: 'MI' });
 * logger.debug('Dettagli matrice', { entries: 10 }); // Solo se PRICE_LOG_LEVEL=debug
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  operation?: string;
  priceListId?: string;
  priceListName?: string;
  workspaceId?: string;
  userId?: string;
  courierId?: string;
  masterListId?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: 'pricing';
  operation?: string;
  message: string;
  context?: LogContext;
  data?: Record<string, unknown>;
}

// Livello di log configurabile via env
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLevel(): LogLevel {
  const envLevel = process.env.PRICE_LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  // Default: info in produzione, debug in development
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  const configuredLevel = getConfiguredLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel];
}

// Verbose mode: disabilita log dettagliati (debug + alcuni info)
function isVerboseEnabled(): boolean {
  // In produzione, verbose è disabilitato di default
  if (process.env.NODE_ENV === 'production') {
    return process.env.PRICE_LOG_VERBOSE === 'true';
  }
  // In development, verbose è abilitato di default (può essere disabilitato)
  return process.env.PRICE_LOG_VERBOSE !== 'false';
}

// JSON output mode per parsing
function isJsonMode(): boolean {
  return process.env.PRICE_LOG_JSON === 'true' || process.env.NODE_ENV === 'production';
}

// ✨ CRITICAL FIX: Scrub dati sensibili in produzione
function shouldScrubSensitiveData(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.PRICE_LOG_SENSITIVE !== 'true';
}

// Campi sensibili da mascherare
const SENSITIVE_FIELDS = [
  'supplierPrice',
  'margin',
  'finalPrice',
  'basePrice',
  'surcharges',
  'totalCost',
];

function scrubSensitiveData(
  data: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!data || !shouldScrubSensitiveData()) return data;

  const scrubbed = { ...data };
  for (const field of SENSITIVE_FIELDS) {
    if (field in scrubbed) {
      scrubbed[field] = '[REDACTED]';
    }
  }
  return scrubbed;
}

function formatLogEntry(entry: LogEntry): string {
  // ✨ CRITICAL FIX: Scrub dati sensibili prima di loggare
  const safeEntry = shouldScrubSensitiveData()
    ? { ...entry, data: scrubSensitiveData(entry.data) }
    : entry;

  if (isJsonMode()) {
    return JSON.stringify(safeEntry);
  }

  // Human-readable format per development
  const prefix = getLogPrefix(entry.level, entry.operation);
  const contextStr = entry.context
    ? Object.entries(entry.context)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
    : '';

  // ✨ CRITICAL FIX: Usa safeEntry anche per human-readable
  const safeData = safeEntry.data;
  const dataStr = safeData ? ` | ${JSON.stringify(safeData)}` : '';

  return `${prefix} ${safeEntry.message}${contextStr ? ` [${contextStr}]` : ''}${dataStr}`;
}

function getLogPrefix(level: LogLevel, operation?: string): string {
  const icons: Record<LogLevel, string> = {
    debug: '🔍',
    info: '✅',
    warn: '⚠️',
    error: '❌',
  };
  const op = operation ? `[${operation.toUpperCase()}]` : '[PRICING]';
  return `${icons[level]} ${op}`;
}

function writeLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export interface PriceLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;

  /** Log dettagliato (solo se verbose abilitato) */
  verbose(message: string, data?: Record<string, unknown>): void;

  /** Crea child logger con contesto aggiuntivo */
  child(additionalContext: Partial<LogContext>): PriceLogger;

  /** Log di una fase di calcolo pricing */
  phase(phase: string, data?: Record<string, unknown>): void;

  /** Log del risultato finale */
  result(result: {
    finalPrice: number;
    supplierPrice?: number;
    margin?: number;
    vatMode?: string;
  }): void;
}

/**
 * Crea un logger per operazioni pricing
 *
 * @param context - Contesto iniziale (operation, priceListId, etc.)
 * @returns Logger istanza
 */
export function createPriceLogger(context: LogContext = {}): PriceLogger {
  const baseContext = { ...context };

  const log = (level: LogLevel, message: string, data?: Record<string, unknown>): void => {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: 'pricing',
      operation: baseContext.operation,
      message,
      context: Object.keys(baseContext).length > 0 ? baseContext : undefined,
      data,
    };

    writeLog(entry);
  };

  return {
    debug: (message, data) => log('debug', message, data),
    info: (message, data) => log('info', message, data),
    warn: (message, data) => log('warn', message, data),
    error: (message, data) => log('error', message, data),

    verbose: (message, data) => {
      if (isVerboseEnabled()) {
        log('debug', message, data);
      }
    },

    child: (additionalContext) => {
      return createPriceLogger({ ...baseContext, ...additionalContext });
    },

    phase: (phase, data) => {
      log('info', `[PHASE: ${phase}]`, data);
    },

    result: (result) => {
      log('info', 'Calcolo completato', {
        finalPrice: (result.finalPrice ?? 0).toFixed(2),
        supplierPrice: result.supplierPrice?.toFixed(2),
        margin: result.margin?.toFixed(2),
        vatMode: result.vatMode,
      });
    },
  };
}

// Logger singleton per operazioni generiche
let defaultLogger: PriceLogger | null = null;

export function getPriceLogger(): PriceLogger {
  if (!defaultLogger) {
    defaultLogger = createPriceLogger({ operation: 'pricing' });
  }
  return defaultLogger;
}

/**
 * Helper per logging condizionale di dettagli pricing
 * Usato per log molto verbosi che possono essere disabilitati
 */
export function logPricingDetails(
  logger: PriceLogger,
  details: {
    priceListName: string;
    priceListType: string;
    basePrice: number;
    surcharges: number;
    totalCost: number;
    supplierPrice?: number;
    margin?: number;
    vatMode?: string;
  }
): void {
  logger.verbose('Dettagli calcolo prezzo', {
    listino: details.priceListName,
    tipo: details.priceListType,
    basePrice: `€${details.basePrice.toFixed(2)}`,
    surcharges: `€${details.surcharges.toFixed(2)}`,
    totalCost: `€${details.totalCost.toFixed(2)}`,
    supplierPrice: details.supplierPrice ? `€${details.supplierPrice.toFixed(2)}` : undefined,
    margin: details.margin ? `€${details.margin.toFixed(2)}` : undefined,
    vatMode: details.vatMode,
  });
}

/**
 * Helper per logging errori pricing con stack trace
 */
export function logPricingError(
  logger: PriceLogger,
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`Errore in ${operation}: ${errorMessage}`, {
    ...context,
    stack: errorStack,
  });
}
