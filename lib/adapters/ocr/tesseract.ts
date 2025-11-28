/**
 * Tesseract OCR Adapter
 *
 * Implementazione con Tesseract.js (open-source, gratuito)
 * TODO: Implementazione completa quando necessario
 */

import { OCRAdapter, type OCRResult, type OCROptions } from './base';

export class TesseractAdapter extends OCRAdapter {
  constructor() {
    super('tesseract');
  }

  async extract(imageData: Buffer | string, options?: OCROptions): Promise<OCRResult> {
    try {
      // TODO: Implementare con tesseract.js
      // const Tesseract = require('tesseract.js');
      // const { data: { text } } = await Tesseract.recognize(imageData, options?.language || 'ita');

      // Per ora, fallback a mock
      console.warn('[Tesseract] Not implemented, falling back to mock');
      const { MockOCRAdapter } = require('./mock');
      const mock = new MockOCRAdapter();
      return await mock.extract(imageData, options);
    } catch (error: any) {
      return {
        success: false,
        confidence: 0,
        extractedData: {},
        error: error.message,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    // Check se tesseract.js è installato
    try {
      require.resolve('tesseract.js');
      return true;
    } catch {
      return false;
    }
  }
}
