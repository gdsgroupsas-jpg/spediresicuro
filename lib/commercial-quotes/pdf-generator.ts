/**
 * PDF Generator per Preventivi Commerciali — Premium Corporate
 *
 * Design: minimal, professionale, colori desaturati.
 * Footer: white-label con dati organizzazione reseller.
 *
 * Struttura:
 * 1. Header: logo/org name + titolo + barra colorata
 * 2. Prospect: box con bordo sinistro colorato
 * 3. Servizio: nome corriere
 * 4. Matrice: tabella peso x zona (tema plain)
 * 4b. Ritiro / 4c. Lavorazione / 4d. Alternative
 * 5. Peso volumetrico
 * 6. Condizioni (clausole)
 * 7. Servizi aggiuntivi
 * 8. Footer white-label (tutte le pagine)
 */

import type {
  CommercialQuote,
  DeliveryMode,
  AdditionalCarrierSnapshot,
} from '@/types/commercial-quotes';
import type { OrganizationBranding, OrganizationFooterInfo } from '@/types/workspace';

// Costanti colore
const DEFAULT_PRIMARY: [number, number, number] = [30, 58, 95]; // #1e3a5f
const DEFAULT_TEXT: [number, number, number] = [33, 33, 33];
const DEFAULT_MUTED: [number, number, number] = [120, 120, 120];
const PREMIUM_LIGHT_BG: [number, number, number] = [247, 248, 250]; // grigio ghiaccio
const PREMIUM_BORDER: [number, number, number] = [228, 230, 235];

// Margini e layout
const ML = 15; // margine sinistro
const MR = 195; // margine destro (posizione x, NON larghezza margine)
const CONTENT_W = MR - ML; // larghezza contenuto
const PAGE_WIDTH = 210; // larghezza A4
const MARGIN_RIGHT = PAGE_WIDTH - MR; // 15mm margine destro per autoTable
const FOOTER_ZONE_START = 268; // sotto questa y -> footer
const PAGE_BOTTOM = 297; // altezza A4

/** Servizio accessorio abilitato dal wizard */
export interface EnabledService {
  service: string;
  price: number;
  percent: number;
}

/**
 * Genera il PDF del preventivo commerciale — Premium Corporate.
 * @param quote - Dati preventivo
 * @param branding - Colori/logo organizzazione (opzionale)
 * @param orgInfo - Dati organizzazione per footer white-label (opzionale)
 * @param enabledServices - Servizi accessori abilitati dal wizard (opzionale)
 */
