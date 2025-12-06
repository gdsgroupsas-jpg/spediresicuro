// Funzioni utility per il progetto
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility per unire classi CSS in modo sicuro
 * Combina clsx e tailwind-merge per gestire conflitti Tailwind
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calcola il prezzo finale aggiungendo il margine al prezzo base
 */
export function calcolaPrezzoConMargine(
  prezzoBase: number,
  marginePercentuale: number
): number {
  const margine = (prezzoBase * marginePercentuale) / 100
  return prezzoBase + margine
}

/**
 * Formatta un prezzo in formato euro italiano
 * @example formatCurrency(1234.56) => "1.234,56 €"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

// Alias per retrocompatibilità
export const formattaPrezzo = formatCurrency

/**
 * Formatta una data in formato italiano corto
 * @example formatDate("2025-01-15") => "15 gen 2025"
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

/**
 * Formatta una data con ora in formato italiano
 * @example formatDateTime("2025-01-15T14:30:00") => "15 gen 2025, 14:30"
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

/**
 * Formatta una data relativa (es. "2 giorni fa")
 */
export function formatRelativeDate(date: string | Date): string {
  const now = new Date()
  const targetDate = new Date(date)
  const diffInMs = now.getTime() - targetDate.getTime()
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

  if (diffInDays === 0) {
    return 'Oggi'
  } else if (diffInDays === 1) {
    return 'Ieri'
  } else if (diffInDays < 7) {
    return `${diffInDays} giorni fa`
  } else if (diffInDays < 30) {
    const weeks = Math.floor(diffInDays / 7)
    return `${weeks} settiman${weeks === 1 ? 'a' : 'e'} fa`
  } else {
    return formatDate(date)
  }
}

/**
 * Estrae le iniziali da un nome
 * @example getInitials("Mario Rossi") => "MR"
 */
export function getInitials(name: string): string {
  if (!name) return ''
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Tronca un testo a una lunghezza massima
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Copia del testo negli appunti
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Genera un ID casuale
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Valida le dimensioni di un pacco
 */
export function validaDimensioni(dimensioni: {
  lunghezza: number
  larghezza: number
  altezza: number
}): boolean {
  return (
    dimensioni.lunghezza > 0 &&
    dimensioni.larghezza > 0 &&
    dimensioni.altezza > 0
  )
}

/**
 * Formatta un numero con separatore delle migliaia italiano
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('it-IT').format(num)
}

/**
 * Calcola la percentuale di variazione tra due valori
 */
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * Formatta un ID UUID per la visualizzazione (abbreviato)
 * @example formatUuid("a1b2c3d4-e5f6-7890-abcd-ef1234567890") => "a1b2...7890"
 */
export function formatUuid(uuid: string): string {
  if (!uuid || uuid.length < 8) return uuid
  return `${uuid.slice(0, 4)}...${uuid.slice(-4)}`
}

