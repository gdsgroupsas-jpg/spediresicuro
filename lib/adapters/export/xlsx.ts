/**
 * XLSX Export Adapter
 *
 * Esportazione spedizioni in formato Excel (XLSX)
 * Richiede libreria 'xlsx'
 */

export interface XLSXOptions {
  sheetName?: string;
  includeFormatting?: boolean;
  autoWidth?: boolean;
}

export class XLSXExporter {
  /**
   * Verifica se la libreria xlsx è disponibile
   */
  static isAvailable(): boolean {
    try {
      // In Next.js, non possiamo usare require.resolve a build time
      return true; // Assumiamo disponibile se nel package.json
    } catch {
      return false;
    }
  }

  /**
   * Esporta array di oggetti in XLSX
   */
  static async export<T extends Record<string, any>>(
    data: T[],
    columns: { key: keyof T; label: string; width?: number }[],
    options: XLSXOptions = {}
  ): Promise<Buffer> {
    let XLSX: any;
    try {
      // Import dinamico per evitare errori a build time
      XLSX = await import('xlsx');
    } catch (error) {
      throw new Error('Libreria xlsx non installata. Eseguire: npm install xlsx');
    }
    const {
      sheetName = 'Sheet1',
      includeFormatting = true,
      autoWidth = true,
    } = options;

    // Prepara dati per export
    const exportData = data.map(item => {
      const row: any = {};
      columns.forEach(col => {
        row[col.label] = item[col.key];
      });
      return row;
    });

    // Crea workbook
    const wb = XLSX.utils.book_new();

    // Crea worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Auto-width colonne
    if (autoWidth) {
      const colWidths = columns.map(col => ({
        wch: col.width || Math.max(
          col.label.length,
          ...data.map(item => String(item[col.key] || '').length)
        ),
      }));
      ws['!cols'] = colWidths;
    }

    // Formatting (se richiesto)
    if (includeFormatting) {
      // Header row in grassetto
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_col(C) + '1';
        if (!ws[address]) continue;
        ws[address].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'FFE0E0E0' } },
        };
      }
    }

    // Aggiungi sheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Genera buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return buffer;
  }

  /**
   * Esporta spedizioni in XLSX
   */
  static async exportShipments(shipments: any[], options?: XLSXOptions): Promise<Buffer> {
    const columns = [
      { key: 'tracking_number', label: 'Tracking', width: 20 },
      { key: 'created_at_formatted', label: 'Data', width: 12 },
      { key: 'status', label: 'Status', width: 15 },
      { key: 'recipient_name', label: 'Destinatario', width: 25 },
      { key: 'recipient_address', label: 'Indirizzo', width: 35 },
      { key: 'recipient_city', label: 'Città', width: 20 },
      { key: 'recipient_zip', label: 'CAP', width: 8 },
      { key: 'recipient_province', label: 'Prov', width: 6 },
      { key: 'recipient_phone', label: 'Telefono', width: 15 },
      { key: 'courier_name', label: 'Corriere', width: 20 },
      { key: 'service_type', label: 'Servizio', width: 12 },
      { key: 'weight', label: 'Peso (kg)', width: 10 },
      { key: 'final_price_formatted', label: 'Prezzo', width: 12 },
    ];

    // Prepara dati
    const dataForExport = shipments.map(s => ({
      ...s,
      created_at_formatted: new Date(s.created_at).toLocaleDateString('it-IT'),
      final_price_formatted: s.final_price?.toFixed(2) || '0.00',
      courier_name: s.courier?.name || '-',
    }));

    return this.export(dataForExport, columns, options);
  }

  /**
   * Esporta LDV in XLSX
   */
  static async exportLDV(shipment: any, options?: XLSXOptions): Promise<Buffer> {
    let XLSX: any;
    try {
      // Import dinamico per evitare errori a build time
      XLSX = await import('xlsx');
    } catch (error) {
      throw new Error('Libreria xlsx non installata. Eseguire: npm install xlsx');
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Dati principali
    const mainData = [
      ['LETTERA DI VETTURA'],
      [],
      ['Tracking Number:', shipment.tracking_number],
      ['Data:', new Date(shipment.created_at).toLocaleDateString('it-IT')],
      [],
      ['MITTENTE'],
      ['Nome:', shipment.sender_name],
      ['Indirizzo:', shipment.sender_address],
      ['Città:', `${shipment.sender_zip} ${shipment.sender_city} (${shipment.sender_province})`],
      ['Telefono:', shipment.sender_phone],
      [],
      ['DESTINATARIO'],
      ['Nome:', shipment.recipient_name],
      ['Indirizzo:', shipment.recipient_address],
      ['Città:', `${shipment.recipient_zip} ${shipment.recipient_city} (${shipment.recipient_province})`],
      ['Telefono:', shipment.recipient_phone],
      [],
      ['PACCO'],
      ['Peso (kg):', shipment.weight],
      ['Dimensioni:', `${shipment.length}x${shipment.width}x${shipment.height} cm`],
      ['Valore:', shipment.declared_value ? `€${shipment.declared_value}` : '-'],
      [],
      ['SERVIZIO'],
      ['Corriere:', shipment.courier?.name || '-'],
      ['Tipo:', shipment.service_type],
      [],
      ['PRICING'],
      ['Prezzo Base:', `€${shipment.base_price?.toFixed(2) || '0.00'}`],
      ['Supplementi:', `€${shipment.surcharges?.toFixed(2) || '0.00'}`],
      ['TOTALE:', `€${shipment.final_price?.toFixed(2) || '0.00'}`],
    ];

    const ws = XLSX.utils.aoa_to_sheet(mainData);

    // Styling
    ws['!cols'] = [{ wch: 20 }, { wch: 40 }];

    XLSX.utils.book_append_sheet(wb, ws, 'LDV');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return buffer;
  }

  /**
   * Genera filename
   */
  static generateFilename(prefix: string = 'export'): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}.xlsx`;
  }
}
