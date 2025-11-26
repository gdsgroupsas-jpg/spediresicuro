/**
 * API Route: Gestione Spedizioni
 * 
 * Endpoint: POST /api/spedizioni
 * 
 * Crea una nuova spedizione e la salva nel database locale (JSON).
 * In futuro verrà migrato a Supabase/PostgreSQL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { addSpedizione, getSpedizioni } from '@/lib/database';

/**
 * Handler GET - Ottiene tutte le spedizioni
 */
export async function GET() {
  try {
    const spedizioni = getSpedizioni();
    return NextResponse.json(
      {
        success: true,
        data: spedizioni,
        count: spedizioni.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Errore API spedizioni GET:', error);
    return NextResponse.json(
      {
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

/**
 * Handler POST - Crea una nuova spedizione
 */
export async function POST(request: NextRequest) {
  try {
    // Leggi i dati dal body della richiesta
    const body = await request.json();

    // Validazione base dei campi obbligatori
    if (!body.mittenteNome || !body.destinatarioNome) {
      return NextResponse.json(
        {
          error: 'Dati mancanti',
          message: 'Nome mittente e destinatario sono obbligatori',
        },
        { status: 400 }
      );
    }

    if (!body.peso || parseFloat(body.peso) <= 0) {
      return NextResponse.json(
        {
          error: 'Dati non validi',
          message: 'Il peso deve essere maggiore di 0',
        },
        { status: 400 }
      );
    }

    // Prepara i dati della spedizione
    const spedizione = {
      // Dati mittente
      mittente: {
        nome: body.mittenteNome,
        indirizzo: body.mittenteIndirizzo || '',
        citta: body.mittenteCitta || '',
        provincia: body.mittenteProvincia || '',
        cap: body.mittenteCap || '',
        telefono: body.mittenteTelefono || '',
        email: body.mittenteEmail || '',
      },
      // Dati destinatario
      destinatario: {
        nome: body.destinatarioNome,
        indirizzo: body.destinatarioIndirizzo || '',
        citta: body.destinatarioCitta || '',
        provincia: body.destinatarioProvincia || '',
        cap: body.destinatarioCap || '',
        telefono: body.destinatarioTelefono || '',
        email: body.destinatarioEmail || '',
      },
      // Dettagli spedizione
      peso: parseFloat(body.peso) || 0,
      dimensioni: {
        lunghezza: parseFloat(body.lunghezza) || 0,
        larghezza: parseFloat(body.larghezza) || 0,
        altezza: parseFloat(body.altezza) || 0,
      },
      tipoSpedizione: body.tipoSpedizione || 'standard',
      note: body.note || '',
      // Campi calcolati (verranno aggiunti in futuro con calcolo prezzi)
      prezzoBase: 0,
      margine: 0,
      prezzoFinale: 0,
      // Status e tracking (default)
      status: 'in_preparazione',
      tracking: null,
      corriere: null,
    };

    // Salva nel database locale
    addSpedizione(spedizione);

    // Risposta di successo
    return NextResponse.json(
      {
        success: true,
        message: 'Spedizione creata con successo',
        data: spedizione,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Errore API spedizioni:', error);
    return NextResponse.json(
      {
        error: 'Errore interno del server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

