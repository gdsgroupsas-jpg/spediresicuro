/**
 * PDF Export Adapter
 *
 * Esportazione LDV e liste in formato PDF
 * Richiede libreria 'jspdf' e 'jspdf-autotable'
 */

export interface PDFOptions {
  format?: 'a4' | 'letter';
  orientation?: 'portrait' | 'landscape';
  includeLogo?: boolean;
  includeBarcode?: boolean;
}

export class PDFExporter {
  /**
   * Verifica se le librerie PDF sono disponibili
   */
  static isAvailable(): boolean {
    try {
      require.resolve('jspdf');
      require.resolve('jspdf-autotable');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Esporta LDV (Lettera di Vettura) in PDF
   */
  static async exportLDV(shipment: any, options: PDFOptions = {}): Promise<Buffer> {
    if (!this.isAvailable()) {
      throw new Error('Librerie PDF non installate. Eseguire: npm install jspdf jspdf-autotable');
    }

    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');

    const {
      format = 'a4',
      orientation = 'portrait',
      includeLogo = true,
      includeBarcode = true,
    } = options;

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format,
    });

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('LETTERA DI VETTURA', 105, 20, { align: 'center' });

    // Tracking Number (grande e prominente)
    doc.setFontSize(16);
    doc.text(`Tracking: ${shipment.tracking_number}`, 105, 30, { align: 'center' });

    // Data
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${new Date(shipment.created_at).toLocaleDateString('it-IT')}`, 105, 38, { align: 'center' });

    let yPos = 50;

    // Box Mittente
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('MITTENTE', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    yPos += 6;
    doc.text(shipment.sender_name || '-', 15, yPos);
    yPos += 5;
    doc.text(shipment.sender_address || '-', 15, yPos);
    yPos += 5;
    doc.text(`${shipment.sender_zip} ${shipment.sender_city} (${shipment.sender_province})`, 15, yPos);
    yPos += 5;
    doc.text(`Tel: ${shipment.sender_phone || '-'}`, 15, yPos);

    yPos += 10;

    // Box Destinatario (evidenziato)
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPos - 5, 190, 30, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('DESTINATARIO', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    yPos += 7;
    doc.text(shipment.recipient_name, 15, yPos);
    yPos += 6;
    doc.text(`${shipment.recipient_address}`, 15, yPos);
    yPos += 6;
    doc.text(`${shipment.recipient_zip} ${shipment.recipient_city} (${shipment.recipient_province})`, 15, yPos);
    yPos += 6;
    doc.text(`Tel: ${shipment.recipient_phone}`, 15, yPos);

    yPos += 15;

    // Tabella Dettagli Pacco
    const packageData = [
      ['Peso (kg)', shipment.weight || '-'],
      ['Dimensioni (cm)', shipment.length && shipment.width && shipment.height
        ? `${shipment.length} x ${shipment.width} x ${shipment.height}`
        : '-'],
      ['Valore Dichiarato', shipment.declared_value ? `€${shipment.declared_value}` : '-'],
      ['Corriere', shipment.courier?.name || '-'],
      ['Tipo Servizio', shipment.service_type || 'standard'],
      ['Contrassegno', shipment.cash_on_delivery ? `€${shipment.cash_on_delivery_amount}` : 'No'],
      ['Assicurazione', shipment.insurance ? 'Sì' : 'No'],
    ];

    (doc as any).autoTable({
      startY: yPos,
      head: [['Dettaglio', 'Valore']],
      body: packageData,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Pricing
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PRICING', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    yPos += 6;
    doc.text(`Prezzo Base: €${shipment.base_price?.toFixed(2) || '0.00'}`, 15, yPos);
    yPos += 5;
    doc.text(`Supplementi: €${shipment.surcharges?.toFixed(2) || '0.00'}`, 15, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTALE: €${shipment.final_price?.toFixed(2) || '0.00'}`, 15, yPos);

    // Note (se presenti)
    if (shipment.notes || shipment.recipient_notes) {
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('NOTE', 15, yPos);
      doc.setFont('helvetica', 'normal');
      yPos += 5;
      const notes = shipment.recipient_notes || shipment.notes;
      const splitNotes = doc.splitTextToSize(notes, 180);
      doc.text(splitNotes, 15, yPos);
    }

    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('Generato da SpedireSicuro.it', 105, 285, { align: 'center' });

    // Converti in buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return pdfBuffer;
  }

  /**
   * Esporta lista spedizioni in PDF
   */
  static async exportShipmentsList(shipments: any[], options: PDFOptions = {}): Promise<Buffer> {
    if (!this.isAvailable()) {
      throw new Error('Librerie PDF non installate');
    }

    const { jsPDF } = require('jspdf');
    require('jspdf-autotable');

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA SPEDIZIONI', 148, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generato: ${new Date().toLocaleString('it-IT')}`, 148, 22, { align: 'center' });

    // Tabella
    const tableData = shipments.map(s => [
      s.tracking_number,
      new Date(s.created_at).toLocaleDateString('it-IT'),
      s.recipient_name,
      s.recipient_city,
      s.recipient_zip,
      s.courier?.name || '-',
      s.status,
      `€${s.final_price?.toFixed(2) || '0.00'}`,
    ]);

    (doc as any).autoTable({
      startY: 30,
      head: [['Tracking', 'Data', 'Destinatario', 'Città', 'CAP', 'Corriere', 'Status', 'Prezzo']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [66, 139, 202] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 20 },
        2: { cellWidth: 40 },
        3: { cellWidth: 30 },
        4: { cellWidth: 15 },
        5: { cellWidth: 30 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 },
      },
    });

    // Footer con totali
    const totalRevenue = shipments.reduce((sum, s) => sum + (s.final_price || 0), 0);
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFont('helvetica', 'bold');
    doc.text(`Totale Spedizioni: ${shipments.length}`, 15, finalY);
    doc.text(`Fatturato Totale: €${totalRevenue.toFixed(2)}`, 15, finalY + 6);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return pdfBuffer;
  }

  /**
   * Genera filename
   */
  static generateFilename(prefix: string = 'export'): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}.pdf`;
  }
}
