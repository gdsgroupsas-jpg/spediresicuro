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
    // Usa 'auto' per selezionare automaticamente il migliore disponibile:
    // 1. Google Vision (se GOOGLE_CLOUD_CREDENTIALS configurata) ✅ ATTIVO
    // 2. Claude Vision (se ANTHROPIC_API_KEY configurata)
    // 3. Tesseract (se disponibile)
    // 4. Mock (fallback)
    const ocr = createOCRAdapter('auto');
    
    console.log(`🔍 OCR Adapter utilizzato: ${(ocr as any).name || 'unknown'}`);

    // Check disponibilità
    const available = await ocr.isAvailable();
    console.log(`📊 OCR disponibile: ${available}`);
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

    // Estrai dati con fallback: Google Vision → Claude Vision
    let result = await ocr.extract(imageBuffer, options);
    let usedAdapter = (ocr as any).name;

    // Fallback: se Google Vision fallisce, prova Claude
    if (!result.success && usedAdapter === 'google-vision') {
      console.warn('⚠️ Google Vision fallito, provo Claude Vision:', result.error);
      
      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const claudeOcr = createOCRAdapter('claude');
          result = await claudeOcr.extract(imageBuffer, options);
          usedAdapter = 'claude-vision';
          console.log('✅ Usando Claude Vision come fallback');
        } catch (error) {
          console.warn('❌ Anche Claude Vision fallito:', error);
        }
      }
    }

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
