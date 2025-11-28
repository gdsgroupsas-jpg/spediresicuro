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
    // Per ora, fallback a mock (tesseract.js non installato)
    console.warn('[Tesseract] Not installed, falling back to mock');
    const { MockOCRAdapter } = require('./mock');
    const mock = new MockOCRAdapter();
    return await mock.extract(imageData, options);
  }

  async isAvailable(): Promise<boolean> {
    // tesseract.js non installato di default
    return false;
  }
}
