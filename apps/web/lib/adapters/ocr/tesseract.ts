/**
 * Tesseract OCR Adapter
 *
 * Implementazione con Tesseract.js (open-source, gratuito)
 * OCR reale per estrazione dati da immagini
 */

import { OCRAdapter, type OCRResult, type OCROptions } from './base';

export class TesseractAdapter extends OCRAdapter {
  private tesseractWorker: any = null;
  constructor() {
    super('tesseract');
  }

  async extract(imageData: Buffer | string, options?: OCROptions): Promise<OCRResult> {
    try {
      // Tesseract.js funziona solo lato client (browser), non in server-side
      // In Next.js API routes, usiamo fallback a mock
      if (typeof window === 'undefined') {
        // Siamo in server-side (API route)
        console.warn('[Tesseract] Server-side non supportato, uso mock migliorato');
        const { ImprovedMockOCRAdapter } = await import('./mock');
        const mock = new ImprovedMockOCRAdapter();
        return await mock.extract(imageData, options);
      }

      // Import dinamico di Tesseract.js (solo lato client)
      const { createWorker } = await import('tesseract.js');

      // Crea worker se non esiste
      if (!this.tesseractWorker) {
        this.tesseractWorker = await createWorker('ita+eng'); // Italiano + Inglese
      }

      // Converti imageData in formato corretto
      let imageBuffer: Buffer;
      if (typeof imageData === 'string') {
        // Se è base64, converti in buffer
        imageBuffer = Buffer.from(imageData, 'base64');
      } else {
        imageBuffer = imageData;
      }

      // Esegui OCR
      const {
        data: { text, confidence },
      } = await this.tesseractWorker.recognize(imageBuffer);

      // Estrai dati dal testo usando pattern matching
      const extractedData = this.extractDataFromText(text);

      return {
        success: true,
        confidence: confidence / 100, // Tesseract restituisce 0-100, convertiamo in 0-1
        extractedData,
        rawText: text,
      };
    } catch (error: any) {
      console.error('[Tesseract OCR] Errore:', error);

      // Fallback a mock se Tesseract non disponibile
      if (error.message?.includes('Cannot find module') || error.message?.includes('tesseract')) {
        console.warn('[Tesseract] Non installato, uso mock migliorato');
        const { ImprovedMockOCRAdapter } = await import('./mock');
        const mock = new ImprovedMockOCRAdapter();
        return await mock.extract(imageData, options);
      }

      return {
        success: false,
        confidence: 0,
        extractedData: {},
        error: error.message || 'Errore durante estrazione OCR',
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    // Tesseract.js funziona solo lato client (browser)
    // In server-side (API routes), restituisce false
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      // Prova a importare Tesseract (solo lato client)
      await import('tesseract.js');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Estrae dati strutturati dal testo OCR usando pattern matching
   */
  private extractDataFromText(text: string): any {
    const extracted: any = {};

    // Normalizza testo: rimuovi spazi multipli, newline, etc.
    const normalized = text.replace(/\s+/g, ' ').trim();

    // Pattern per nome (parole maiuscole all'inizio, spesso dopo "destinatario", "spedire a", etc.)
    const namePatterns = [
      /(?:destinatario|spedire a|consegna a|nome)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/,
    ];
    for (const pattern of namePatterns) {
      const match = normalized.match(pattern);
      if (match && match[1]) {
        extracted.recipient_name = match[1].trim();
        break;
      }
    }

    // Pattern per indirizzo (via, corso, piazza, viale + numero)
    const addressPattern =
      /(via|corso|piazza|viale|vicolo|piazzale|lungomare)[\s]+([a-z0-9\s,]+?)(?:\s+(\d+))?/i;
    const addressMatch = normalized.match(addressPattern);
    if (addressMatch) {
      const street = addressMatch[1] + ' ' + addressMatch[2].trim();
      const number = addressMatch[3] || '';
      extracted.recipient_address = `${street}${number ? ', ' + number : ''}`.trim();
    }

    // Pattern per CAP (5 cifre)
    const zipPattern = /\b(\d{5})\b/;
    const zipMatch = normalized.match(zipPattern);
    if (zipMatch) {
      extracted.recipient_zip = zipMatch[1];
    }

    // Pattern per città (dopo CAP, spesso maiuscola)
    if (zipMatch) {
      const afterZip = normalized.substring(normalized.indexOf(zipMatch[1]) + 5);
      const cityMatch = afterZip.match(/\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
      if (cityMatch) {
        extracted.recipient_city = cityMatch[1].trim();
      }
    }

    // Pattern per provincia (2-3 lettere maiuscole, spesso tra parentesi)
    const provincePattern = /\(([A-Z]{2,3})\)/;
    const provinceMatch = normalized.match(provincePattern);
    if (provinceMatch) {
      extracted.recipient_province = provinceMatch[1];
    }

    // Pattern per telefono (numeri con prefisso +39, 0039, o 3xx)
    const phonePatterns = [
      /(?:\+39|0039)?[\s]?3\d{2}[\s]?\d{6,7}/,
      /tel[elefono]*[\s:]*([\d\s\+\-\(\)]+)/i,
      /\b(3\d{2}[\s]?\d{6,7})\b/,
    ];
    for (const pattern of phonePatterns) {
      const match = normalized.match(pattern);
      if (match) {
        const phone = match[1] || match[0];
        extracted.recipient_phone = this.normalizePhone(phone);
        break;
      }
    }

    // Pattern per email
    const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/;
    const emailMatch = normalized.match(emailPattern);
    if (emailMatch) {
      extracted.recipient_email = emailMatch[1].toLowerCase();
    }

    // Pattern per note (dopo "note", "osservazioni", etc.)
    const notesPattern = /(?:note|osservazioni|info)[\s:]+(.+?)(?:\n|$)/i;
    const notesMatch = normalized.match(notesPattern);
    if (notesMatch) {
      extracted.notes = notesMatch[1].trim();
    }

    return extracted;
  }

  /**
   * Cleanup worker quando non serve più
   */
  async terminate(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
  }
}
