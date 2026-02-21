/**
 * Interfaccia Logger minimale per disaccoppiare logging dalla business logic.
 *
 * Implementazione default usa console, ma può essere sostituita per test o telemetria.
 */

export interface ILogger {
  log(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Implementazione default che usa console
 */
class ConsoleLogger implements ILogger {
  log(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  }
}

/**
 * Logger default esportato
 * Può essere sostituito per test o telemetria avanzata
 */
export const defaultLogger: ILogger = new ConsoleLogger();

/**
 * Logger nullo per test (non logga nulla)
 */
export class NullLogger implements ILogger {
  log(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
