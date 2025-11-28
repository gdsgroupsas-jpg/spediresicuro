/**
 * CSV Export Adapter
 *
 * Esportazione spedizioni in formato CSV
 */

export interface CSVOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  encoding?: 'utf-8' | 'utf-8-bom'; // BOM per Excel
}

export class CSVExporter {
  /**
   * Esporta array di oggetti in CSV
   */
  static export<T extends Record<string, any>>(
    data: T[],
    columns: { key: keyof T; label: string }[],
    options: CSVOptions = {}
  ): string {
    const {
      delimiter = ',',
      includeHeaders = true,
      encoding = 'utf-8-bom',
    } = options;

    const rows: string[] = [];

    // Headers
    if (includeHeaders) {
      const headers = columns.map(col => this.escapeCSV(col.label));
      rows.push(headers.join(delimiter));
    }

    // Data rows
    data.forEach(item => {
      const row = columns.map(col => {
        const value = item[col.key];
        return this.escapeCSV(this.formatValue(value));
      });
      rows.push(row.join(delimiter));
    });

    let csv = rows.join('\n');

    // Aggiungi BOM UTF-8 per Excel
    if (encoding === 'utf-8-bom') {
      csv = '\ufeff' + csv;
    }

    return csv;
  }

  /**
   * Esporta spedizioni in CSV
   */
  static exportShipments(shipments: any[], options?: CSVOptions): string {
    const columns = [
      { key: 'tracking_number', label: 'Tracking' },
      { key: 'created_at', label: 'Data' },
      { key: 'status', label: 'Status' },
      { key: 'recipient_name', label: 'Destinatario' },
      { key: 'recipient_address', label: 'Indirizzo' },
      { key: 'recipient_city', label: 'Città' },
      { key: 'recipient_zip', label: 'CAP' },
      { key: 'recipient_province', label: 'Provincia' },
      { key: 'recipient_phone', label: 'Telefono' },
      { key: 'courier_name', label: 'Corriere' },
      { key: 'service_type', label: 'Servizio' },
      { key: 'weight', label: 'Peso (kg)' },
      { key: 'final_price', label: 'Prezzo Finale' },
    ];

    // Prepara dati con campi calcolati
    const dataForExport = shipments.map(s => ({
      ...s,
      created_at: new Date(s.created_at).toLocaleDateString('it-IT'),
      final_price: `€${s.final_price?.toFixed(2) || '0.00'}`,
      courier_name: s.courier?.name || '-',
    }));

    return this.export(dataForExport, columns, options);
  }

  /**
   * Esporta LDV (Lettera di Vettura) in CSV
   */
  static exportLDV(shipment: any, options?: CSVOptions): string {
    const ldvData = [
      { campo: 'Tracking Number', valore: shipment.tracking_number },
      { campo: 'Data Spedizione', valore: new Date(shipment.created_at).toLocaleDateString('it-IT') },
      { campo: '', valore: '' },
      { campo: 'MITTENTE', valore: '' },
      { campo: 'Nome', valore: shipment.sender_name },
      { campo: 'Indirizzo', valore: shipment.sender_address },
      { campo: 'Città', valore: `${shipment.sender_zip} ${shipment.sender_city} (${shipment.sender_province})` },
      { campo: 'Telefono', valore: shipment.sender_phone },
      { campo: '', valore: '' },
      { campo: 'DESTINATARIO', valore: '' },
      { campo: 'Nome', valore: shipment.recipient_name },
      { campo: 'Indirizzo', valore: shipment.recipient_address },
      { campo: 'Città', valore: `${shipment.recipient_zip} ${shipment.recipient_city} (${shipment.recipient_province})` },
      { campo: 'Telefono', valore: shipment.recipient_phone },
      { campo: '', valore: '' },
      { campo: 'PACCO', valore: '' },
      { campo: 'Peso (kg)', valore: shipment.weight },
      { campo: 'Dimensioni (cm)', valore: `${shipment.length}x${shipment.width}x${shipment.height}` },
      { campo: 'Valore Dichiarato', valore: shipment.declared_value ? `€${shipment.declared_value}` : '-' },
      { campo: '', valore: '' },
      { campo: 'SERVIZIO', valore: '' },
      { campo: 'Corriere', valore: shipment.courier?.name || '-' },
      { campo: 'Tipo Servizio', valore: shipment.service_type },
      { campo: 'Contrassegno', valore: shipment.cash_on_delivery ? `€${shipment.cash_on_delivery_amount}` : 'No' },
      { campo: 'Assicurazione', valore: shipment.insurance ? 'Sì' : 'No' },
      { campo: '', valore: '' },
      { campo: 'PRICING', valore: '' },
      { campo: 'Prezzo Base', valore: `€${shipment.base_price?.toFixed(2) || '0.00'}` },
      { campo: 'Supplementi', valore: `€${shipment.surcharges?.toFixed(2) || '0.00'}` },
      { campo: 'Totale', valore: `€${shipment.final_price?.toFixed(2) || '0.00'}` },
    ];

    const columns = [
      { key: 'campo', label: 'Campo' },
      { key: 'valore', label: 'Valore' },
    ];

    return this.export(ldvData as any, columns, options);
  }

  /**
   * Helper: Escape CSV value
   */
  private static escapeCSV(value: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    const strValue = String(value);

    // Se contiene virgola, virgolette o newline, metti tra virgolette
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }

    return strValue;
  }

  /**
   * Helper: Formatta valore
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toLocaleDateString('it-IT');
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'boolean') {
      return value ? 'Sì' : 'No';
    }

    return String(value);
  }

  /**
   * Genera filename con timestamp
   */
  static generateFilename(prefix: string = 'export', extension: string = 'csv'): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}.${extension}`;
  }
}
