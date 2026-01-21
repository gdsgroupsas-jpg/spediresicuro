/**
 * Error Handling Library
 *
 * Enterprise-grade error formatting and recovery actions
 * Implements: ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md - Phase 3
 *
 * Modules:
 * - error-formatter: Converte errori tecnici → user-friendly
 * - error-action-map: Mappa codici errore → azioni recovery
 */

export {
  formatError,
  formatException,
  formatApiError,
  type RawError,
  type FormattedError,
} from './error-formatter';

export {
  errorActionMap,
  getActionsForError,
  isKnownErrorCode,
  type KnownErrorCode,
  type ErrorActionConfig,
} from './error-action-map';
