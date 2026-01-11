/**
 * API Route: OCR Extract
 *
 * Endpoint per estrazione dati da immagini tramite OCR
 *
 * GDPR COMPLIANCE (P0 AUDIT FIX):
 * - User consent obbligatorio per Vision APIs (Google/Claude)
 * - Logging completo processing per audit trail
 * - Kill-switch env var ENABLE_OCR_VISION
 * - Retention policy 7 giorni (auto-cleanup)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createOCRAdapter } from '@/lib/adapters/ocr';
import { requireSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    // ============================================
    // AUTHENTICATION (required)
    // ============================================
    const { context, error: authError } = await requireSafeAuth();
    if (authError || !context) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = context.target.id;

    // ============================================
    // GDPR: Check kill-switch
    // ============================================
    const visionEnabled = process.env.ENABLE_OCR_VISION !== 'false'; // Default: enabled

    // ============================================
    // GDPR: Check user consent (se Vision enabled)
    // ============================================
    let consentGiven = false;
    if (visionEnabled) {
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('ocr_vision_consent_given_at')
        .eq('id', userId)
        .single();

      consentGiven = !!user?.ocr_vision_consent_given_at;

      if (!consentGiven) {
        console.warn('⚠️ [OCR] User consent not given, using Tesseract only', {
          userId: userId.substring(0, 8) + '...',
        });
      }
    }

    // ============================================
    // REQUEST PARSING
    // ============================================
    const body = await request.json();
    const { image, options } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Immagine mancante' },
        { status: 400 }
      );
    }

    // ============================================
    // OCR ADAPTER SELECTION (GDPR-aware)
    // ============================================
    // 1. Se consent + vision enabled → Auto (Google/Claude Vision)
    // 2. Se NO consent OR vision disabled → Tesseract only
    const adapterType = (visionEnabled && consentGiven) ? 'auto' : 'tesseract';
    const ocr = createOCRAdapter(adapterType);

    console.log(`🔍 OCR Adapter: ${adapterType} | Consent: ${consentGiven} | Vision enabled: ${visionEnabled}`);

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

    // ============================================
    // IMAGE PROCESSING
    // ============================================
    const imageBuffer = Buffer.from(image, 'base64');

    // Calculate image hash (per deduplication + privacy)
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const imageSize = imageBuffer.length;
    const imageFormat = detectImageFormat(imageBuffer);

    // ============================================
    // OCR EXTRACTION
    // ============================================
    let result = await ocr.extract(imageBuffer, options);
    let usedProvider = getProviderName(ocr);

    // Fallback: se Google Vision fallisce, prova Claude
    if (!result.success && usedProvider === 'google_vision' && visionEnabled && consentGiven) {
      console.warn('⚠️ Google Vision fallito, provo Claude Vision:', result.error);

      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const claudeOcr = createOCRAdapter('claude');
          result = await claudeOcr.extract(imageBuffer, options);
          usedProvider = 'claude_vision';
          console.log('✅ Usando Claude Vision come fallback');
        } catch (error) {
          console.warn('❌ Anche Claude Vision fallito:', error);
        }
      }
    }

    // ============================================
    // GDPR: Log processing event
    // ============================================
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const processingStatus = result.success ? 'success' : 'failed';
    const extractedFields = result.success ? normalizeExtractedData(result.extractedData) : null;

    await supabaseAdmin.rpc('log_ocr_processing', {
      p_user_id: userId,
      p_provider: usedProvider,
      p_status: processingStatus,
      p_image_hash: imageHash,
      p_image_size: imageSize,
      p_image_format: imageFormat,
      p_extracted_fields: extractedFields ? JSON.parse(JSON.stringify(extractedFields)) : null,
      p_consent_given: consentGiven,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_error_message: result.success ? null : result.error,
      p_error_code: result.success ? null : 'OCR_FAILED',
    });

    // ============================================
    // RESPONSE
    // ============================================
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Errore durante l\'estrazione OCR',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      confidence: result.confidence,
      extractedData: extractedFields,
      provider: usedProvider,
      consentGiven,
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
 * Get provider name from adapter
 */
function getProviderName(ocr: any): string {
  const name = ocr.name || 'unknown';

  // Map adapter names to DB enum values
  const mapping: Record<string, string> = {
    'google-vision': 'google_vision',
    'claude-vision': 'claude_vision',
    'tesseract': 'tesseract',
    'mock': 'mock',
  };

  return mapping[name] || name;
}

/**
 * Detect image format from buffer
 */
function detectImageFormat(buffer: Buffer): string {
  const header = buffer.toString('hex', 0, 4);

  if (header.startsWith('ffd8ff')) return 'jpeg';
  if (header.startsWith('89504e47')) return 'png';
  if (header.startsWith('47494638')) return 'gif';
  if (header.startsWith('424d')) return 'bmp';

  return 'unknown';
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
