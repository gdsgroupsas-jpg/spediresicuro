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
import { supabaseAdmin } from '@/lib/db/client';

/**
 * Sanitizza payload spedizione in base al ruolo utente
 * Rimuove campi admin se l'utente non è superadmin
 * 
 * @param payload - Payload spedizione da sanitizzare
 * @param userRole - Ruolo utente (da session.user)
 * @param accountType - Account type utente (da database)
 * @returns Payload sanitizzato
 */
function sanitizeShipmentPayloadByRole(
  payload: any,
  userRole: string | undefined,
  accountType: string | undefined
): any {
  const isSuperAdmin = accountType === 'superadmin' || userRole === 'superadmin' || userRole === 'SUPERADMIN';
  
  // Se non è superadmin, rimuovi campi admin
  if (!isSuperAdmin) {
    const sanitized = { ...payload };
    
    // Rimuovi campi admin
    delete sanitized.created_by_admin_id;
    delete sanitized.admin_operation_reason;
    
    console.log('ℹ️ [SANITIZE] Campi admin rimossi (utente non superadmin)');
    
    return sanitized;
  }
  
  // Superadmin: mantieni tutti i campi (ma admin_operation_reason viene rimosso comunque in normalizzazione)
  return payload;
}

/**
 * Normalizza payload spedizione per Supabase
 * - Converte oggetti in string/uuid
 * - Serializza metadata (JSONB)
 * - Elimina chiavi con undefined
 * 
 * @param payload - Payload da normalizzare
 * @returns Payload normalizzato
 */
function normalizeShipmentPayload(payload: any): any {
  const normalized: any = {};
  
  // Lista campi UUID (da normalizzare a stringa)
  const uuidFields = ['courier_id', 'user_id'];
  
  // Lista campi JSONB (da serializzare)
  const jsonbFields = ['metadata', 'poste_metadata'];
  
  for (const [key, value] of Object.entries(payload)) {
    // 1. Rimuovi undefined/null
    if (value === undefined || value === null) {
      continue; // Salta undefined/null
    }
    
    // 2. Rimuovi campi non validi (non esistono nello schema)
    if (key === 'admin_operation_reason') {
      console.warn(`⚠️ [NORMALIZE] Campo ${key} non esiste nello schema, rimosso`);
      continue; // Rimuovi sempre (non esiste nello schema)
    }
    
    // 3. Normalizza UUID (stringa valida o null)
    if (uuidFields.includes(key)) {
      if (typeof value === 'string' && value.trim() !== '') {
        normalized[key] = value.trim();
      } else if (typeof value === 'object' && value !== null) {
        // Se è un oggetto, prova a estrarre UUID (es. { id: "uuid" } -> "uuid")
        const uuidValue = (value as any).id || (value as any).uuid || null;
        if (uuidValue && typeof uuidValue === 'string') {
          normalized[key] = uuidValue.trim();
        } else {
          console.warn(`⚠️ [NORMALIZE] Campo UUID ${key} è un oggetto non valido, convertito in null`);
          normalized[key] = null;
        }
      } else {
        normalized[key] = null;
      }
      continue;
    }
    
    // 4. Normalizza JSONB (serializza oggetti)
    if (jsonbFields.includes(key)) {
      if (typeof value === 'object' && value !== null) {
        normalized[key] = value; // Supabase gestisce JSONB automaticamente
      } else if (typeof value === 'string' && value.trim() !== '') {
        // Se è stringa, prova a parsarla
        try {
          normalized[key] = JSON.parse(value);
        } catch {
          normalized[key] = null;
        }
      } else {
        normalized[key] = null;
      }
      continue;
    }
    
    // 5. Normalizza altri tipi (string, number, boolean)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Oggetto non JSONB → rimuovi (causa "[OBJECT]" nel payload)
      console.warn(`⚠️ [NORMALIZE] Campo ${key} è un oggetto non JSONB, rimosso per evitare "[OBJECT]"`);
      continue; // Rimuovi oggetti non JSONB
    }
    
    // 6. Mantieni valore normalizzato
    normalized[key] = value;
  }
  
  return normalized;
}

