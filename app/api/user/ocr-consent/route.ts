/**
 * API Route: OCR Vision Consent Management
 *
 * Gestione consenso utente per OCR Vision processing (GDPR Art. 6).
 *
 * POST: Grant consent
 * DELETE: Revoke consent
 * GET: Check consent status
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

/**
 * POST: Grant OCR Vision consent
 */
export async function POST(request: NextRequest) {
  try {
    // ============================================
    // AUTHENTICATION
    // ============================================
    const context = await requireSafeAuth();
    const userId = context.target.id;

    // ============================================
    // METADATA COLLECTION (for audit)
    // ============================================
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // ============================================
    // GRANT CONSENT
    // ============================================
    const { error } = await supabaseAdmin.rpc('grant_ocr_vision_consent', {
      p_user_id: userId,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
    });

    if (error) {
      console.error('❌ [OCR_CONSENT] Failed to grant consent:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to grant consent',
        },
        { status: 500 }
      );
    }

    console.log('✅ [OCR_CONSENT] Consent granted', {
      userId: userId.substring(0, 8) + '...',
      ip: ipAddress,
    });

    return NextResponse.json({
      success: true,
      message: 'OCR Vision consent granted',
      consentGiven: true,
    });
  } catch (error: any) {
    console.error('❌ [OCR_CONSENT] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Revoke OCR Vision consent
 */
export async function DELETE(request: NextRequest) {
  try {
    // ============================================
    // AUTHENTICATION
    // ============================================
    const context = await requireSafeAuth();
    const userId = context.target.id;

    // ============================================
    // REVOKE CONSENT
    // ============================================
    const { error } = await supabaseAdmin.rpc('revoke_ocr_vision_consent', {
      p_user_id: userId,
    });

    if (error) {
      console.error('❌ [OCR_CONSENT] Failed to revoke consent:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to revoke consent',
        },
        { status: 500 }
      );
    }

    console.log('⚠️ [OCR_CONSENT] Consent revoked', {
      userId: userId.substring(0, 8) + '...',
    });

    return NextResponse.json({
      success: true,
      message: 'OCR Vision consent revoked. Future OCR will use Tesseract only.',
      consentGiven: false,
    });
  } catch (error: any) {
    console.error('❌ [OCR_CONSENT] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET: Check consent status
 */
export async function GET(request: NextRequest) {
  try {
    // ============================================
    // AUTHENTICATION
    // ============================================
    const context = await requireSafeAuth();
    const userId = context.target.id;

    // ============================================
    // CHECK CONSENT STATUS
    // ============================================
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('ocr_vision_consent_given_at, ocr_vision_consent_ip')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ [OCR_CONSENT] Failed to check consent:', error);

      return NextResponse.json(
        {
          success: false,
          error: 'Failed to check consent',
        },
        { status: 500 }
      );
    }

    const consentGiven = !!user?.ocr_vision_consent_given_at;

    return NextResponse.json({
      success: true,
      consentGiven,
      consentTimestamp: user?.ocr_vision_consent_given_at || null,
      consentIp: user?.ocr_vision_consent_ip || null,
    });
  } catch (error: any) {
    console.error('❌ [OCR_CONSENT] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
