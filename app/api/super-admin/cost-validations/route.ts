/**
 * API Route: Cost Validations (SuperAdmin)
 * 
 * GET - Lista tutte le validazioni costi (differenze DB vs API)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { handleApiError } from '@/lib/api-responses';

export async function GET(request: NextRequest) {
  try {
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Verifica superadmin
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('email', context.actor.email)
      .single();

    if (!user || user.account_type !== 'superadmin') {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Recupera validazioni (solo quelle che richiedono attenzione o recenti)
    const { data: validations, error } = await supabaseAdmin
      .from('cost_validations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      validations: validations || [],
      total: validations?.length || 0,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/super-admin/cost-validations');
  }
}