/**
 * Handler GET - Ottiene tutte le spedizioni
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const logger = await createApiLogger(request);
  let session: any = null;
  
  try {
    logger.info('GET /api/spedizioni - Richiesta lista spedizioni');
    
    // Autenticazione
    session = await auth();

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
              // PRIORITÀ: recipient_* colonne Supabase (schema attuale)
              // FALLBACK: destinatarioNome, etc. (campi legacy)
              nome: spedizione.recipient_name || spedizione.destinatarioNome || spedizione.destinatario?.nome || spedizione.nome || spedizione.nominativo || '',
              indirizzo: spedizione.recipient_address || spedizione.destinatarioIndirizzo || spedizione.destinatario?.indirizzo || spedizione.indirizzo || '',
              citta: spedizione.recipient_city || spedizione.destinatarioCitta || spedizione.destinatario?.citta || spedizione.citta || spedizione.localita || '',
              provincia: spedizione.recipient_province || spedizione.destinatarioProvincia || spedizione.destinatario?.provincia || spedizione.provincia || '',
              cap: spedizione.recipient_postal_code || spedizione.recipient_zip || spedizione.destinatarioCap || spedizione.destinatario?.cap || spedizione.cap || '',
              telefono: spedizione.recipient_phone || spedizione.destinatarioTelefono || spedizione.destinatario?.telefono || spedizione.telefono || '',
              email: spedizione.recipient_email || spedizione.destinatarioEmail || spedizione.destinatario?.email || spedizione.email_dest || spedizione.email || '',
            },
        mittente: spedizione.mittente || {
          nome: spedizione.sender_name || spedizione.mittenteNome || 'Mittente Predefinito',
          indirizzo: spedizione.sender_address || spedizione.mittenteIndirizzo || '',
          citta: spedizione.sender_city || spedizione.mittenteCitta || '',
          provincia: spedizione.sender_province || spedizione.mittenteProvincia || '',
          cap: spedizione.sender_postal_code || spedizione.sender_zip || spedizione.mittenteCap || '',
          telefono: spedizione.sender_phone || spedizione.mittenteTelefono || '',
          email: spedizione.sender_email || spedizione.mittenteEmail || '',
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
            // PRIORITÀ: recipient_* colonne Supabase (schema attuale)
            // FALLBACK: destinatarioNome, etc. (campi legacy)
            nome: s.recipient_name || s.destinatarioNome || s.destinatario?.nome || s.nome || s.nominativo || '',
            indirizzo: s.recipient_address || s.destinatarioIndirizzo || s.destinatario?.indirizzo || s.indirizzo || '',
            citta: s.recipient_city || s.destinatarioCitta || s.destinatario?.citta || s.citta || s.localita || '',
            provincia: s.recipient_province || s.destinatarioProvincia || s.destinatario?.provincia || s.provincia || '',
            cap: s.recipient_postal_code || s.recipient_zip || s.destinatarioCap || s.destinatario?.cap || s.cap || '',
            telefono: s.recipient_phone || s.destinatarioTelefono || s.destinatario?.telefono || s.telefono || '',
            email: s.recipient_email || s.destinatarioEmail || s.destinatario?.email || s.email_dest || s.email || '',
          },
          // Assicura anche struttura mittente
          mittente: s.mittente || {
            nome: s.sender_name || s.mittenteNome || 'Mittente Predefinito',
            indirizzo: s.sender_address || s.mittenteIndirizzo || '',
            citta: s.sender_city || s.mittenteCitta || '',
            provincia: s.sender_province || s.mittenteProvincia || '',
            cap: s.sender_postal_code || s.sender_zip || s.mittenteCap || '',
            telefono: s.sender_phone || s.mittenteTelefono || '',
            email: s.sender_email || s.mittenteEmail || '',
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
  let session: any = null;
  
  try {
    logger.info('POST /api/spedizioni - Richiesta creazione spedizione');
    
    // Autenticazione
    session = await auth();

    if (!session?.user?.email) {
      logger.warn('POST /api/spedizioni - Non autenticato');
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Leggi i dati dal body della richiesta
    const body = await request.json();

    // ⚠️ VALIDAZIONE ROBUSTA: Verifica campi obbligatori PRIMA di chiamare Supabase
    const validationErrors: string[] = [];

    // Validazione nome mittente e destinatario
    if (!body.mittenteNome || body.mittenteNome.trim().length < 2) {
      validationErrors.push('Nome mittente obbligatorio (minimo 2 caratteri)');
    }
    if (!body.destinatarioNome || body.destinatarioNome.trim().length < 2) {
      validationErrors.push('Nome destinatario obbligatorio (minimo 2 caratteri)');
    }

    // ⚠️ VALIDAZIONE PROVINCIA E CAP MITTENTE (CRITICO)
    if (!body.mittenteProvincia || body.mittenteProvincia.trim().length !== 2) {
      validationErrors.push('Provincia mittente obbligatoria (sigla 2 lettere, es. SA)');
    }
    if (!body.mittenteCap || !/^\d{5}$/.test(body.mittenteCap.trim())) {
      validationErrors.push('CAP mittente obbligatorio (5 cifre)');
    }
    if (!body.mittenteCitta || body.mittenteCitta.trim().length < 2) {
      validationErrors.push('Città mittente obbligatoria');
    }

    // ⚠️ VALIDAZIONE PROVINCIA E CAP DESTINATARIO (CRITICO)
    if (!body.destinatarioProvincia || body.destinatarioProvincia.trim().length !== 2) {
      validationErrors.push('Provincia destinatario obbligatoria (sigla 2 lettere, es. MI)');
    }
    if (!body.destinatarioCap || !/^\d{5}$/.test(body.destinatarioCap.trim())) {
      validationErrors.push('CAP destinatario obbligatorio (5 cifre)');
    }
    if (!body.destinatarioCitta || body.destinatarioCitta.trim().length < 2) {
      validationErrors.push('Città destinatario obbligatoria');
    }

    // Validazione peso
    if (!body.peso || parseFloat(body.peso) <= 0) {
      validationErrors.push('Il peso deve essere maggiore di 0');
    }

    // Se ci sono errori di validazione, blocca la richiesta
    if (validationErrors.length > 0) {
      logger.warn('POST /api/spedizioni - Validazione fallita', { errors: validationErrors });
      return NextResponse.json(
        {
          error: 'Dati non validi',
          message: validationErrors.join('. '),
          details: validationErrors,
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
        nome: body.mittenteNome || body.rif_mittente || '', // ⚠️ FIX: Fallback a rif_mittente
        indirizzo: body.mittenteIndirizzo || '',
        citta: body.mittenteCitta || '',
        provincia: body.mittenteProvincia || '',
        cap: body.mittenteCap || '',
        telefono: body.mittenteTelefono || '',
        email: body.mittenteEmail || '',
      },
      // Dati destinatario
      destinatario: {
        nome: body.destinatarioNome || body.rif_destinatario || '', // ⚠️ FIX: Fallback a rif_destinatario
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

    // ⚠️ LOGGING CRITICO: Verifica payload PRIMA della normalizzazione
    console.log('🔍 [API] Payload RAW dal frontend:', {
      mittente: {
        città: body.mittenteCitta,
        provincia: body.mittenteProvincia,
        cap: body.mittenteCap,
      },
      destinatario: {
        città: body.destinatarioCitta,
        provincia: body.destinatarioProvincia,
        cap: body.destinatarioCap,
      },
    });

    // ⚠️ NORMALIZZAZIONE PAYLOAD: Sanitizza e normalizza prima dell'INSERT
    // 1. Recupera ruolo utente per sanitizzazione
    let userRole: string | undefined = (session.user as any).role;
    let accountType: string | undefined = (session.user as any).account_type;
    
    // Se non disponibile in session, recupera da database
    if (!accountType) {
      try {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('role, account_type')
          .eq('email', session.user.email)
          .single();
        
        if (userData) {
          userRole = userData.role || userRole;
          accountType = userData.account_type || accountType;
        }
      } catch (error) {
        console.warn('⚠️ [API] Errore recupero ruolo utente:', error);
      }
    }
    
    // 2. Sanitizza payload in base al ruolo
    const sanitizedPayload = sanitizeShipmentPayloadByRole(spedizione, userRole, accountType);
    
    // ⚠️ FIX CRITICO: Mappa campi nested PRIMA di normalizzare
    // Frontend invia: { mittente: { citta, provincia, cap }, destinatario: { ... } }
    // DB richiede: { sender_city, sender_province, sender_zip, recipient_city, ... }
    if (sanitizedPayload.mittente && typeof sanitizedPayload.mittente === 'object') {
      // ⚠️ FIX: Mappa TUTTI i campi mittente, non solo city/province/zip
      sanitizedPayload.sender_name = sanitizedPayload.mittente.nome || sanitizedPayload.mittente.name || null;
      sanitizedPayload.sender_address = sanitizedPayload.mittente.indirizzo || sanitizedPayload.mittente.address || null;
      sanitizedPayload.sender_city = sanitizedPayload.mittente.citta || sanitizedPayload.mittente.città || sanitizedPayload.mittente.city || null;
      sanitizedPayload.sender_province = sanitizedPayload.mittente.provincia || sanitizedPayload.mittente.province || null;
      sanitizedPayload.sender_postal_code = sanitizedPayload.mittente.cap || sanitizedPayload.mittente.zip || sanitizedPayload.mittente.postal_code || null;
      sanitizedPayload.sender_phone = sanitizedPayload.mittente.telefono || sanitizedPayload.mittente.phone || null;
      sanitizedPayload.sender_email = sanitizedPayload.mittente.email || null;
      // COMPAT: Mantieni anche sender_zip per retrocompatibilità
      sanitizedPayload.sender_zip = sanitizedPayload.sender_postal_code;
      console.log('📋 [PRE-NORMALIZE] Mappati campi mittente:', {
        sender_name: sanitizedPayload.sender_name,
        sender_address: sanitizedPayload.sender_address,
        sender_city: sanitizedPayload.sender_city,
        sender_province: sanitizedPayload.sender_province,
        sender_postal_code: sanitizedPayload.sender_postal_code,
        sender_phone: sanitizedPayload.sender_phone,
        sender_email: sanitizedPayload.sender_email,
      });
      // Elimina oggetto mittente dopo mapping
      delete sanitizedPayload.mittente;
    }
    
    if (sanitizedPayload.destinatario && typeof sanitizedPayload.destinatario === 'object') {
      // ⚠️ FIX: Mappa TUTTI i campi destinatario, non solo city/province/zip
      sanitizedPayload.recipient_name = sanitizedPayload.destinatario.nome || sanitizedPayload.destinatario.name || null;
      sanitizedPayload.recipient_address = sanitizedPayload.destinatario.indirizzo || sanitizedPayload.destinatario.address || null;
      sanitizedPayload.recipient_city = sanitizedPayload.destinatario.citta || sanitizedPayload.destinatario.città || sanitizedPayload.destinatario.city || null;
      sanitizedPayload.recipient_province = sanitizedPayload.destinatario.provincia || sanitizedPayload.destinatario.province || null;
      sanitizedPayload.recipient_postal_code = sanitizedPayload.destinatario.cap || sanitizedPayload.destinatario.zip || sanitizedPayload.destinatario.postal_code || null;
      sanitizedPayload.recipient_phone = sanitizedPayload.destinatario.telefono || sanitizedPayload.destinatario.phone || null;
      sanitizedPayload.recipient_email = sanitizedPayload.destinatario.email || null;
      // COMPAT: Mantieni anche recipient_zip per retrocompatibilità
      sanitizedPayload.recipient_zip = sanitizedPayload.recipient_postal_code;
      console.log('📋 [PRE-NORMALIZE] Mappati campi destinatario:', {
        recipient_name: sanitizedPayload.recipient_name,
        recipient_address: sanitizedPayload.recipient_address,
        recipient_city: sanitizedPayload.recipient_city,
        recipient_province: sanitizedPayload.recipient_province,
        recipient_postal_code: sanitizedPayload.recipient_postal_code,
        recipient_phone: sanitizedPayload.recipient_phone,
        recipient_email: sanitizedPayload.recipient_email,
      });
      // Elimina oggetto destinatario dopo mapping
      delete sanitizedPayload.destinatario;
    }
    
    // 3. Normalizza payload (rimuove undefined, normalizza tipi, serializza JSONB)
    const normalizedPayload = normalizeShipmentPayload(sanitizedPayload);
    
    // ⚠️ LOGGING SICURO: Log struttura payload senza esporre dati sensibili
    const safePayload = Object.keys(normalizedPayload).reduce((acc, key) => {
      const sensitiveFields = ['email', 'phone', 'api_key', 'api_secret', 'password', 'token', 'secret'];
      const isSensitive = sensitiveFields.some(field => key.toLowerCase().includes(field));
      
      const value = normalizedPayload[key];
      if (isSensitive) {
        acc[key] = '[REDACTED]';
      } else if (value === null || value === undefined) {
        acc[key] = null;
      } else if (typeof value === 'object' && value !== null) {
        acc[key] = '[JSONB]'; // Indica JSONB, non "[OBJECT]"
      } else if (typeof value === 'string' && value.length > 50) {
        acc[key] = `${value.substring(0, 20)}... (${value.length} chars)`;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    console.log('📋 [API] Payload normalizzato (struttura):', {
      fields_count: Object.keys(normalizedPayload).length,
      is_superadmin: accountType === 'superadmin',
      has_admin_fields: !!(normalizedPayload.created_by_admin_id),
      structure: safePayload
    });
    
    // Salva nel database (SOLO Supabase)
    let createdShipment: any = null;
    try {
      const authContext = await createAuthContextFromSession(session);
      // Usa payload normalizzato invece di spedizione originale
      createdShipment = await addSpedizione(normalizedPayload, authContext);
      console.log('✅ [API] Spedizione creata con ID:', createdShipment.id);
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
        
        // ⚠️ CRITICO: Verifica shipmentId PRIMA di tutto
        const shipmentIdDirect = (ldvResult as any).shipmentId;
        const shipmentIdMetadata = ldvResult.metadata?.shipmentId || ldvResult.metadata?.increment_id;
        const shipmentId = shipmentIdDirect || shipmentIdMetadata;
        
        console.log('🔍 [API] ⚠️⚠️⚠️ VERIFICA SHIPMENTID ⚠️⚠️⚠️:', {
          shipmentId_diretto: shipmentIdDirect || 'NON TROVATO',
          shipmentId_metadata: shipmentIdMetadata || 'NON TROVATO',
          shipmentId_finale: shipmentId || 'NON TROVATO',
          has_metadata: !!ldvResult.metadata,
          metadata_keys: ldvResult.metadata ? Object.keys(ldvResult.metadata) : [],
          result_keys: Object.keys(ldvResult),
        });
        
        console.log('📦 [API] Dettagli risultato orchestrator:', {
          has_tracking: !!ldvResult.tracking_number,
          has_label_url: !!ldvResult.label_url,
          has_label_pdf: !!ldvResult.label_pdf,
          has_metadata: !!ldvResult.metadata,
          metadata_keys: ldvResult.metadata ? Object.keys(ldvResult.metadata) : [],
          method: ldvResult.method,
          // ⚠️ DEBUG: Verifica shipmentId nel metadata
          shipmentId_in_metadata: shipmentId || 'NON TROVATO',
          metadata_content: ldvResult.metadata ? JSON.stringify(ldvResult.metadata).substring(0, 200) : 'null',
        });
        
        // ⚠️ PERSISTENZA: Salva LDV, tracking e metadata in shipments SOLO se orchestrator ha successo
        if (createdShipment?.id) {
          try {
            // Prepara dati da aggiornare
            const updateData: any = {
              updated_at: new Date().toISOString(),
            };
            
            // Aggiorna tracking_number se fornito dall'orchestrator
            if (ldvResult.tracking_number) {
              updateData.tracking_number = ldvResult.tracking_number;
              updateData.ldv = ldvResult.tracking_number; // LDV = tracking number
            }
            
            // Aggiorna external_tracking_number se presente (es. Poste waybill_number)
            if (ldvResult.metadata?.waybill_number) {
              updateData.external_tracking_number = ldvResult.metadata.waybill_number;
            }
            
            // ⚠️ FIX P0: Salva SEMPRE label_data se abbiamo label_pdf (base64)
            // Questo è necessario per avere sempre l'etichetta originale disponibile per il download
            // Anche se c'è label_url, salviamo label_data come backup (l'URL potrebbe scadere)
            if (ldvResult.label_pdf) {
              if (Buffer.isBuffer(ldvResult.label_pdf)) {
                // Converti Buffer in base64 string per salvare in database
                updateData.label_data = ldvResult.label_pdf.toString('base64');
                console.log('💾 [API] Salvato label_pdf come label_data (base64, size:', ldvResult.label_pdf.length, 'bytes)');
              } else if (typeof ldvResult.label_pdf === 'string') {
                // Già base64 string
                updateData.label_data = ldvResult.label_pdf;
                console.log('💾 [API] Salvato label_pdf come label_data (già base64)');
              }
            }
            
            // ⚠️ FIX P0: Salva SEMPRE metadata se spedizione ha successo
            // Questo è necessario per il download della LDV originale dal corriere
            // Anche se label_url non è disponibile, salviamo comunque le info per tracciabilità
            // ⚠️ CRITICO: Usa JSON.stringify per assicurarsi che Supabase accetti il JSONB
            if (body.corriere === 'Poste Italiane') {
              // Per Poste, salva come poste_metadata (se esiste colonna) o metadata
              const posteMetadata = {
                poste_account_id: ldvResult.metadata?.poste_account_id || null,
                poste_product_code: ldvResult.metadata?.poste_product_code || null,
                waybill_number: ldvResult.metadata?.waybill_number || null,
                label_pdf_url: ldvResult.metadata?.label_pdf_url || ldvResult.label_url || null,
                carrier: 'Poste Italiane',
                method: ldvResult.method || 'unknown',
                has_label_pdf: !!ldvResult.label_pdf, // Flag per indicare se abbiamo PDF base64
                created_at: new Date().toISOString(), // Timestamp per tracciabilità
              };
              // Rimuovi chiavi null per evitare oggetto troppo grande
              Object.keys(posteMetadata).forEach(key => {
                if ((posteMetadata as any)[key] === null) delete (posteMetadata as any)[key];
              });
              updateData.metadata = posteMetadata;
            } else {
              // Per altri corrieri, salva come carrier_metadata generico
              const carrierMetadata = {
                ...(ldvResult.metadata || {}),
                carrier: body.corriere || 'GLS',
                method: ldvResult.method || 'unknown',
                label_url: ldvResult.label_url || null, // ⚠️ CRITICO: URL etichetta originale (può essere null)
                has_label_pdf: !!ldvResult.label_pdf, // Flag per indicare se abbiamo PDF base64
                created_at: new Date().toISOString(), // Timestamp per tracciabilità
              };
              // Rimuovi chiavi null per evitare oggetto troppo grande
              Object.keys(carrierMetadata).forEach(key => {
                if ((carrierMetadata as any)[key] === null) delete (carrierMetadata as any)[key];
              });
              updateData.metadata = carrierMetadata;
            }
            
            // ⚠️ FIX CRITICO: Salva shipmentId per TUTTI i corrieri (incluso Poste Italiane)
            // Prima era dentro il blocco else e non veniva eseguito per Poste Italiane!
            // Secondo openapi.json: POST /shipping/create restituisce "shipmentId" che è l'increment_id per cancellazione
            // ⚠️ CRITICO: Cerca shipmentId in ordine: direttamente nel risultato > metadata.shipmentId > metadata.increment_id
            const shipmentId = (ldvResult as any).shipmentId || // PRIORITÀ 1: Direttamente nel risultato
                               ldvResult.metadata?.shipmentId || // PRIORITÀ 2: Nel metadata
                               ldvResult.metadata?.increment_id || // PRIORITÀ 3: Alias nel metadata
                               null;
            
            console.log('🔍 [API] DEBUG shipmentId extraction (per TUTTI i corrieri):', {
              corriere: body.corriere,
              has_metadata: !!ldvResult.metadata,
              metadata_type: typeof ldvResult.metadata,
              metadata_keys: ldvResult.metadata ? Object.keys(ldvResult.metadata) : [],
              shipmentId_from_metadata: shipmentId || 'NON TROVATO',
              has_shipmentId_in_result: !!(ldvResult as any).shipmentId,
              metadata_content: ldvResult.metadata ? JSON.stringify(ldvResult.metadata).substring(0, 300) : 'null',
              full_result_keys: Object.keys(ldvResult),
            });
            
            if (shipmentId) {
              updateData.shipment_id_external = String(shipmentId);
              console.log('💾 [API] ✅ Salvato shipmentId (increment_id) come shipment_id_external:', updateData.shipment_id_external);
            } else {
              // ⚠️ FALLBACK: Se shipmentId non è nel risultato, prova a estrarlo dal tracking number
              const trackingForExtraction = ldvResult.tracking_number || trackingNumber;
              if (trackingForExtraction) {
                const trackingMatch = trackingForExtraction.match(/(\d+)$/);
                if (trackingMatch) {
                  const extractedShipmentId = trackingMatch[1];
                  updateData.shipment_id_external = extractedShipmentId;
                  console.warn('⚠️ [API] shipmentId NON nel risultato, estratto dal tracking come fallback:', {
                    extracted_shipment_id: extractedShipmentId,
                    tracking: trackingForExtraction,
                    corriere: body.corriere,
                    warning: 'Questo potrebbe non essere corretto se il tracking number non contiene l\'increment_id reale',
                  });
                } else {
                  console.error('❌ [API] shipmentId NON TROVATO e impossibile estrarlo dal tracking - cancellazione futura NON funzionerà!');
                  console.error('❌ [API] Corriere:', body.corriere);
                  console.error('❌ [API] Metadata completo:', JSON.stringify(ldvResult.metadata || {}, null, 2));
                  console.error('❌ [API] Risultato completo (chiavi):', Object.keys(ldvResult));
                }
              } else {
                console.error('❌ [API] shipmentId NON TROVATO e tracking number non disponibile - cancellazione futura NON funzionerà!');
                console.error('❌ [API] Corriere:', body.corriere);
                console.error('❌ [API] Metadata completo:', JSON.stringify(ldvResult.metadata || {}, null, 2));
                console.error('❌ [API] Risultato completo (chiavi):', Object.keys(ldvResult));
              }
            }
            
            console.log('💾 [API] Metadata preparato per salvataggio:', {
              has_label_url: !!updateData.metadata.label_url || !!updateData.metadata.label_pdf_url,
              has_label_pdf_flag: !!updateData.metadata.has_label_pdf,
              method: updateData.metadata.method,
              carrier: updateData.metadata.carrier,
            });
            
            // ⚠️ LOGGING SICURO: Log struttura update senza dati sensibili
            const safeUpdate = Object.keys(updateData).reduce((acc, key) => {
              const sensitiveFields = ['api_key', 'api_secret', 'password', 'token', 'secret', 'credential'];
              const isSensitive = sensitiveFields.some(field => key.toLowerCase().includes(field));
              
              const value = updateData[key];
              if (isSensitive) {
                acc[key] = '[REDACTED]';
              } else if (typeof value === 'object' && value !== null) {
                acc[key] = '[JSONB]';
              } else {
                acc[key] = value;
              }
              return acc;
            }, {} as any);
            
            console.log('💾 [API] Aggiornamento spedizione con dati orchestrator:', {
              shipment_id: createdShipment.id.substring(0, 8) + '...',
              has_tracking: !!updateData.tracking_number,
              has_ldv: !!updateData.ldv,
              has_metadata: !!updateData.metadata,
              update_structure: safeUpdate
            });
            
            // Esegui UPDATE idempotente (usa ID come chiave)
            console.log('💾 [API] Eseguo UPDATE spedizione con:', {
              shipment_id: createdShipment.id.substring(0, 8) + '...',
              has_tracking: !!updateData.tracking_number,
              has_ldv: !!updateData.ldv,
              has_metadata: !!updateData.metadata,
              has_shipment_id_external: !!updateData.shipment_id_external, // ⚠️ CRITICO per cancellazione
              shipment_id_external: updateData.shipment_id_external || 'NON SALVATO!',
              metadata_label_url: updateData.metadata?.label_url || updateData.metadata?.label_pdf_url || 'NON DISPONIBILE',
            });
            
            const { data: updatedShipment, error: updateError } = await supabaseAdmin
              .from('shipments')
              .update(updateData)
              .eq('id', createdShipment.id)
              .select('id, tracking_number, ldv, external_tracking_number, metadata, label_data')
              .single();
            
            if (updateError) {
              console.error('❌ [API] Errore aggiornamento spedizione con dati orchestrator:', {
                shipment_id: createdShipment.id,
                error: updateError.message,
                details: updateError.details,
                code: updateError.code,
                hint: updateError.hint,
              });
              // Non bloccare la risposta - spedizione già creata
            } else {
              console.log('✅ [API] Spedizione aggiornata con dati orchestrator:', {
                shipment_id: updatedShipment.id.substring(0, 8) + '...',
                tracking_number: updatedShipment.tracking_number,
                has_ldv: !!updatedShipment.ldv,
                has_metadata: !!updatedShipment.metadata,
                metadata_keys: updatedShipment.metadata ? Object.keys(updatedShipment.metadata) : [],
                metadata_label_url: updatedShipment.metadata?.label_url || updatedShipment.metadata?.label_pdf_url || 'NON DISPONIBILE',
              });
              
              // Aggiorna oggetto spedizione per risposta
              spedizione.tracking = updatedShipment.tracking_number || spedizione.tracking;
              spedizione.ldv = updatedShipment.ldv || spedizione.ldv;
              spedizione.external_tracking_number = updatedShipment.external_tracking_number || spedizione.external_tracking_number;
              spedizione.metadata = updatedShipment.metadata || spedizione.metadata;
            }
          } catch (updateError: any) {
            console.error('❌ [API] Errore durante aggiornamento spedizione:', updateError.message);
            // Non bloccare la risposta - spedizione già creata
          }
        } else {
          console.warn('⚠️ [API] Impossibile aggiornare spedizione: ID non disponibile');
        }
      } else {
        console.warn('⚠️ Creazione LDV fallita (non critico):', ldvResult.error);
      }
    } catch (error) {
      // Non bloccare la risposta se la creazione LDV fallisce
      console.warn('⚠️ Errore creazione LDV (non critico):', error);
    }

    // Risposta di successo
    // ⚠️ FIX: Converti label_pdf Buffer in base64 per serializzazione JSON
    let ldvResultSafe: any = ldvResult;
    if (ldvResult && ldvResult.label_pdf && Buffer.isBuffer(ldvResult.label_pdf)) {
      ldvResultSafe = {
        ...ldvResult,
        label_pdf: ldvResult.label_pdf.toString('base64'),
        label_pdf_base64: true, // Flag per indicare al frontend che è base64
      } as any;
      console.log('📄 [API] label_pdf convertito in base64 per frontend (size:', ldvResult.label_pdf.length, 'bytes)');
    }
    
    return NextResponse.json(
      {
        success: true,
        message: 'Spedizione creata con successo',
        data: spedizione,
        ldv: ldvResultSafe, // Info creazione LDV (orchestrator)
      },
      { status: 201 }
    );
  } catch (error) {
    const userId = session?.user?.id;
    return handleApiError(error, 'POST /api/spedizioni', requestId, userId);
  }
}

/**
 * Handler DELETE - Soft delete spedizione
 * 
 * ⚠️ CRITICO: Usa SOLO Supabase - nessun fallback JSON
 * ⚠️ INTEGRAZIONE: Cancella anche su Spedisci.Online se configurato
 */
