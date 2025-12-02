/**
 * API Route: Gestione Spedizioni
 * 
 * Endpoint: POST /api/spedizioni
 * 
 * Crea una nuova spedizione e la salva nel database locale (JSON).
 * In futuro verrà migrato a Supabase/PostgreSQL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { addSpedizione, getSpedizioni } from '@/lib/database';

/**
 * Handler GET - Ottiene tutte le spedizioni
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Gestisci query parameter per singola spedizione
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (id) {
      // Restituisci singola spedizione (filtrata per utente autenticato)
      let spedizioni: any[] = [];
      try {
        spedizioni = await getSpedizioni(session.user.email);
      } catch (error: any) {
        console.error('❌ [API] Errore getSpedizioni (singola):', error.message);
        if (error.message?.includes('Supabase non configurato')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Database non configurato',
              message: 'Supabase non è configurato. Configura le variabili ambiente necessarie.',
            },
            { status: 503 }
          );
        }
        throw error;
      }
      const spedizione = spedizioni.find((s: any) => s.id === id);
      
      if (!spedizione || spedizione.deleted === true) {
        return NextResponse.json({ error: 'Spedizione non trovata' }, { status: 404 });
      }
      
      // Normalizza struttura destinatario
      const spedizioneNormalizzata = {
        ...spedizione,
        destinatario: spedizione.destinatario?.nome 
          ? spedizione.destinatario 
          : {
              nome: spedizione.destinatarioNome || spedizione.destinatario?.nome || spedizione.nome || spedizione.nominativo || '',
              indirizzo: spedizione.destinatarioIndirizzo || spedizione.destinatario?.indirizzo || spedizione.indirizzo || '',
              citta: spedizione.destinatarioCitta || spedizione.destinatario?.citta || spedizione.citta || spedizione.localita || '',
              provincia: spedizione.destinatarioProvincia || spedizione.destinatario?.provincia || spedizione.provincia || '',
              cap: spedizione.destinatarioCap || spedizione.destinatario?.cap || spedizione.cap || '',
              telefono: spedizione.destinatarioTelefono || spedizione.destinatario?.telefono || spedizione.telefono || '',
              email: spedizione.destinatarioEmail || spedizione.destinatario?.email || spedizione.email_dest || spedizione.email || '',
            },
        mittente: spedizione.mittente || {
          nome: spedizione.mittenteNome || 'Mittente Predefinito',
          indirizzo: spedizione.mittenteIndirizzo || '',
          citta: spedizione.mittenteCitta || '',
          provincia: spedizione.mittenteProvincia || '',
          cap: spedizione.mittenteCap || '',
          telefono: spedizione.mittenteTelefono || '',
          email: spedizione.mittenteEmail || '',
        },
        // ⚠️ IMPORTANTE: Tracking - per ordini importati, ldv è il tracking
        // Per ordini creati dalla piattaforma, tracking è già presente
        tracking: spedizione.ldv || spedizione.tracking || '',
      };
      
      return NextResponse.json({
        success: true,
        data: spedizioneNormalizzata,
      }, { status: 200 });
    }

    // Ottieni spedizioni filtrate per utente autenticato (multi-tenancy)
    let spedizioni: any[] = [];
    try {
      spedizioni = await getSpedizioni(session.user.email);
    } catch (error: any) {
      console.error('❌ [API] Errore getSpedizioni:', error.message);
      // Se Supabase non è configurato, ritorna array vuoto con messaggio
      if (error.message?.includes('Supabase non configurato')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Database non configurato',
            message: 'Supabase non è configurato. Configura le variabili ambiente necessarie.',
            data: [],
            count: 0,
          },
          { status: 503 }
        );
      }
      // Altrimenti rilancia l'errore
      throw error;
    }

    // Filtra solo spedizioni non eliminate (deleted deve essere esplicitamente true per essere filtrate)
    const spedizioniAttive = spedizioni.filter((s: any) => {
      // Se deleted non esiste o è false, mostra la spedizione
      return s.deleted !== true;
    });

    // ⚠️ IMPORTANTE: Normalizza struttura destinatario per tutte le spedizioni
    // Questo risolve il problema delle spedizioni importate salvate con campi separati
    const spedizioniNormalizzate = spedizioniAttive.map((s: any) => {
      // Se non ha struttura destinatario ma ha campi separati, costruiscila
      if (!s.destinatario || !s.destinatario.nome) {
        return {
          ...s,
          destinatario: {
            nome: s.destinatarioNome || s.destinatario?.nome || s.nome || s.nominativo || '',
            indirizzo: s.destinatarioIndirizzo || s.destinatario?.indirizzo || s.indirizzo || '',
            citta: s.destinatarioCitta || s.destinatario?.citta || s.citta || s.localita || '',
            provincia: s.destinatarioProvincia || s.destinatario?.provincia || s.provincia || '',
            cap: s.destinatarioCap || s.destinatario?.cap || s.cap || '',
            telefono: s.destinatarioTelefono || s.destinatario?.telefono || s.telefono || '',
            email: s.destinatarioEmail || s.destinatario?.email || s.email_dest || s.email || '',
          },
          // Assicura anche struttura mittente
          mittente: s.mittente || {
            nome: s.mittenteNome || 'Mittente Predefinito',
            indirizzo: s.mittenteIndirizzo || '',
            citta: s.mittenteCitta || '',
            provincia: s.mittenteProvincia || '',
            cap: s.mittenteCap || '',
            telefono: s.mittenteTelefono || '',
            email: s.mittenteEmail || '',
          },
          // ⚠️ IMPORTANTE: Assicura tracking (ldv è il tracking, NON order_id)
          // Per ordini importati da Spedisci.Online, ldv contiene il tracking
          // Per ordini creati dalla piattaforma, tracking è già presente
          tracking: s.ldv || s.tracking || s.tracking_number || s.trackingNumber || '', // PRIMA PRIORITÀ: ldv
          // Mantieni anche ldv separato per compatibilità
          ldv: s.ldv || s.tracking || '',
        };
      }
      return s;
    });

    // Log per debug (rimuovere in produzione)
    console.log(`📦 Totale spedizioni nel DB: ${spedizioni.length}`);
    console.log(`✅ Spedizioni attive: ${spedizioniAttive.length}`);
    console.log(`📥 Spedizioni importate: ${spedizioniNormalizzate.filter((s: any) => s.imported).length}`);

    return NextResponse.json(
      {
        success: true,
        data: spedizioniNormalizzate,
        count: spedizioniNormalizzate.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ [API] Errore API spedizioni GET:', error);
    console.error('❌ [API] Stack:', error instanceof Error ? error.stack : 'N/A');
    
    // Messaggio errore più dettagliato
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    const isSupabaseError = errorMessage.includes('Supabase') || errorMessage.includes('supabase');
    
    return NextResponse.json(
      {
        success: false,
        error: isSupabaseError ? 'Errore database Supabase' : 'Errore interno del server',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: isSupabaseError ? 503 : 500 }
    );
  }
}

/**
 * Handler POST - Crea una nuova spedizione
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

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
    
    // Costi aggiuntivi
    const contrassegno = parseFloat(body.contrassegno) || 0;
    const assicurazione = parseFloat(body.assicurazione) || 0;
    const costoContrassegno = contrassegno > 0 ? 3 : 0; // Costo fisso per gestione contrassegno
    const costoAssicurazione = assicurazione > 0 ? (assicurazione * 0.02) : 0; // 2% del valore assicurato
    
    // Margine configurabile (default 15%)
    const marginePercentuale = 15;
    const margine = (prezzoBase * marginePercentuale) / 100;
    const prezzoFinale = prezzoBase + margine + costoContrassegno + costoAssicurazione;

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
      contrassegno: contrassegno,
      assicurazione: assicurazione,
      note: body.note || '',
      // Campi aggiuntivi per formato spedisci.online
      contenuto: body.contenuto || '',
      order_id: body.order_id || '',
      totale_ordine: prezzoFinale,
      rif_mittente: body.rif_mittente || body.mittenteNome || '',
      rif_destinatario: body.rif_destinatario || body.destinatarioNome || '',
      colli: body.colli || 1,
      // Campi calcolati
      prezzoBase: prezzoBase,
      margine: margine,
      costoContrassegno: costoContrassegno,
      costoAssicurazione: costoAssicurazione,
      prezzoFinale: prezzoFinale,
      // Status e tracking
      status: 'in_preparazione',
      tracking: trackingNumber,
      corriere: body.corriere || 'GLS',
      // Audit Trail - Tracciamento creazione
      created_by_user_email: session.user.email,
      created_by_user_name: session.user.name || session.user.email,
      // Soft Delete
      deleted: false,
    };

    // Salva nel database (SOLO Supabase)
    try {
      await addSpedizione(spedizione, session.user.email);
    } catch (error: any) {
      console.error('❌ [API] Errore addSpedizione:', error.message);
      console.error('❌ [API] Stack:', error.stack);
      // Rilancia l'errore con messaggio più chiaro
      throw error;
    }

    // INVIO AUTOMATICO LDV TRAMITE ORCHESTRATOR (se configurato)
    let ldvResult = null;
    try {
      const { createShipmentWithOrchestrator } = await import('@/lib/actions/spedisci-online');
      ldvResult = await createShipmentWithOrchestrator(spedizione, body.corriere || 'GLS');
      
      if (ldvResult.success) {
        console.log(`✅ LDV creata (${ldvResult.method}):`, ldvResult.tracking_number);
        // Aggiorna tracking number se fornito dall'orchestrator
        if (ldvResult.tracking_number && ldvResult.tracking_number !== spedizione.tracking) {
          spedizione.tracking = ldvResult.tracking_number;
        }
      } else {
        console.warn('⚠️ Creazione LDV fallita (non critico):', ldvResult.error);
      }
    } catch (error) {
      // Non bloccare la risposta se la creazione LDV fallisce
      console.warn('⚠️ Errore creazione LDV (non critico):', error);
    }

    // Risposta di successo
    return NextResponse.json(
      {
        success: true,
        message: 'Spedizione creata con successo',
        data: spedizione,
        ldv: ldvResult, // Info creazione LDV (orchestrator)
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ [API] Errore API spedizioni POST:', error);
    console.error('❌ [API] Stack:', error instanceof Error ? error.stack : 'N/A');
    
    // Messaggio errore più dettagliato
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    const isSupabaseError = errorMessage.includes('Supabase') || errorMessage.includes('supabase') || errorMessage.includes('column') || errorMessage.includes('schema');
    
    return NextResponse.json(
      {
        success: false,
        error: isSupabaseError ? 'Errore database Supabase' : 'Errore interno del server',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: isSupabaseError ? 503 : 500 }
    );
  }
}

/**
 * Handler DELETE - Soft delete spedizione
 * 
 * ⚠️ CRITICO: Usa SOLO Supabase - nessun fallback JSON
 */
