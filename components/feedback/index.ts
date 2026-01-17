/**
 * Feedback Components Library
 *
 * Enterprise-grade UI feedback system per SpedireSicuro
 * Implements: ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md - Phase 3
 *
 * Components:
 * - SuccessModal: Modal di conferma successo con tracking + azioni
 * - ErrorDialog: Dialog errore con recovery actions
 * - OperationSkeleton: Placeholder loading animato
 * - StateIndicator: Badge stato operazione (idle/loading/success/error)
 */

export { SuccessModal } from './SuccessModal'
export type { SuccessModalProps } from './SuccessModal'

export { ErrorDialog } from './ErrorDialog'
export type { ErrorDialogProps, ErrorData, ErrorAction } from './ErrorDialog'

export { OperationSkeleton } from './OperationSkeleton'
export type { OperationSkeletonProps, SkeletonShape } from './OperationSkeleton'

export { StateIndicator } from './StateIndicator'
export type { StateIndicatorProps, OperationState } from './StateIndicator'