export async function DELETE(request: NextRequest) {
  const requestId = getRequestId(request);
  const logger = await createApiLogger(request);
  let session: any = null;
  
  try {
    logger.info('DELETE /api/spedizioni - Richiesta eliminazione spedizione');
    
    // Autenticazione
    session = await auth();

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

    // ⚠️ PRIMA: Recupera la spedizione per avere il tracking number E shipment_id_external
    const { data: shipmentData, error: fetchError } = await supabaseAdmin
      .from('shipments')
      .select('id, tracking_number, ldv, user_id, shipment_id_external')
      .eq('id', id)
      .eq('deleted', false)
      .single();

    if (fetchError || !shipmentData) {
      console.error('❌ [SUPABASE] Spedizione non trovata:', fetchError?.message);
      return NextResponse.json({ error: 'Spedizione non trovata o già eliminata' }, { status: 404 });
    }

    const trackingNumber = shipmentData.tracking_number || shipmentData.ldv;
    const shipmentIdExternal = shipmentData.shipment_id_external;
    let spedisciOnlineCancelResult: any = null;

    // ⚠️ DEBUG: Log dati recuperati per verificare che non siano vuoti
    console.log('🗑️ [DELETE] Dati spedizione recuperati:', {
      tracking_number: shipmentData.tracking_number,
      ldv: shipmentData.ldv,
      final_tracking: trackingNumber,
      shipment_id_external: shipmentIdExternal,
      isEmpty: !trackingNumber || trackingNumber.trim() === '',
      hasShipmentIdExternal: !!(shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN'),
      warning: !shipmentIdExternal || shipmentIdExternal === 'UNKNOWN' 
        ? '⚠️ ATTENZIONE: shipment_id_external non disponibile, verrà estratto increment_id dal tracking (potrebbe non essere corretto)'
        : '✅ shipment_id_external disponibile, verrà usato direttamente',
    });

    // ⚠️ INTEGRAZIONE SPEDISCI.ONLINE: Cancella su piattaforma esterna
    // Prova a cancellare se abbiamo shipment_id_external O tracking_number
    const canCancelRemotely = (shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN') || 
                              (trackingNumber && trackingNumber.trim() !== '');
    
    if (canCancelRemotely) {
      try {
        console.log('🗑️ [API] Tentativo cancellazione su Spedisci.Online:', {
          shipmentIdExternal,
          trackingNumber,
          method: shipmentIdExternal ? 'by_id' : 'by_tracking',
        });
      
        // ⚠️ FIX: Recupera configurazione Spedisci.Online usando funzione RPC
        // PRIORITÀ 1: Configurazione dell'utente che cancella (se è reseller/proprietario)
        // PRIORITÀ 2: Configurazione del proprietario della spedizione
        // PRIORITÀ 3: Configurazione globale (is_default = true)
        
        let configData: any = null;
        
        // 1. Verifica se l'utente che cancella è un reseller e recupera la sua configurazione
        const { data: currentUserData } = await supabaseAdmin
          .from('users')
          .select('id, email, is_reseller')
          .eq('email', session.user.email)
          .single();
        
        const currentUserId = currentUserData?.id || supabaseUserId;
        
        // Prova vari provider_id possibili (spediscionline, spedisci_online, spedisci-online)
        const possibleProviderIds = ['spediscionline', 'spedisci_online', 'spedisci-online'];
        
        if (currentUserId) {
          // Prova prima con l'utente che cancella
          for (const providerId of possibleProviderIds) {
            const { data: userConfig, error: userConfigError } = await supabaseAdmin.rpc('get_courier_config_for_user', {
              p_user_id: currentUserId,
              p_provider_id: providerId,
            });
            
            if (userConfigError) {
              console.warn(`⚠️ [API] Errore RPC per ${providerId}:`, userConfigError.message);
            } else if (userConfig && userConfig.length > 0) {
              configData = userConfig[0];
              console.log('✅ [API] Usando configurazione utente che cancella:', {
                email: session.user.email,
                provider_id: providerId,
                owner_user_id: configData.owner_user_id ? 'presente' : 'null',
              });
              break;
            }
          }
        }
        
        // 2. Se non trovata, usa configurazione del proprietario della spedizione
        if (!configData) {
          const shipmentOwnerId = shipmentData.user_id;
          if (shipmentOwnerId && shipmentOwnerId !== currentUserId) {
            for (const providerId of possibleProviderIds) {
              const { data: ownerConfig, error: ownerConfigError } = await supabaseAdmin.rpc('get_courier_config_for_user', {
                p_user_id: shipmentOwnerId,
                p_provider_id: providerId,
              });
              
              if (ownerConfigError) {
                console.warn(`⚠️ [API] Errore RPC per proprietario ${providerId}:`, ownerConfigError.message);
              } else if (ownerConfig && ownerConfig.length > 0) {
                configData = ownerConfig[0];
                console.log('✅ [API] Usando configurazione proprietario spedizione:', {
                  user_id: shipmentOwnerId.substring(0, 8) + '...',
                  provider_id: providerId,
                  owner_user_id: configData.owner_user_id ? 'presente' : 'null',
                });
                break;
              }
            }
          }
        }
        
        // 3. Fallback: configurazione globale (is_default = true)
        if (!configData) {
          for (const providerId of possibleProviderIds) {
            const { data: globalConfig } = await supabaseAdmin
              .from('courier_configs')
              .select('api_key, base_url, contract_mapping')
              .eq('provider_id', providerId)
              .eq('is_default', true)
              .eq('is_active', true)
              .maybeSingle();
            
            if (globalConfig) {
              configData = globalConfig;
              console.log('✅ [API] Usando configurazione globale (default) per cancellazione:', providerId);
              break;
            }
          }
          
          if (!configData) {
            console.log('⚠️ [API] Nessuna configurazione globale trovata per Spedisci.Online (provati:', possibleProviderIds.join(', '), ')');
          }
        }
        
        // Log stato configurazione
        if (!configData) {
          console.log('ℹ️ [API] Spedisci.Online non configurato, skip cancellazione remota');
        } else if (!configData.api_key) {
          console.warn('⚠️ [API] Configurazione Spedisci.Online trovata ma API key mancante');
        } else {
          console.log('✅ [API] Configurazione Spedisci.Online trovata, procedo con cancellazione');
          
          // Decripta api_key se necessario
          const { isEncrypted, decryptCredential } = await import('@/lib/security/encryption');
          let apiKey = configData.api_key;
          
          if (isEncrypted(apiKey)) {
            try {
              apiKey = decryptCredential(apiKey);
              console.log('🔓 [API] API key decriptata per cancellazione');
            } catch (decryptError: any) {
              console.error('❌ [API] Errore decriptazione API key:', decryptError?.message);
              throw new Error('Impossibile decriptare le credenziali API');
            }
          }
          
          // ⚠️ FIX: Usa sempre SpedisciOnlineAdapter con cancelShipmentOnPlatform
          // Priorità: shipment_id_external (increment_id) > tracking_number
          const { SpedisciOnlineAdapter } = await import('@/lib/adapters/couriers/spedisci-online');
          
          const adapter = new SpedisciOnlineAdapter({
            api_key: apiKey,
            base_url: configData.base_url || 'https://api.spedisci.online/api/v2',
          });
          
          // ⚠️ PRIORITÀ: Usa shipment_id_external (increment_id) se disponibile, altrimenti tracking_number
          // Se shipment_id_external è null, il metodo cancelShipmentOnPlatform proverà a recuperarlo da Spedisci.Online
          const idToCancel = (shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN') 
            ? shipmentIdExternal 
            : trackingNumber;
          
          console.log('🗑️ [API] Cancellazione Spedisci.Online:', {
            idToCancel,
            method: (shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN') ? 'by_increment_id' : 'by_tracking_with_fallback',
            shipmentIdExternal: shipmentIdExternal || 'null',
            trackingNumber: trackingNumber || 'null',
            note: shipmentIdExternal ? 'Usando shipment_id_external diretto' : 'Proverà a recuperare increment_id da Spedisci.Online, poi fallback su estrazione dal tracking',
          });
          
          spedisciOnlineCancelResult = await adapter.cancelShipmentOnPlatform(idToCancel);
          
          if (spedisciOnlineCancelResult.success) {
            const method = (shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN') ? 'by increment_id' : 'by tracking';
            const hasDirectId = !!(shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN');
            console.log(`✅ [API] Spedizione cancellata su Spedisci.Online (${method}):`, {
              idToCancel,
              method,
              hasDirectId,
              message: spedisciOnlineCancelResult.message,
            });
            
            // ⚠️ FALLBACK: Se la cancellazione è riuscita ma shipment_id_external era null,
            // salva l'increment_id estratto per le prossime volte (se disponibile)
            if (!hasDirectId && trackingNumber) {
              try {
                // Estrai increment_id dal tracking (stessa logica usata in cancelShipmentOnPlatform)
                const trackingMatch = trackingNumber.match(/(\d+)$/);
                if (trackingMatch) {
                  const extractedIncrementId = trackingMatch[1];
                  console.log('💾 [API] Salvo increment_id estratto come fallback per prossime volte:', {
                    shipment_id: id,
                    extracted_increment_id: extractedIncrementId,
                    tracking: trackingNumber,
                  });
                  
                  // Salva come shipment_id_external per le prossime volte
                  await supabaseAdmin
                    .from('shipments')
                    .update({
                      shipment_id_external: extractedIncrementId,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', id);
                  
                  console.log('✅ [API] shipment_id_external salvato come fallback');
                }
              } catch (fallbackError: any) {
                console.warn('⚠️ [API] Errore salvataggio fallback shipment_id_external:', fallbackError?.message);
                // Non bloccare il flusso
              }
            }
          } else {
            const method = (shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN') ? 'increment_id' : 'tracking';
            const hasDirectId = !!(shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN');
            
            // ⚠️ CRITICO: Se la cancellazione fallisce e non abbiamo shipment_id_external,
            // la spedizione potrebbe esistere ancora su Spedisci.Online
            if (!hasDirectId && spedisciOnlineCancelResult.error?.includes('increment_id estratto')) {
              console.error(`❌ [API] CRITICO: Cancellazione fallita - la spedizione potrebbe esistere ancora su Spedisci.Online!`, {
                idToCancel,
                method,
                error: spedisciOnlineCancelResult.error,
                action_required: 'Verifica manualmente su Spedisci.Online e cancella se necessario',
                reason: 'shipment_id_external non disponibile, increment_id estratto dal tracking potrebbe non corrispondere',
                tracking_number: trackingNumber,
                suggestion: 'L\'increment_id estratto dal tracking number potrebbe non corrispondere all\'increment_id reale su Spedisci.Online. Verifica manualmente la spedizione su Spedisci.Online usando il tracking number.',
              });
            } else {
              console.warn(`⚠️ [API] Cancellazione per ${method} fallita:`, {
                idToCancel,
                method,
                error: spedisciOnlineCancelResult.error,
              });
            }
          }
        }
      } catch (cancelError: any) {
        console.warn('⚠️ [API] Errore cancellazione Spedisci.Online:', cancelError?.message);
        spedisciOnlineCancelResult = {
          success: false,
          error: cancelError?.message || 'Errore durante la cancellazione',
        };
        // Non blocchiamo il soft delete locale
      }
    } else {
      console.log('⚠️ [API] Nessun identificativo disponibile per cancellazione remota');
    }

    // Soft delete - aggiorna spedizione in Supabase con tracking completo
    // ⚠️ FIX: Aggiungi deleted_by_user_email per tracciabilità completa
    const { data, error } = await supabaseAdmin
      .from('shipments')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by_user_id: supabaseUserId,
        deleted_by_user_email: session.user.email, // ⚠️ NUOVO: Traccia chi ha cancellato
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
      spedisciOnline: spedisciOnlineCancelResult ? {
        cancelled: spedisciOnlineCancelResult.success,
        message: spedisciOnlineCancelResult.message || spedisciOnlineCancelResult.error,
      } : null,
    });
  } catch (error) {
    const userId = session?.user?.id;
    return handleApiError(error, 'DELETE /api/spedizioni', requestId, userId);
  }
}