/**
 * Invoice PDF Generator
 *
 * Genera fatture PDF conformi alla normativa fiscale italiana.
 *
 * REQUISITI FISCALI:
 * - Numero progressivo (YYYY-XXXX)
 * - Data emissione
 * - Dati mittente (ragione sociale, P.IVA, CF, indirizzo)
 * - Dati destinatario
 * - Descrizione servizio
 * - Imponibile, IVA (22%), Totale
 * - Modalità pagamento
 * - IBAN per bonifico
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Dati per generazione fattura
 */
export interface InvoiceData {
  invoiceNumber: string; // "2026-0001"
  issueDate: Date;
  dueDate?: Date;
  sender: {
    companyName: string;
    vatNumber: string;
    taxCode: string;
    address: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  };
  recipient: {
    name: string;
    vatNumber?: string;
    taxCode?: string;
    address: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number; // 22%
    total: number;
  }>;
  paymentMethod: string;
  iban: string;
  notes?: string;
}

/**
 * Genera PDF fattura conforme normativa italiana
 *
 * @param data - Dati fattura
 * @returns Buffer del PDF
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const doc = new jsPDF();

  // ============================================
  // HEADER
  // ============================================

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FATTURA', 105, 20, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`N. ${data.invoiceNumber}`, 105, 28, { align: 'center' });

  // ============================================
  // DATI MITTENTE (Sinistra)
  // ============================================

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('MITTENTE', 20, 45);

  doc.setFont('helvetica', 'normal');
  let yPos = 50;
  doc.text(data.sender.companyName, 20, yPos);
  yPos += 5;
  doc.text(`P.IVA: ${data.sender.vatNumber}`, 20, yPos);
  yPos += 5;
  doc.text(`C.F.: ${data.sender.taxCode}`, 20, yPos);
  yPos += 5;

  // Indirizzo
  const senderAddress = [
    data.sender.address,
    data.sender.city ? `${data.sender.zip || ''} ${data.sender.city}`.trim() : '',
    data.sender.province || '',
    data.sender.country || 'Italia',
  ]
    .filter(Boolean)
    .join(', ');

  doc.text(senderAddress, 20, yPos);

  // ============================================
  // DATI DESTINATARIO (Destra)
  // ============================================

  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATARIO', 120, 45);

  doc.setFont('helvetica', 'normal');
  yPos = 50;
  doc.text(data.recipient.name, 120, yPos);
  yPos += 5;

  if (data.recipient.vatNumber) {
    doc.text(`P.IVA: ${data.recipient.vatNumber}`, 120, yPos);
    yPos += 5;
  }

  if (data.recipient.taxCode) {
    doc.text(`C.F.: ${data.recipient.taxCode}`, 120, yPos);
    yPos += 5;
  }

  // Indirizzo destinatario
  const recipientAddress = [
    data.recipient.address,
    data.recipient.city ? `${data.recipient.zip || ''} ${data.recipient.city}`.trim() : '',
    data.recipient.province || '',
    data.recipient.country || 'Italia',
  ]
    .filter(Boolean)
    .join(', ');

  doc.text(recipientAddress, 120, yPos);

  // ============================================
  // DATI DOCUMENTO
  // ============================================

  yPos = 80;
  doc.setFontSize(9);
  doc.text(`Data emissione: ${formatDate(data.issueDate)}`, 20, yPos);
  yPos += 5;

  if (data.dueDate) {
    doc.text(`Data scadenza: ${formatDate(data.dueDate)}`, 20, yPos);
    yPos += 5;
  }

  // ============================================
  // TABELLA RIGHE FATTURA
  // ============================================

  const tableData = data.items.map((item) => [
    item.description,
    item.quantity.toString(),
    `€${item.unitPrice.toFixed(2)}`,
    `${item.vatRate}%`,
    `€${item.total.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: yPos + 5,
    head: [['Descrizione', 'Q.tà', 'Prezzo Unit.', 'IVA', 'Totale']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [66, 139, 202], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
    },
  });

  // ============================================
  // TOTALI
  // ============================================

  const finalY = (doc as any).lastAutoTable.finalY || yPos + 30;

  const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
  const vat = data.items.reduce((sum, item) => sum + (item.total * item.vatRate) / 100, 0);
  const total = subtotal + vat;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  let totalY = finalY + 10;
  doc.text(`Imponibile:`, 120, totalY);
  doc.text(`€${subtotal.toFixed(2)}`, 170, totalY, { align: 'right' });

  totalY += 5;
  doc.text(`IVA (22%):`, 120, totalY);
  doc.text(`€${vat.toFixed(2)}`, 170, totalY, { align: 'right' });

  totalY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`TOTALE:`, 120, totalY);
  doc.text(`€${total.toFixed(2)}`, 170, totalY, { align: 'right' });

  // ============================================
  // FOOTER (Modalità pagamento)
  // ============================================

  totalY += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Modalità di pagamento: ${data.paymentMethod}`, 20, totalY);
  totalY += 5;
  doc.text(`IBAN: ${data.iban}`, 20, totalY);

  // Note opzionali
  if (data.notes) {
    totalY += 10;
    doc.text('Note:', 20, totalY);
    totalY += 5;
    doc.text(data.notes, 20, totalY, { maxWidth: 170 });
  }

  // ============================================
  // RETURN BUFFER
  // ============================================

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Formatta data in formato italiano
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('it-IT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
