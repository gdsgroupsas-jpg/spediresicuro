/**
 * API Route: CAP Validation
 *
 * Validazione CAP/Città/Provincia usando dataset Poste Italiane.
 * Nessuna API esterna, lookup locale deterministico.
 *
 * POST /api/address/validate-cap
 * Body: { cap: string, city: string, province: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAddress, getCityInfo, getProvinceForCap } from '@/lib/address/italian-postal-data';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cap, city, province } = body;

    if (!cap && !city && !province) {
      return NextResponse.json(
        { success: false, error: 'Almeno un campo obbligatorio (cap, city, province)' },
        { status: 400 }
      );
    }

    // Validazione completa se abbiamo tutti i campi
    if (cap && city && province) {
      const result = validateAddress(cap, city, province);
      return NextResponse.json({
        success: true,
        ...result,
      });
    }

    // Lookup parziale: solo città
    if (city && !cap && !province) {
      const info = getCityInfo(city);
      if (info) {
        return NextResponse.json({
          success: true,
          valid: true,
          suggestion: {
            correctCap: info.cap,
            correctProvince: info.province,
          },
          message: `${city}: CAP ${info.cap}, Provincia ${info.province}`,
        });
      }
      return NextResponse.json({
        success: true,
        valid: true,
        message: 'Città non trovata nel database capoluoghi',
      });
    }

    // Lookup parziale: solo CAP
    if (cap && !city) {
      const expectedProvince = getProvinceForCap(cap);
      if (expectedProvince) {
        if (province && province.toUpperCase() !== expectedProvince) {
          return NextResponse.json({
            success: true,
            valid: false,
            message: `CAP ${cap} corrisponde a provincia ${expectedProvince}, non ${province}`,
            suggestion: { correctProvince: expectedProvince },
          });
        }
        return NextResponse.json({
          success: true,
          valid: true,
          suggestion: { correctProvince: expectedProvince },
          message: `CAP ${cap} corrisponde a provincia ${expectedProvince}`,
        });
      }
    }

    // Validazione parziale con i campi disponibili
    const result = validateAddress(cap || '', city || '', province || '');
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore validazione CAP';
    console.error('[ValidateCAP] Errore:', message);

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
