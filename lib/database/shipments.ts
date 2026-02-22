/**
 * Shipment Operations: Operazioni spedizioni (SOLO Supabase)
 *
 * ⚠️ CRITICO: Questo modulo usa SOLO Supabase - nessun fallback JSON per spedizioni.
 * Se Supabase non è configurato o fallisce, viene lanciato un errore chiaro.
 *
 * Contiene:
 * - addSpedizione()
 * - getSpedizioni()
 * - Helper interni di mapping e validazione
 */

import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { getCurrentWorkspaceId, injectWorkspaceIdSync } from '@/lib/workspace-injection';

/**
 * Helper: Mappa status da formato JSON a formato Supabase
 */
function mapStatusToSupabase(status: string): string {
  const statusMap: Record<string, string> = {
    in_preparazione: 'pending',
    pending: 'pending',
    in_transito: 'in_transit',
    consegnata: 'delivered',
    eccezione: 'failed',
    annullata: 'cancelled',
  };
  return statusMap[status] || 'pending';
}

/**
 * Helper: Mappa status da formato Supabase a formato JSON
 */
function mapStatusFromSupabase(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'in_preparazione',
    draft: 'in_preparazione',
    in_transit: 'in_transito',
    shipped: 'in_transito',
    delivered: 'consegnata',
    failed: 'eccezione',
    cancelled: 'annullata',
  };
  return statusMap[status] || 'in_preparazione';
}

/**
 * Helper: Converte un valore in numero o null (gestisce false, undefined, null, stringhe)
 */
