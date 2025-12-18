/**
 * API Route: Reliability Score Corrieri
 * 
 * Calcola e restituisce il reliability score per i corrieri in una zona specifica
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeCorrieriPerformance, generateRoutingSuggestion } from '@/lib/corrieri-performance';
import { Corriere } from '@/types/corrieri';
import { auth } from '@/lib/auth-config';
import { createAuthContextFromSession } from '@/lib/auth-context';

// Forza rendering dinamico (usa nextUrl.searchParams)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verifica autenticazione
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const authContext = await createAuthContextFromSession(session);

    const searchParams = request.nextUrl.searchParams;
    const citta = searchParams.get('citta');
    const provincia = searchParams.get('provincia');

    if (!citta || !provincia) {
      return NextResponse.json(
        {
          error: 'Parametri mancanti',
          message: 'Città e provincia sono obbligatori',
        },
        { status: 400 }
      );
    }

    const performances = await analyzeCorrieriPerformance(citta, provincia, authContext);

    return NextResponse.json(
      {
        success: true,
        data: performances,
        zona: `${citta}, ${provincia}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Errore API reliability:', error);
    return NextResponse.json(
      {
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const authContext = await createAuthContextFromSession(session);

    const body = await request.json();
    const { citta, provincia, corriereScelto, prezzoCorriereScelto } = body;

    if (!citta || !provincia || !corriereScelto || !prezzoCorriereScelto) {
      return NextResponse.json(
        {
          error: 'Parametri mancanti',
          message: 'Città, provincia, corriere scelto e prezzo sono obbligatori',
        },
        { status: 400 }
      );
    }

    const suggestion = await generateRoutingSuggestion(
      citta,
      provincia,
      prezzoCorriereScelto,
      corriereScelto as Corriere,
      authContext
    );

    return NextResponse.json(
      {
        success: true,
        data: suggestion,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Errore API routing suggestion:', error);
    return NextResponse.json(
      {
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

