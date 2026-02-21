/**
 * Test: Parser generico contrassegni (COD)
 *
 * Verifica parsing file Excel/CSV con formato italiano.
 */

import { describe, it, expect } from 'vitest';
import { genericParser } from '@/lib/cod/parsers/generic';
import * as XLSX from 'xlsx';

function createExcelBuffer(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

describe('genericParser', () => {
  it('ha id e label corretti', () => {
    expect(genericParser.id).toBe('generic');
    expect(genericParser.label).toBe('Formato Generico');
  });

  it('parsa file Excel con dati validi', async () => {
    const buffer = createExcelBuffer([
      {
        ldv: '4UW1Q40040650',
        rif_mittente: 'makup c/o postaexpress',
        contrassegno: 49.9,
        pagato: 49.9,
        destinatario: 'MARIO ROSSI',
        bda: '',
        note: 'CITOFONO 15',
        order_num: '',
        rif_destinazione: '',
        'Data ldv': '2026-01-14T09:32:23.000000Z',
      },
      {
        ldv: '4UW1Q40040651',
        rif_mittente: 'shop xyz',
        contrassegno: 25.5,
        pagato: 25.5,
        destinatario: 'LUIGI VERDI',
        bda: '',
        note: '',
        order_num: '',
        rif_destinazione: '',
        'Data ldv': '2026-01-15T10:00:00.000000Z',
      },
    ]);

    const result = await genericParser.parse(buffer, 'test.xlsx');

    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.totalRows).toBe(2);
    expect(result.totalCodFile).toBeCloseTo(75.4, 1);

    expect(result.rows[0].ldv).toBe('4UW1Q40040650');
    expect(result.rows[0].contrassegno).toBeCloseTo(49.9);
    expect(result.rows[0].destinatario).toBe('MARIO ROSSI');
    expect(result.rows[0].rif_mittente).toBe('makup c/o postaexpress');
    expect(result.rows[0].note).toBe('CITOFONO 15');
  });

  it('salta riga TOTALE', async () => {
    const buffer = createExcelBuffer([
      { ldv: 'ABC123', contrassegno: 10, pagato: 10, destinatario: 'Test' },
      { ldv: 'TOTALE', contrassegno: 10, pagato: 10, destinatario: '' },
    ]);

    const result = await genericParser.parse(buffer, 'test.xlsx');

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ldv).toBe('ABC123');
  });

  it('salta righe con ldv vuoto', async () => {
    const buffer = createExcelBuffer([
      { ldv: 'ABC123', contrassegno: 10, pagato: 10 },
      { ldv: '', contrassegno: 5, pagato: 5 },
    ]);

    const result = await genericParser.parse(buffer, 'test.xlsx');
    expect(result.rows).toHaveLength(1);
  });

  it('gestisce file vuoto', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    const result = await genericParser.parse(buffer, 'empty.xlsx');
    expect(result.rows).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it('gestisce valori numerici con virgola (formato italiano)', async () => {
    // xlsx library parsa numeri direttamente, ma testiamo il case stringa
    const buffer = createExcelBuffer([
      { ldv: 'TEST1', contrassegno: '49,90', pagato: '49,90', destinatario: 'Test' },
    ]);

    const result = await genericParser.parse(buffer, 'test.xlsx');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].contrassegno).toBeCloseTo(49.9);
  });

  it('ritorna errore per file senza colonna ldv', async () => {
    const buffer = createExcelBuffer([{ nome: 'Test', importo: 10 }]);

    const result = await genericParser.parse(buffer, 'bad.xlsx');
    expect(result.rows).toHaveLength(0);
    expect(result.errors.some((e) => e.includes('LDV'))).toBe(true);
  });
});
