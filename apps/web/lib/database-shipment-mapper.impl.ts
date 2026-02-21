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
 * Helper: Ottiene user_id Supabase da email NextAuth
 * Usa la tabella user_profiles per mappare email -> UUID
 *
 * ⚠️ IMPORTANTE: Ora che user_profiles esiste, questa funzione:
 * 1. Cerca prima in user_profiles (veloce, indicizzato)
 * 2. Se non trovato, cerca in auth.users e crea/aggiorna il profilo
 * 3. Crea automaticamente il profilo se l'utente esiste in auth.users
 */
/**
 * Helper: Ottiene user_id Supabase da email NextAuth
 * Usa la tabella user_profiles per mappare email -> UUID
 *
 * ⚠️ IMPORTANTE: Ora che user_profiles esiste, questa funzione:
 * 1. Cerca prima in user_profiles (veloce, indicizzato)
 * 2. Se non trovato, cerca in auth.users e crea/aggiorna il profilo
 * 3. Crea automaticamente il profilo se l'utente esiste in auth.users
 * 4. FALLBACK: Se non trova nulla, usa NextAuth session.user.id se disponibile
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
export function mapSpedizioneToSupabase(spedizione: any, userId?: string | null): any {
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
export function mapSpedizioneFromSupabase(s: any): any {
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
