/**
 * Registry parser contrassegni
 *
 * Per aggiungere un nuovo parser:
 * 1. Crea il file in lib/cod/parsers/
 * 2. Implementa l'interfaccia CodParser
 * 3. Registralo qui nel parsers map
 */

import type { CodParser } from './types';
import { genericParser } from './generic';

/** Mappa parser registrati per id */
const parsers = new Map<string, CodParser>();

// Registra parser disponibili
parsers.set(genericParser.id, genericParser);

/** Ottieni un parser per id */
export function getParser(id: string): CodParser | undefined {
  return parsers.get(id);
}

/** Lista parser disponibili (per UI select) */
export function getAvailableParsers(): Array<{ id: string; label: string; description: string }> {
  return Array.from(parsers.values()).map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
  }));
}

export type { CodParser, CodParsedRow, CodParseResult } from './types';
