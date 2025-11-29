/**
 * Genera documenti (CSV/PDF) per una singola spedizione
 */

import jsPDF from 'jspdf';

export interface SpedizioneData {
  tracking: string;
  mittente: {
    nome: string;
    indirizzo: string;
    citta: string;
    provincia: string;
    cap: string;
    telefono: string;
    email: string;
  };
  destinatario: {
    nome: string;
    indirizzo: string;
    citta: string;
    provincia: string;
    cap: string;
    telefono: string;
    email: string;
  };
  peso: number;
  dimensioni: {
    lunghezza: number;
    larghezza: number;
    altezza: number;
  };
  tipoSpedizione: string;
  corriere: string;
  prezzoFinale: number;
  status: string;
  note?: string;
  createdAt?: string;
}

/**
 * Genera CSV per una singola spedizione
 */
export function generateShipmentCSV(spedizione: SpedizioneData): string {
  const rows: string[] = [];
  
  // Header
  rows.push('DETTAGLIO SPEDIZIONE');
  rows.push(`Tracking Number,${spedizione.tracking}`);
  rows.push(`Data Creazione,${spedizione.createdAt || new Date().toISOString()}`);
  rows.push(`Status,${spedizione.status}`);
  rows.push('');
  
  // Mittente
  rows.push('MITTENTE');
  rows.push(`Nome,${spedizione.mittente.nome}`);
  rows.push(`Indirizzo,${spedizione.mittente.indirizzo}`);
  rows.push(`Città,${spedizione.mittente.citta}`);
  rows.push(`Provincia,${spedizione.mittente.provincia}`);
  rows.push(`CAP,${spedizione.mittente.cap}`);
  rows.push(`Telefono,${spedizione.mittente.telefono}`);
  rows.push(`Email,${spedizione.mittente.email}`);
  rows.push('');
  
  // Destinatario
  rows.push('DESTINATARIO');
  rows.push(`Nome,${spedizione.destinatario.nome}`);
  rows.push(`Indirizzo,${spedizione.destinatario.indirizzo}`);
  rows.push(`Città,${spedizione.destinatario.citta}`);
  rows.push(`Provincia,${spedizione.destinatario.provincia}`);
  rows.push(`CAP,${spedizione.destinatario.cap}`);
  rows.push(`Telefono,${spedizione.destinatario.telefono}`);
  rows.push(`Email,${spedizione.destinatario.email}`);
  rows.push('');
  
  // Dettagli spedizione
  rows.push('DETTAGLI SPEDIZIONE');
  rows.push(`Peso (kg),${spedizione.peso}`);
  rows.push(`Dimensioni,${spedizione.dimensioni.lunghezza}x${spedizione.dimensioni.larghezza}x${spedizione.dimensioni.altezza} cm`);
  rows.push(`Tipo,${spedizione.tipoSpedizione}`);
  rows.push(`Corriere,${spedizione.corriere}`);
  rows.push(`Prezzo,€ ${spedizione.prezzoFinale.toFixed(2)}`);
  if (spedizione.note) {
    rows.push(`Note,${spedizione.note}`);
  }
  
  return rows.join('\n');
}

/**
 * Scarica CSV
 */
export function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Genera PDF per una singola spedizione
 */
export function generateShipmentPDF(spedizione: SpedizioneData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;
  
  // Header con logo/colori
  doc.setFillColor(255, 215, 0); // #FFD700
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('SPEDIRESICURO.IT', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('TICKET DI SPEDIZIONE', pageWidth / 2, 30, { align: 'center' });
  
  yPos = 50;
  
  // Tracking Number
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TRACKING NUMBER', margin, yPos);
  yPos += 8;
  doc.setFontSize(16);
  doc.setTextColor(255, 149, 0); // #FF9500
  doc.text(spedizione.tracking, margin, yPos);
  yPos += 12;
  
  // Linea separatrice
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;
  
  // Mittente
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('MITTENTE', margin, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${spedizione.mittente.nome}`, margin, yPos);
  yPos += 5;
  doc.text(`${spedizione.mittente.indirizzo}`, margin, yPos);
  yPos += 5;
  doc.text(`${spedizione.mittente.cap} ${spedizione.mittente.citta} (${spedizione.mittente.provincia})`, margin, yPos);
  yPos += 5;
  doc.text(`Tel: ${spedizione.mittente.telefono}`, margin, yPos);
  if (spedizione.mittente.email) {
    yPos += 5;
    doc.text(`Email: ${spedizione.mittente.email}`, margin, yPos);
  }
  yPos += 10;
  
  // Destinatario
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DESTINATARIO', margin, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${spedizione.destinatario.nome}`, margin, yPos);
  yPos += 5;
  doc.text(`${spedizione.destinatario.indirizzo}`, margin, yPos);
  yPos += 5;
  doc.text(`${spedizione.destinatario.cap} ${spedizione.destinatario.citta} (${spedizione.destinatario.provincia})`, margin, yPos);
  yPos += 5;
  doc.text(`Tel: ${spedizione.destinatario.telefono}`, margin, yPos);
  if (spedizione.destinatario.email) {
    yPos += 5;
    doc.text(`Email: ${spedizione.destinatario.email}`, margin, yPos);
  }
  yPos += 10;
  
  // Linea separatrice
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;
  
  // Dettagli spedizione
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DETTAGLI SPEDIZIONE', margin, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Peso: ${spedizione.peso} kg`, margin, yPos);
  yPos += 5;
  doc.text(`Dimensioni: ${spedizione.dimensioni.lunghezza}x${spedizione.dimensioni.larghezza}x${spedizione.dimensioni.altezza} cm`, margin, yPos);
  yPos += 5;
  doc.text(`Tipo: ${spedizione.tipoSpedizione}`, margin, yPos);
  yPos += 5;
  doc.text(`Corriere: ${spedizione.corriere}`, margin, yPos);
  yPos += 5;
  doc.text(`Status: ${spedizione.status}`, margin, yPos);
  yPos += 10;
  
  // Prezzo
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 149, 0); // #FF9500
  doc.text(`Prezzo: € ${spedizione.prezzoFinale.toFixed(2)}`, margin, yPos);
  yPos += 10;
  
  // Note (se presenti)
  if (spedizione.note) {
    yPos += 5;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Note:', margin, yPos);
    yPos += 5;
    const splitNote = doc.splitTextToSize(spedizione.note, pageWidth - 2 * margin);
    doc.text(splitNote, margin, yPos);
  }
  
  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT')} - SpedireSicuro.it`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
  
  return doc;
}

/**
 * Scarica PDF
 */
export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

