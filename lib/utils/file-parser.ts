/**
 * Parser per file CSV/XLS/XLSX
 * Supporta import da Spedisci.Online, Amazon, Shopify, PrestaShop, etc.
 * 
 * ⚠️ MIGRATO: Usa ExcelJS invece di xlsx per sicurezza
 */

import ExcelJS from 'exceljs';

// Interfaccia per ordine importato
export interface ImportedOrder {
  // Tracking / LDV
  ldv?: string; // Lettera di Vettura (Spedisci.Online) - QUESTO È IL TRACKING
  tracking?: string; // Tracking number generico
  tracking_number?: string; // Variante tracking number

  // Order ID
  order_id?: string; // ID ordine (es. Amazon, Shopify) - NON È IL TRACKING

  // Destinatario
  nominativo?: string; // Spedisci.Online
  nome?: string; // Nome generico
  cognome?: string; // Cognome separato
  indirizzo?: string;
  cap?: string;
  citta?: string;
  localita?: string; // Variante di "citta" (usata in alcuni CSV)
  provincia?: string;
  telefono?: string;
  cellulare?: string;
  email?: string;
  email_dest?: string; // Email destinatario (Spedisci.Online)

  // Mittente
  rif_mitt?: string; // Riferimento mittente (Spedisci.Online)
  rif_dest?: string; // Riferimento destinatario (Spedisci.Online)

  // Dettagli spedizione
  peso?: number | string;
  colli?: number | string;
  costo?: number | string;
  contrassegno?: number | string;
  assicurazione?: number | string;
  note?: string;
  contenuto?: string;

  // Date
  created_at?: string;
  data_ordine?: string;

  // Altro
  bda?: string; // Numero BDA (Spedisci.Online)
  [key: string]: any; // Altri campi custom
}

/**
 * Normalizza un ordine importato nel formato standard della piattaforma
 */
export function normalizeImportedOrder(order: ImportedOrder): any {
  // PRIORITÀ TRACKING: ldv > tracking > tracking_number
  const trackingValue = order.ldv || order.tracking || order.tracking_number || '';

  // Nome destinatario
  const nomeDestinatario = order.nominativo ||
    (order.nome && order.cognome ? `${order.nome} ${order.cognome}` : order.nome) ||
    '';

  // Email destinatario
  const emailDestinatario = order.email_dest || order.email || '';

  // Peso normalizzato
  const peso = typeof order.peso === 'number' ? order.peso : parseFloat(order.peso as string || '0') || 0;

  // Colli normalizzati
  const colli = typeof order.colli === 'number' ? order.colli : parseInt(order.colli as string || '1', 10) || 1;

  // Costo normalizzato
  const costo = typeof order.costo === 'number' ? order.costo : parseFloat(order.costo as string || '0') || 0;

  return {
    // IMPORTANTE: Mantieni LDV originale E tracking normalizzato
    ldv: order.ldv || '', // Campo LDV originale da Spedisci.Online
    tracking: trackingValue, // Tracking normalizzato
    order_id: order.order_id || '', // Order ID (separato dal tracking)

    // Destinatario normalizzato
    // IMPORTANTE: Accetta sia "citta" che "localita" come nome colonna
    destinatario: {
      nome: nomeDestinatario,
      indirizzo: order.indirizzo || '',
      cap: order.cap || '',
      citta: order.citta || order.localita || (order as any).city || (order as any).recipient_city || '',
      provincia: order.provincia || (order as any).province || (order as any).recipient_province || '',
      telefono: order.telefono || order.cellulare || '',
      email: emailDestinatario,
    },

    // Mittente (se presente)
    mittente: {
      nome: order.rif_mitt || 'Mittente predefinito',
      indirizzo: '',
      cap: '',
      citta: '',
      provincia: '',
      telefono: '',
      email: '',
    },

    // Dettagli spedizione
    peso: peso,
    colli: colli,
    prezzoFinale: costo,
    tipoSpedizione: 'standard',
    status: 'in_preparazione',
    contrassegno: order.contrassegno || 0,
    assicurazione: order.assicurazione || 0,
    note: order.note || '',
    contenuto: order.contenuto || '',

    // Riferimenti
    rif_mittente: order.rif_mitt || '',
    rif_destinatario: order.rif_dest || order.nominativo || '',

    // Metadata
    created_at: order.created_at || new Date().toISOString(),
    imported: true,
    imported_at: new Date().toISOString(),
  };
}

/**
 * Parsa file CSV (accetta File o stringa)
 * 
 * ⚠️ NOTA: ExcelJS non supporta nativamente CSV, usiamo parsing manuale
 */
export async function parseCSV(input: File | string): Promise<ImportedOrder[]> {
  return new Promise((resolve, reject) => {
    try {
      const parseCSVText = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
          resolve([]);
          return;
        }

        // Prima riga = header
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        // Parse righe successive
        const data: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }

        // Normalizza i nomi delle colonne (lowercase, rimuovi spazi)
        const normalized = data.map((row: any) => {
          const normalizedRow: any = {};
          Object.keys(row).forEach((key) => {
            const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
            normalizedRow[normalizedKey] = row[key];
          });
          return normalizedRow;
        });

        resolve(normalized);
      };

      if (typeof input === 'string') {
        // Input è già una stringa CSV
        parseCSVText(input);
      } else {
        // Input è un File
        const reader = new FileReader();

        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            parseCSVText(text);
          } catch (error) {
            reject(new Error('Errore nel parsing del CSV: ' + (error as Error).message));
          }
        };

        reader.onerror = () => {
          reject(new Error('Errore nella lettura del file'));
        };

        reader.readAsText(input);
      }
    } catch (error) {
      reject(new Error('Errore nel parsing del CSV: ' + (error as Error).message));
    }
  });
}

/**
 * Parsa file Excel (XLS/XLSX)
 * 
 * ⚠️ MIGRATO: Usa ExcelJS invece di xlsx
 */
export async function parseExcel(file: File): Promise<ImportedOrder[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          reject(new Error('Errore: dati file non disponibili'));
          return;
        }

        // Crea workbook da ArrayBuffer
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        // Leggi il primo worksheet
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          reject(new Error('Nessun worksheet trovato nel file Excel'));
          return;
        }

        // Estrai header dalla prima riga
        const headerRow = worksheet.getRow(1);
        const headers: string[] = [];
        headerRow.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = cell.value?.toString() || `Column${colNumber}`;
        });

        // Estrai dati dalle righe successive
        const data: any[] = [];
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Salta header

          const rowData: any = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header) {
              rowData[header] = cell.value;
            }
          });

          if (Object.keys(rowData).length > 0) {
            data.push(rowData);
          }
        });

        // Normalizza i nomi delle colonne
        const normalized = data.map((row: any) => {
          const normalizedRow: any = {};
          Object.keys(row).forEach((key) => {
            const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, '_');
            normalizedRow[normalizedKey] = row[key];
          });
          return normalizedRow;
        });

        resolve(normalized);
      } catch (error) {
        reject(new Error('Errore nel parsing del file Excel: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Errore nella lettura del file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Funzione principale per parsare file (CSV/XLS/XLSX)
 */
export async function parseFile(file: File): Promise<ImportedOrder[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'csv':
      return parseCSV(file);
    case 'xls':
    case 'xlsx':
      return parseExcel(file);
    default:
      throw new Error('Formato file non supportato. Usa CSV, XLS o XLSX');
  }
}

/**
 * Alias per compatibilità con componenti esistenti
 */
export const parseXLS = parseExcel;
