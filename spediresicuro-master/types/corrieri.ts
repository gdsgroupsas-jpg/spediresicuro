/**
 * Tipi per il sistema di Routing Predittivo Anti-Disastro
 */

// Corrieri disponibili
export type Corriere = 'GLS' | 'SDA' | 'Bartolini' | 'DHL' | 'UPS' | 'Poste Italiane';

// Performance di un corriere in una zona
export interface CorrierePerformance {
  corriere: Corriere;
  zona: string; // Città o provincia
  periodo: string; // Settimana o periodo di riferimento
  totaleSpedizioni: number;
  consegneInTempo: number;
  consegneInRitardo: number;
  tempoMedioConsegna: number; // in ore
  tassoSuccesso: number; // percentuale (0-100)
  reliabilityScore: number; // 0-100
  ultimoAggiornamento: string;
}

// Suggerimento AI per routing
export interface RoutingSuggestion {
  corriereConsigliato: Corriere;
  corriereEvitare?: Corriere;
  motivo: string;
  risparmioPotenziale?: number; // in euro
  rischioRitardo: 'basso' | 'medio' | 'alto';
  reliabilityScore: number;
  prezzo: number;
  prezzoAlternativo?: number;
  differenzaPrezzo?: number;
}

// Configurazione Auto-Pilot
export interface AutoPilotConfig {
  enabled: boolean;
  maxPrezzo: number; // Prezzo massimo accettabile
  minReliabilityScore: number; // Score minimo richiesto (0-100)
  priorita: 'affidabilita' | 'prezzo' | 'bilanciato';
}

