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
import { createAuthContextFromSession } from '@/lib/auth-context';
import { createApiLogger, getRequestId } from '@/lib/api-helpers';
import { handleApiError } from '@/lib/api-responses';

/**
 * Handler GET - Ottiene tutte le spedizioni
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const logger = await createApiLogger(request);
  
  try {
    logger.info('GET /api/spedizioni - Richiesta lista spedizioni');
    
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      logger.warn('GET /api/spedizioni - Non autenticato');
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Gestisci query parameter per singola spedizione
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (id) {
      // Restituisci singola spedizione (filtrata per utente autenticato)
      let spedizioni: any[] = [];
      try {
        const authContext = await createAuthContextFromSession(session);
        spedizioni = await getSpedizioni(authContext);
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
      const authContext = await createAuthContextFromSession(session);
      spedizioni = await getSpedizioni(authContext);
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
    const userId = session?.user?.id;
    return handleApiError(error, 'GET /api/spedizioni', requestId, userId);
  }
}

/**
 * Handler POST - Crea una nuova spedizione
 */
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const logger = await createApiLogger(request);
  
  try {
    logger.info('POST /api/spedizioni - Richiesta creazione spedizione');
    
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      logger.warn('POST /api/spedizioni - Non autenticato');
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
    const contrassegno = body.contrassegno && body.contrassegnoAmount 
      ? parseFloat(body.contrassegnoAmount) || 0 
      : 0;
    const assicurazione = parseFloat(body.assicurazione) || 0;
    const costoContrassegno = contrassegno > 0 ? 3 : 0; // Costo fisso per gestione contrassegno
    const costoAssicurazione = assicurazione > 0 ? (assicurazione * 0.02) : 0; // 2% del valore assicurato
    
    // Validazione: codValue >= 0 (codValue è il campo OpenAPI per contrassegno)
    if (contrassegno < 0) {
      return NextResponse.json(
        {
          error: 'Validazione fallita',
          message: 'L\'importo del contrassegno (codValue) non può essere negativo',
        },
        { status: 400 }
      );
    }
    
    // Validazione: se contrassegno attivo, telefono destinatario obbligatorio
    if (contrassegno > 0 && !body.destinatarioTelefono) {
      return NextResponse.json(
        {
          error: 'Validazione fallita',
          message: 'Il telefono destinatario è obbligatorio quando è attivo il contrassegno',
        },
        { status: 400 }
      );
    }
    
    // Margine configurabile (default 15%)
    const marginePercentuale = 15;
    const margine = (prezzoBase * marginePercentuale) / 100;
    const prezzoFinale = prezzoBase + margine + costoContrassegno + costoAssicurazione;

    // Genera tracking number
    const trackingPrefix = (body.corriere || 'GLS').substring(0, 3).toUpperCase();
    const trackingNumber = `${trackingPrefix}${Date.now().toString().slice(-8)}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Prepara i dati della spedizione
    // Usa tipo any per permettere aggiunta proprietà dinamiche (ldv, external_tracking_number, poste_metadata)
    const spedizione: any = {
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
      const authContext = await createAuthContextFromSession(session);
      await addSpedizione(spedizione, authContext);
    } catch (error: any) {
      console.error('❌ [API] Errore addSpedizione:', error.message);
      console.error('❌ [API] Stack:', error.stack);
      // Rilancia l'errore con messaggio più chiaro
      throw error;
    }

    // INVIO AUTOMATICO LDV TRAMITE ORCHESTRATOR (se configurato)
    let ldvResult = null;
    try {
      console.log('🚀 [API] Chiamo orchestrator per corriere:', body.corriere);
      const { createShipmentWithOrchestrator } = await import('@/lib/actions/spedisci-online');
      ldvResult = await createShipmentWithOrchestrator(spedizione, body.corriere || 'GLS');
      
      console.log('📦 [API] Risultato orchestrator:', {
        success: ldvResult.success,
        method: ldvResult.method,
        tracking: ldvResult.tracking_number,
        has_label_url: !!ldvResult.label_url,
        error: ldvResult.error
      });
      
      if (ldvResult.success) {
        console.log(`✅ LDV creata (${ldvResult.method}):`, ldvResult.tracking_number);
        
        // Aggiorna tracking number se fornito dall'orchestrator
        if (ldvResult.tracking_number && ldvResult.tracking_number !== spedizione.tracking) {
          spedizione.tracking = ldvResult.tracking_number;
          spedizione.ldv = ldvResult.tracking_number; // Salva anche come LDV
        }

        // Se è una spedizione Poste, salva metadati aggiuntivi
        if (body.corriere === 'Poste Italiane' && ldvResult.metadata) {
          const { poste_account_id, poste_product_code, waybill_number, label_pdf_url } = ldvResult.metadata;
          
          // Aggiorna spedizione con metadati Poste
          spedizione.external_tracking_number = waybill_number || ldvResult.tracking_number;
          spedizione.poste_metadata = {
            poste_account_id,
            poste_product_code,
            waybill_number,
            label_pdf_url
          };
          
          console.log('📦 Metadati Poste salvati:', {
            waybill_number,
            poste_product_code,
            label_pdf_url
          });
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
    const session = await auth();
    const userId = session?.user?.id;
    return handleApiError(error, 'POST /api/spedizioni', requestId, userId);
  }
}

/**
 * Handler DELETE - Soft delete spedizione
 * 
 * ⚠️ CRITICO: Usa SOLO Supabase - nessun fallback JSON
 */
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const logger = await createApiLogger(request);
  
  try {
    logger.info('DELETE /api/spedizioni - Richiesta eliminazione spedizione');
    
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      logger.warn('DELETE /api/spedizioni - Non autenticato');
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
    const session = await auth();
    const userId = session?.user?.id;
    return handleApiError(error, 'DELETE /api/spedizioni', requestId, userId);
  }
}