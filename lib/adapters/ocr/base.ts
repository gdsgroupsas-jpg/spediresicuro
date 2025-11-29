/**
 * OCR Adapter Base Interface
 *
 * Interfaccia comune per estrazione dati da immagini
 */

export interface OCRResult {
  success: boolean;
  confidence: number; // 0-1
  extractedData: {
    recipient_name?: string;
    recipient_address?: string;
    recipient_city?: string;
    recipient_zip?: string;
    recipient_province?: string;
    recipient_phone?: string;
    recipient_email?: string;
    notes?: string;
  };
  rawText?: string;
  error?: string;
}

export interface OCROptions {
  language?: string; // 'ita', 'eng', 'auto'
  enhance?: boolean; // Pre-processing immagine
  timeout?: number;  // Timeout in ms
}

/**
 * Base OCR Adapter
 */
export abstract class OCRAdapter {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Estrai dati da immagine
   *
   * @param imageData - Buffer o base64 dell'immagine
   * @param options - Opzioni OCR
   */
  abstract extract(imageData: Buffer | string, options?: OCROptions): Promise<OCRResult>;

  /**
   * Test disponibilità servizio
   */
  abstract isAvailable(): Promise<boolean>;

  /**
   * Helper: Normalizza telefono italiano
   */
  protected normalizePhone(phone: string): string {
    if (!phone) return '';

    // Rimuovi spazi, trattini, parentesi
    let normalized = phone.replace(/[\s\-()]/g, '');

    // Rimuovi prefisso internazionale +39 o 0039
    normalized = normalized.replace(/^(\+39|0039)/, '');

    // Rimuovi leading zero se numero mobile
    if (normalized.startsWith('3') && normalized.length === 10) {
      return normalized;
    }

    // Per fissi, mantieni leading zero
    if (normalized.length === 9 || normalized.length === 10) {
      return normalized;
    }

    return phone; // Ritorna originale se non riconosciuto
  }

  /**
   * Helper: Valida CAP italiano
   */
  protected validateZip(zip: string): string | undefined {
    if (!zip) return undefined;

    const cleaned = zip.replace(/\s/g, '');

    // CAP italiano: 5 cifre
    if (/^\d{5}$/.test(cleaned)) {
      return cleaned;
    }

    return undefined;
  }

  /**
   * Helper: Estrai CAP da testo
   */
  protected extractZip(text: string): string | undefined {
    const zipMatch = text.match(/\b\d{5}\b/);
    return zipMatch ? zipMatch[0] : undefined;
  }

  /**
   * Helper: Estrai email da testo
   */
  protected extractEmail(text: string): string | undefined {
    const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    return emailMatch ? emailMatch[0] : undefined;
  }

  /**
   * Helper: Estrai telefono da testo
   */
  protected extractPhone(text: string): string | undefined {
    // Pattern per telefoni italiani
    const patterns = [
      /(\+39|0039)?\s*3\d{2}[\s\-]?\d{6,7}/, // Mobile
      /(\+39|0039)?\s*0\d{1,3}[\s\-]?\d{6,8}/, // Fisso
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.normalizePhone(match[0]);
      }
    }

    return undefined;
  }
}

/**
 * Factory per creare OCR adapter
 */
export function createOCRAdapter(type: 'mock' | 'tesseract' | 'auto' = 'auto'): OCRAdapter {
  switch (type) {
    case 'tesseract': {
      const { TesseractAdapter } = require('./tesseract');
      return new TesseractAdapter();
    }

    case 'mock': {
      const { ImprovedMockOCRAdapter } = require('./mock');
      return new ImprovedMockOCRAdapter();
    }

    case 'auto':
    default: {
      // Prova Tesseract, fallback a mock migliorato
      try {
        const { TesseractAdapter } = require('./tesseract');
        const tesseract = new TesseractAdapter();
        // Verifica disponibilità in modo sincrono (per ora usa sempre mock migliorato se auto)
        // L'API route gestirà il check asincrono
        const { ImprovedMockOCRAdapter } = require('./mock');
        return new ImprovedMockOCRAdapter();
      } catch {
        const { ImprovedMockOCRAdapter } = require('./mock');
        return new ImprovedMockOCRAdapter();
      }
    }
  }
}
