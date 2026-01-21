/**
 * API: User Settings
 *
 * GET  /api/user/settings - Recupera impostazioni utente corrente
 * PUT  /api/user/settings - Aggiorna impostazioni utente
 */

import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail, updateUser } from '@/lib/database';
import { requireAuth } from '@/lib/api-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-responses';

// ⚠️ IMPORTANTE: Questa route usa headers() per l'autenticazione, quindi deve essere dinamica
export const dynamic = 'force-dynamic';

/**
 * GET - Recupera impostazioni utente
 * ⚠️ CRITICO: Usa SOLO Supabase - nessun fallback JSON
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticazione
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    // Trova utente in Supabase
    const user = await findUserByEmail(context!.actor.email!);

    if (!user) {
      return ApiErrors.NOT_FOUND('Utente');
    }

    // Restituisci impostazioni (senza password)
    return NextResponse.json({
      defaultSender: user.defaultSender || null,
      email: user.email,
      name: user.name,
      role: user.role,
      provider: user.provider,
      image: user.image,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/user/settings');
  }
}

/**
 * PUT - Aggiorna impostazioni utente
 * ⚠️ CRITICO: Usa SOLO Supabase - nessun fallback JSON
 */
export async function PUT(request: NextRequest) {
  try {
    // Autenticazione
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    // Parse body
    const body = await request.json();
    const { defaultSender } = body;

    // Validazione mittente predefinito
    if (defaultSender) {
      if (
        !defaultSender.nome ||
        !defaultSender.indirizzo ||
        !defaultSender.citta ||
        !defaultSender.cap
      ) {
        return ApiErrors.BAD_REQUEST(
          'Dati mittente incompleti. Campi obbligatori: nome, indirizzo, città, CAP'
        );
      }

      // Valida CAP italiano (5 cifre)
      if (!/^\d{5}$/.test(defaultSender.cap)) {
        return ApiErrors.VALIDATION_ERROR('CAP non valido. Deve essere 5 cifre.');
      }

      // Valida provincia (2 lettere)
      if (defaultSender.provincia && !/^[A-Z]{2}$/.test(defaultSender.provincia)) {
        return ApiErrors.VALIDATION_ERROR(
          'Provincia non valida. Deve essere 2 lettere (es: MI, RM)'
        );
      }
    }

    // Trova utente in Supabase
    const user = await findUserByEmail(context!.actor.email!);

    if (!user) {
      return ApiErrors.NOT_FOUND('Utente');
    }

    // Aggiorna impostazioni in Supabase
    const updatedUser = await updateUser(user.id, {
      defaultSender: defaultSender || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Impostazioni salvate con successo',
      defaultSender: updatedUser.defaultSender || null,
    });
  } catch (error: any) {
    return handleApiError(error, 'PUT /api/user/settings');
  }
}
