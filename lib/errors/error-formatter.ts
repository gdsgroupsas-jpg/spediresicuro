/**
 * Error Formatter
 *
 * Converte errori tecnici in messaggi user-friendly
 *
 * Design specs (ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md):
 * - Non-technical language
 * - Supportive tone
 * - No blame (avoid: "User error", "Invalid input")
 * - No tech jargon (avoid: "HTTP 402", "RPC call failed")
 */

import type { ErrorData, ErrorAction } from '@/components/feedback'
import { getActionsForError, type KnownErrorCode } from './error-action-map'

/**
 * Input errore raw (da API, exception, etc.)
 */
export interface RawError {
  /** Codice errore (opzionale) */
  code?: string
  /** Messaggio originale */
  message?: string
  /** Status HTTP (opzionale) */
  status?: number
  /** Dettagli aggiuntivi */
  details?: Record<string, unknown>
  /** Error object originale */
  originalError?: Error | unknown
}

/**
 * Output formattato per ErrorDialog
 */
export interface FormattedError {
  /** Dati errore formattati */
  error: ErrorData
  /** Azioni recovery */
  actions: ErrorAction[]
  /** Se retry è disponibile */
  canRetry: boolean
}

/**
 * Mappa messaggi errore comuni → formato user-friendly
 */
const errorMessageMap: Record<string, { title: string; message: string }> = {
  // Wallet errors
  wallet_insufficient: {
    title: 'Saldo Insufficiente',
    message: 'Non hai abbastanza credito nel wallet per completare questa operazione.',
  },
  insufficient_balance: {
    title: 'Saldo Insufficiente',
    message: 'Il saldo del tuo wallet non è sufficiente.',
  },

  // Courier errors
  courier_not_available: {
    title: 'Corriere Non Disponibile',
    message: 'Questo corriere non è disponibile per la destinazione selezionata.',
  },
  courier_not_selected: {
    title: 'Corriere Non Selezionato',
    message: 'Seleziona un corriere dalla tabella preventivi prima di creare la spedizione.',
  },
  contract_not_found: {
    title: 'Contratto Non Configurato',
    message: 'Il contratto per questo corriere non è stato configurato.',
  },
  contract_not_configured: {
    title: 'Configurazione Mancante',
    message: 'Devi configurare il contratto per questo corriere prima di poterlo utilizzare.',
  },

  // Address errors
  invalid_address: {
    title: 'Indirizzo Non Valido',
    message: "L'indirizzo inserito non è valido. Verifica i dati e riprova.",
  },
  invalid_postal_code: {
    title: 'CAP Non Valido',
    message: 'Il codice postale inserito non è valido per questa località.',
  },
  missing_province: {
    title: 'Provincia Mancante',
    message: 'La provincia è obbligatoria. Seleziona la città dal menu di autocompletamento.',
  },

  // Validation errors
  validation_error: {
    title: 'Dati Non Validi',
    message: 'Alcuni campi contengono dati non validi. Verifica e correggi.',
  },
  phone_invalid: {
    title: 'Telefono Non Valido',
    message: 'Il numero di telefono inserito non è valido.',
  },
  email_invalid: {
    title: 'Email Non Valida',
    message: "L'indirizzo email inserito non è valido.",
  },

  // API/Network errors
  api_timeout: {
    title: 'Servizio Non Raggiungibile',
    message: 'Il servizio sta impiegando troppo tempo a rispondere. Riprova tra qualche istante.',
  },
  network_error: {
    title: 'Errore di Connessione',
    message: 'Impossibile connettersi al server. Verifica la tua connessione internet.',
  },
  fetch_failed: {
    title: 'Errore di Connessione',
    message: 'Impossibile raggiungere il server. Verifica la connessione e riprova.',
  },

  // Auth errors
  unauthorized: {
    title: 'Non Autorizzato',
    message: 'Le credenziali non sono valide o sono scadute.',
  },
  forbidden: {
    title: 'Accesso Negato',
    message: 'Non hai i permessi per eseguire questa operazione.',
  },

  // Rate limiting
  rate_limit: {
    title: 'Troppe Richieste',
    message: 'Hai effettuato troppe richieste. Attendi qualche minuto e riprova.',
  },
  too_many_requests: {
    title: 'Troppe Richieste',
    message: 'Hai raggiunto il limite di richieste. Riprova tra poco.',
  },

  // Server errors
  internal_error: {
    title: 'Errore del Sistema',
    message: 'Si è verificato un errore interno. Il nostro team è stato notificato.',
  },
  server_error: {
    title: 'Errore del Server',
    message: 'Il server ha riscontrato un problema. Riprova tra qualche istante.',
  },
}

