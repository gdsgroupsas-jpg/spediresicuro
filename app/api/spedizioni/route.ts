/**
 * API Route: Gestione Spedizioni
 *
 * Endpoint: POST /api/spedizioni
 *
 * Crea una nuova spedizione e la salva nel database locale (JSON).
 * In futuro verrà migrato a Supabase/PostgreSQL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth, requireWorkspaceAuth } from '@/lib/workspace-auth';
import { addSpedizione, getSpedizioni } from '@/lib/database';
import type { AuthContext } from '@/lib/auth-context';
import { createApiLogger, getRequestId } from '@/lib/api-helpers';
import { handleApiError } from '@/lib/api-responses';
import { supabaseAdmin } from '@/lib/db/client';
import { withRateLimit } from '@/lib/security/rate-limit-middleware';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import { createShipmentCore } from '@/lib/shipments/create-shipment-core';
import { getCourierClientReal } from '@/lib/shipments/get-courier-client';
import { convertLegacyPayload } from '@/lib/shipments/convert-legacy-payload';
import { createShipmentSchema } from '@/lib/validations/shipment';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';
import { writeShipmentAuditLog } from '@/lib/security/audit-log';

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
  const isSuperAdmin =
    accountType === 'superadmin' || userRole === 'superadmin' || userRole === 'SUPERADMIN';

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
          console.warn(
            `⚠️ [NORMALIZE] Campo UUID ${key} è un oggetto non valido, convertito in null`
          );
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
      console.warn(
        `⚠️ [NORMALIZE] Campo ${key} è un oggetto non JSONB, rimosso per evitare "[OBJECT]"`
      );
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
    session = await getWorkspaceAuth();

    if (!session?.actor?.email) {
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
        // Converti ActingContext in AuthContext per getSpedizioni
        // NOTA: Usa target per operazioni business (supporta impersonation)
        const authContext: AuthContext = {
          type: 'user',
          userId: session.target.id,
          userEmail: session.target.email || undefined,
          isAdmin: session.target.role === 'admin' || session.target.account_type === 'superadmin',
        };
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
              nome:
                spedizione.recipient_name ||
                spedizione.destinatarioNome ||
                spedizione.destinatario?.nome ||
                spedizione.nome ||
                spedizione.nominativo ||
                '',
              indirizzo:
                spedizione.recipient_address ||
                spedizione.destinatarioIndirizzo ||
                spedizione.destinatario?.indirizzo ||
                spedizione.indirizzo ||
                '',
              citta:
                spedizione.recipient_city ||
                spedizione.destinatarioCitta ||
                spedizione.destinatario?.citta ||
                spedizione.citta ||
                spedizione.localita ||
                '',
              provincia:
                spedizione.recipient_province ||
                spedizione.destinatarioProvincia ||
                spedizione.destinatario?.provincia ||
                spedizione.provincia ||
                '',
              cap:
                spedizione.recipient_postal_code ||
                spedizione.recipient_zip ||
                spedizione.destinatarioCap ||
                spedizione.destinatario?.cap ||
                spedizione.cap ||
                '',
              telefono:
                spedizione.recipient_phone ||
                spedizione.destinatarioTelefono ||
                spedizione.destinatario?.telefono ||
                spedizione.telefono ||
                '',
              email:
                spedizione.recipient_email ||
                spedizione.destinatarioEmail ||
                spedizione.destinatario?.email ||
                spedizione.email_dest ||
                spedizione.email ||
                '',
            },
        mittente: spedizione.mittente || {
          nome: spedizione.sender_name || spedizione.mittenteNome || 'Mittente Predefinito',
          indirizzo: spedizione.sender_address || spedizione.mittenteIndirizzo || '',
          citta: spedizione.sender_city || spedizione.mittenteCitta || '',
          provincia: spedizione.sender_province || spedizione.mittenteProvincia || '',
          cap:
            spedizione.sender_postal_code || spedizione.sender_zip || spedizione.mittenteCap || '',
          telefono: spedizione.sender_phone || spedizione.mittenteTelefono || '',
          email: spedizione.sender_email || spedizione.mittenteEmail || '',
        },
        // ⚠️ IMPORTANTE: Tracking - per ordini importati, ldv è il tracking
        // Per ordini creati dalla piattaforma, tracking è già presente
        tracking: spedizione.ldv || spedizione.tracking || '',
      };

      return NextResponse.json(
        {
          success: true,
          data: spedizioneNormalizzata,
        },
        { status: 200 }
      );
    }

    // Ottieni spedizioni filtrate per utente autenticato (multi-tenancy)
    let spedizioni: any[] = [];
    try {
      // Converti ActingContext in AuthContext per getSpedizioni
      const authContext: AuthContext = {
        type: 'user',
        userId: session.target.id,
        userEmail: session.target.email || undefined,
        isAdmin: session.target.role === 'admin' || session.target.account_type === 'superadmin',
      };
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
            nome:
              s.recipient_name ||
              s.destinatarioNome ||
              s.destinatario?.nome ||
              s.nome ||
              s.nominativo ||
              '',
            indirizzo:
              s.recipient_address ||
              s.destinatarioIndirizzo ||
              s.destinatario?.indirizzo ||
              s.indirizzo ||
              '',
            citta:
              s.recipient_city ||
              s.destinatarioCitta ||
              s.destinatario?.citta ||
              s.citta ||
              s.localita ||
              '',
            provincia:
              s.recipient_province ||
              s.destinatarioProvincia ||
              s.destinatario?.provincia ||
              s.provincia ||
              '',
            cap:
              s.recipient_postal_code ||
              s.recipient_zip ||
              s.destinatarioCap ||
              s.destinatario?.cap ||
              s.cap ||
              '',
            telefono:
              s.recipient_phone ||
              s.destinatarioTelefono ||
              s.destinatario?.telefono ||
              s.telefono ||
              '',
            email:
              s.recipient_email ||
              s.destinatarioEmail ||
              s.destinatario?.email ||
              s.email_dest ||
              s.email ||
              '',
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
    console.log(
      `📥 Spedizioni importate: ${spedizioniNormalizzate.filter((s: any) => s.imported).length}`
    );

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
 *
 * SICUREZZA: Delega INTERAMENTE a createShipmentCore (Single Source of Truth).
 * Converte payload legacy e usa lo stesso flusso di /api/shipments/create:
 * - Wallet debit OBBLIGATORIO (prima della chiamata corriere)
 * - Idempotency lock
 * - Validazione Zod
 * - Ricalcolo prezzo server-side
 *
 * Prima questo handler aveva 850+ righe di logica duplicata SENZA wallet debit.
 * Consolidato in data 2026-02-17 per eliminare il bypass critico.
 */
