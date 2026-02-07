/**
 * Lead Scoring Algorithm — Funzione pura per calcolo punteggio prospect
 *
 * Score 0-100 basato su:
 * - Completezza dati contatto
 * - Potenziale business (volume, valore, settore)
 * - Engagement (email opens, contatti recenti)
 * - Avanzamento pipeline
 * - Decay per inattivita'
 *
 * PURO: nessuna dipendenza esterna, completamente testabile
 */

import type { ProspectStatus, ProspectSector } from '@/types/reseller-prospects';

// ============================================
// INPUT
// ============================================

export interface LeadScoreInput {
  // Dati contatto
  email?: string | null;
  phone?: string | null;

  // Business
  sector?: ProspectSector | string | null;
  estimated_monthly_volume?: number | null;

  // Pipeline
  status: ProspectStatus;

  // Engagement
  email_open_count?: number | null;
  last_contact_at?: string | null;

  // Timing
  created_at: string;

  // Preventivi collegati
  linked_quote_ids?: string[] | null;
}

// ============================================
// PESI
// ============================================

const SCORES = {
  // Completezza dati
  HAS_EMAIL: 10,
  HAS_PHONE: 5,

  // Potenziale business
  VOLUME_MEDIUM: 15, // > 50 spedizioni/mese
  VOLUME_HIGH: 25, // > 200 spedizioni/mese (sostituisce MEDIUM)
  HIGH_VALUE_SECTOR: 10, // ecommerce, pharma

  // Engagement
  EMAIL_OPENED: 5, // per apertura
  EMAIL_OPENED_MAX: 15, // cap
  CONTACTED_WITHIN_24H: 10, // contattato entro 24h dalla creazione

  // Pipeline
  HAS_QUOTE: 15, // almeno un preventivo inviato
  IN_NEGOTIATION: 10, // in fase negoziazione

  // Recency (positivo)
  RECENT_CONTACT_7D: 5, // ultimo contatto < 7 giorni

  // Decay (negativo)
  STALE_14D: -10, // ultimo contatto > 14 giorni
  STALE_30D: -20, // ultimo contatto > 30 giorni (sostituisce 14D)

  // Base
  BASE: 10,
} as const;

const HIGH_VALUE_SECTORS: string[] = ['ecommerce', 'pharma'];

// ============================================
// FUNZIONE PRINCIPALE
// ============================================

/**
 * Calcola il lead score per un prospect
 *
 * @param input - Dati prospect per il calcolo
 * @param now - Timestamp corrente (per testabilita')
 * @returns Score 0-100
 */
export function calculateLeadScore(input: LeadScoreInput, now?: Date): number {
  const currentTime = now || new Date();
  let score = SCORES.BASE;

  // --- Completezza dati ---
  if (input.email) score += SCORES.HAS_EMAIL;
  if (input.phone) score += SCORES.HAS_PHONE;

  // --- Potenziale business ---
  if (input.estimated_monthly_volume) {
    if (input.estimated_monthly_volume > 200) {
      score += SCORES.VOLUME_HIGH;
    } else if (input.estimated_monthly_volume > 50) {
      score += SCORES.VOLUME_MEDIUM;
    }
  }

  if (input.sector && HIGH_VALUE_SECTORS.includes(input.sector)) {
    score += SCORES.HIGH_VALUE_SECTOR;
  }

  // --- Engagement email ---
  if (input.email_open_count && input.email_open_count > 0) {
    const emailScore = Math.min(
      input.email_open_count * SCORES.EMAIL_OPENED,
      SCORES.EMAIL_OPENED_MAX
    );
    score += emailScore;
  }

  // --- Contatto rapido ---
  if (input.last_contact_at && input.created_at) {
    const createdAt = new Date(input.created_at);
    const contactedAt = new Date(input.last_contact_at);
    const hoursToFirstContact = (contactedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursToFirstContact >= 0 && hoursToFirstContact <= 24) {
      score += SCORES.CONTACTED_WITHIN_24H;
    }
  }

  // --- Pipeline ---
  const hasQuotes = input.linked_quote_ids && input.linked_quote_ids.length > 0;
  if (hasQuotes || input.status === 'quote_sent') {
    score += SCORES.HAS_QUOTE;
  }
  if (input.status === 'negotiating') {
    score += SCORES.IN_NEGOTIATION;
  }

  // --- Recency / Decay ---
  if (input.last_contact_at) {
    const lastContact = new Date(input.last_contact_at);
    const daysSinceContact =
      (currentTime.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceContact <= 7) {
      score += SCORES.RECENT_CONTACT_7D;
    } else if (daysSinceContact > 30) {
      score += SCORES.STALE_30D; // -20
    } else if (daysSinceContact > 14) {
      score += SCORES.STALE_14D; // -10
    }
  }

  // --- Clamp 0-100 ---
  return Math.max(0, Math.min(100, score));
}

// ============================================
// UTILITY
// ============================================

/**
 * Etichetta testuale per il livello di score
 */
export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Caldo';
  if (score >= 60) return 'Tiepido';
  if (score >= 40) return 'Freddo';
  return 'Molto Freddo';
}

/**
 * Colore CSS per il badge score
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'red';
  if (score >= 60) return 'orange';
  if (score >= 40) return 'yellow';
  return 'gray';
}
