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
export function createOCRAdapter(type: 'mock' | 'tesseract' | 'claude' | 'google-vision' | 'auto' = 'auto'): OCRAdapter {
  switch (type) {
    case 'google-vision': {
      const { GoogleVisionOCRAdapter } = require('./google-vision');
      return new GoogleVisionOCRAdapter();
    }

    case 'claude': {
      const { ClaudeOCRAdapter } = require('./claude');
      return new ClaudeOCRAdapter();
    }

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
      // Priorità: Claude Vision (screen) > Google Vision > Tesseract > Mock

      console.log('🔎 Selezionando OCR adapter automaticamente...');
      console.log(`   ANTHROPIC_API_KEY presente: ${!!process.env.ANTHROPIC_API_KEY}`);
      console.log(`   GOOGLE_CLOUD_CREDENTIALS presente: ${!!process.env.GOOGLE_CLOUD_CREDENTIALS}`);

      // 1. Prova Claude Vision (priorità per screen OCR)
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          console.log('✅ OCR Claude Vision (screen) ATTIVO - consumerà crediti Anthropic');
          const { ClaudeOCRAdapter } = require('./claude');
          return new ClaudeOCRAdapter();
        } catch (error) {
          console.warn('❌ Claude Vision non disponibile:', error);
        }
      }

      // 2. Prova Google Cloud Vision (fallback)
      if (process.env.GOOGLE_CLOUD_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          console.log('✅ OCR Google Cloud Vision ATTIVO - OCR reale professionale');
          const { GoogleVisionOCRAdapter } = require('./google-vision');
          return new GoogleVisionOCRAdapter();
        } catch (error) {
          console.warn('❌ Google Vision non disponibile:', error);
        }
      }

      // 2. Prova Tesseract (se disponibile)
      try {
        const { TesseractAdapter } = require('./tesseract');
        return new TesseractAdapter();
      } catch (error) {
        console.warn('Tesseract non disponibile, fallback a Mock:', error);
      }

      // 3. Fallback a Mock migliorato
      console.warn('⚠️ ANTHROPIC_API_KEY non configurata - usando Mock OCR');
      const { ImprovedMockOCRAdapter } = require('./mock');
      return new ImprovedMockOCRAdapter();
    }
  }
}