export async function DELETE(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Ottieni ID dalla query
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log(`🗑️ [API] DELETE richiesto per ID: ${id}`);

    if (!id) {
      console.error('❌ [API] ID spedizione mancante nella query string');
      return NextResponse.json({ error: 'ID spedizione mancante' }, { status: 400 });
    }

    // Valida formato ID (UUID o stringa)
    if (typeof id !== 'string' || id.trim() === '') {
      console.error('❌ [API] ID spedizione non valido:', id);
      return NextResponse.json({ error: 'ID spedizione non valido' }, { status: 400 });
    }

    // ⚠️ CRITICO: Usa SOLO Supabase per soft delete
    const { supabaseAdmin } = await import('@/lib/supabase');
    
    console.log(`🗑️ [SUPABASE] Soft delete spedizione: ${id}`);
    
    // Ottieni user_id Supabase se disponibile (opzionale)
    let supabaseUserId: string | null = null;
    try {
      const { getSupabaseUserIdFromEmail } = await import('@/lib/database');
      supabaseUserId = await getSupabaseUserIdFromEmail(session.user.email);
    } catch (error) {
      // Non critico se non trovato
      console.warn('⚠️ [SUPABASE] Impossibile ottenere user_id per soft delete:', error);
    }

    // Soft delete - aggiorna spedizione in Supabase
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: supabaseUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('deleted', false) // Solo se non è già eliminata
      .select()
      .single();

    if (error) {
      console.error('❌ [SUPABASE] Errore soft delete:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      
      // Se la spedizione non esiste o è già eliminata
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Spedizione non trovata o già eliminata' }, { status: 404 });
      }
      
      throw new Error(`Errore Supabase: ${error.message}${error.details ? ` - ${error.details}` : ''}`);
    }

    if (!data) {
      return NextResponse.json({ error: 'Spedizione non trovata o già eliminata' }, { status: 404 });
    }

    console.log(`✅ [SUPABASE] Spedizione ${id} eliminata con successo (soft delete)`);

    return NextResponse.json({
      success: true,
      message: 'Spedizione eliminata con successo',
    });
  } catch (error) {
    console.error('❌ [API] Errore DELETE spedizione:', error);
    console.error('❌ [API] Stack:', error instanceof Error ? error.stack : 'N/A');
    
    const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
    const isSupabaseError = errorMessage.includes('Supabase') || errorMessage.includes('supabase');
    
    return NextResponse.json(
      {
        error: isSupabaseError ? 'Errore database Supabase' : 'Errore interno del server',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
      { status: isSupabaseError ? 503 : 500 }
    );
  }
}