/**
 * Mappa status HTTP → codice errore
 */
function statusToErrorCode(status: number): KnownErrorCode {
  switch (status) {
    case 400:
      return 'INVALID_ADDRESS' // Generic validation
    case 401:
      return 'UNAUTHORIZED'
    case 402:
      return 'WALLET_INSUFFICIENT'
    case 403:
      return 'UNAUTHORIZED'
    case 404:
      return 'COURIER_NOT_AVAILABLE'
    case 408:
      return 'API_TIMEOUT'
    case 409:
      return 'GENERIC_ERROR' // Conflict
    case 422:
      return 'RECIPIENT_VALIDATION_ERROR'
    case 429:
      return 'RATE_LIMIT'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'SERVER_ERROR'
    default:
      return 'GENERIC_ERROR'
  }
}

/**
 * Estrae codice errore da messaggio
 */
function extractErrorCode(message: string): KnownErrorCode | null {
  const lowered = message.toLowerCase()

  // Wallet
  if (lowered.includes('wallet') && (lowered.includes('insufficient') || lowered.includes('saldo'))) {
    return 'WALLET_INSUFFICIENT'
  }

  // Corriere
  if (lowered.includes('corriere') && lowered.includes('selezion')) {
    return 'COURIER_NOT_SELECTED'
  }
  if (lowered.includes('courier') && lowered.includes('not available')) {
    return 'COURIER_NOT_AVAILABLE'
  }

  // Contratto
  if (lowered.includes('contratto') || lowered.includes('contract')) {
    return 'CONTRACT_NOT_CONFIGURED'
  }

  // Indirizzo
  if (lowered.includes('indirizzo') || lowered.includes('address')) {
    return 'INVALID_ADDRESS'
  }
  if (lowered.includes('provincia') || lowered.includes('cap') || lowered.includes('postal')) {
    return 'INVALID_ADDRESS'
  }

  // Telefono/Email
  if (lowered.includes('telefono') || lowered.includes('phone')) {
    return 'RECIPIENT_VALIDATION_ERROR'
  }
  if (lowered.includes('email')) {
    return 'RECIPIENT_VALIDATION_ERROR'
  }

  // Network
  if (lowered.includes('timeout') || lowered.includes('timed out')) {
    return 'API_TIMEOUT'
  }
  if (lowered.includes('network') || lowered.includes('fetch') || lowered.includes('connection')) {
    return 'NETWORK_ERROR'
  }

  // Auth
  if (lowered.includes('unauthorized') || lowered.includes('401')) {
    return 'UNAUTHORIZED'
  }

  // Rate limit
  if (lowered.includes('rate limit') || lowered.includes('too many')) {
    return 'RATE_LIMIT'
  }

  return null
}

/**
 * Trova il miglior messaggio user-friendly per un errore
 */
function findBestMessage(
  code: string | undefined,
  message: string | undefined
): { title: string; message: string } | null {
  // Prova codice esatto
  if (code) {
    const codeKey = code.toLowerCase().replace(/_/g, '_')
    if (errorMessageMap[codeKey]) {
      return errorMessageMap[codeKey]
    }
  }

  // Prova a estrarre da messaggio
  if (message) {
    const lowered = message.toLowerCase()
    for (const [key, value] of Object.entries(errorMessageMap)) {
      if (lowered.includes(key.replace(/_/g, ' '))) {
        return value
      }
    }
  }

  return null
}

