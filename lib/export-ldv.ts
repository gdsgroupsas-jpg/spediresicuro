/**
 * Export LDV (Lettera di Vettura) Functions
 *
 * Funzioni per generare PDF, Excel e CSV delle spedizioni
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Shipment {
  id: string;
  tracking_number: string;
  recipient_name: string;
  recipient_address: string;
  recipient_city: string;
  recipient_zip: string;
  recipient_phone: string;
  weight: number;
  final_price?: number;
  status: string;
  created_at: string;
}

/**
 * Genera PDF LDV per una spedizione
 */
export async function generatePDFLDV(shipment: Shipment): Promise<Blob> {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text('LETTERA DI VETTURA', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.text(`Tracking: ${shipment.tracking_number}`, 20, 35);
  doc.text(`Data: ${new Date(shipment.created_at).toLocaleDateString('it-IT')}`, 20, 42);

  // Destinatario
  doc.setFontSize(14);
  doc.text('DESTINATARIO', 20, 55);

  doc.setFontSize(10);
  doc.text(`Nome: ${shipment.recipient_name}`, 20, 65);
  doc.text(`Indirizzo: ${shipment.recipient_address}`, 20, 72);
  doc.text(`Città: ${shipment.recipient_city} (${shipment.recipient_zip})`, 20, 79);
  doc.text(`Telefono: ${shipment.recipient_phone}`, 20, 86);

  // Dettagli spedizione
  doc.setFontSize(14);
  doc.text('DETTAGLI SPEDIZIONE', 20, 100);

  autoTable(doc, {
    startY: 105,
    head: [['Campo', 'Valore']],
    body: [
      ['Peso (kg)', shipment.weight.toString()],
      ['Prezzo (€)', shipment.final_price ? shipment.final_price.toFixed(2) : 'N/A'],
      ['Status', shipment.status],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.text(
    `Pagina ${pageCount} - SpedireSicuro.it`,
    doc.internal.pageSize.getWidth() / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  return doc.output('blob');
}

/**
 * Genera Excel per lista spedizioni
 */
export async function generateExcelLDV(shipments: Shipment[]): Promise<Blob> {
  const data = shipments.map(s => ({
    'Tracking': s.tracking_number,
    'Destinatario': s.recipient_name,
    'Città': s.recipient_city,
    'CAP': s.recipient_zip,
    'Telefono': s.recipient_phone,
    'Peso (kg)': s.weight,
    'Prezzo (€)': s.final_price || 0,
    'Status': s.status,
    'Data': new Date(s.created_at).toLocaleDateString('it-IT'),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Spedizioni');

  // Auto-width columns
  const maxWidth = data.reduce((w, r) => Math.max(w, JSON.stringify(r).length), 10);
  ws['!cols'] = Array(Object.keys(data[0] || {}).length).fill({ wch: maxWidth });

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Genera CSV per lista spedizioni
 */
export async function generateCSVLDV(shipments: Shipment[]): Promise<Blob> {
  const headers = [
    'Tracking',
    'Destinatario',
    'Città',
    'CAP',
    'Telefono',
    'Peso (kg)',
    'Prezzo (€)',
    'Status',
    'Data'
  ];

  const rows = shipments.map(s => [
    s.tracking_number,
    s.recipient_name,
    s.recipient_city,
    s.recipient_zip,
    s.recipient_phone,
    s.weight.toString(),
    s.final_price?.toFixed(2) || '0.00',
    s.status,
    new Date(s.created_at).toLocaleDateString('it-IT'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // UTF-8 BOM per Excel
  const BOM = '\uFEFF';
  return new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
}
