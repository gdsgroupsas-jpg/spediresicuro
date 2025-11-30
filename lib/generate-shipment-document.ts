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
  // Campi aggiuntivi per formato spedisci.online
  contrassegno?: number | string;
  assicurazione?: number | string;
  contenuto?: string;
  order_id?: string;
  totale_ordine?: number | string;
  rif_mittente?: string;
  rif_destinatario?: string;
  colli?: number | string;
}

/**
 * Genera CSV per una singola spedizione
 * Formato compatibile con spedisci.online
 * Separatore: punto e virgola (;)
 * Decimali: punto (.)
 * Encoding: UTF-8
 */
export function generateShipmentCSV(spedizione: SpedizioneData): string {
  // Helper per formattare valori (sostituisce virgola con punto per decimali)
  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    // Se è un numero, converti virgola in punto
    if (typeof value === 'number') {
      return String(value).replace(',', '.');
    }
    // Se è una stringa con virgola decimale, converti in punto
    if (typeof value === 'string' && /^\d+,\d+$/.test(value)) {
      return value.replace(',', '.');
    }
    return String(value);
  };

  // Helper per escape valori CSV (gestisce punto e virgola nei testi)
  const escapeCSV = (value: string): string => {
    if (!value) return '';
    // Se contiene punto e virgola o virgolette, racchiudi tra virgolette e raddoppia le virgolette interne
    if (value.includes(';') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Prepara i valori secondo formato spedisci.online
  const destinatario = escapeCSV(spedizione.destinatario.nome || '');
  const indirizzo = escapeCSV(spedizione.destinatario.indirizzo || '');
  const cap = spedizione.destinatario.cap || '';
  const localita = escapeCSV(spedizione.destinatario.citta || '');
  const provincia = (spedizione.destinatario.provincia || '').toUpperCase().slice(0, 2);
  const country = 'IT';
  const peso = formatValue(spedizione.peso || 0);
  const colli = formatValue(spedizione.colli || 1);
  const contrassegno = formatValue(spedizione.contrassegno || '');
  const rif_mittente = escapeCSV(spedizione.rif_mittente || spedizione.mittente.nome || '');
  const rif_destinatario = escapeCSV(spedizione.rif_destinatario || spedizione.destinatario.nome || '');
  const note = escapeCSV(spedizione.note || '');
  const telefono = spedizione.destinatario.telefono || '';
  const email_destinatario = spedizione.destinatario.email || '';
  const contenuto = escapeCSV(spedizione.contenuto || '');
  const order_id = escapeCSV(spedizione.order_id || spedizione.tracking || '');
  const totale_ordine = formatValue(spedizione.totale_ordine || spedizione.prezzoFinale || '');

  // Header CSV secondo formato spedisci.online (tutto minuscolo)
  const header = 'destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;';
  
  // Riga dati
  const row = [
    destinatario,
    indirizzo,
    cap,
    localita,
    provincia,
    country,
    peso,
    colli,
    contrassegno,
    rif_mittente,
    rif_destinatario,
    note,
    telefono,
    email_destinatario,
    contenuto,
    order_id,
    totale_ordine,
  ].join(';') + ';'; // Aggiungi punto e virgola finale

  // Restituisci header + riga dati
  return header + '\n' + row;
}

/**
 * Genera CSV multiplo per lista spedizioni
 * Formato compatibile con spedisci.online per importazione batch
 * 
 * @param spedizioni Array di spedizioni da esportare
 * @returns Stringa CSV con header + tutte le righe
 */
export function generateMultipleShipmentsCSV(spedizioni: SpedizioneData[]): string {
  if (spedizioni.length === 0) {
    return '';
  }

  // Header CSV (una sola volta)
  const header = 'destinatario;indirizzo;cap;localita;provincia;country;peso;colli;contrassegno;rif_mittente;rif_destinatario;note;telefono;email_destinatario;contenuto;order_id;totale_ordine;';
  
  // Genera CSV per ogni spedizione
  const rows = spedizioni.map(spedizione => {
    // Usa la stessa logica di generateShipmentCSV ma solo per la riga dati
    const formatValue = (value: any): string => {
      if (value === null || value === undefined || value === '') return '';
      if (typeof value === 'number') return String(value).replace(',', '.');
      if (typeof value === 'string' && /^\d+,\d+$/.test(value)) {
        return value.replace(',', '.');
      }
      return String(value);
    };

    const escapeCSV = (value: string): string => {
      if (!value) return '';
      if (value.includes(';') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const destinatario = escapeCSV(spedizione.destinatario.nome || '');
    const indirizzo = escapeCSV(spedizione.destinatario.indirizzo || '');
    const cap = spedizione.destinatario.cap || '';
    const localita = escapeCSV(spedizione.destinatario.citta || '');
    const provincia = (spedizione.destinatario.provincia || '').toUpperCase().slice(0, 2);
    const country = 'IT';
    const peso = formatValue(spedizione.peso || 0);
    const colli = formatValue(spedizione.colli || 1);
    const contrassegno = formatValue(spedizione.contrassegno || '');
    const rif_mittente = escapeCSV(spedizione.rif_mittente || spedizione.mittente.nome || '');
    const rif_destinatario = escapeCSV(spedizione.rif_destinatario || spedizione.destinatario.nome || '');
    const note = escapeCSV(spedizione.note || '');
    const telefono = spedizione.destinatario.telefono || '';
    const email_destinatario = spedizione.destinatario.email || '';
    const contenuto = escapeCSV(spedizione.contenuto || '');
    const order_id = escapeCSV(spedizione.order_id || spedizione.tracking || '');
    const totale_ordine = formatValue(spedizione.totale_ordine || spedizione.prezzoFinale || '');

    return [
      destinatario,
      indirizzo,
      cap,
      localita,
      provincia,
      country,
      peso,
      colli,
      contrassegno,
      rif_mittente,
      rif_destinatario,
      note,
      telefono,
      email_destinatario,
      contenuto,
      order_id,
      totale_ordine,
    ].join(';') + ';';
  });

  // Restituisci header + tutte le righe
  return header + '\n' + rows.join('\n');
}

/**
 * Scarica CSV multiplo
 */
export function downloadMultipleCSV(content: string, filename: string) {
  // BOM UTF-8 per compatibilità Excel + encoding UTF-8
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
 * Scarica CSV
 * Formato spedisci.online: separatore punto e virgola, encoding UTF-8
 */
export function downloadCSV(content: string, filename: string) {
  // BOM UTF-8 per compatibilità Excel + encoding UTF-8
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