export async function POST(request: NextRequest) {
  // Rate limit
  const rl = await withRateLimit(request, 'spedizioni-create', { limit: 60, windowSeconds: 60 });
  if (rl) return rl;

  // Auth con supporto impersonation (come /api/shipments/create)
  const context = await requireWorkspaceAuth();

  try {
    const body = await request.json();

    // Converte payload legacy → formato standard (come /api/shipments/create)
    const convertedBody = convertLegacyPayload(body);

    // Validazione Zod (stessa di /api/shipments/create)
    const validated = createShipmentSchema.parse(convertedBody);

    // Resolve courier client
    const courierResult = await getCourierClientReal(supabaseAdmin, validated, {
      userId: context.target.id,
      configId: validated.configId || (body as any).configId,
    });

    // Delega a createShipmentCore (Single Source of Truth)
    // Include: wallet debit, idempotency lock, creazione etichetta, refund su errore
    const result = await createShipmentCore({
      context,
      validated,
      deps: {
        supabaseAdmin,
        getCourierClient: async () => courierResult.client,
        courierConfigId: courierResult.configId,
      },
    });

    // Audit log su successo
    if (result.status === 200 && result.json?.shipment) {
      try {
        await writeShipmentAuditLog(
          context,
          AUDIT_ACTIONS.CREATE_SHIPMENT,
          result.json.shipment.id,
          {
            carrier: validated.carrier,
            tracking_number: result.json.shipment.tracking_number,
            cost: result.json.shipment.cost,
            provider: validated.provider,
            source: 'legacy-api', // Traccia che è arrivato dalla route legacy
          }
        );
      } catch {
        // Fail-open: non bloccare se audit fallisce
      }
    }

    return Response.json(result.json, { status: result.status });
  } catch (error: any) {
    console.error('[POST /api/spedizioni] Errore:', error);

    // Errore di autenticazione
    if (
      error.message?.includes('UNAUTHORIZED') ||
      error.message?.includes('Authentication required')
    ) {
      return Response.json(
        { error: 'Non autenticato', message: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    // Errore di validazione Zod
    if (error.name === 'ZodError') {
      return Response.json({ error: 'Dati non validi', details: error.errors }, { status: 400 });
    }

    // Errore config non trovata
    if (error.message?.includes('Configurazione non trovata')) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    return Response.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ── Codice legacy POST rimosso (2026-02-17) ──
// Le 850+ righe di logica duplicata sono state sostituite dal thin wrapper sopra.
// Ora POST /api/spedizioni usa createShipmentCore (Single Source of Truth) come /api/shipments/create.
// Questo elimina il bypass wallet che permetteva spedizioni gratuite.
// ── Fine nota ──
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
    session = await getWorkspaceAuth();

    if (!session?.actor?.email) {
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
      supabaseUserId = await getSupabaseUserIdFromEmail(session.actor.email);
    } catch (error) {
      // Non critico se non trovato
      console.warn('⚠️ [SUPABASE] Impossibile ottenere user_id per soft delete:', error);
    }

    // ⚠️ PRIMA: Recupera la spedizione per avere il tracking number E shipment_id_external
    const { data: shipmentData, error: fetchError } = await supabaseAdmin
      .from('shipments')
      .select('id, tracking_number, ldv, user_id, shipment_id_external, final_price')
      .eq('id', id)
      .eq('deleted', false)
      .single();

    if (fetchError || !shipmentData) {
      console.error('❌ [SUPABASE] Spedizione non trovata:', fetchError?.message);
      return NextResponse.json(
        { error: 'Spedizione non trovata o già eliminata' },
        { status: 404 }
      );
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
      warning:
        !shipmentIdExternal || shipmentIdExternal === 'UNKNOWN'
          ? '⚠️ ATTENZIONE: shipment_id_external non disponibile, verrà estratto increment_id dal tracking (potrebbe non essere corretto)'
          : '✅ shipment_id_external disponibile, verrà usato direttamente',
    });

    // ⚠️ INTEGRAZIONE SPEDISCI.ONLINE: Cancella su piattaforma esterna
    // Prova a cancellare se abbiamo shipment_id_external O tracking_number
    const canCancelRemotely =
      (shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN') ||
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
          .eq('email', session.actor.email)
          .single();

        const currentUserId = currentUserData?.id || supabaseUserId;

        // Prova vari provider_id possibili (spediscionline, spedisci_online, spedisci-online)
        const possibleProviderIds = ['spediscionline', 'spedisci_online', 'spedisci-online'];

        if (currentUserId) {
          // Prova prima con l'utente che cancella
          for (const providerId of possibleProviderIds) {
            const { data: userConfig, error: userConfigError } = await supabaseAdmin.rpc(
              'get_courier_config_for_user',
              {
                p_user_id: currentUserId,
                p_provider_id: providerId,
              }
            );

            if (userConfigError) {
              console.warn(`⚠️ [API] Errore RPC per ${providerId}:`, userConfigError.message);
            } else if (userConfig && userConfig.length > 0) {
              configData = userConfig[0];
              console.log('✅ [API] Usando configurazione utente che cancella:', {
                email: session.actor.email,
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
              const { data: ownerConfig, error: ownerConfigError } = await supabaseAdmin.rpc(
                'get_courier_config_for_user',
                {
                  p_user_id: shipmentOwnerId,
                  p_provider_id: providerId,
                }
              );

              if (ownerConfigError) {
                console.warn(
                  `⚠️ [API] Errore RPC per proprietario ${providerId}:`,
                  ownerConfigError.message
                );
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
              console.log(
                '✅ [API] Usando configurazione globale (default) per cancellazione:',
                providerId
              );
              break;
            }
          }

          if (!configData) {
            console.log(
              '⚠️ [API] Nessuna configurazione globale trovata per Spedisci.Online (provati:',
              possibleProviderIds.join(', '),
              ')'
            );
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
          const idToCancel =
            shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN'
              ? shipmentIdExternal
              : trackingNumber;

          console.log('🗑️ [API] Cancellazione Spedisci.Online:', {
            idToCancel,
            method:
              shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN'
                ? 'by_increment_id'
                : 'by_tracking_with_fallback',
            shipmentIdExternal: shipmentIdExternal || 'null',
            trackingNumber: trackingNumber || 'null',
            note: shipmentIdExternal
              ? 'Usando shipment_id_external diretto'
              : 'Proverà a recuperare increment_id da Spedisci.Online, poi fallback su estrazione dal tracking',
          });

          spedisciOnlineCancelResult = await adapter.cancelShipmentOnPlatform(idToCancel);

          if (spedisciOnlineCancelResult.success) {
            const method =
              shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN'
                ? 'by increment_id'
                : 'by tracking';
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
                  console.log(
                    '💾 [API] Salvo increment_id estratto come fallback per prossime volte:',
                    {
                      shipment_id: id,
                      extracted_increment_id: extractedIncrementId,
                      tracking: trackingNumber,
                    }
                  );

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
                console.warn(
                  '⚠️ [API] Errore salvataggio fallback shipment_id_external:',
                  fallbackError?.message
                );
                // Non bloccare il flusso
              }
            }
          } else {
            const method =
              shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN' ? 'increment_id' : 'tracking';
            const hasDirectId = !!(shipmentIdExternal && shipmentIdExternal !== 'UNKNOWN');

            // ⚠️ CRITICO: Se la cancellazione fallisce e non abbiamo shipment_id_external,
            // la spedizione potrebbe esistere ancora su Spedisci.Online
            if (
              !hasDirectId &&
              spedisciOnlineCancelResult.error?.includes('increment_id estratto')
            ) {
              console.error(
                `❌ [API] CRITICO: Cancellazione fallita - la spedizione potrebbe esistere ancora su Spedisci.Online!`,
                {
                  idToCancel,
                  method,
                  error: spedisciOnlineCancelResult.error,
                  action_required:
                    'Verifica manualmente su Spedisci.Online e cancella se necessario',
                  reason:
                    'shipment_id_external non disponibile, increment_id estratto dal tracking potrebbe non corrispondere',
                  tracking_number: trackingNumber,
                  suggestion:
                    "L'increment_id estratto dal tracking number potrebbe non corrispondere all'increment_id reale su Spedisci.Online. Verifica manualmente la spedizione su Spedisci.Online usando il tracking number.",
                }
              );
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
        deleted_by_user_email: session.actor.email, // ⚠️ NUOVO: Traccia chi ha cancellato
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
        return NextResponse.json(
          { error: 'Spedizione non trovata o già eliminata' },
          { status: 404 }
        );
      }

      throw new Error(
        `Errore Supabase: ${error.message}${error.details ? ` - ${error.details}` : ''}`
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Spedizione non trovata o già eliminata' },
        { status: 404 }
      );
    }

    console.log(`✅ [SUPABASE] Spedizione ${id} eliminata con successo (soft delete)`);

    // ============================================
    // RIMBORSO WALLET: riaccredita final_price
    // ============================================
    let walletRefundResult: { success: boolean; amount?: number; error?: string } | null = null;
    const refundAmount = shipmentData.final_price;

    if (refundAmount && refundAmount > 0 && shipmentData.user_id) {
      try {
        // Verifica account_type: superadmin non paga dal wallet, quindi non riceve rimborso
        const { data: shipmentOwner } = await supabaseAdmin
          .from('users')
          .select('account_type')
          .eq('id', shipmentData.user_id)
          .maybeSingle();

        const ownerIsSuperadmin = shipmentOwner?.account_type?.toLowerCase() === 'superadmin';

        if (ownerIsSuperadmin) {
          console.log(
            'ℹ️ [WALLET] Skip rimborso: proprietario è superadmin (wallet non debitato alla creazione)'
          );
        } else {
          // ✨ FIX CONTABILE: Usa refund_wallet_balance con tipo SHIPMENT_REFUND
          // invece di increment_wallet_balance che registra come DEPOSIT
          const idempotencyKey = `cancel-${id}`;
          const trackingRef = shipmentData.tracking_number || shipmentData.ldv || '';
          const refundDescription = `Rimborso cancellazione spedizione ${trackingRef}`.trim();

          const cancelRefundWorkspaceId = await getUserWorkspaceId(shipmentData.user_id);
          const { data: refundResult, error: refundError } = await supabaseAdmin.rpc(
            'refund_wallet_balance',
            {
              p_user_id: shipmentData.user_id,
              p_amount: refundAmount,
              p_idempotency_key: idempotencyKey,
              p_description: refundDescription,
              p_shipment_id: id,
              p_workspace_id: cancelRefundWorkspaceId,
            }
          );

          if (refundError) {
            console.error('❌ [WALLET] Errore rimborso cancellazione:', refundError.message);
            // Compensation queue per review manuale
            await supabaseAdmin.from('compensation_queue').insert({
              user_id: shipmentData.user_id,
              shipment_id_external: shipmentData.shipment_id_external || 'UNKNOWN',
              tracking_number: shipmentData.tracking_number || shipmentData.ldv || 'UNKNOWN',
              action: 'REFUND',
              original_cost: refundAmount,
              error_context: {
                reason: 'cancellation_refund_failed',
                refund_error: refundError.message,
                cancelled_by: session.actor.email,
              },
              status: 'PENDING',
            } as any);
            walletRefundResult = {
              success: false,
              amount: refundAmount,
              error: refundError.message,
            };
          } else {
            const isReplay = refundResult?.idempotent_replay;
            console.log(
              `✅ [WALLET] Rimborso €${refundAmount} per cancellazione spedizione ${id}${isReplay ? ' (idempotent replay)' : ''}`
            );
            walletRefundResult = { success: true, amount: refundAmount };
          }
        } // close !ownerIsSuperadmin
      } catch (refundErr: any) {
        console.error('❌ [WALLET] Eccezione rimborso:', refundErr?.message);
        walletRefundResult = { success: false, amount: refundAmount, error: refundErr?.message };
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Spedizione eliminata con successo',
      walletRefund: walletRefundResult,
      spedisciOnline: spedisciOnlineCancelResult
        ? {
            cancelled: spedisciOnlineCancelResult.success,
            message: spedisciOnlineCancelResult.message || spedisciOnlineCancelResult.error,
          }
        : null,
    });
  } catch (error) {
    const userId = session?.user?.id;
    return handleApiError(error, 'DELETE /api/spedizioni', requestId, userId);
  }
}
