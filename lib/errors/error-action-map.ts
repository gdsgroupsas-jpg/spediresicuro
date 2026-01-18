/**
 * Error Action Mapping
 *
 * Mappa codici errore → azioni di recovery per ErrorDialog
 *
 * Design specs (ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md):
 * - Ogni errore ha azioni di recovery specifiche
 * - Primary CTA first
 * - Retry sempre disponibile (idempotent)
 * - Supportive tone (non-technical language)
 */

import type { ErrorAction } from '@/components/feedback'

/**
 * Tipo codice errore noto
 */
export type KnownErrorCode =
  | 'WALLET_INSUFFICIENT'
  | 'COURIER_NOT_AVAILABLE'
  | 'COURIER_NOT_SELECTED'
  | 'INVALID_ADDRESS'
  | 'RECIPIENT_VALIDATION_ERROR'
  | 'SENDER_VALIDATION_ERROR'
  | 'API_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'CONTRACT_NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'
  | 'GENERIC_ERROR'

/**
 * Configurazione azioni per codice errore
 */
export interface ErrorActionConfig {
  /** Azioni recovery disponibili */
  actions: ErrorAction[]
  /** Se retry è disponibile */
  canRetry: boolean
}

/**
 * Mappa completa codici errore → azioni
 */
export const errorActionMap: Record<KnownErrorCode, ErrorActionConfig> = {
  /**
   * WALLET_INSUFFICIENT
   * Causa: Saldo wallet insufficiente per la spedizione
   * Recovery: Ricarica wallet, scegli corriere più economico, contatta supporto
   */
  WALLET_INSUFFICIENT: {
    actions: [
      {
        id: 'add_wallet',
        label: 'Ricarica il tuo wallet',
        buttonText: 'Ricarica Wallet',
        destination: '/dashboard/wallet',
        type: 'primary',
        icon: 'wallet',
      },
      {
        id: 'change_courier',
        label: 'Scegli un corriere più economico',
        buttonText: 'Cambia Corriere',
        destination: null, // azione locale
        type: 'secondary',
        icon: 'courier',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null, // apre chat
        type: 'tertiary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },

  /**
   * COURIER_NOT_AVAILABLE
   * Causa: Corriere non disponibile per questa destinazione/servizio
   * Recovery: Scegli altro corriere, contatta supporto
   */
  COURIER_NOT_AVAILABLE: {
    actions: [
      {
        id: 'select_courier',
        label: 'Seleziona un altro corriere',
        buttonText: 'Scegli Corriere',
        destination: null,
        type: 'primary',
        icon: 'courier',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: false,
  },

  /**
   * COURIER_NOT_SELECTED
   * Causa: Nessun corriere selezionato dal preventivatore
   * Recovery: Seleziona corriere dal preventivatore
   */
  COURIER_NOT_SELECTED: {
    actions: [
      {
        id: 'select_courier',
        label: 'Seleziona un corriere dal preventivatore',
        buttonText: 'Scegli Corriere',
        destination: null,
        type: 'primary',
        icon: 'courier',
      },
    ],
    canRetry: false,
  },

  /**
   * INVALID_ADDRESS
   * Causa: Indirizzo mittente o destinatario non valido
   * Recovery: Correggi indirizzo, usa autocomplete
   */
  INVALID_ADDRESS: {
    actions: [
      {
        id: 'fix_address',
        label: 'Correggi i dati indirizzo',
        buttonText: 'Modifica Indirizzo',
        destination: null,
        type: 'primary',
        icon: 'settings',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },

  /**
   * RECIPIENT_VALIDATION_ERROR
   * Causa: Dati destinatario invalidi (telefono, email, etc.)
   * Recovery: Correggi dati destinatario
   */
  RECIPIENT_VALIDATION_ERROR: {
    actions: [
      {
        id: 'fix_recipient',
        label: 'Correggi i dati del destinatario',
        buttonText: 'Modifica Destinatario',
        destination: null,
        type: 'primary',
        icon: 'settings',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },

  /**
   * SENDER_VALIDATION_ERROR
   * Causa: Dati mittente invalidi
   * Recovery: Correggi dati mittente
   */
  SENDER_VALIDATION_ERROR: {
    actions: [
      {
        id: 'fix_sender',
        label: 'Correggi i dati del mittente',
        buttonText: 'Modifica Mittente',
        destination: null,
        type: 'primary',
        icon: 'settings',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },

  /**
   * API_TIMEOUT
   * Causa: API corriere/spedizioni non risponde
   * Recovery: Riprova (idempotent), contatta supporto
   */
  API_TIMEOUT: {
    actions: [
      {
        id: 'retry_later',
        label: 'Il servizio potrebbe essere temporaneamente non disponibile',
        buttonText: 'Riprova Tra Poco',
        destination: null,
        type: 'primary',
        icon: 'retry',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },

  /**
   * NETWORK_ERROR
   * Causa: Errore di rete (offline, DNS, etc.)
   * Recovery: Verifica connessione, riprova
   */
  NETWORK_ERROR: {
    actions: [
      {
        id: 'check_connection',
        label: 'Verifica la tua connessione internet',
        buttonText: 'Verifica',
        destination: null,
        type: 'primary',
        icon: 'settings',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },

  /**
   * CONTRACT_NOT_CONFIGURED
   * Causa: Contratto corriere non configurato
   * Recovery: Configura contratto, contatta supporto
   */
  CONTRACT_NOT_CONFIGURED: {
    actions: [
      {
        id: 'configure_contract',
        label: 'Configura il contratto per questo corriere',
        buttonText: 'Configura',
        destination: '/dashboard/integrazioni',
        type: 'primary',
        icon: 'settings',
      },
      {
        id: 'select_other',
        label: 'Seleziona un altro corriere',
        buttonText: 'Cambia Corriere',
        destination: null,
        type: 'secondary',
        icon: 'courier',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'tertiary',
        icon: 'support',
      },
    ],
    canRetry: false,
  },

  /**
   * UNAUTHORIZED
   * Causa: Credenziali API non valide o scadute
   * Recovery: Verifica credenziali, contatta supporto
   */
  UNAUTHORIZED: {
    actions: [
      {
        id: 'check_credentials',
        label: 'Verifica le tue credenziali API',
        buttonText: 'Verifica',
        destination: '/dashboard/integrazioni',
        type: 'primary',
        icon: 'settings',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: false,
  },

  /**
   * RATE_LIMIT
   * Causa: Troppi tentativi, rate limit raggiunto
   * Recovery: Aspetta e riprova
   */
  RATE_LIMIT: {
    actions: [
      {
        id: 'wait',
        label: 'Troppi tentativi. Attendi qualche minuto.',
        buttonText: 'Riprova Tra 1 Min',
        destination: null,
        type: 'primary',
        icon: 'retry',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },

  /**
   * SERVER_ERROR
   * Causa: Errore interno server (500)
   * Recovery: Riprova, contatta supporto
   */
  SERVER_ERROR: {
    actions: [
      {
        id: 'retry',
        label: 'Si è verificato un errore del server',
        buttonText: 'Riprova',
        destination: null,
        type: 'primary',
        icon: 'retry',
      },
      {
        id: 'support',
        label: 'Contatta il supporto se il problema persiste',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },

  /**
   * GENERIC_ERROR
   * Causa: Errore non classificato
   * Recovery: Riprova, contatta supporto, vedi log
   */
  GENERIC_ERROR: {
    actions: [
      {
        id: 'retry',
        label: 'Si è verificato un errore',
        buttonText: 'Riprova',
        destination: null,
        type: 'primary',
        icon: 'retry',
      },
      {
        id: 'support',
        label: 'Contatta il supporto',
        buttonText: 'Supporto',
        destination: null,
        type: 'secondary',
        icon: 'support',
      },
    ],
    canRetry: true,
  },
}

/**
 * Ottieni azioni per un codice errore
 */
export function getActionsForError(code: string): ErrorActionConfig {
  const knownCode = code as KnownErrorCode
  return errorActionMap[knownCode] || errorActionMap.GENERIC_ERROR
}

/**
 * Verifica se un codice è noto
 */
export function isKnownErrorCode(code: string): code is KnownErrorCode {
  return code in errorActionMap
}
