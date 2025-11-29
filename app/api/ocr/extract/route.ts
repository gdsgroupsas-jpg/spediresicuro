/**
 * API Route: OCR Extract
 *
 * Endpoint per estrazione dati da immagini tramite OCR
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOCRAdapter } from '@/lib/adapters/ocr';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, options } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Immagine mancante' },
        { status: 400 }
      );
    }

    // Crea adapter OCR
    // NOTA: Tesseract.js funziona solo lato client (browser), non in API routes
    // Quindi usiamo sempre il mock migliorato nelle API routes
    // Per OCR reale, dovrebbe essere implementato lato client (browser)
    const ocrType = 'mock'; // Forza mock in server-side
    const ocr = createOCRAdapter(ocrType as any);

    // Check disponibilità
    const available = await ocr.isAvailable();
    if (!available) {
      return NextResponse.json(
        {
          success: false,
          error: 'Servizio OCR non disponibile. Contattare l\'amministratore.',
        },
        { status: 503 }
      );
    }

    // Converti base64 a Buffer
    const imageBuffer = Buffer.from(image, 'base64');

    // Estrai dati
    const result = await ocr.extract(imageBuffer, options);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Errore durante l\'estrazione OCR',
        },
        { status: 500 }
      );
    }

    // Normalizza e valida dati estratti
    const normalizedData = normalizeExtractedData(result.extractedData);

    return NextResponse.json({
      success: true,
      confidence: result.confidence,
      extractedData: normalizedData,
      rawText: result.rawText,
    });
  } catch (error: any) {
    console.error('OCR Extract Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Errore interno del server',
      },
      { status: 500 }
    );
  }
}

/**
 * Normalizza e valida dati estratti
 */
function normalizeExtractedData(data: any) {
  return {
    recipient_name: data.recipient_name?.trim() || '',
    recipient_address: data.recipient_address?.trim() || '',
    recipient_city: data.recipient_city?.trim() || '',
    recipient_zip: data.recipient_zip?.replace(/\s/g, '') || '',
    recipient_province: data.recipient_province?.toUpperCase()?.trim() || '',
    recipient_phone: normalizePhone(data.recipient_phone || ''),
    recipient_email: data.recipient_email?.trim() || '',
    notes: data.notes?.trim() || '',
  };
}

/**
 * Normalizza numero telefono italiano
 */
function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Rimuovi spazi, trattini, parentesi
  let normalized = phone.replace(/[\s\-()]/g, '');

  // Rimuovi prefisso +39 o 0039
  normalized = normalized.replace(/^(\+39|0039)/, '');

  return normalized;
}