/**
 * Formatta dettagli aggiuntivi per errori wallet
 */
function formatWalletDetails(details: Record<string, unknown> | undefined): string | undefined {
  if (!details) return undefined

  const parts: string[] = []

  if (typeof details.required === 'number') {
    parts.push(`Importo richiesto: €${details.required.toFixed(2)}`)
  }
  if (typeof details.balance === 'number') {
    parts.push(`Saldo attuale: €${details.balance.toFixed(2)}`)
  }
  if (typeof details.shortfall === 'number') {
    parts.push(`Mancano: €${details.shortfall.toFixed(2)}`)
  }

  return parts.length > 0 ? parts.join(' | ') : undefined
}

/**
 * Formatta un errore raw in formato user-friendly
 *
 * @example
 * ```ts
 * const formatted = formatError({
 *   code: 'WALLET_INSUFFICIENT',
 *   message: 'Insufficient wallet balance',
 *   details: { required: 50, balance: 20 }
 * })
 *
 * // Result:
 * // {
 * //   error: {
 * //     code: 'WALLET_INSUFFICIENT',
 * //     title: 'Saldo Insufficiente',
 * //     message: 'Non hai abbastanza credito nel wallet...',
 * //     details: 'Importo richiesto: €50.00 | Saldo attuale: €20.00'
 * //   },
 * //   actions: [{ id: 'add_wallet', ... }],
 * //   canRetry: true
 * // }
 * ```
 */
export function formatError(raw: RawError): FormattedError {
  // 1. Determina codice errore
  let errorCode: KnownErrorCode = 'GENERIC_ERROR'

  if (raw.code) {
    // Codice esplicito
    errorCode = raw.code.toUpperCase().replace(/-/g, '_') as KnownErrorCode
  } else if (raw.status) {
    // Deduci da status HTTP
    errorCode = statusToErrorCode(raw.status)
  } else if (raw.message) {
    // Estrai da messaggio
    const extracted = extractErrorCode(raw.message)
    if (extracted) errorCode = extracted
  }

  // 2. Trova messaggio user-friendly
  const friendlyMessage = findBestMessage(errorCode, raw.message)

  // 3. Costruisci ErrorData
  const error: ErrorData = {
    code: errorCode,
    title: friendlyMessage?.title || 'Errore',
    message: friendlyMessage?.message || raw.message || 'Si è verificato un errore imprevisto.',
    details: formatWalletDetails(raw.details),
    // Passa valori numerici per wallet errors
    ...(raw.details?.required !== undefined && { required: raw.details.required as number }),
    ...(raw.details?.balance !== undefined && { balance: raw.details.balance as number }),
    ...(raw.details?.shortfall !== undefined && { shortfall: raw.details.shortfall as number }),
  }

  // 4. Ottieni azioni recovery
  const actionConfig = getActionsForError(errorCode)

  return {
    error,
    actions: actionConfig.actions,
    canRetry: actionConfig.canRetry,
  }
}

/**
 * Formatta un errore JavaScript/Exception
 */
export function formatException(err: Error | unknown): FormattedError {
  if (err instanceof Error) {
    return formatError({
      message: err.message,
      originalError: err,
    })
  }

  return formatError({
    message: String(err),
    originalError: err,
  })
}

/**
 * Formatta risposta API fetch failed
 */
export async function formatApiError(response: Response): Promise<FormattedError> {
  try {
    const data = await response.json()
    return formatError({
      code: data.code || data.error_code,
      message: data.message || data.error || data.error_message,
      status: response.status,
      details: data.details || data,
    })
  } catch {
    return formatError({
      message: response.statusText || 'Errore nella risposta del server',
      status: response.status,
    })
  }
}
