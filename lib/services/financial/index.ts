/**
 * Financial Services Index
 *
 * Esporta tutti i servizi finanziari centralizzati.
 *
 * @module lib/services/financial
 * @since Sprint 3 - Refactoring
 */

export {
  FinancialAlertsService,
  createFinancialAlertsService,
  type FinancialAlert,
  type AlertSeverity,
  type AlertConfig,
} from './financial-alerts-service';

export {
  ReconciliationService,
  createReconciliationService,
  type ReconciliationItem,
  type ReconciliationStats,
  type ReconciliationStatus,
  type BulkReconciliationResult,
} from './reconciliation-service';
