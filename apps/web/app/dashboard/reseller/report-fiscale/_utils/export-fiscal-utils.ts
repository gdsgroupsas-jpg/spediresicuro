/**
 * Export Fiscal Utils
 *
 * Funzioni per esportare il report fiscale in CSV e Excel.
 */

import ExcelJS from 'exceljs';
import type { MonthlyFiscalSummary, FiscalShipmentLine } from '@/types/reseller-fiscal';

/**
 * Formatta una data ISO in formato italiano
 */
function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formatta un numero come valuta EUR
 */
function formatCurrency(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/**
 * Escape per CSV (previene injection)
 */
function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Se contiene separatore, virgolette o newline, metti tra virgolette
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Genera CSV con dettaglio spedizioni
 */
export function exportFiscalCSV(data: MonthlyFiscalSummary): void {
  // Header
  const headers = [
    'Data',
    'Tracking',
    'Cliente Email',
    'Cliente Ragione Sociale',
    'Cliente P.IVA',
    'Lordo EUR',
    'Netto EUR',
    'IVA EUR',
    'Aliquota IVA %',
    'Margine EUR',
    'Margine %',
    'Corriere',
    'Servizio',
    'Destinatario',
    'Citta Destinatario',
  ].join(';');

  // Rows
  const rows: string[] = [];
  for (const client of data.clients) {
    for (const shipment of client.shipments) {
      const row = [
        formatDate(shipment.date),
        escapeCSV(shipment.tracking_number),
        escapeCSV(client.client.email),
        escapeCSV(client.client.company_name || client.client.name),
        escapeCSV(client.client.vat_number),
        formatCurrency(shipment.gross_amount),
        formatCurrency(shipment.net_amount),
        formatCurrency(shipment.vat_amount),
        shipment.vat_rate.toString(),
        shipment.margin_amount !== null ? formatCurrency(shipment.margin_amount) : 'N/A',
        shipment.margin_percent !== null ? shipment.margin_percent.toFixed(1) : 'N/A',
        escapeCSV(shipment.courier_name),
        escapeCSV(shipment.service_type),
        escapeCSV(shipment.recipient_name),
        escapeCSV(shipment.recipient_city),
      ].join(';');
      rows.push(row);
    }
  }

  // BOM UTF-8 per Excel italiano
  const BOM = '\uFEFF';
  const csvContent = BOM + headers + '\n' + rows.join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `report-fiscale-${data.period.label.replace(' ', '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera Excel multi-sheet
 */
export async function exportFiscalExcel(data: MonthlyFiscalSummary): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Riepilogo
  const summarySheet = workbook.addWorksheet('Riepilogo');
  const summaryRows: (string | number | null)[][] = [
    ['REPORT FISCALE - ' + data.period.label.toUpperCase(), ''],
    ['', ''],
    ['CEDENTE (Reseller)', ''],
    ['Nome/Ragione Sociale', data.reseller.company_name || data.reseller.name],
    ['Email', data.reseller.email || ''],
    ['P.IVA', data.reseller.vat_number || ''],
    ['Codice Fiscale', data.reseller.fiscal_code || ''],
    ['', ''],
    ['PERIODO', ''],
    ['Dal', formatDate(data.period.start_date)],
    ['Al', formatDate(data.period.end_date)],
    ['', ''],
    ['TOTALI', ''],
    ['Numero Spedizioni', data.total_shipments],
    ['Totale Lordo', formatCurrency(data.total_gross) + ' EUR'],
    ['Totale Netto (Imponibile)', formatCurrency(data.total_net) + ' EUR'],
    ['Totale IVA', formatCurrency(data.total_vat) + ' EUR'],
    [
      'Totale Margine',
      data.total_margin !== null ? formatCurrency(data.total_margin) + ' EUR' : 'N/A',
    ],
    [
      'Margine Medio',
      data.avg_margin_percent !== null ? data.avg_margin_percent.toFixed(1) + '%' : 'N/A',
    ],
  ];
  summaryRows.forEach((row) => summarySheet.addRow(row));

  // Sheet 2: Per Cliente
  const clientSheet = workbook.addWorksheet('Per Cliente');
  clientSheet.addRow([
    'Cliente',
    'Email',
    'P.IVA',
    'Spedizioni',
    'Lordo EUR',
    'Netto EUR',
    'IVA EUR',
    'Margine EUR',
    'Margine %',
  ]);
  data.clients.forEach((c) =>
    clientSheet.addRow([
      c.client.company_name || c.client.name,
      c.client.email,
      c.client.vat_number || '',
      c.shipments_count,
      c.total_gross,
      c.total_net,
      c.total_vat,
      c.total_margin,
      c.avg_margin_percent,
    ])
  );

  // Sheet 3: Dettaglio Spedizioni
  const detailSheet = workbook.addWorksheet('Dettaglio Spedizioni');
  detailSheet.addRow([
    'Data',
    'Tracking',
    'Cliente',
    'P.IVA Cliente',
    'Lordo EUR',
    'Netto EUR',
    'IVA EUR',
    'Aliquota %',
    'Margine EUR',
    'Margine %',
    'Corriere',
    'Servizio',
    'Destinatario',
    'Citta',
  ]);
  for (const client of data.clients) {
    for (const s of client.shipments) {
      detailSheet.addRow([
        formatDate(s.date),
        s.tracking_number,
        client.client.company_name || client.client.name,
        client.client.vat_number || '',
        s.gross_amount,
        s.net_amount,
        s.vat_amount,
        s.vat_rate,
        s.margin_amount,
        s.margin_percent,
        s.courier_name,
        s.service_type,
        s.recipient_name,
        s.recipient_city,
      ]);
    }
  }

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `report-fiscale-${data.period.label.replace(' ', '-')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
