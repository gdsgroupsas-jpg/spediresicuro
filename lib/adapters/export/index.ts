/**
 * Export Adapters - Central Export
 */

export * from './csv';
export * from './xlsx';
export * from './pdf';

/**
 * Unified Export Service
 */
export class ExportService {
  /**
   * Esporta spedizioni nel formato richiesto
   */
  static async exportShipments(
    shipments: any[],
    format: 'csv' | 'xlsx' | 'pdf',
    options?: any
  ): Promise<{ data: Buffer | string; filename: string; mimeType: string }> {
    switch (format) {
      case 'csv': {
        const { CSVExporter } = require('./csv');
        const data = CSVExporter.exportShipments(shipments, options);
        return {
          data: Buffer.from(data, 'utf-8'),
          filename: CSVExporter.generateFilename('spedizioni'),
          mimeType: 'text/csv',
        };
      }

      case 'xlsx': {
        const { XLSXExporter } = require('./xlsx');
        const data = await XLSXExporter.exportShipments(shipments, options);
        return {
          data,
          filename: XLSXExporter.generateFilename('spedizioni'),
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }

      case 'pdf': {
        const { PDFExporter } = require('./pdf');
        const data = await PDFExporter.exportShipmentsList(shipments, options);
        return {
          data,
          filename: PDFExporter.generateFilename('spedizioni'),
          mimeType: 'application/pdf',
        };
      }

      default:
        throw new Error(`Formato non supportato: ${format}`);
    }
  }

  /**
   * Esporta LDV singola nel formato richiesto
   */
  static async exportLDV(
    shipment: any,
    format: 'csv' | 'xlsx' | 'pdf',
    options?: any
  ): Promise<{ data: Buffer | string; filename: string; mimeType: string }> {
    switch (format) {
      case 'csv': {
        const { CSVExporter } = require('./csv');
        const data = CSVExporter.exportLDV(shipment, options);
        return {
          data: Buffer.from(data, 'utf-8'),
          filename: `LDV_${shipment.tracking_number}.csv`,
          mimeType: 'text/csv',
        };
      }

      case 'xlsx': {
        const { XLSXExporter } = require('./xlsx');
        const data = await XLSXExporter.exportLDV(shipment, options);
        return {
          data,
          filename: `LDV_${shipment.tracking_number}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
      }

      case 'pdf': {
        const { PDFExporter } = require('./pdf');
        const data = await PDFExporter.exportLDV(shipment, options);
        return {
          data,
          filename: `LDV_${shipment.tracking_number}.pdf`,
          mimeType: 'application/pdf',
        };
      }

      default:
        throw new Error(`Formato non supportato: ${format}`);
    }
  }
}
