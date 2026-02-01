/**
 * Parser generico per file contrassegni
 *
 * Formato atteso (Excel/CSV, colonne in italiano):
 * ldv, rif_mittente, contrassegno, pagato, destinatario, bda, note, order_num, rif_destinazione, Data ldv
 * Ultima riga: TOTALE con somma.
 * Formato numerico italiano: virgola decimale (es. 49,9).
 */

import type { CodParser, CodParsedRow, CodParseResult } from './types';

/** Converte stringa con virgola decimale in numero */
function parseItalianNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const str = String(value).trim().replace(/\s/g, '');
  // Gestisci formato italiano: 1.234,56 -> 1234.56
  const normalized = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

/** Normalizza nome colonna per matching flessibile */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Mappa nomi colonna -> campo CodParsedRow */
const COLUMN_MAP: Record<string, keyof CodParsedRow> = {
  ldv: 'ldv',
  lettera_di_vettura: 'ldv',
  tracking: 'ldv',
  rif_mittente: 'rif_mittente',
  riferimento_mittente: 'rif_mittente',
  mittente: 'rif_mittente',
  contrassegno: 'contrassegno',
  cod: 'contrassegno',
  importo: 'contrassegno',
  importo_contrassegno: 'contrassegno',
  pagato: 'pagato',
  importo_pagato: 'pagato',
  destinatario: 'destinatario',
  nome_destinatario: 'destinatario',
  bda: 'bda',
  note: 'note',
  note_consegna: 'note',
  order_num: 'order_num',
  numero_ordine: 'order_num',
  rif_destinazione: 'rif_destinazione',
  riferimento_destinazione: 'rif_destinazione',
  data_ldv: 'data_ldv',
  data: 'data_ldv',
};

export const genericParser: CodParser = {
  id: 'generic',
  label: 'Formato Generico',
  description: 'File Excel/CSV con colonne standard (ldv, contrassegno, pagato, destinatario, ...)',

  async parse(buffer: Buffer, filename: string): Promise<CodParseResult> {
    const errors: string[] = [];
    const rows: CodParsedRow[] = [];

    try {
      // Importa xlsx dinamicamente (server-side only)
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

      if (workbook.SheetNames.length === 0) {
        return {
          rows: [],
          totalRows: 0,
          totalCodFile: 0,
          errors: ['File vuoto: nessun foglio trovato'],
        };
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawData.length === 0) {
        return {
          rows: [],
          totalRows: 0,
          totalCodFile: 0,
          errors: ['Nessuna riga trovata nel file'],
        };
      }

      // Mappa headers
      const firstRow = rawData[0];
      const headerMapping: Record<string, keyof CodParsedRow> = {};
      for (const key of Object.keys(firstRow)) {
        const normalized = normalizeHeader(key);
        if (COLUMN_MAP[normalized]) {
          headerMapping[key] = COLUMN_MAP[normalized];
        }
      }

      if (!Object.values(headerMapping).includes('ldv')) {
        errors.push('Colonna LDV/tracking non trovata nel file');
        return { rows: [], totalRows: 0, totalCodFile: 0, errors };
      }

      let totalCodFile = 0;

      for (let i = 0; i < rawData.length; i++) {
        const raw = rawData[i];

        // Estrai valori mappati
        const mapped: Partial<CodParsedRow> = {};
        for (const [originalKey, field] of Object.entries(headerMapping)) {
          (mapped as any)[field] = raw[originalKey];
        }

        const ldv = String(mapped.ldv || '').trim();

        // Salta riga TOTALE (ultima riga riepilogo)
        if (ldv.toUpperCase() === 'TOTALE' || ldv === '') {
          continue;
        }

        const contrassegno = parseItalianNumber(mapped.contrassegno);
        const pagato = parseItalianNumber(mapped.pagato);

        // Gestisci data (xlsx puo' restituire Date o stringa)
        let dataLdv: string | null = null;
        const rawDate = mapped.data_ldv as unknown;
        if (rawDate) {
          try {
            if (typeof rawDate === 'object' && rawDate !== null && 'toISOString' in rawDate) {
              dataLdv = (rawDate as Date).toISOString();
            } else {
              const d = new Date(String(rawDate));
              if (!isNaN(d.getTime())) {
                dataLdv = d.toISOString();
              }
            }
          } catch {
            // Data non parsabile, ignora
          }
        }

        rows.push({
          ldv,
          rif_mittente: mapped.rif_mittente ? String(mapped.rif_mittente).trim() : null,
          contrassegno,
          pagato,
          destinatario: mapped.destinatario ? String(mapped.destinatario).trim() : null,
          bda: mapped.bda ? String(mapped.bda).trim() : null,
          note: mapped.note ? String(mapped.note).trim() : null,
          order_num: mapped.order_num ? String(mapped.order_num).trim() : null,
          rif_destinazione: mapped.rif_destinazione ? String(mapped.rif_destinazione).trim() : null,
          data_ldv: dataLdv,
        });

        totalCodFile += contrassegno;
      }

      return {
        rows,
        totalRows: rows.length,
        totalCodFile: Math.round(totalCodFile * 100) / 100,
        errors,
      };
    } catch (error: any) {
      errors.push(`Errore parsing file: ${error.message}`);
      return { rows: [], totalRows: 0, totalCodFile: 0, errors };
    }
  },
};
