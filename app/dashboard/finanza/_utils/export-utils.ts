import type { FiscalContext } from '@/lib/agent/fiscal-data.types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

/**
 * Export fiscal data to PDF with professional formatting
 */
export async function exportToPDF(fiscalContext: FiscalContext): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(99, 102, 241); // indigo-500
  doc.text('Finance Control Room', 15, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Report generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')}`,
    15,
    28
  );

  // Summary Box
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(15, 35, pageWidth - 30, 40, 'F');

  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text('Riepilogo Finanziario', 20, 43);

  doc.setFontSize(10);
  const summaryData = [
    [
      'Periodo:',
      `${new Date(fiscalContext.period.start).toLocaleDateString('it-IT')} - ${new Date(fiscalContext.period.end).toLocaleDateString('it-IT')}`,
    ],
    ['Spedizioni:', fiscalContext.shipmentsSummary.count.toString()],
    ['Ricavi Totali:', `€ ${fiscalContext.shipmentsSummary.total_revenue.toFixed(2)}`],
    [
      'Margine Netto:',
      fiscalContext.shipmentsSummary.total_margin !== null
        ? `€ ${fiscalContext.shipmentsSummary.total_margin.toFixed(2)}`
        : 'N/A',
    ],
    [
      'Margine %:',
      fiscalContext.shipmentsSummary.total_margin !== null &&
      fiscalContext.shipmentsSummary.total_revenue > 0
        ? `${((fiscalContext.shipmentsSummary.total_margin / fiscalContext.shipmentsSummary.total_revenue) * 100).toFixed(1)}%`
        : 'N/A',
    ],
    ['Saldo Wallet:', `€ ${fiscalContext.wallet.balance.toFixed(2)}`],
  ];

  let yPos = 50;
  summaryData.forEach(([label, value]) => {
    doc.setTextColor(100, 100, 100);
    doc.text(label, 20, yPos);
    doc.setTextColor(0, 0, 0);
    doc.text(value, 80, yPos);
    yPos += 6;
  });

  // COD Section
  yPos = 85;
  doc.setFontSize(12);
  doc.setTextColor(99, 102, 241);
  doc.text('Contrassegni (COD)', 15, yPos);

  yPos += 8;
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Pendenti: ${fiscalContext.pending_cod_count}`, 20, yPos);
  doc.text(`Valore: € ${fiscalContext.pending_cod_value.toFixed(2)}`, 80, yPos);

  // Deadlines Table
  yPos += 12;
  doc.setFontSize(12);
  doc.setTextColor(99, 102, 241);
  doc.text('Prossime Scadenze Fiscali', 15, yPos);

  const deadlinesData = fiscalContext.deadlines.map((d) => [
    new Date(d.date).toLocaleDateString('it-IT'),
    d.type,
    d.description,
  ]);

  doc.autoTable({
    startY: yPos + 5,
    head: [['Data', 'Tipo', 'Descrizione']],
    body: deadlinesData,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 241] },
    styles: { fontSize: 9 },
  });

  // Footer
  const pageCount = doc.internal.pages.length - 1;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Pagina ${i} di ${pageCount} - SpedireSicuro Platform`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save
  const fileName = `fiscal-report-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}

/**
 * Export fiscal data to Excel with multiple sheets
 */
export async function exportToExcel(fiscalContext: FiscalContext): Promise<void> {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryData = [
    ['Finance Control Room - Report Fiscale'],
    [''],
    ['Generato il:', new Date().toLocaleString('it-IT')],
    [
      'Periodo:',
      `${new Date(fiscalContext.period.start).toLocaleDateString('it-IT')} - ${new Date(fiscalContext.period.end).toLocaleDateString('it-IT')}`,
    ],
    [''],
    ['RIEPILOGO'],
    ['Metrica', 'Valore'],
    ['Spedizioni Totali', fiscalContext.shipmentsSummary.count],
    ['Ricavi Totali', fiscalContext.shipmentsSummary.total_revenue],
    ['Margine Netto', fiscalContext.shipmentsSummary.total_margin ?? 'N/A'],
    [
      'Margine %',
      fiscalContext.shipmentsSummary.total_margin !== null &&
      fiscalContext.shipmentsSummary.total_revenue > 0
        ? (
            (fiscalContext.shipmentsSummary.total_margin /
              fiscalContext.shipmentsSummary.total_revenue) *
            100
          ).toFixed(2) + '%'
        : 'N/A',
    ],
    ['Saldo Wallet', fiscalContext.wallet.balance],
    [''],
    ['CONTRASSEGNI (COD)'],
    ['Pendenti', fiscalContext.pending_cod_count],
    ['Valore Totale', fiscalContext.pending_cod_value],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Set column widths
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Riepilogo');

  // Sheet 2: Deadlines
  const deadlinesData = [
    ['Prossime Scadenze Fiscali'],
    [''],
    ['Data', 'Tipo', 'Descrizione'],
    ...fiscalContext.deadlines.map((d) => [
      new Date(d.date).toLocaleDateString('it-IT'),
      d.type,
      d.description,
    ]),
  ];

  const deadlinesSheet = XLSX.utils.aoa_to_sheet(deadlinesData);
  deadlinesSheet['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 40 }];

  XLSX.utils.book_append_sheet(workbook, deadlinesSheet, 'Scadenze');

  // Sheet 3: Metrics (for further analysis)
  const metricsData = [
    ['Metriche Dettagliate'],
    [''],
    ['Categoria', 'Valore', 'Note'],
    [
      'Revenue per Shipment',
      (fiscalContext.shipmentsSummary.total_revenue / fiscalContext.shipmentsSummary.count).toFixed(
        2
      ),
      'Media',
    ],
    [
      'Margin per Shipment',
      fiscalContext.shipmentsSummary.total_margin !== null &&
      fiscalContext.shipmentsSummary.count > 0
        ? (
            fiscalContext.shipmentsSummary.total_margin / fiscalContext.shipmentsSummary.count
          ).toFixed(2)
        : 'N/A',
      'Media',
    ],
    [
      'COD Percentage',
      ((fiscalContext.pending_cod_count / fiscalContext.shipmentsSummary.count) * 100).toFixed(1) +
        '%',
      'Su totale spedizioni',
    ],
    [
      'Avg COD Value',
      fiscalContext.pending_cod_count > 0
        ? (fiscalContext.pending_cod_value / fiscalContext.pending_cod_count).toFixed(2)
        : 0,
      'Media per contrassegno',
    ],
  ];

  const metricsSheet = XLSX.utils.aoa_to_sheet(metricsData);
  metricsSheet['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }];

  XLSX.utils.book_append_sheet(workbook, metricsSheet, 'Metriche');

  // Save
  const fileName = `fiscal-report-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
