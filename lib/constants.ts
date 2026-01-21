/**
 * Costanti dell'applicazione
 *
 * Qui puoi definire tutti i valori fissi usati nell'applicazione:
 * - Configurazioni
 * - Messaggi
 * - Valori predefiniti
 */

// Configurazione margini
export const MARGINI = {
  DEFAULT: 15, // Margine predefinito in percentuale
  MIN: 0, // Margine minimo
  MAX: 100, // Margine massimo
} as const;

// Messaggi di errore
export const ERROR_MESSAGES = {
  CAMPO_OBBLIGATORIO: 'Questo campo è obbligatorio',
  EMAIL_NON_VALIDA: "Inserisci un'email valida",
  TELEFONO_NON_VALIDO: 'Inserisci un numero di telefono valido',
  PREZZO_NON_VALIDO: 'Il prezzo deve essere un numero positivo',
} as const;

// Messaggi di successo
export const SUCCESS_MESSAGES = {
  PREVENTIVO_CALCOLATO: 'Preventivo calcolato con successo!',
  SPEDIZIONE_SALVATA: 'Spedizione salvata correttamente',
} as const;

// Configurazione API
export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  PREVENTIVI: '/api/preventivi',
  SPEDIZIONI: '/api/spedizioni',
} as const;
