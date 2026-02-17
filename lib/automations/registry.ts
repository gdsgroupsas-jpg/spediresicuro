/**
 * Registry Automazioni
 *
 * Mappa slug → handler. Ogni handler è una funzione async che riceve
 * la config e l'automazione, e ritorna un AutomationResult.
 *
 * Per aggiungere una nuova automazione:
 * 1. Crea handler in lib/automations/handlers/
 * 2. Registra qui con lo stesso slug del DB
 */

import type { AutomationHandler } from '@/types/automations';
import { handlePostpaidBilling } from './handlers/postpaid-billing';
import { handleLowBalanceAlert } from './handlers/low-balance-alert';

/**
 * Mappa slug → handler.
 * Lo slug DEVE corrispondere a automations.slug nel DB.
 */
export const AUTOMATION_HANDLERS: Record<string, AutomationHandler> = {
  'postpaid-monthly-billing': handlePostpaidBilling,
  'low-balance-alert': handleLowBalanceAlert,
};
