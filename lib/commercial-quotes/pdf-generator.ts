/**
 * PDF Generator per Preventivi Commerciali
 *
 * Genera PDF brandizzati con matrice peso x zona,
 * clausole standard e branding reseller/organizzazione.
 *
 * Struttura (ispirata al template SELFIE):
 * 1. Header: logo + titolo + data + validita' + revisione
 * 2. Prospect: dati azienda
 * 3. Servizio: nome corriere
 * 4. Matrice: tabella peso x zona con autoTable
 * 5. Peso volumetrico: formula + esempio
 * 6. Clausole: lista puntata
 * 7. Footer: contatti
 */

import type {
  CommercialQuote,
  DeliveryMode,
  AdditionalCarrierSnapshot,
  PriceMatrixSnapshot,
} from '@/types/commercial-quotes';
import type { OrganizationBranding } from '@/types/workspace';

// Colori default SpedireSicuro
const DEFAULT_PRIMARY = [30, 58, 95] as const; // #1e3a5f
const DEFAULT_TEXT = [26, 26, 26] as const;
const DEFAULT_MUTED = [102, 102, 102] as const;

/**
 * Genera il PDF del preventivo commerciale.
 * Ritorna un Buffer pronto per download o storage.
 */
export async function generateCommercialQuotePDF(
  quote: CommercialQuote,
  branding?: OrganizationBranding | null
): Promise<Buffer> {
  // Import dinamico per compatibilita' Next.js SSR
  let jsPDF: typeof import('jspdf').jsPDF;
  let autoTable: typeof import('jspdf-autotable').autoTable;
  try {
    const jspdfModule = await import('jspdf');
    jsPDF =
      jspdfModule.jsPDF ||
      (jspdfModule as unknown as { default: typeof import('jspdf') }).default?.jsPDF;
    const autoTableModule = await import('jspdf-autotable');
    autoTable = autoTableModule.autoTable || autoTableModule.default;
  } catch {
    throw new Error('Librerie PDF non disponibili (jspdf, jspdf-autotable)');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Colore primario dal branding o default
  const primaryColor = parseBrandingColor(branding?.primary_color) || [...DEFAULT_PRIMARY];
  const matrix = quote.price_matrix;

  let yPos = 15;

  // ============================================
  // 1. HEADER
  // ============================================

  // Logo (se disponibile) o testo default
  if (branding?.logo_url) {
    try {
      const logoBase64 = await fetchLogoAsBase64(branding.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 15, yPos, 60, 20);
      }
    } catch {
      // Fallback: testo se logo non caricabile
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('SpedireSicuro.it', 15, yPos + 10);
    }
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('SpedireSicuro.it', 15, yPos + 10);
  }

  // Titolo PREVENTIVO (destra)
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('PREVENTIVO', 195, yPos + 5, { align: 'right' });

  // Data e validita'
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DEFAULT_MUTED);

  const dataEmissione = new Date(quote.created_at).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(`Data: ${dataEmissione}`, 195, yPos + 12, { align: 'right' });
  doc.text(`Validit\u00E0: ${quote.validity_days} giorni`, 195, yPos + 17, { align: 'right' });

  if (quote.revision > 1) {
    doc.setFontSize(9);
    doc.text(`Rev. ${quote.revision}`, 195, yPos + 22, { align: 'right' });
  }

  // Linea separatore header
  yPos += 30;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.8);
  doc.line(15, yPos, 195, yPos);
  yPos += 8;

  // ============================================
  // 2. PROSPECT
  // ============================================

  doc.setFillColor(249, 249, 249);
  doc.roundedRect(15, yPos, 180, 22, 2, 2, 'F');
  doc.setDrawColor(221, 221, 221);
  doc.roundedRect(15, yPos, 180, 22, 2, 2, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('CLIENTE', 20, yPos + 7);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DEFAULT_TEXT);
  doc.text(quote.prospect_company, 20, yPos + 13);

  // Contatto e settore sulla stessa riga
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DEFAULT_MUTED);
  const contactParts: string[] = [];
  if (quote.prospect_contact_name) contactParts.push(quote.prospect_contact_name);
  if (quote.prospect_email) contactParts.push(quote.prospect_email);
  if (quote.prospect_phone) contactParts.push(quote.prospect_phone);
  if (contactParts.length > 0) {
    doc.text(contactParts.join(' | '), 20, yPos + 18);
  }

  yPos += 28;

  // ============================================
  // 3. SERVIZIO (titolo corriere)
  // ============================================

  doc.setFillColor(...primaryColor);
  doc.roundedRect(15, yPos, 180, 12, 2, 2, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`SERVIZIO: ${matrix.carrier_display_name}`, 105, yPos + 8, { align: 'center' });

  yPos += 18;

  // ============================================
  // 4. MATRICE PREZZI (autoTable)
  // ============================================

  const tableHead = ['PESO', ...matrix.zones];

  const tableBody = matrix.weight_ranges.map((range, rowIdx) => {
    const row = [range.label];
    matrix.zones.forEach((_, colIdx) => {
      const price = matrix.prices[rowIdx]?.[colIdx];
      row.push(price ? `${price.toFixed(2)} \u20AC` : '-');
    });
    return row;
  });

  autoTable(doc, {
    startY: yPos,
    head: [tableHead],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 10,
      halign: 'center',
    },
    columnStyles: {
      0: {
        fillColor: [245, 245, 245],
        fontStyle: 'bold',
        halign: 'left',
        cellWidth: 35,
      },
    },
    alternateRowStyles: {
      fillColor: [249, 249, 249],
    },
    margin: { left: 15, right: 15 },
    styles: {
      cellPadding: 3,
      lineColor: [221, 221, 221],
      lineWidth: 0.3,
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // ============================================
  // 4b. MODALITA' RITIRO (se presente nello snapshot)
  // ============================================

  const deliveryMode = matrix.delivery_mode || quote.delivery_mode || 'carrier_pickup';
  const pickupFee = matrix.pickup_fee ?? quote.pickup_fee ?? null;
  const pickupInfo = getPickupDisplayInfo(deliveryMode, pickupFee);

  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.5);

  const pickupBoxHeight = 12;
  doc.roundedRect(15, yPos, 180, pickupBoxHeight, 2, 2, 'F');
  doc.line(15, yPos, 15, yPos + pickupBoxHeight);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(pickupInfo.title, 20, yPos + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  doc.text(pickupInfo.description, 20, yPos + 10);

  yPos += pickupBoxHeight + 6;

  // ============================================
  // 4c. LAVORAZIONE MERCE (se attiva)
  // ============================================

  const goodsNeedsProcessing =
    matrix.goods_needs_processing || quote.goods_needs_processing || false;

  if (goodsNeedsProcessing) {
    const procFee = matrix.processing_fee ?? quote.processing_fee ?? null;
    const procInfo = getProcessingDisplayInfo(procFee);

    doc.setFillColor(254, 249, 195); // yellow-100
    doc.setDrawColor(234, 179, 8); // yellow-500
    doc.setLineWidth(0.5);

    const procBoxHeight = 12;
    doc.roundedRect(15, yPos, 180, procBoxHeight, 2, 2, 'F');
    doc.line(15, yPos, 15, yPos + procBoxHeight);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(161, 98, 7); // yellow-700
    doc.text(procInfo.title, 20, yPos + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(85, 85, 85);
    doc.text(procInfo.description, 20, yPos + 10);

    yPos += procBoxHeight + 6;
  }

  // ============================================
  // 4d. MATRICI ALTERNATIVE (multi-corriere)
  // ============================================

  const additionalCarriers = quote.additional_carriers as AdditionalCarrierSnapshot[] | null;
  if (additionalCarriers && additionalCarriers.length > 0) {
    for (let acIdx = 0; acIdx < additionalCarriers.length; acIdx++) {
      const ac = additionalCarriers[acIdx];
      const acMatrix = ac.price_matrix;

      // Verifica spazio pagina
      if (yPos > 200) {
        doc.addPage();
        yPos = 15;
      }

      // Titolo alternativa
      doc.setFillColor(107, 114, 128); // gray-500
      doc.roundedRect(15, yPos, 180, 10, 2, 2, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(
        `ALTERNATIVA ${String.fromCharCode(66 + acIdx)}: ${acMatrix.carrier_display_name}`,
        105,
        yPos + 7,
        { align: 'center' }
      );
      yPos += 14;

      // Tabella prezzi alternativa
      const acTableHead = ['PESO', ...acMatrix.zones];
      const acTableBody = acMatrix.weight_ranges.map((range, rowIdx) => {
        const row = [range.label];
        acMatrix.zones.forEach((_, colIdx) => {
          const price = acMatrix.prices[rowIdx]?.[colIdx];
          row.push(price ? `${price.toFixed(2)} \u20AC` : '-');
        });
        return row;
      });

      autoTable(doc, {
        startY: yPos,
        head: [acTableHead],
        body: acTableBody,
        theme: 'grid',
        headStyles: {
          fillColor: [107, 114, 128],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center',
        },
        bodyStyles: { fontSize: 9, halign: 'center' },
        columnStyles: {
          0: { fillColor: [245, 245, 245], fontStyle: 'bold', halign: 'left', cellWidth: 35 },
        },
        alternateRowStyles: { fillColor: [249, 249, 249] },
        margin: { left: 15, right: 15 },
        styles: { cellPadding: 2.5, lineColor: [221, 221, 221], lineWidth: 0.3 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ============================================
  // 5. PESO VOLUMETRICO
  // ============================================

  doc.setFillColor(227, 242, 253);
  doc.setDrawColor(33, 150, 243);
  doc.setLineWidth(0.5);

  const volBoxHeight = 18;
  doc.roundedRect(15, yPos, 180, volBoxHeight, 2, 2, 'F');
  doc.line(15, yPos, 15, yPos + volBoxHeight); // Bordo sinistro blu

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(21, 101, 192);
  doc.text('PESO VOLUMETRICO', 20, yPos + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(85, 85, 85);
  doc.text('Formula: (Lunghezza \u00D7 Larghezza \u00D7 Altezza in cm) / 5000', 20, yPos + 11);
  doc.text(
    'Esempio: Un pacco di 50\u00D740\u00D730 cm = 60.000 cm\u00B3 / 5000 = 12 kg volumetrici',
    20,
    yPos + 15.5
  );

  yPos += volBoxHeight + 6;

  // ============================================
  // 6. CLAUSOLE (Note importanti)
  // ============================================

  const clauses = quote.clauses || [];
  if (clauses.length > 0) {
    // Verifica spazio pagina
    if (yPos > 240) {
      doc.addPage();
      yPos = 15;
    }

    doc.setFillColor(255, 249, 230);
    doc.setDrawColor(255, 193, 7);
    doc.setLineWidth(0.5);

    const clauseHeight = 8 + clauses.length * 5;
    doc.roundedRect(15, yPos, 180, clauseHeight, 2, 2, 'F');
    doc.line(15, yPos, 15, yPos + clauseHeight);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 124, 0);
    doc.text('NOTE IMPORTANTI', 20, yPos + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(85, 85, 85);

    clauses.forEach((clause, i) => {
      doc.text(`\u2022 ${clause.text}`, 22, yPos + 11 + i * 5);
    });

    yPos += clauseHeight + 6;
  }

  // ============================================
  // 7. SERVIZI AGGIUNTIVI
  // ============================================

  if (yPos < 255) {
    doc.setFillColor(227, 242, 253);
    const servicesBoxHeight = 20;
    doc.roundedRect(15, yPos, 180, servicesBoxHeight, 2, 2, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(21, 101, 192);
    doc.text('SERVIZI AGGIUNTIVI DISPONIBILI', 20, yPos + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(85, 85, 85);
    doc.text('\u2022 Assicurazione integrativa (oltre 100\u20AC di valore)', 22, yPos + 11);
    doc.text('\u2022 Consegna al piano / Fermo deposito / Consegna su appuntamento', 22, yPos + 16);

    yPos += servicesBoxHeight + 6;
  }

  // ============================================
  // 8. FOOTER
  // ============================================

  // Footer sempre in fondo pagina
  const footerY = 280;
  doc.setDrawColor(238, 238, 238);
  doc.setLineWidth(0.5);
  doc.line(15, footerY - 5, 195, footerY - 5);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('SPEDIRESICURO.IT \u2013 Powered by AI', 105, footerY, {
    align: 'center',
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DEFAULT_MUTED);
  doc.text('Tel: +39 081 827 6241 | Email: info@spedisci.online', 105, footerY + 5, {
    align: 'center',
  });
  doc.text('P.IVA: 06758621210 | www.spediresicuro.it', 105, footerY + 10, { align: 'center' });

  // Genera buffer
  return Buffer.from(doc.output('arraybuffer'));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parsa un colore CSS (#RRGGBB) in array RGB [r, g, b]
 */
function parseBrandingColor(color?: string | null): [number, number, number] | null {
  if (!color) return null;
  const hex = color.replace('#', '');
  if (hex.length !== 6) return null;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

/**
 * Scarica un logo da URL e lo converte in base64 per jsPDF.
 * Cache in-memory per 5 minuti.
 */
const logoCache = new Map<string, { data: string; timestamp: number }>();
const LOGO_CACHE_TTL = 5 * 60 * 1000; // 5 minuti

async function fetchLogoAsBase64(url: string): Promise<string | null> {
  // Check cache
  const cached = logoCache.get(url);
  if (cached && Date.now() - cached.timestamp < LOGO_CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${base64}`;

    // Salva in cache
    logoCache.set(url, { data: dataUrl, timestamp: Date.now() });

    return dataUrl;
  } catch {
    return null;
  }
}

/**
 * Genera titolo e descrizione per la sezione lavorazione merce nel PDF.
 */
function getProcessingDisplayInfo(processingFee: number | null): {
  title: string;
  description: string;
} {
  if (processingFee && processingFee > 0) {
    return {
      title: 'LAVORAZIONE MERCE',
      description: `Etichettatura e imballaggio a cura dei nostri operatori \u2014 ${processingFee.toFixed(2)}\u20AC + IVA per spedizione`,
    };
  }
  return {
    title: 'LAVORAZIONE MERCE',
    description:
      'Etichettatura e imballaggio a cura dei nostri operatori \u2014 Incluso nel servizio',
  };
}

/**
 * Genera titolo e descrizione per la sezione ritiro nel PDF.
 */
function getPickupDisplayInfo(
  deliveryMode: DeliveryMode,
  pickupFee: number | null
): { title: string; description: string } {
  const feeText =
    pickupFee && pickupFee > 0
      ? ` \u2014 Supplemento: ${pickupFee.toFixed(2)}\u20AC + IVA per ritiro`
      : ' \u2014 Incluso nel prezzo';

  switch (deliveryMode) {
    case 'carrier_pickup':
      return {
        title: 'RITIRO A CURA DEL CORRIERE',
        description: `Il corriere ritira la merce presso la sede del mittente${feeText}`,
      };
    case 'own_fleet':
      return {
        title: 'RITIRO CON NOSTRA FLOTTA',
        description: `Ritiriamo la merce con la nostra flotta e la affidiamo al vettore${feeText}`,
      };
    case 'client_dropoff':
      return {
        title: 'CONSEGNA AL NOSTRO PUNTO',
        description: 'Il cliente consegna la merce presso il nostro magazzino/punto di raccolta',
      };
    default:
      return {
        title: 'RITIRO',
        description: `Ritiro presso la sede del mittente${feeText}`,
      };
  }
}
