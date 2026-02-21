/**
 * M2: Instrumented Supabase Client
 *
 * Wrapper che crea automaticamente Sentry spans per tutte le query Supabase.
 * Permette distributed tracing end-to-end senza modificare codice esistente.
 *
 * @example
 * import { instrumentSupabaseClient } from '@/lib/db/instrumented-client';
 * import { supabaseAdmin } from '@/lib/supabase';
 *
 * const db = instrumentSupabaseClient(supabaseAdmin, requestId);
 * const { data } = await db.from('shipments').select('*').limit(10);
 * // Automaticamente crea span "db.query.shipments" in Sentry
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { createLogger } from '@/lib/logger';

/**
 * Wrappa il Supabase client per instrumentazione automatica
 *
 * @param client - Supabase client da wrappare
 * @param requestId - Request ID per correlazione logs
 * @returns Supabase client instrumentato (stesso API, trace automatico)
 */
export function instrumentSupabaseClient(
  client: SupabaseClient,
  requestId?: string
): SupabaseClient {
  const logger = createLogger(requestId);

  // Crea Proxy per intercettare metodi
  return new Proxy(client, {
    get(target, prop) {
      const value = target[prop as keyof SupabaseClient];

      // Intercetta metodo 'from' per wrappare query builder
      if (prop === 'from' && typeof value === 'function') {
        return (tableName: string) => {
          const tableBuilder = (value as any).call(target, tableName);
          return wrapQueryBuilder(tableBuilder, tableName, requestId, logger);
        };
      }

      // Intercetta metodo 'rpc' per wrappare RPC calls
      if (prop === 'rpc' && typeof value === 'function') {
        return async (fnName: string, params?: any) => {
          return await Sentry.startSpan(
            {
              op: 'db.rpc',
              name: `supabase.rpc.${fnName}`,
              attributes: {
                'db.system': 'postgresql',
                'db.name': 'supabase',
                'db.operation': 'rpc',
                'db.rpc.function': fnName,
              },
            },
            async () => {
              const startTime = Date.now();
              try {
                const result = await (value as any).call(target, fnName, params);
                const duration = Date.now() - startTime;

                logger.debug(`RPC call: ${fnName}`, {
                  function: fnName,
                  duration,
                  success: !result.error,
                });

                return result;
              } catch (error) {
                logger.error(`RPC call failed: ${fnName}`, error);
                throw error;
              }
            }
          );
        };
      }

      return value;
    },
  }) as SupabaseClient;
}

/**
 * Wrappa query builder per tracciare query execution
 */
function wrapQueryBuilder(
  builder: any,
  tableName: string,
  requestId?: string,
  logger?: ReturnType<typeof createLogger>
) {
  let operation = 'query'; // default

  // Crea Proxy per intercettare metodi query
  return new Proxy(builder, {
    get(target, prop) {
      const value = target[prop];

      if (typeof value !== 'function') return value;

      // Traccia operazioni
      if (prop === 'select') operation = 'select';
      if (prop === 'insert') operation = 'insert';
      if (prop === 'update') operation = 'update';
      if (prop === 'delete') operation = 'delete';
      if (prop === 'upsert') operation = 'upsert';

      // Metodi terminali che eseguono la query
      if (prop === 'then' || prop === 'single' || prop === 'maybeSingle') {
        return async function (this: any, ...args: any[]) {
          // Crea span Sentry per questa query
          return await Sentry.startSpan(
            {
              op: 'db.query',
              name: `supabase.${tableName}.${operation}`,
              attributes: {
                'db.system': 'postgresql',
                'db.name': 'supabase',
                'db.table': tableName,
                'db.operation': operation,
              },
            },
            async () => {
              const startTime = Date.now();
              try {
                // Esegui query originale
                const result = await value.apply(target, args);
                const duration = Date.now() - startTime;

                // Log solo se molto lento (>1s) o errore
                if (duration > 1000 || result.error) {
                  logger?.info(`DB ${operation}: ${tableName}`, {
                    table: tableName,
                    operation,
                    duration,
                    success: !result.error,
                    slow: duration > 1000,
                  });
                } else {
                  logger?.debug(`DB ${operation}: ${tableName}`, {
                    table: tableName,
                    operation,
                    duration,
                  });
                }

                return result;
              } catch (error) {
                logger?.error(`DB ${operation} failed: ${tableName}`, error, {
                  table: tableName,
                  operation,
                });
                throw error;
              }
            }
          );
        };
      }

      // Altri metodi: chain normalmente
      return function (this: any, ...args: any[]) {
        const result = value.apply(target, args);
        // Se il risultato è chainable, wrappalo ricorsivamente
        if (result && typeof result === 'object') {
          return wrapQueryBuilder(result, tableName, requestId, logger);
        }
        return result;
      };
    },
  });
}

/**
 * Factory function (following M1 pattern)
 *
 * @param client - Supabase client da instrumentare
 * @param requestId - Request ID (opzionale)
 * @returns Client instrumentato
 */
export function createInstrumentedClient(
  client: SupabaseClient,
  requestId?: string
): SupabaseClient {
  return instrumentSupabaseClient(client, requestId);
}
