/**
 * Tipi per il sistema parser contrassegni (COD)
 *
 * Architettura modulare: ogni fornitore ha il suo parser
 * che implementa l'interfaccia CodParser.
 */

/** Riga parsata da un file contrassegni */
export interface CodParsedRow {
  ldv: string;
  rif_mittente: string | null;
  contrassegno: number;
  pagato: number;
  destinatario: string | null;
  bda: string | null;
  note: string | null;
  order_num: string | null;
  rif_destinazione: string | null;
  data_ldv: string | null; // ISO string
}

/** Risultato del parsing di un file */
export interface CodParseResult {
  rows: CodParsedRow[];
  totalRows: number;
  totalCodFile: number; // Somma contrassegni dal file
  errors: string[];
}

/** Interfaccia che ogni parser deve implementare */
export interface CodParser {
  /** Identificativo univoco del parser */
  id: string;
  /** Nome visualizzato */
  label: string;
  /** Descrizione del formato supportato */
  description: string;
  /** Parsa il contenuto del file (Buffer da xlsx/csv) */
  parse(buffer: Buffer, filename: string): Promise<CodParseResult>;
}