export async function generateCommercialQuotePDF(
  quote: CommercialQuote,
  branding?: OrganizationBranding | null,
  orgInfo?: OrganizationFooterInfo | null,
  enabledServices?: EnabledService[] | null,
  volumetricDivisor?: number
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

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const primaryColor = parseBrandingColor(branding?.primary_color) || [...DEFAULT_PRIMARY];
  const primaryDark = darkenColor(primaryColor, 0.25);
  const matrix = quote.price_matrix;

  // Pre-carica logo SpedireSicuro (usato in header fallback + footer)
  const spedireSicuroLogo = await getSpedireSicuroLogo();

  let yPos = 15;

  // ============================================
  // 1. HEADER — Premium Corporate
  // ============================================

  // Logo o nome organizzazione (sinistra)
  if (branding?.logo_url) {
    try {
      const logoBase64 = await fetchLogoAsBase64(branding.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', ML, yPos, 50, 16);
      } else if (spedireSicuroLogo) {
        doc.addImage(spedireSicuroLogo, 'PNG', ML, yPos, 50, 16);
      } else {
        drawOrgNameHeader(doc, orgInfo, primaryColor, yPos);
      }
    } catch {
      if (spedireSicuroLogo) {
        doc.addImage(spedireSicuroLogo, 'PNG', ML, yPos, 50, 16);
      } else {
        drawOrgNameHeader(doc, orgInfo, primaryColor, yPos);
      }
    }
  } else if (spedireSicuroLogo) {
    // Nessun logo reseller → mostra logo SpedireSicuro
    doc.addImage(spedireSicuroLogo, 'PNG', ML, yPos, 50, 16);
  } else {
    drawOrgNameHeader(doc, orgInfo, primaryColor, yPos);
  }

  // Titolo "PREVENTIVO COMMERCIALE" (destra)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('PREVENTIVO COMMERCIALE', MR, yPos + 5, { align: 'right' });

  // Data / Validita' / Rev (destra, sotto titolo)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DEFAULT_MUTED);

  const dataEmissione = new Date(quote.created_at).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(`Data: ${dataEmissione}`, MR, yPos + 11, { align: 'right' });
  doc.text(`Validit\u00E0: ${quote.validity_days} giorni`, MR, yPos + 15.5, { align: 'right' });

  if (quote.revision > 1) {
    doc.text(`Rev. ${quote.revision}`, MR, yPos + 20, { align: 'right' });
  }

  // Barra colorata sottile sotto header
  yPos += 24;
  doc.setFillColor(...primaryColor);
  doc.rect(ML, yPos, CONTENT_W, 1.5, 'F');
  yPos += 6;

  // ============================================
  // 2. PROSPECT — Bordo sinistro colorato
  // ============================================

  const prospectBoxH = 24;
  // Sfondo bianco con bordo sinistro colorato
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...PREMIUM_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, yPos, CONTENT_W, prospectBoxH, 1.5, 1.5, 'FD');
  // Bordo sinistro accent
  doc.setFillColor(...primaryColor);
  doc.rect(ML, yPos, 2, prospectBoxH, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DEFAULT_MUTED);
  doc.text('DESTINATARIO', ML + 7, yPos + 5);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DEFAULT_TEXT);
  doc.text(quote.prospect_company, ML + 7, yPos + 11);

  // Contatti sotto il nome
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...DEFAULT_MUTED);
  const contactParts: string[] = [];
  if (quote.prospect_contact_name) contactParts.push(quote.prospect_contact_name);
  if (quote.prospect_email) contactParts.push(quote.prospect_email);
  if (quote.prospect_phone) contactParts.push(quote.prospect_phone);
  if (contactParts.length > 0) {
    doc.text(contactParts.join('  \u00B7  '), ML + 7, yPos + 16);
  }

  // Settore (se disponibile)
  if (quote.prospect_sector) {
    doc.setFontSize(8);
    doc.text(`Settore: ${quote.prospect_sector}`, ML + 7, yPos + 20.5);
  }

  yPos += prospectBoxH + 6;

  // ============================================
  // 3. SERVIZIO — Corriere principale
  // ============================================

  doc.setFillColor(...primaryColor);
  doc.roundedRect(ML, yPos, CONTENT_W, 10, 1.5, 1.5, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`SERVIZIO: ${matrix.carrier_display_name}`, 105, yPos + 7, { align: 'center' });
  yPos += 14;

  // ============================================
  // 4. MATRICE PREZZI — Tema plain, minimal
  // ============================================

  const tableHead = ['PESO', ...matrix.zones];
  const tableBody = matrix.weight_ranges.map((range, rowIdx) => {
    const row = [range.label];
    matrix.zones.forEach((_, colIdx) => {
      const price = matrix.prices[rowIdx]?.[colIdx];
      row.push(price ? `\u20AC ${price.toFixed(2)}` : '-');
    });
    return row;
  });

  // Font e dimensioni adattivi in base al numero di colonne
  const totalCols = tableHead.length;
  const { headFont, bodyFont, headPad, bodyPad, pesoWidth } = getAdaptiveTableSizes(totalCols);

  autoTable(doc, {
    startY: yPos,
    head: [tableHead],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: primaryColor,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: headFont,
      halign: 'center',
      cellPadding: headPad,
    },
    bodyStyles: {
      fontSize: bodyFont,
      halign: 'center',
      cellPadding: bodyPad,
      textColor: DEFAULT_TEXT,
    },
    columnStyles: {
      0: {
        fillColor: PREMIUM_LIGHT_BG,
        fontStyle: 'bold',
        halign: 'left',
        cellWidth: pesoWidth,
        textColor: DEFAULT_TEXT,
      },
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    margin: { left: ML, right: MARGIN_RIGHT },
    styles: {
      lineColor: PREMIUM_BORDER,
      lineWidth: 0.2,
      overflow: 'ellipsize',
    },
    tableLineColor: PREMIUM_BORDER,
    tableLineWidth: 0.2,
  });

  yPos = (doc as any).lastAutoTable.finalY + 6;

  // ============================================
  // 4b. MODALITA' RITIRO — Corporate desaturato
  // ============================================

  const deliveryMode = matrix.delivery_mode || quote.delivery_mode || 'carrier_pickup';
  const pickupFee = matrix.pickup_fee ?? quote.pickup_fee ?? null;
  const pickupInfo = getPickupDisplayInfo(deliveryMode, pickupFee);

  yPos = ensureSpace(doc, yPos, 14);

  // Sfondo desaturato emerald
  doc.setFillColor(243, 250, 247);
  doc.setDrawColor(134, 195, 172);
  doc.setLineWidth(0.3);
  const pickupBoxH = 12;
  doc.roundedRect(ML, yPos, CONTENT_W, pickupBoxH, 1.5, 1.5, 'FD');
  // Bordo sinistro
  doc.setFillColor(72, 165, 131);
  doc.rect(ML, yPos, 2, pickupBoxH, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(46, 125, 95);
  doc.text(pickupInfo.title, ML + 7, yPos + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(pickupInfo.description, ML + 7, yPos + 10);

  yPos += pickupBoxH + 5;

  // ============================================
  // 4c. LAVORAZIONE MERCE — Corporate ambra desaturato
  // ============================================

  const goodsNeedsProcessing =
    matrix.goods_needs_processing || quote.goods_needs_processing || false;

  if (goodsNeedsProcessing) {
    const procFee = matrix.processing_fee ?? quote.processing_fee ?? null;
    const procInfo = getProcessingDisplayInfo(procFee);

    yPos = ensureSpace(doc, yPos, 14);

    doc.setFillColor(253, 249, 237);
    doc.setDrawColor(210, 180, 100);
    doc.setLineWidth(0.3);
    const procBoxH = 12;
    doc.roundedRect(ML, yPos, CONTENT_W, procBoxH, 1.5, 1.5, 'FD');
    doc.setFillColor(190, 155, 50);
    doc.rect(ML, yPos, 2, procBoxH, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(140, 100, 20);
    doc.text(procInfo.title, ML + 7, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(procInfo.description, ML + 7, yPos + 10);

    yPos += procBoxH + 5;
  }

  // ============================================
  // 4d. MATRICI ALTERNATIVE (multi-corriere)
  // ============================================

  const additionalCarriers = quote.additional_carriers as AdditionalCarrierSnapshot[] | null;
  if (additionalCarriers && additionalCarriers.length > 0) {
    for (let acIdx = 0; acIdx < additionalCarriers.length; acIdx++) {
      const ac = additionalCarriers[acIdx];
      const acMatrix = ac.price_matrix;

      yPos = ensureSpace(doc, yPos, 30);

      // Titolo alternativa — colore scuro derivato dal primaryColor
      doc.setFillColor(...primaryDark);
      doc.roundedRect(ML, yPos, CONTENT_W, 10, 1.5, 1.5, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(
        `OPZIONE ${String.fromCharCode(66 + acIdx)}: ${acMatrix.carrier_display_name}`,
        105,
        yPos + 7,
        { align: 'center' }
      );
      yPos += 13;

      // Tabella prezzi alternativa
      const acTableHead = ['PESO', ...acMatrix.zones];
      const acTableBody = acMatrix.weight_ranges.map((range, rowIdx) => {
        const row = [range.label];
        acMatrix.zones.forEach((_, colIdx) => {
          const price = acMatrix.prices[rowIdx]?.[colIdx];
          row.push(price ? `\u20AC ${price.toFixed(2)}` : '-');
        });
        return row;
      });

      const acTotalCols = acTableHead.length;
      const acSizes = getAdaptiveTableSizes(acTotalCols);
      // Alternative usano font leggermente piu' piccolo
      const acHeadFont = Math.max(acSizes.headFont - 1, 6);
      const acBodyFont = Math.max(acSizes.bodyFont - 1, 6);

      autoTable(doc, {
        startY: yPos,
        head: [acTableHead],
        body: acTableBody,
        theme: 'plain',
        headStyles: {
          fillColor: primaryDark,
          textColor: 255,
          fontStyle: 'bold',
          fontSize: acHeadFont,
          halign: 'center',
          cellPadding: acSizes.headPad,
        },
        bodyStyles: {
          fontSize: acBodyFont,
          halign: 'center',
          cellPadding: acSizes.bodyPad,
          textColor: DEFAULT_TEXT,
        },
        columnStyles: {
          0: {
            fillColor: PREMIUM_LIGHT_BG,
            fontStyle: 'bold',
            halign: 'left',
            cellWidth: acSizes.pesoWidth,
            textColor: DEFAULT_TEXT,
          },
        },
        alternateRowStyles: { fillColor: [252, 252, 253] },
        margin: { left: ML, right: MARGIN_RIGHT },
        styles: { lineColor: PREMIUM_BORDER, lineWidth: 0.2, overflow: 'ellipsize' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // ============================================
  // 5. PESO VOLUMETRICO — Box grigio ghiaccio
  // ============================================

  yPos = ensureSpace(doc, yPos, 20);

  doc.setFillColor(...PREMIUM_LIGHT_BG);
  doc.setDrawColor(...PREMIUM_BORDER);
  doc.setLineWidth(0.3);
  const volBoxH = 18;
  doc.roundedRect(ML, yPos, CONTENT_W, volBoxH, 1.5, 1.5, 'FD');
  doc.setFillColor(...primaryColor);
  doc.rect(ML, yPos, 2, volBoxH, 'F');

  const volDiv = volumetricDivisor || 5000;
  const exampleResult = Math.round(60000 / volDiv);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('PESO VOLUMETRICO', ML + 7, yPos + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Formula: (Lunghezza \u00D7 Larghezza \u00D7 Altezza in cm) / ${volDiv}`,
    ML + 7,
    yPos + 11
  );
  doc.text(
    `Esempio: Un pacco 50\u00D740\u00D730 cm = 60.000 cm\u00B3 / ${volDiv} = ${exampleResult} kg volumetrici`,
    ML + 7,
    yPos + 15.5
  );

  yPos += volBoxH + 5;

  // ============================================
  // 6. CONDIZIONI (clausole)
  // ============================================

  const clauses = quote.clauses || [];
  if (clauses.length > 0) {
    const clauseH = 8 + clauses.length * 4.5;
    yPos = ensureSpace(doc, yPos, clauseH + 2);

    doc.setFillColor(...PREMIUM_LIGHT_BG);
    doc.setDrawColor(...PREMIUM_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, yPos, CONTENT_W, clauseH, 1.5, 1.5, 'FD');
    doc.setFillColor(...primaryColor);
    doc.rect(ML, yPos, 2, clauseH, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('CONDIZIONI', ML + 7, yPos + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    clauses.forEach((clause, i) => {
      doc.text(`\u2022  ${clause.text}`, ML + 8, yPos + 10 + i * 4.5);
    });

    yPos += clauseH + 5;
  }

  // ============================================
  // 7. SERVIZI AGGIUNTIVI (dinamici o fallback)
  // ============================================

  const hasEnabledServices = enabledServices && enabledServices.length > 0;
  const serviceLines: string[] = hasEnabledServices
    ? enabledServices.map((s) => {
        const parts: string[] = [];
        if (s.price > 0) parts.push(`\u20AC${s.price.toFixed(2)}`);
        if (s.percent > 0) parts.push(`${s.percent}%`);
        const costStr = parts.length > 0 ? ` (${parts.join(' + ')})` : '';
        return `\u2022  ${s.service}${costStr}`;
      })
    : [
        '\u2022  Assicurazione integrativa (oltre 100\u20AC di valore)',
        '\u2022  Consegna al piano / Fermo deposito / Consegna su appuntamento',
      ];

  const servLineH = 4.5;
  const servH = 8 + serviceLines.length * servLineH;
  yPos = ensureSpace(doc, yPos, servH + 2);

  doc.setFillColor(...PREMIUM_LIGHT_BG);
  doc.setDrawColor(...PREMIUM_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, yPos, CONTENT_W, servH, 1.5, 1.5, 'FD');
  doc.setFillColor(...primaryColor);
  doc.rect(ML, yPos, 2, servH, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('SERVIZI AGGIUNTIVI DISPONIBILI', ML + 7, yPos + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  serviceLines.forEach((line, i) => {
    doc.text(line, ML + 8, yPos + 10 + i * servLineH);
  });

  // ============================================
  // 8. FOOTER WHITE-LABEL (tutte le pagine)
  // ============================================

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, primaryColor, orgInfo || null, p, totalPages, spedireSicuroLogo);
  }

  return Buffer.from(doc.output('arraybuffer'));
}

// ============================================
// FOOTER
// ============================================

function drawFooter(
  doc: InstanceType<typeof import('jspdf').jsPDF>,
  primaryColor: number[],
  orgInfo: OrganizationFooterInfo | null,
  currentPage: number,
  totalPages: number,
  spedireSicuroLogo: string | null
): void {
  const footerY = 278;

  // Linea separatore
  doc.setDrawColor(...PREMIUM_BORDER);
  doc.setLineWidth(0.3);
  doc.line(ML, footerY - 4, MR, footerY - 4);

  if (orgInfo) {
    // --- Footer white-label reseller ---
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(primaryColor as [number, number, number]));
    doc.text(orgInfo.name.toUpperCase(), 105, footerY, { align: 'center' });

    // Riga dettagli
    const details: string[] = [];
    if (orgInfo.vat_number) details.push(`P.IVA: ${orgInfo.vat_number}`);
    if (orgInfo.billing_email) details.push(orgInfo.billing_email);
    if (orgInfo.billing_address) {
      const addr = orgInfo.billing_address;
      const parts = [addr.via, addr.cap, addr.citta, addr.provincia].filter(Boolean);
      if (parts.length > 0) details.push(parts.join(' '));
    }

    if (details.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...DEFAULT_MUTED);
      doc.text(details.join('  \u00B7  '), 105, footerY + 4, { align: 'center' });
    }

    // "Powered by SpedireSicuro.it" con mini-logo
    if (spedireSicuroLogo) {
      // Mini-logo (12x4mm) + testo
      const logoW = 12;
      const logoH = 4;
      const poweredText = 'Powered by SpedireSicuro.it';
      doc.setFontSize(6.5);
      doc.setTextColor(180, 180, 180);
      const textW = doc.getTextWidth(poweredText);
      const totalW = logoW + 1.5 + textW; // logo + gap + testo
      const startX = 105 - totalW / 2;
      doc.addImage(spedireSicuroLogo, 'PNG', startX, footerY + 5.5, logoW, logoH);
      doc.text(poweredText, startX + logoW + 1.5, footerY + 8.5);
    } else {
      doc.setFontSize(6.5);
      doc.setTextColor(180, 180, 180);
      doc.text('Powered by SpedireSicuro.it', 105, footerY + 8, { align: 'center' });
    }
  } else {
    // --- Footer default SpedireSicuro ---
    // Logo o testo "SPEDIRESICURO.IT"
    if (spedireSicuroLogo) {
      // Logo centrato (30x10mm)
      doc.addImage(spedireSicuroLogo, 'PNG', 105 - 15, footerY - 3, 30, 10);
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(primaryColor as [number, number, number]));
      doc.text('SPEDIRESICURO.IT', 105, footerY, { align: 'center' });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...DEFAULT_MUTED);
    doc.text(
      'Tel: +39 081 827 6241  \u00B7  info@spedisci.online  \u00B7  P.IVA: 06758621210',
      105,
      spedireSicuroLogo ? footerY + 8 : footerY + 4,
      { align: 'center' }
    );
  }

  // Numerazione pagine
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 180, 180);
  doc.text(`${currentPage} / ${totalPages}`, MR, footerY + 8, { align: 'right' });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calcola font, padding e larghezza colonna PESO in base al numero totale di colonne.
 * Piu' colonne -> font piu' piccolo, padding ridotto, colonna PESO stretta.
 */
function getAdaptiveTableSizes(totalCols: number): {
  headFont: number;
  bodyFont: number;
  headPad: number;
  bodyPad: number;
  pesoWidth: number;
} {
  if (totalCols <= 5) {
    // Fino a 4 zone: tabella comoda
    return { headFont: 9, bodyFont: 9, headPad: 4, bodyPad: 3.5, pesoWidth: 30 };
  }
  if (totalCols <= 7) {
    // 5-6 zone: leggermente compatto
    return { headFont: 8, bodyFont: 8, headPad: 3, bodyPad: 2.5, pesoWidth: 26 };
  }
  // 7+ zone: compatto
  return { headFont: 7, bodyFont: 7, headPad: 2.5, bodyPad: 2, pesoWidth: 22 };
}

/** Nome organizzazione nell'header se logo non disponibile */
function drawOrgNameHeader(
  doc: InstanceType<typeof import('jspdf').jsPDF>,
  orgInfo: OrganizationFooterInfo | null | undefined,
  primaryColor: number[],
  yPos: number
): void {
  const headerName = orgInfo?.name || 'SpedireSicuro.it';
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(primaryColor as [number, number, number]));
  doc.text(headerName, ML, yPos + 10);
}

/** Verifica spazio e aggiunge pagina se necessario */
function ensureSpace(
  doc: InstanceType<typeof import('jspdf').jsPDF>,
  yPos: number,
  needed: number
): number {
  if (yPos + needed > FOOTER_ZONE_START) {
    doc.addPage();
    return 15;
  }
  return yPos;
}

/** Parsa colore CSS (#RRGGBB) in array RGB */
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

/** Schiarisce un colore RGB mescolandolo con bianco */
function lightenColor(rgb: number[], amount: number): [number, number, number] {
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * amount),
    Math.round(rgb[1] + (255 - rgb[1]) * amount),
    Math.round(rgb[2] + (255 - rgb[2]) * amount),
  ];
}

/** Scurisce un colore RGB */
function darkenColor(rgb: number[], amount: number): [number, number, number] {
  return [
    Math.round(rgb[0] * (1 - amount)),
    Math.round(rgb[1] * (1 - amount)),
    Math.round(rgb[2] * (1 - amount)),
  ];
}

/** Carica il logo SpedireSicuro locale da public/brand/logo/. Cache permanente. */
let spedireSicuroLogoCache: string | null | undefined;

async function getSpedireSicuroLogo(): Promise<string | null> {
  if (spedireSicuroLogoCache !== undefined) return spedireSicuroLogoCache;

  try {
    const { readFileSync } = await import('fs');
    const { join } = await import('path');
    const logoPath = join(process.cwd(), 'public', 'brand', 'logo', 'logo-horizontal.png');
    const buffer = readFileSync(logoPath);
    const base64 = buffer.toString('base64');
    spedireSicuroLogoCache = `data:image/png;base64,${base64}`;
    return spedireSicuroLogoCache;
  } catch {
    spedireSicuroLogoCache = null;
    return null;
  }
}

/** Scarica logo da URL e converte in base64 per jsPDF. Cache 5 min. */
const logoCache = new Map<string, { data: string; timestamp: number }>();
const LOGO_CACHE_TTL = 5 * 60 * 1000;

async function fetchLogoAsBase64(url: string): Promise<string | null> {
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

    logoCache.set(url, { data: dataUrl, timestamp: Date.now() });
    return dataUrl;
  } catch {
    return null;
  }
}

/** Info sezione lavorazione merce */
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

/** Info sezione ritiro */
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
