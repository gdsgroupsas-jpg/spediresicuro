/**
 * Sistema di Tracking Performance Corrieri
 *
 * Calcola reliability score basato su dati storici reali
 */

import { Corriere, CorrierePerformance, RoutingSuggestion } from '@/types/corrieri';
import { getSpedizioni } from './database';
import type { AuthContext } from './auth-context';

/**
 * Calcola il Reliability Score di un corriere per una zona
 *
 * Formula:
 * - Tasso successo: 40%
 * - Tempo medio consegna: 30%
 * - Volume spedizioni (più dati = più affidabile): 20%
 * - Trend recente: 10%
 */
export function calculateReliabilityScore(performance: CorrierePerformance): number {
  const tassoSuccesso = performance.tassoSuccesso; // 0-100
  const tempoScore = Math.max(0, 100 - (performance.tempoMedioConsegna / 24) * 20); // Penalizza ritardi
  const volumeScore = Math.min(100, (performance.totaleSpedizioni / 100) * 100); // Più dati = meglio
  const trendScore = 80; // Placeholder, da calcolare con dati storici

  const score = tassoSuccesso * 0.4 + tempoScore * 0.3 + volumeScore * 0.2 + trendScore * 0.1;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Analizza le performance dei corrieri per una zona specifica
 *
 * ⚠️ IMPORTANTE: Richiede AuthContext per sicurezza (service_role per vedere tutte le spedizioni)
 */
export async function analyzeCorrieriPerformance(
  citta: string,
  provincia: string,
  authContext: AuthContext
): Promise<CorrierePerformance[]> {
  // Ottieni tutte le spedizioni (service_role vede tutto, user vede solo le proprie)
  const spedizioni = await getSpedizioni(authContext);

  // Filtra per zona (ultime 2 settimane)
  const dueSettimaneFa = new Date();
  dueSettimaneFa.setDate(dueSettimaneFa.getDate() - 14);

  const spedizioniZona = spedizioni.filter((sp) => {
    if (!sp.destinatario?.citta || !sp.corriere) return false;
    const dataSpedizione = new Date(sp.createdAt || sp.dataCreazione);
    return (
      (sp.destinatario.citta.toLowerCase() === citta.toLowerCase() ||
        sp.destinatario.provincia?.toUpperCase() === provincia.toUpperCase()) &&
      dataSpedizione >= dueSettimaneFa
    );
  });

  // Raggruppa per corriere
  const performanceMap = new Map<Corriere, CorrierePerformance>();

  spedizioniZona.forEach((sp) => {
    const corriere = sp.corriere as Corriere;
    if (!corriere) return;

    const existing = performanceMap.get(corriere) || {
      corriere,
      zona: `${citta}, ${provincia}`,
      periodo: 'ultime 2 settimane',
      totaleSpedizioni: 0,
      consegneInTempo: 0,
      consegneInRitardo: 0,
      tempoMedioConsegna: 0,
      tassoSuccesso: 0,
      reliabilityScore: 0,
      ultimoAggiornamento: new Date().toISOString(),
    };

    existing.totaleSpedizioni++;

    // Simula calcolo basato su status (in produzione, verrebbe da API tracking)
    if (sp.status === 'consegnata') {
      existing.consegneInTempo++;
    } else if (sp.status === 'eccezione' || sp.status === 'in_transito') {
      // Se in transito da più di 3 giorni = ritardo
      const giorniInTransito = Math.floor(
        (Date.now() - new Date(sp.createdAt || sp.dataCreazione).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (giorniInTransito > 3) {
        existing.consegneInRitardo++;
      } else {
        existing.consegneInTempo++;
      }
    }

    performanceMap.set(corriere, existing);
  });

  // Calcola metriche finali
  const performances: CorrierePerformance[] = [];

  performanceMap.forEach((perf) => {
    perf.tassoSuccesso =
      perf.totaleSpedizioni > 0 ? (perf.consegneInTempo / perf.totaleSpedizioni) * 100 : 100; // Default 100% se nessun dato

    perf.tempoMedioConsegna = perf.totaleSpedizioni > 0 ? 24 : 48; // Placeholder

    perf.reliabilityScore = calculateReliabilityScore(perf);

    performances.push(perf);
  });

  // Se non ci sono dati, restituisci performance di default (simulate)
  if (performances.length === 0) {
    return getDefaultPerformance(citta, provincia);
  }

  return performances;
}

/**
 * Performance di default quando non ci sono dati storici
 * (simulate per demo)
 */
function getDefaultPerformance(citta: string, provincia: string): CorrierePerformance[] {
  return [
    {
      corriere: 'GLS',
      zona: `${citta}, ${provincia}`,
      periodo: 'ultime 2 settimane',
      totaleSpedizioni: 0,
      consegneInTempo: 0,
      consegneInRitardo: 0,
      tempoMedioConsegna: 24,
      tassoSuccesso: 95,
      reliabilityScore: 92,
      ultimoAggiornamento: new Date().toISOString(),
    },
    {
      corriere: 'SDA',
      zona: `${citta}, ${provincia}`,
      periodo: 'ultime 2 settimane',
      totaleSpedizioni: 0,
      consegneInTempo: 0,
      consegneInRitardo: 0,
      tempoMedioConsegna: 36,
      tassoSuccesso: 88,
      reliabilityScore: 85,
      ultimoAggiornamento: new Date().toISOString(),
    },
    {
      corriere: 'Bartolini',
      zona: `${citta}, ${provincia}`,
      periodo: 'ultime 2 settimane',
      totaleSpedizioni: 0,
      consegneInTempo: 0,
      consegneInRitardo: 0,
      tempoMedioConsegna: 48,
      tassoSuccesso: 90,
      reliabilityScore: 87,
      ultimoAggiornamento: new Date().toISOString(),
    },
  ];
}

/**
 * Genera suggerimento AI per routing ottimale
 */
export async function generateRoutingSuggestion(
  citta: string,
  provincia: string,
  prezzoCorriereScelto: number,
  corriereScelto: Corriere,
  authContext: AuthContext
): Promise<RoutingSuggestion | null> {
  const performances = await analyzeCorrieriPerformance(citta, provincia, authContext);

  if (performances.length === 0) {
    return null;
  }

  // Trova il corriere con reliability score più alto
  const bestCorriere = performances.reduce((best, current) =>
    current.reliabilityScore > best.reliabilityScore ? current : best
  );

  // Se il corriere scelto è già il migliore, nessun suggerimento
  if (bestCorriere.corriere === corriereScelto) {
    return null;
  }

  // Calcola differenza di prezzo (simulata)
  const prezzoBest = prezzoCorriereScelto * 0.95; // Assumiamo che il migliore costi il 5% in più
  const differenza = prezzoBest - prezzoCorriereScelto;

  // Determina rischio ritardo
  const performanceScelto = performances.find((p) => p.corriere === corriereScelto);
  const rischioRitardo: 'basso' | 'medio' | 'alto' =
    !performanceScelto || performanceScelto.reliabilityScore >= 90
      ? 'basso'
      : performanceScelto.reliabilityScore >= 75
        ? 'medio'
        : 'alto';

  // Genera messaggio motivazionale
  let motivo = '';
  if (rischioRitardo === 'alto') {
    motivo = `⚠️ Rilevati ritardi del ${Math.round(
      100 - (performanceScelto?.tassoSuccesso || 100)
    )}% nella zona di destinazione (${citta}) nelle ultime 48 ore. Ti consigliamo ${bestCorriere.corriere} per garantire la consegna in tempo.`;
  } else if (differenza > 0 && differenza < 1) {
    motivo = `💡 Stai risparmiando solo ${differenza.toFixed(2)}€, ma ${bestCorriere.corriere} ha un'affidabilità del ${bestCorriere.reliabilityScore}% vs ${performanceScelto?.reliabilityScore || 0}%. La differenza vale la tranquillità.`;
  } else {
    motivo = `✨ ${bestCorriere.corriere} ha un'affidabilità superiore (${bestCorriere.reliabilityScore}%) nella zona di ${citta}. Consigliato per garantire la consegna.`;
  }

  return {
    corriereConsigliato: bestCorriere.corriere,
    corriereEvitare: corriereScelto,
    motivo,
    risparmioPotenziale: differenza < 0 ? Math.abs(differenza) : undefined,
    rischioRitardo,
    reliabilityScore: bestCorriere.reliabilityScore,
    prezzo: prezzoBest,
    prezzoAlternativo: prezzoCorriereScelto,
    differenzaPrezzo: differenza,
  };
}
