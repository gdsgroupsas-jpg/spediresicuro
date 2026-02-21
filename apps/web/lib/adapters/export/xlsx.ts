/**
 * XLSX Export Adapter
 *
 * Esportazione spedizioni in formato Excel (XLSX)
 * Usa ExcelJS (alternativa sicura a xlsx)
 */

import ExcelJS from 'exceljs';

export interface XLSXOptions {
  sheetName?: string;
  includeFormatting?: boolean;
  autoWidth?: boolean;
}

export class XLSXExporter {
  /**
   * Verifica se la libreria exceljs è disponibile
   */
  static isAvailable(): boolean {
    try {
      // ExcelJS è sempre disponibile se installato
      return true;
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
    const { sheetName = 'Sheet1', includeFormatting = true, autoWidth = true } = options;

    // Crea workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Prepara header row
    const headers = columns.map((col) => col.label);
    worksheet.addRow(headers);

    // Formatta header (se richiesto)
    if (includeFormatting) {
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    }

    // Aggiungi dati
    data.forEach((item) => {
      const row = columns.map((col) => item[col.key] ?? '');
      worksheet.addRow(row);
    });

    // Auto-width colonne
    if (autoWidth) {
      worksheet.columns.forEach((column, index) => {
        const colDef = columns[index];
        if (colDef?.width) {
          column.width = colDef.width;
        } else {
          // Calcola larghezza automatica
          let maxLength = colDef?.label.length || 10;
          data.forEach((item) => {
            const value = String(item[colDef.key] || '');
            if (value.length > maxLength) maxLength = value.length;
          });
          column.width = Math.min(maxLength + 2, 50); // Max 50 caratteri
        }
      });
    }

    // Genera buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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
    const dataForExport = shipments.map((s) => ({
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
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('LDV');

    // Dati principali
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
      [
        'Città:',
        `${shipment.recipient_zip} ${shipment.recipient_city} (${shipment.recipient_province})`,
      ],
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

    // Aggiungi dati al worksheet
    mainData.forEach((row) => {
      worksheet.addRow(row);
    });

    // Styling colonne
    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 40;

    // Formatta titolo
    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 14 };

    // Genera buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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
