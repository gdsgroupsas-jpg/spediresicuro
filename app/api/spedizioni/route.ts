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

    // Calcola prezzo base
    const peso = parseFloat(body.peso) || 0;
    const basePrice = 10; // Prezzo base fisso
    const pesoPrice = peso * 2; // 2€ per kg
    const expressMultiplier = body.tipoSpedizione === 'express' ? 1.5 : 1;
    const prezzoBase = (basePrice + pesoPrice) * expressMultiplier;
    
    // Margine configurabile (default 15%)
    const marginePercentuale = 15;
    const margine = (prezzoBase * marginePercentuale) / 100;
    const prezzoFinale = prezzoBase + margine;

    // Genera tracking number
    const trackingPrefix = (body.corriere || 'GLS').substring(0, 3).toUpperCase();
    const trackingNumber = `${trackingPrefix}${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

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
      peso: peso,
      dimensioni: {
        lunghezza: parseFloat(body.lunghezza) || 0,
        larghezza: parseFloat(body.larghezza) || 0,
        altezza: parseFloat(body.altezza) || 0,
      },
      tipoSpedizione: body.tipoSpedizione || 'standard',
      note: body.note || '',
      // Campi calcolati
      prezzoBase: prezzoBase,
      margine: margine,
      prezzoFinale: prezzoFinale,
      // Status e tracking
      status: 'in_preparazione',
      tracking: trackingNumber,
      corriere: body.corriere || 'GLS',
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

