/**
 * Cron Utilities per Automation Engine
 *
 * Usa croner per parsing e matching di espressioni cron.
 * Il dispatcher chiama shouldRunNow() ogni 5 minuti per decidere
 * se una automazione deve essere eseguita.
 */

import { Cron } from 'croner';

/**
 * Verifica se un'espressione cron dovrebbe eseguire ora,
 * considerando una finestra di tolleranza.
 *
 * @param cronExpr - Espressione cron (es. '0 2 1 * *')
 * @param toleranceMinutes - Finestra tolleranza in minuti (default: 5)
 * @param now - Momento corrente (default: new Date())
 * @returns true se l'ultimo scheduled time è entro la tolleranza
 */
export function shouldRunNow(
  cronExpr: string,
  toleranceMinutes: number = 5,
  now: Date = new Date()
): boolean {
  try {
    const job = new Cron(cronExpr);
    const toleranceMs = toleranceMinutes * 60 * 1000;
    const windowStart = new Date(now.getTime() - toleranceMs);

    // Calcola il prossimo run dal punto di inizio finestra.
    // Se cade tra windowStart e now, il cron è nel momento giusto.
    const nextFromWindow = job.nextRun(windowStart);

    if (!nextFromWindow) return false;

    return (
      nextFromWindow.getTime() >= windowStart.getTime() && nextFromWindow.getTime() <= now.getTime()
    );
  } catch {
    console.error(`[CRON] Espressione cron non valida: ${cronExpr}`);
    return false;
  }
}

/**
 * Calcola la prossima esecuzione prevista.
 *
 * @param cronExpr - Espressione cron
 * @param from - Da quando calcolare (default: now)
 * @returns Date della prossima esecuzione, o null se invalida
 */
export function getNextRun(cronExpr: string, from?: Date): Date | null {
  try {
    const job = new Cron(cronExpr);
    const next = job.nextRun(from);
    return next;
  } catch {
    return null;
  }
}

/**
 * Valida un'espressione cron.
 *
 * @param cronExpr - Espressione cron da validare
 * @returns true se valida
 */
export function isValidCron(cronExpr: string): boolean {
  try {
    new Cron(cronExpr);
    return true;
  } catch {
    return false;
  }
}