function toNumberOrNull(value: any): number | null {
  if (value === null || value === undefined || value === false || value === '') {
    return null;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? null : parsed;
}

/**
 * Helper: Converte un valore in numero o 0 (gestisce false, undefined, null, stringhe)
 */
function toNumberOrZero(value: any): number {
  const num = toNumberOrNull(value);
  return num !== null ? num : 0;
}

/**
 * Helper: Converte formato JSON spedizione a formato Supabase
 *
 * ⚠️ IMPORTANTE: Ora include user_id e packages_count per multi-tenancy
 */
function mapSpedizioneToSupabase(spedizione: any, userId?: string | null): any {
  // Estrai dati destinatario (formato JSON: destinatario.nome)
  const destinatario = spedizione.destinatario || {};
  const mittente = spedizione.mittente || {};

  // Normalizza tracking/ldv
  const ldv = spedizione.ldv || '';
  const tracking =
    spedizione.tracking ||
    spedizione.ldv ||
    spedizione.tracking_number ||
    spedizione.trackingNumber ||
    `TRK${Date.now()}`;

  // Mappa status
  const statusSupabase = mapStatusToSupabase(spedizione.status || 'in_preparazione');

  // Prepara payload Supabase
  return {
    // ⚠️ NUOVO: Multi-tenancy
    user_id: userId || null, // Se null, Supabase userà auth.uid() se disponibile
    // Tracking
    tracking_number: tracking,
    ldv: ldv || null, // Lettera di Vettura (importante per Spedisci.Online)
    external_tracking_number: spedizione.external_tracking_number || null, // Waybill number per Poste
    status: statusSupabase,
    // Mittente - ⚠️ MAPPING ESPLICITO CON FALLBACK SICURO (NO STRINGA VUOTA)
    // ⚠️ FIX: Cerca anche campi flat sender_* che arrivano da route.ts normalizzato
    sender_name:
      mittente.nome || spedizione.mittenteNome || spedizione.sender_name || 'Mittente Predefinito',
    sender_address:
      mittente.indirizzo || spedizione.mittenteIndirizzo || spedizione.sender_address || '',
    sender_city: spedizione.sender_city || mittente.citta || spedizione.mittenteCitta || null, // ⚠️ FIX: sender_city ha priorità
    sender_zip:
      spedizione.sender_zip ||
      spedizione.sender_postal_code ||
      mittente.cap ||
      spedizione.mittenteCap ||
      null, // ⚠️ FIX: sender_zip/postal_code ha priorità
    sender_province:
      spedizione.sender_province || mittente.provincia || spedizione.mittenteProvincia || null, // ⚠️ FIX: sender_province ha priorità
    sender_country: 'IT', // Default Italia
    sender_phone: mittente.telefono || spedizione.mittenteTelefono || spedizione.sender_phone || '',
    sender_email: mittente.email || spedizione.mittenteEmail || spedizione.sender_email || '',
    // Destinatario - ⚠️ MAPPING ESPLICITO CON FALLBACK SICURO (NO STRINGA VUOTA)
    // ⚠️ FIX: Cerca anche campi flat recipient_* che arrivano da route.ts normalizzato
    recipient_name:
      destinatario.nome ||
      spedizione.destinatarioNome ||
      spedizione.recipient_name ||
      spedizione.nome ||
      spedizione.nominativo ||
      '',
    recipient_type: 'B2C', // Default B2C (da implementare logica B2B se necessario)
    recipient_address:
      destinatario.indirizzo ||
      spedizione.destinatarioIndirizzo ||
      spedizione.recipient_address ||
      spedizione.indirizzo ||
      '',
    recipient_city:
      spedizione.recipient_city ||
      destinatario.citta ||
      spedizione.destinatarioCitta ||
      spedizione.citta ||
      spedizione.localita ||
      null, // ⚠️ FIX: recipient_city ha priorità
    recipient_zip:
      spedizione.recipient_zip ||
      spedizione.recipient_postal_code ||
      destinatario.cap ||
      spedizione.destinatarioCap ||
      spedizione.cap ||
      null, // ⚠️ FIX: recipient_zip/postal_code ha priorità
    recipient_province:
      spedizione.recipient_province ||
      destinatario.provincia ||
      spedizione.destinatarioProvincia ||
      spedizione.provincia ||
      null, // ⚠️ FIX: recipient_province ha priorità
    recipient_country: 'IT', // Default Italia
    recipient_phone:
      destinatario.telefono || spedizione.destinatarioTelefono || spedizione.telefono || '',
    recipient_email:
      destinatario.email ||
      spedizione.destinatarioEmail ||
      spedizione.email_dest ||
      spedizione.email ||
      '',
    // Pacco - ⚠️ CRITICO: Assicura che tutti i campi numerici siano sempre numeri o null, mai false
    weight: toNumberOrZero(spedizione.peso) || 1,
    length: toNumberOrNull(spedizione.dimensioni?.lunghezza),
    width: toNumberOrNull(spedizione.dimensioni?.larghezza),
    height: toNumberOrNull(spedizione.dimensioni?.altezza),
    // ⚠️ NOTA: packages_count NON esiste nello schema Supabase - rimosso
    // Servizio
    // courier_id verrà impostato in addSpedizione dopo il lookup async
    courier_id: null,
    service_type:
      spedizione.tipoSpedizione === 'express'
        ? 'express'
        : spedizione.tipoSpedizione === 'economy'
          ? 'economy'
          : spedizione.tipoSpedizione === 'same_day'
            ? 'same_day'
            : spedizione.tipoSpedizione === 'next_day'
              ? 'next_day'
              : 'standard',
    cash_on_delivery:
      !!spedizione.contrassegno ||
      (spedizione.contrassegnoAmount && parseFloat(spedizione.contrassegnoAmount) > 0),
    // ⚠️ CRITICO: Assicura che cash_on_delivery_amount sia sempre un numero o null, mai false
    cash_on_delivery_amount: spedizione.contrassegnoAmount
      ? toNumberOrNull(spedizione.contrassegnoAmount)
      : toNumberOrNull(spedizione.contrassegno),
    insurance: !!spedizione.assicurazione,
    // ⚠️ CRITICO: Assicura che declared_value sia sempre un numero o null, mai false
    declared_value:
      toNumberOrNull(spedizione.valoreDichiarato) || toNumberOrNull(spedizione.assicurazione),
    currency: 'EUR', // Default EUR
    // Pricing - ⚠️ CRITICO: Assicura che tutti i campi pricing siano sempre numeri o null, mai false
    base_price: toNumberOrNull(spedizione.prezzoBase),
    surcharges:
      toNumberOrZero(spedizione.costoContrassegno) + toNumberOrZero(spedizione.costoAssicurazione),
    total_cost:
      toNumberOrZero(spedizione.prezzoBase) +
      toNumberOrZero(spedizione.costoContrassegno) +
      toNumberOrZero(spedizione.costoAssicurazione),
    final_price:
      toNumberOrZero(spedizione.prezzoFinale) ||
      toNumberOrZero(spedizione.totale_ordine) ||
      toNumberOrZero(spedizione.costo),
    margin_percent: toNumberOrNull(spedizione.margine) || 15,
    // E-commerce (per order_reference visto negli screenshot)
    ecommerce_order_number:
      spedizione.order_id || spedizione.order_reference || spedizione.rif_destinatario || null,
    ecommerce_order_id: spedizione.order_id || null,
    // ⚠️ CRITICO: order_reference non deve essere UNIQUE - genera un valore unico se non fornito
    // Usa tracking_number come fallback per garantire unicità
    order_reference:
      spedizione.order_reference ||
      spedizione.order_id ||
      spedizione.rif_destinatario ||
      tracking ||
      null,
    // Note
    notes: spedizione.note || '',
    // ⚠️ CRITICO: Audit Trail - created_by_user_email (per multi-tenancy quando user_id è null)
    created_by_user_email: spedizione.created_by_user_email || null,
    // ⚠️ NUOVO: Audit metadata per service_role operations (solo se in contesto admin)
    // NOTA: created_by_admin_id viene gestito nella normalizzazione per rimuoverlo se non in contesto admin
    // ⚠️ admin_operation_reason NON esiste nello schema shipments - rimosso
    created_by_admin_id: spedizione.created_by_admin_id || null,
    // Metadati aggiuntivi (JSONB) - per salvare dati specifici corriere (es: Poste)
    metadata: spedizione.poste_metadata || spedizione.metadata || null,
    // Campi aggiuntivi (salvati in JSONB o come note)
    // Nota: packages_count (colli) non esiste nello schema Supabase - non può essere salvato
  };
}

/**
 * Helper: Converte formato Supabase a formato JSON spedizione
 * ⚠️ IMPORTANTE: Gestisce campi mancanti/null in modo sicuro
 */
function mapSpedizioneFromSupabase(s: any): any {
  try {
    return {
      id: s.id || '',
      tracking: s.tracking_number || s.ldv || '',
      ldv: s.ldv || s.tracking_number || '',
      status: s.status ? mapStatusFromSupabase(s.status) : 'in_preparazione',
      createdAt: s.created_at || new Date().toISOString(),
      // Destinatario (formato JSON annidato)
      destinatario: {
        nome: s.recipient_name || '',
        indirizzo: s.recipient_address || '',
        citta: s.recipient_city || '',
        provincia: s.recipient_province || '',
        cap: s.recipient_zip || '',
        telefono: s.recipient_phone || '',
        email: s.recipient_email || '',
      },
      // Mittente
      mittente: {
        nome: s.sender_name || 'Mittente Predefinito',
        indirizzo: s.sender_address || '',
        citta: s.sender_city || '',
        provincia: s.sender_province || '',
        cap: s.sender_zip || '',
        telefono: s.sender_phone || '',
        email: s.sender_email || '',
      },
      // Pacco
      peso: s.weight || 1,
      dimensioni:
        s.length && s.width && s.height
          ? {
              lunghezza: s.length,
              larghezza: s.width,
              altezza: s.height,
            }
          : undefined,
      // Servizio
      contrassegno: s.cash_on_delivery_amount || (s.cash_on_delivery ? 0 : undefined),
      assicurazione: s.insurance || false,
      // Pricing
      prezzoBase: s.base_price || null,
      prezzoFinale: s.final_price || 0,
      margine: s.margin_percent || 15,
      // Note
      note: s.notes || '',
      // Campi aggiuntivi (mantenuti per compatibilità)
      corriere: s.courier_id || '',
      tipoSpedizione: s.service_type || 'standard',
      // ⚠️ NUOVO: packages_count (colli)
      colli: s.packages_count || 1,
      // Campi per export CSV (rif_mittente, rif_destinatario, contenuto, order_id, totale_ordine)
      rif_mittente: s.sender_reference || s.sender_name || '',
      rif_destinatario: s.recipient_reference || s.recipient_name || '',
      contenuto: s.content || s.internal_notes || '',
      order_id: s.ecommerce_order_id || s.ecommerce_order_number || '',
      totale_ordine: s.final_price || 0,
      deleted: s.deleted || false,
      // Campi aggiuntivi per compatibilità
      imported: s.imported || false,
      importSource: s.import_source || '',
      importPlatform: s.import_platform || '',
      verified: s.verified || false,
      // ✨ NUOVO: VAT Semantics (ADR-001)
      vat_mode: s.vat_mode || null,
      vat_rate: s.vat_rate || 22.0,
    };
  } catch (error: any) {
    console.error('❌ [MAP] Errore mapping spedizione:', error.message, s);
    // Ritorna struttura minima in caso di errore
    return {
      id: s.id || '',
      tracking: s.tracking_number || s.ldv || '',
      ldv: s.ldv || s.tracking_number || '',
      status: 'in_preparazione',
      createdAt: s.created_at || new Date().toISOString(),
      destinatario: {
        nome: s.recipient_name || '',
        indirizzo: s.recipient_address || '',
        citta: s.recipient_city || '',
        provincia: s.recipient_province || '',
        cap: s.recipient_zip || '',
        telefono: s.recipient_phone || '',
        email: s.recipient_email || '',
      },
      mittente: {
        nome: s.sender_name || 'Mittente Predefinito',
        indirizzo: s.sender_address || '',
        citta: s.sender_city || '',
        provincia: s.sender_province || '',
        cap: s.sender_zip || '',
        telefono: s.sender_phone || '',
        email: s.sender_email || '',
      },
      peso: s.weight || 1,
      prezzoFinale: s.final_price || 0,
      deleted: s.deleted || false,
      // ✨ NUOVO: VAT Semantics (ADR-001) - anche nel fallback
      vat_mode: s.vat_mode || null,
      vat_rate: s.vat_rate || 22.0,
    };
  }
}

/**
 * Lookup UUID corriere da codice/nome (es. "GLS" → UUID da tabella couriers).
 * Tabella couriers è globale → ok supabaseAdmin.
 * Se non trovato → null (backward compat).
 */
async function getCourierIdByCode(courierCode: string): Promise<string | null> {
  if (!courierCode) return null;
  const code = courierCode.toUpperCase().trim();
  try {
    const { data } = await supabaseAdmin
      .from('couriers')
      .select('id')
      .or(`code.eq.${code},name.ilike.%${code}%`)
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  } catch {
    return null;
  }
}

/**
 * Aggiunge una nuova spedizione
 *
 * ⚠️ CRITICO: Usa SOLO Supabase - nessun fallback JSON
 * ⚠️ SICUREZZA: Richiede AuthContext esplicito - non permette user_id=null per utenti normali
 * Se Supabase non è configurato o fallisce, viene lanciato un errore
 *
 * Gestisce correttamente ldv (Lettera di Vettura) e tracking
 * - ldv è il tracking number per ordini da Spedisci.Online
 * - Se ldv è presente, viene usato anche come tracking
 * - Se tracking non è presente, usa ldv come fallback
 */
export async function addSpedizione(
  spedizione: any,
  authContext: import('../auth-context').AuthContext
): Promise<any> {
  // ⚠️ CRITICO: Verifica che Supabase sia configurato
  if (!isSupabaseConfigured()) {
    const errorMsg =
      'Supabase non configurato. Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY';
    console.error('❌ [SUPABASE]', errorMsg);
    throw new Error(errorMsg);
  }

  // ⚠️ SICUREZZA: Blocca anonymous
  if (authContext.type === 'anonymous') {
    console.error('❌ [SECURITY] Tentativo addSpedizione senza autenticazione');
    throw new Error('Non autenticato: accesso negato');
  }

  // ⚠️ CRITICO: Normalizza tracking/ldv
  // PRIORITÀ: ldv > tracking > generato automaticamente
  const ldv = spedizione.ldv || '';
  const tracking =
    spedizione.tracking ||
    spedizione.ldv ||
    spedizione.tracking_number ||
    spedizione.trackingNumber ||
    `TRK${Date.now()}`;

  // ⚠️ DEBUG: Log per verificare cosa viene salvato
  console.log('💾 Salvando spedizione:', {
    ldv_originale: spedizione.ldv,
    tracking_originale: spedizione.tracking,
    ldv_salvato: ldv,
    tracking_salvato: tracking,
  });

  // Prepara struttura completa spedizione (formato JSON per compatibilità)
  const nuovaSpedizione = {
    ...spedizione,
    id: spedizione.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: spedizione.createdAt || spedizione.created_at || new Date().toISOString(),
    created_by_user_email: authContext.userEmail || '',
    // Assicura struttura destinatario (priorità: struttura esistente > campi separati)
    // ⚠️ IMPORTANTE: Se esiste già destinatario con nome, mantienilo, altrimenti costruiscilo
    destinatario:
      spedizione.destinatario && spedizione.destinatario.nome
        ? spedizione.destinatario
        : {
            nome:
              spedizione.destinatarioNome ||
              spedizione.nome ||
              spedizione.nominativo ||
              spedizione.destinatario?.nome ||
              '',
            indirizzo:
              spedizione.destinatarioIndirizzo ||
              spedizione.indirizzo ||
              spedizione.destinatario?.indirizzo ||
              '',
            citta:
              spedizione.destinatarioCitta ||
              spedizione.citta ||
              spedizione.localita ||
              spedizione.destinatario?.citta ||
              '',
            provincia:
              spedizione.destinatarioProvincia ||
              spedizione.provincia ||
              spedizione.destinatario?.provincia ||
              '',
            cap: spedizione.destinatarioCap || spedizione.cap || spedizione.destinatario?.cap || '',
            telefono:
              spedizione.destinatarioTelefono ||
              spedizione.telefono ||
              spedizione.destinatario?.telefono ||
              '',
            email:
              spedizione.destinatarioEmail ||
              spedizione.email_dest ||
              spedizione.email ||
              spedizione.destinatario?.email ||
              '',
          },
    // Assicura struttura mittente
    mittente: spedizione.mittente || {
      nome: spedizione.mittenteNome || 'Mittente Predefinito',
      indirizzo: spedizione.mittenteIndirizzo || '',
      citta: spedizione.mittenteCitta || '',
      provincia: spedizione.mittenteProvincia || '',
      cap: spedizione.mittenteCap || '',
      telefono: spedizione.mittenteTelefono || '',
      email: spedizione.mittenteEmail || '',
    },
    // ⚠️ CRITICO: Tracking (ldv è il tracking number, NON order_id)
    // LDV = Lettera di Vettura = Tracking Number (es. "3UW1LZ1436641")
    // order_id è un campo separato (es. "406-5945828-8539538")
    // Per ordini importati da Spedisci.Online, ldv contiene il tracking
    // Per ordini creati dalla piattaforma, tracking è già presente
    // ⚠️ IMPORTANTE: Mantieni entrambi i campi per compatibilità
    ldv: ldv, // Campo LDV originale (importante per Spedisci.Online)
    tracking: tracking, // Tracking normalizzato (può essere ldv o generato)
    // Assicura status
    status: spedizione.status || 'in_preparazione',
    // Assicura prezzo
    prezzoFinale: spedizione.prezzoFinale || spedizione.totale_ordine || spedizione.costo || 0,
    // Mantieni tutti gli altri campi
    peso: spedizione.peso || 1,
    tipoSpedizione: spedizione.tipoSpedizione || 'standard',
    corriere: spedizione.corriere || '',
    imported: spedizione.imported || false,
    importSource: spedizione.importSource || '',
    importPlatform: spedizione.importPlatform || '',
    verified: spedizione.verified || false,
    order_id: spedizione.order_id || '',
    totale_ordine: spedizione.totale_ordine || spedizione.costo || 0,
    rif_mittente: spedizione.rif_mittente || spedizione.rif_mitt || '',
    rif_destinatario: spedizione.rif_destinatario || spedizione.rif_dest || '',
    note: spedizione.note || '',
    contrassegno: spedizione.contrassegno,
    assicurazione: spedizione.assicurazione,
    dimensioni: spedizione.dimensioni,
    colli: spedizione.colli || 1,
    // ⚠️ IMPORTANTE: Assicura che deleted sia sempre false per nuove spedizioni
    deleted: false,
  };

  // ⚠️ CRITICO: Salva SOLO in Supabase - nessun fallback JSON
  try {
    console.log('🔄 [SUPABASE] Salvataggio spedizione...');

    // ⚠️ SICUREZZA: Determina user_id in base al contesto
    let supabaseUserId: string | null = null;

    if (authContext.type === 'user') {
      // Utente normale: user_id è OBBLIGATORIO
      if (!authContext.userId) {
        console.error('❌ [SECURITY] addSpedizione chiamato con user context senza userId');
        throw new Error(
          'Impossibile salvare spedizione: userId mancante. Verifica autenticazione.'
        );
      }
      supabaseUserId = authContext.userId;
      console.log(
        `✅ [SUPABASE] User ID: ${supabaseUserId.substring(0, 8)}... (user: ${authContext.userEmail || 'N/A'})`
      );
    } else if (authContext.type === 'service_role') {
      // Service role: user_id può essere null (con audit metadata)
      // Se fornito, usalo; altrimenti null è permesso
      supabaseUserId = authContext.userId || null;

      // Log audit per operazioni service_role
      const { logServiceRoleOperation } = await import('../auth-context');
      logServiceRoleOperation(authContext, 'addSpedizione', {
        user_id: supabaseUserId || 'null',
        created_by_admin_id: authContext.serviceRoleMetadata?.adminId,
        reason: authContext.serviceRoleMetadata?.reason,
      });

      console.log(
        `🔐 [SUPABASE] Service role: salvataggio spedizione${supabaseUserId ? ` con user_id: ${supabaseUserId.substring(0, 8)}...` : ' con user_id=null (admin operation)'}`
      );

      // Aggiungi metadati di audit per service_role
      // ⚠️ NOTA: admin_operation_reason NON esiste nello schema shipments - non viene salvato
      nuovaSpedizione.created_by_admin_id = authContext.serviceRoleMetadata?.adminId || null;
    }

    const supabasePayload = mapSpedizioneToSupabase(nuovaSpedizione, supabaseUserId);

    // Risolvi courier_id in modo async (tabella couriers è globale → supabaseAdmin)
    if (nuovaSpedizione.corriere) {
      supabasePayload.courier_id = await getCourierIdByCode(nuovaSpedizione.corriere);
    }

    // ⚠️ CRITICO: Normalizza payload prima dell'INSERT
    // - Rimuove campi admin se non in contesto admin
    // - Rimuove undefined/null
    // - Normalizza tipi (uuid/string/number/json)
    // - Serializza correttamente oggetti JSON
    const isAdminContext =
      authContext.type === 'service_role' && authContext.serviceRoleMetadata?.adminId;

    // ⚠️ CRITICO: Verifica e pulisci tutti i campi numerici per evitare "false" come stringa o booleano
    const cleanedPayload: any = {};
    // Lista COMPLETA di tutti i campi numerici nello schema Supabase shipments
    const numericFields = [
      'weight',
      'length',
      'width',
      'height',
      'volumetric_weight',
      'packages_count',
      'cash_on_delivery_amount',
      'declared_value',
      'base_price',
      'surcharges',
      'total_cost',
      'final_price',
      'margin_percent',
      'courier_quality_score',
      'ocr_confidence_score',
    ];

    for (const [key, value] of Object.entries(supabasePayload)) {
      // Se è un campo numerico, assicura che sia sempre un numero o null, MAI false o "false"
      if (numericFields.includes(key)) {
        if (
          value === false ||
          value === 'false' ||
          value === '' ||
          value === null ||
          value === undefined
        ) {
          cleanedPayload[key] = null;
        } else if (typeof value === 'string') {
          // Se è una stringa, prova a convertirla in numero
          const num = parseFloat(value);
          cleanedPayload[key] = isNaN(num) ? null : num;
        } else if (typeof value === 'number') {
          // Se è già un numero, mantienilo (ma verifica NaN)
          cleanedPayload[key] = isNaN(value) ? null : value;
        } else if (typeof value === 'boolean') {
          // Se è un booleano, convertilo in null (non dovrebbe mai succedere)
          cleanedPayload[key] = null;
        } else {
          // Altri tipi → null
          cleanedPayload[key] = null;
        }
      } else {
        // Campi non numerici: mantieni il valore originale MA verifica che non ci siano false dove non dovrebbero esserci
        cleanedPayload[key] = value;
      }
    }

    // ⚠️ ULTIMA VERIFICA: Rimuovi esplicitamente qualsiasi campo numerico che potrebbe essere false
    // Questo è un doppio controllo per sicurezza
    for (const field of numericFields) {
      if (cleanedPayload[field] === false || cleanedPayload[field] === 'false') {
        console.warn(`⚠️ [CLEANUP] Campo numerico ${field} aveva valore false, convertito in null`);
        cleanedPayload[field] = null;
      }
    }

    // ⚠️ NORMALIZZAZIONE FINALE: Rimuove campi non validi e normalizza tipi
    const normalizedPayload: any = {};

    // Lista campi da rimuovere SEMPRE (non esistono nello schema)
    const invalidFields = ['admin_operation_reason']; // Campo non esiste nello schema shipments

    // Lista campi admin (da rimuovere se non in contesto admin)
    const adminFields = ['created_by_admin_id'];

    // Lista campi UUID (da normalizzare)
    const uuidFields = ['user_id', 'courier_id'];

    // Lista campi JSONB (da serializzare correttamente)
    const jsonbFields = ['metadata'];

    for (const [key, value] of Object.entries(cleanedPayload)) {
      // 1. Rimuovi campi non validi (non esistono nello schema)
      if (invalidFields.includes(key)) {
        console.warn(`⚠️ [NORMALIZE] Campo ${key} non esiste nello schema, rimosso dal payload`);
        continue; // Salta campo non valido
      }

      // 2. Rimuovi campi admin se non in contesto admin
      if (adminFields.includes(key) && !isAdminContext) {
        console.log(`ℹ️ [NORMALIZE] Campo admin ${key} rimosso (non in contesto admin)`);
        continue; // Salta campo admin
      }

      // 3. Rimuovi undefined/null
      if (value === undefined || value === null) {
        continue; // Salta undefined/null
      }

      // 4. Normalizza UUID (stringa valida o null)
      if (uuidFields.includes(key)) {
        if (typeof value === 'string' && value.trim() !== '') {
          normalizedPayload[key] = value.trim();
        } else if (value === null || value === '') {
          normalizedPayload[key] = null;
        } else {
          // UUID non valido → null
          console.warn(
            `⚠️ [NORMALIZE] Campo UUID ${key} ha valore non valido: ${typeof value === 'object' ? '[OBJECT]' : value}, convertito in null`
          );
          normalizedPayload[key] = null;
        }
        continue;
      }

      // 5. Normalizza JSONB (serializza oggetti)
      if (jsonbFields.includes(key)) {
        if (typeof value === 'object' && value !== null) {
          try {
            normalizedPayload[key] = value; // Supabase gestisce JSONB automaticamente
          } catch (error) {
            console.warn(`⚠️ [NORMALIZE] Errore serializzazione JSONB ${key}:`, error);
            normalizedPayload[key] = null;
          }
        } else if (typeof value === 'string' && value.trim() !== '') {
          // Se è stringa, prova a parsarla
          try {
            normalizedPayload[key] = JSON.parse(value);
          } catch {
            normalizedPayload[key] = null;
          }
        } else {
          normalizedPayload[key] = null;
        }
        continue;
      }

      // 6. Normalizza altri tipi (string, number, boolean)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Oggetto non JSONB → rimuovi (causa "[OBJECT]" nel payload)
        // ⚠️ CRITICO: Evita "[OBJECT]" nel payload - rimuovi oggetti non JSONB
        console.warn(
          `⚠️ [NORMALIZE] Campo ${key} è un oggetto non JSONB, rimosso dal payload per evitare "[OBJECT]"`
        );
        continue; // Rimuovi oggetti non JSONB
      }

      // 7. Mantieni valore normalizzato
      normalizedPayload[key] = value;
    }

    // ⚠️ ULTIMA VERIFICA PRE-INSERT: Serializza e deserializza per assicurarsi che i tipi siano corretti
    // Questo forza la conversione di qualsiasi valore residuo
    const finalPayload = JSON.parse(
      JSON.stringify(normalizedPayload, (key, value) => {
        // Se è un campo numerico e il valore è false o "false", convertilo in null
        const numericFields = [
          'weight',
          'length',
          'width',
          'height',
          'volumetric_weight',
          'packages_count',
          'cash_on_delivery_amount',
          'declared_value',
          'base_price',
          'surcharges',
          'total_cost',
          'final_price',
          'margin_percent',
          'courier_quality_score',
          'ocr_confidence_score',
        ];
        if (numericFields.includes(key)) {
          if (value === false || value === 'false') {
            return null;
          }
          if (typeof value === 'string' && value !== '') {
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
          }
        }
        // Rimuovi undefined
        if (value === undefined) {
          return null;
        }
        return value;
      })
    );

    // ⚠️ GUARDRAIL FINALE: Verifica campi critici PRIMA dell'INSERT
    const guardRailErrors: string[] = [];

    // Verifica province (CRITICO per constraint DB)
    if (
      !finalPayload.sender_province ||
      typeof finalPayload.sender_province !== 'string' ||
      !/^[A-Z]{2}$/.test(finalPayload.sender_province)
    ) {
      guardRailErrors.push(
        `sender_province invalida: "${finalPayload.sender_province}" (deve essere sigla 2 lettere maiuscole, es. SA)`
      );
    }
    if (
      !finalPayload.recipient_province ||
      typeof finalPayload.recipient_province !== 'string' ||
      !/^[A-Z]{2}$/.test(finalPayload.recipient_province)
    ) {
      guardRailErrors.push(
        `recipient_province invalida: "${finalPayload.recipient_province}" (deve essere sigla 2 lettere maiuscole, es. MI)`
      );
    }

    // Verifica CAP (CRITICO per constraint DB)
    if (
      !finalPayload.sender_zip ||
      typeof finalPayload.sender_zip !== 'string' ||
      !/^[0-9]{5}$/.test(finalPayload.sender_zip)
    ) {
      guardRailErrors.push(
        `sender_zip invalido: "${finalPayload.sender_zip}" (deve essere 5 cifre, es. 84087)`
      );
    }
    if (
      !finalPayload.recipient_zip ||
      typeof finalPayload.recipient_zip !== 'string' ||
      !/^[0-9]{5}$/.test(finalPayload.recipient_zip)
    ) {
      guardRailErrors.push(
        `recipient_zip invalido: "${finalPayload.recipient_zip}" (deve essere 5 cifre, es. 20100)`
      );
    }

    // Verifica città (CRITICO)
    if (
      !finalPayload.sender_city ||
      typeof finalPayload.sender_city !== 'string' ||
      finalPayload.sender_city.trim().length < 2
    ) {
      guardRailErrors.push(
        `sender_city invalida: "${finalPayload.sender_city}" (deve essere almeno 2 caratteri)`
      );
    }
    if (
      !finalPayload.recipient_city ||
      typeof finalPayload.recipient_city !== 'string' ||
      finalPayload.recipient_city.trim().length < 2
    ) {
      guardRailErrors.push(
        `recipient_city invalida: "${finalPayload.recipient_city}" (deve essere almeno 2 caratteri)`
      );
    }

    // Se ci sono errori, blocca INSERT
    if (guardRailErrors.length > 0) {
      console.error('❌ [GUARDRAIL] Payload finale NON valido:', guardRailErrors);
      console.error('❌ [GUARDRAIL] Payload ricevuto:', {
        sender_city: finalPayload.sender_city,
        sender_province: finalPayload.sender_province,
        sender_zip: finalPayload.sender_zip,
        recipient_city: finalPayload.recipient_city,
        recipient_province: finalPayload.recipient_province,
        recipient_zip: finalPayload.recipient_zip,
      });
      throw new Error(`Guardrail fallito: ${guardRailErrors.join('; ')}`);
    }

    // ⚠️ LOGGING SICURO: Log struttura payload senza esporre dati sensibili
    const safePayload = Object.keys(finalPayload).reduce((acc, key) => {
      const sensitiveFields = [
        'api_key',
        'api_secret',
        'password',
        'token',
        'secret',
        'credential',
        'email',
        'phone',
      ];
      const isSensitive = sensitiveFields.some((field) => key.toLowerCase().includes(field));

      const value = finalPayload[key];
      if (isSensitive) {
        acc[key] = '[REDACTED]';
      } else if (value === null || value === undefined) {
        acc[key] = null;
      } else if (typeof value === 'object' && value !== null) {
        acc[key] = '[JSONB]'; // Indica che è JSONB, non "[OBJECT]"
      } else if (typeof value === 'string' && value.length > 50) {
        acc[key] = `${value.substring(0, 20)}... (${value.length} chars)`;
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    console.log('📋 [SUPABASE] Payload normalizzato (struttura):', {
      fields_count: Object.keys(finalPayload).length,
      has_user_id: !!finalPayload.user_id,
      has_admin_fields: !!finalPayload.created_by_admin_id,
      is_admin_context: isAdminContext,
      structure: safePayload,
    });

    // ⚠️ LOGGING CRITICO: Log campi indirizzo PRIMA dell'INSERT
    console.log('🔍 [SUPABASE] Campi indirizzo finali (PRIMA INSERT):', {
      sender: {
        city: finalPayload.sender_city,
        province: finalPayload.sender_province,
        zip: finalPayload.sender_zip,
      },
      recipient: {
        city: finalPayload.recipient_city,
        province: finalPayload.recipient_province,
        zip: finalPayload.recipient_zip,
      },
    });

    // ⚠️ WORKSPACE INJECTION: Aggiungi workspace_id se disponibile
    // Architecture V2: Ogni spedizione appartiene a un workspace
    const workspaceId = await getCurrentWorkspaceId();
    const payloadWithWorkspace = injectWorkspaceIdSync(finalPayload, workspaceId);

    if (workspaceId) {
      console.log('🏢 [SUPABASE] Workspace ID iniettato:', workspaceId.substring(0, 8) + '...');
    } else {
      console.log('⚠️ [SUPABASE] Nessun workspace_id disponibile (backward-compatible mode)');
    }

    console.log('🔄 [SUPABASE] Esecuzione INSERT...');
    const { data: supabaseData, error: supabaseError } = await supabaseAdmin
      .from('shipments')
      .insert([payloadWithWorkspace])
      .select()
      .single();

    if (supabaseError) {
      console.error('❌ [SUPABASE] Errore salvataggio:', {
        message: supabaseError.message,
        details: supabaseError.details,
        hint: supabaseError.hint,
        code: supabaseError.code,
      });

      // Messaggio errore più dettagliato
      let errorMessage = `Errore Supabase: ${supabaseError.message}`;
      if (supabaseError.details) {
        errorMessage += ` - ${supabaseError.details}`;
      }
      if (supabaseError.hint) {
        errorMessage += `. Suggerimento: ${supabaseError.hint}`;
      }
      if (
        supabaseError.message?.includes('column') &&
        supabaseError.message?.includes('does not exist')
      ) {
        errorMessage += `. Esegui lo script SQL 004_fix_shipments_schema.sql per aggiungere i campi mancanti.`;
      }

      throw new Error(errorMessage);
    }

    console.log(`✅ [SUPABASE] Spedizione salvata con successo! ID: ${supabaseData.id}`);

    // Aggiorna ID con quello di Supabase
    nuovaSpedizione.id = supabaseData.id;

    return nuovaSpedizione;
  } catch (error: any) {
    console.error('❌ [SUPABASE] Errore generico salvataggio:', error.message);
    console.error('❌ [SUPABASE] Stack:', error.stack);
    // Rilancia l'errore invece di usare fallback JSON
    throw error;
  }
}

/**
 * Ottiene tutte le spedizioni
 *
 * ⚠️ IMPORTANTE: Usa SOLO Supabase - nessun fallback JSON
 * ⚠️ SICUREZZA: Richiede AuthContext esplicito - nessun percorso può chiamare senza contesto valido
 *
 * @param authContext Contesto di autenticazione (obbligatorio)
 */
export async function getSpedizioni(
  authContext: import('../auth-context').AuthContext
): Promise<any[]> {
  // ⚠️ CRITICO: Verifica che Supabase sia configurato
  if (!isSupabaseConfigured()) {
    const errorMsg =
      'Supabase non configurato. Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY';
    console.error('❌ [SUPABASE]', errorMsg);
    console.error(
      '❌ [SUPABASE] URL:',
      process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Presente' : 'Mancante'
    );
    console.error(
      '❌ [SUPABASE] Anon Key:',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Presente' : 'Mancante'
    );
    console.error(
      '❌ [SUPABASE] Service Key:',
      process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Presente' : 'Mancante'
    );
    throw new Error(errorMsg);
  }

  // ⚠️ SICUREZZA: Blocca anonymous
  if (authContext.type === 'anonymous') {
    console.error('❌ [SECURITY] Tentativo accesso getSpedizioni senza autenticazione');
    throw new Error('Non autenticato: accesso negato');
  }

  try {
    // ⚠️ SICUREZZA: Filtra per user_id e/o workspace_id per utenti normali
    // Include workspace info per UI adattiva (colonna workspace nelle tabelle)
    let query = supabaseAdmin
      .from('shipments')
      .select('*, workspaces:workspace_id(id, name, type)')
      .order('created_at', { ascending: false });

    // ⚠️ WORKSPACE FILTER: Architecture V2 con visibilita gerarchica
    // Pattern: Parent vede dati di tutti i discendenti (Stripe Connect style)
    const workspaceId = await getCurrentWorkspaceId();

    if (authContext.type === 'user') {
      if (!authContext.userId) {
        console.error('❌ [SECURITY] getSpedizioni chiamato con user context senza userId');
        throw new Error('Contesto utente invalido: userId mancante');
      }

      if (workspaceId) {
        // ⚠️ WORKSPACE HIERARCHY FILTER: Usa RPC per visibilita gerarchica
        // Platform vede tutto sotto di se, Reseller vede suoi + client, Client vede solo suoi
        const { data: visibleIds, error: rpcError } = await supabaseAdmin.rpc(
          'get_visible_workspace_ids',
          { p_workspace_id: workspaceId }
        );

        if (rpcError) {
          console.error('❌ [SUPABASE] Errore RPC get_visible_workspace_ids:', rpcError.message);
          // Fallback: filtra solo per workspace_id diretto
          query = query.eq('workspace_id', workspaceId);
        } else if (visibleIds && visibleIds.length > 0) {
          // Filtra per tutti i workspace visibili (self + discendenti)
          // NO workspace_id IS NULL: query passa da supabaseAdmin (service role),
          // RLS non filtra — record orfani sarebbero un leak cross-workspace
          query = query.in('workspace_id', visibleIds);
          console.log(
            `✅ [SUPABASE] Filtro gerarchico: ${visibleIds.length} workspace visibili da ${workspaceId.substring(0, 8)}...`
          );
        } else {
          // Nessun workspace visibile - filtra per workspace diretto
          query = query.eq('workspace_id', workspaceId);
        }
      } else {
        // No workspace context - backward-compatible: filtra per user_id
        query = query.eq('user_id', authContext.userId);
        console.log(
          `✅ [SUPABASE] Filtro per user_id: ${authContext.userId.substring(0, 8)}... (no workspace context)`
        );
      }
    } else if (authContext.type === 'service_role') {
      // Service role: bypass RLS e recupera tutto (con audit log)
      const { logServiceRoleOperation } = await import('../auth-context');
      logServiceRoleOperation(authContext, 'getSpedizioni', {
        scope: 'all_shipments',
        bypass_rls: true,
        workspace_id: workspaceId || 'none',
      });
      console.log('🔐 [SUPABASE] Service role: recupero tutte le spedizioni (bypass RLS)');
      // Nessun filtro: service_role vede tutto
    }

    console.log('🔄 [SUPABASE] Esecuzione query...');
    const { data: supabaseSpedizioni, error } = await query;

    // ⚠️ DEBUG: Log dettagliato per troubleshooting
    console.log(`📊 [SUPABASE] Query risultato:`, {
      count: supabaseSpedizioni?.length || 0,
      hasError: !!error,
      errorMessage: error?.message,
      firstShipmentId: supabaseSpedizioni?.[0]?.id,
      firstShipmentEmail: supabaseSpedizioni?.[0]?.created_by_user_email,
      firstShipmentUserId: supabaseSpedizioni?.[0]?.user_id,
    });

    if (error) {
      console.error('❌ [SUPABASE] Errore query:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw new Error(
        `Errore Supabase: ${error.message}${error.details ? ` - ${error.details}` : ''}${error.hint ? `. Suggerimento: ${error.hint}` : ''}. Verifica la configurazione e che la tabella shipments esista.`
      );
    }

    // Se non ci sono spedizioni, ritorna array vuoto (non è un errore)
    if (!supabaseSpedizioni || supabaseSpedizioni.length === 0) {
      console.log(
        `ℹ️ [SUPABASE] Nessuna spedizione trovata${authContext.type === 'user' ? ` per ${authContext.userEmail || 'N/A'}` : ' (service_role)'}`
      );
      return [];
    }

    try {
      // Filtra spedizioni non eliminate PRIMA del mapping
      const spedizioniAttive = supabaseSpedizioni.filter((s: any) => {
        // Se deleted non esiste o è null o false, mostra la spedizione
        return s.deleted !== true;
      });

      // Converti formato Supabase a formato JSON
      const spedizioniJSON = spedizioniAttive.map((s: any) => {
        try {
          return mapSpedizioneFromSupabase(s);
        } catch (mapError: any) {
          console.error('❌ [SUPABASE] Errore mapping spedizione:', mapError.message, s);
          throw new Error(`Errore mapping spedizione ${s.id}: ${mapError.message}`);
        }
      });

      console.log(
        `✅ [SUPABASE] Recuperate ${spedizioniJSON.length} spedizioni attive su ${supabaseSpedizioni.length} totali${authContext.type === 'user' ? ` per ${authContext.userEmail || 'N/A'}` : ' (service_role)'}`
      );
      return spedizioniJSON;
    } catch (mapError: any) {
      console.error('❌ [SUPABASE] Errore mapping generale:', mapError.message);
      throw new Error(`Errore mapping spedizioni: ${mapError.message}`);
    }
  } catch (error: any) {
    console.error('❌ [SUPABASE] Errore lettura:', error.message);
    console.error('❌ [SUPABASE] Stack:', error.stack);

    // ⚠️ CRITICO: Se l'errore è EROFS (read-only file system), significa che qualcosa sta ancora cercando di usare JSON
    // Questo NON dovrebbe mai succedere in getSpedizioni perché non usiamo più JSON
    if (
      error.message?.includes('EROFS') ||
      error.message?.includes('read-only') ||
      error.code === 'EROFS'
    ) {
      console.error(
        '❌ [SUPABASE] ERRORE CRITICO: Rilevato tentativo di accesso a JSON file system!'
      );
      console.error(
        '❌ [SUPABASE] Questo NON dovrebbe mai succedere in getSpedizioni - verifica che non ci siano chiamate a readDatabase()'
      );
      throw new Error(
        'Errore configurazione: il sistema sta cercando di usare JSON invece di Supabase. Verifica che Supabase sia configurato correttamente.'
      );
    }

    // Rilancia l'errore invece di usare fallback JSON
    throw error;
  }
}
