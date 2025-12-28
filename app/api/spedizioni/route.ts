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
            
            // Salva metadata come JSONB (carrier_metadata o poste_metadata)
            if (ldvResult.metadata) {
              // Normalizza metadata per schema Supabase
              if (body.corriere === 'Poste Italiane') {
                // Per Poste, salva come poste_metadata (se esiste colonna) o metadata
                updateData.metadata = {
                  poste_account_id: ldvResult.metadata.poste_account_id,
                  poste_product_code: ldvResult.metadata.poste_product_code,
                  waybill_number: ldvResult.metadata.waybill_number,
                  label_pdf_url: ldvResult.metadata.label_pdf_url,
                  carrier: 'Poste Italiane',
                  method: ldvResult.method,
                };
              } else {
                // Per altri corrieri, salva come carrier_metadata generico
                updateData.metadata = {
                  ...ldvResult.metadata,
                  carrier: body.corriere || 'GLS',
                  method: ldvResult.method,
                  label_url: ldvResult.label_url,
                };
              }
            }
            
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
            const { data: updatedShipment, error: updateError } = await supabaseAdmin
              .from('shipments')
              .update(updateData)
              .eq('id', createdShipment.id)
              .select('id, tracking_number, ldv, external_tracking_number, metadata')
              .single();
            
            if (updateError) {
              console.error('❌ [API] Errore aggiornamento spedizione con dati orchestrator:', {
                shipment_id: createdShipment.id,
                error: updateError.message,
                details: updateError.details
              });
              // Non bloccare la risposta - spedizione già creata
            } else {
              console.log('✅ [API] Spedizione aggiornata con dati orchestrator:', {
                shipment_id: updatedShipment.id.substring(0, 8) + '...',
                tracking_number: updatedShipment.tracking_number,
                has_ldv: !!updatedShipment.ldv,
                has_metadata: !!updatedShipment.metadata
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
    const userId = session?.user?.id;
    return handleApiError(error, 'DELETE /api/spedizioni', requestId, userId);
  }
}