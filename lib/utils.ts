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
 * @param prezzoBase - Prezzo base della spedizione
 * @param marginePercentuale - Percentuale di margine da applicare
 * @returns Prezzo finale con margine incluso
 */
export function calcolaPrezzoConMargine(
  prezzoBase: number,
  marginePercentuale: number
): number {
  const margine = (prezzoBase * marginePercentuale) / 100
  return prezzoBase + margine
}

/**
 * Formatta un prezzo in formato euro
 * @param prezzo - Prezzo da formattare
 * @returns Stringa formattata (es. "€ 25,50")
 */
export function formattaPrezzo(prezzo: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(prezzo)
}

/**
 * Valida le dimensioni di un pacco
 * @param dimensioni - Oggetto con lunghezza, larghezza, altezza
 * @returns true se valide, false altrimenti
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

