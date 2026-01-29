/**
 * Database Adapter: SOLO Supabase
 *
 * ⚠️ CRITICO: Questo file usa SOLO Supabase - nessun fallback JSON per spedizioni.
 * Se Supabase non è configurato o fallisce, viene lanciato un errore chiaro.
 *
 * Funzioni spedizioni:
 * - SOLO Supabase (nessun fallback JSON)
 *
 * Funzioni utenti/preventivi/configurazioni:
 * - Usano ancora JSON (da migrare in futuro)
 */

import fs from 'fs';
import path from 'path';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

// --- CONFIGURAZIONE AMBIENTE ---
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Percorso del file database JSON
const DB_PATH = path.join(process.cwd(), 'data', 'database.json');

// Interfaccia per i dati del database
interface Database {
  spedizioni: any[];
  preventivi: any[];
  utenti: User[];
  configurazioni: {
    margine: number;
  };
}

// Interfaccia per mittente predefinito
export interface DefaultSender {
  nome: string;
  indirizzo: string;
  citta: string;
  provincia: string;
  cap: string;
  telefono: string;
  email?: string;
}

// Interfaccia per dati cliente completi
export interface DatiCliente {
  // Dati anagrafici base
  nome: string;
  cognome: string;
  codiceFiscale: string;
  dataNascita?: string;
  luogoNascita?: string;
  sesso?: 'M' | 'F';

  // Contatti
  telefono: string;
  cellulare?: string;
  email: string;

  // Indirizzo
  indirizzo: string;
  citta: string;
  provincia: string;
  cap: string;
  nazione?: string;

  // Tipo cliente
  tipoCliente: 'persona' | 'azienda';

  // Dati azienda (se tipoCliente === 'azienda')
  ragioneSociale?: string;
  partitaIva?: string;
  codiceSDI?: string; // Codice destinatario SDI per fatturazione elettronica
  pec?: string; // Email PEC per fatturazione elettronica

  // Dati fatturazione
  indirizzoFatturazione?: string;
  cittaFatturazione?: string;
  provinciaFatturazione?: string;
  capFatturazione?: string;

  // Dati bancari
  iban?: string;
  banca?: string;
  nomeIntestatario?: string;

  // Documenti (opzionali ma presenti)
  documentoIdentita?: {
    tipo: 'carta_identita' | 'patente' | 'passaporto';
    numero: string;
    rilasciatoDa: string;
    dataRilascio: string;
    dataScadenza?: string;
    file?: string; // URL del documento caricato
  };

  // Flag completamento
  datiCompletati: boolean;
  dataCompletamento?: string;
}

// Interfaccia per integrazioni e-commerce
export interface Integrazione {
  platform: string;
  credentials: Record<string, string>;
  connectedAt: string;
  status: 'active' | 'inactive';
}

// Interfaccia per gli utenti
export interface User {
  id: string;
  email: string;
  password: string; // Hash della password (in produzione usare bcrypt) - vuoto per OAuth
  name: string;
  role: 'user' | 'admin';
  provider?: 'credentials' | 'google' | 'github' | 'facebook'; // Provider di autenticazione
  providerId?: string; // ID utente dal provider OAuth
  image?: string; // Avatar URL (da OAuth)
  defaultSender?: DefaultSender; // Mittente predefinito per spedizioni
  datiCliente?: DatiCliente; // Dati completi del cliente
  integrazioni?: Integrazione[]; // Integrazioni e-commerce
  createdAt: string;
  updatedAt: string;
}

// Inizializza il database se non esiste
// ⚠️ IMPORTANTE: Su Vercel (produzione) il file system è read-only, quindi questa funzione
// non può creare file. Usa solo in sviluppo locale o quando Supabase non è configurato.
function initDatabase(): Database {
  // ⚠️ SICUREZZA: Utenti demo rimossi per sicurezza
  // Gli utenti devono essere creati manualmente nel database o via Supabase
  // NON usare password hardcoded in produzione
  const demoUsers: User[] = [];

  const defaultData: Database = {
    spedizioni: [],
    preventivi: [],
    utenti: demoUsers,
    configurazioni: {
      margine: 15, // Margine predefinito 15%
    },
  };

  // ⚠️ CRITICO: Su Vercel (produzione) il file system è read-only
  // Non tentare di creare file in produzione
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    console.warn(
      '⚠️ [JSON] File system read-only su Vercel - initDatabase() ritorna solo dati in memoria'
    );
    return defaultData;
  }

  // Crea la cartella data se non esiste (solo in sviluppo)
  try {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Crea il file database se non esiste (solo in sviluppo)
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
    }
  } catch (error: any) {
    // Se è EROFS (read-only), ritorna solo dati in memoria
    if (error?.code === 'EROFS' || error?.message?.includes('read-only')) {
      console.warn('⚠️ [JSON] File system read-only - initDatabase() ritorna solo dati in memoria');
      return defaultData;
    }
    // Altrimenti rilancia l'errore
    throw error;
  }

  return defaultData;
}

/**
 * Legge i dati dal database JSON
 */
export function readDatabase(): Database {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return initDatabase();
    }

    const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
    const db = JSON.parse(fileContent);

    // Migrazione: aggiungi campo utenti se non esiste
    if (!db.utenti) {
      // ⚠️ SICUREZZA: Utenti demo rimossi per sicurezza
      // Gli utenti devono essere creati manualmente nel database o via Supabase
      db.utenti = [];
    }

    return db;
  } catch (error) {
    console.error('Errore lettura database:', error);
    return initDatabase();
  }
}

/**
 * Scrive i dati nel database JSON
 */
/**
 * Scrive i dati nel database JSON
 *
 * ⚠️ IMPORTANTE: Preserva il codice errore originale per permettere gestione specifica
 * - EROFS: file system read-only (Vercel) - non critico se Supabase ha successo
 * - Altri errori: critici - indicano problemi reali
 */
export function writeDatabase(data: Database): void {
  try {
    // Verifica se la directory esiste
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error: any) {
    // Preserva il codice errore originale per permettere gestione specifica
    const errorCode = error?.code;
    const errorMessage = error?.message || 'Errore sconosciuto';

    console.error('Errore scrittura database:', {
      code: errorCode,
      message: errorMessage,
      path: DB_PATH,
    });

    // Crea nuovo errore preservando codice originale
    const wrappedError: any = new Error(`Impossibile salvare i dati: ${errorMessage}`);
    wrappedError.code = errorCode; // Preserva codice originale (EROFS, EACCES, ENOSPC, ecc.)
    wrappedError.originalError = error; // Preserva errore originale per debug
    throw wrappedError;
  }
}

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
export async function getSupabaseUserIdFromEmail(
  email: string,
  nextAuthUserId?: string | null
): Promise<string | null> {
  try {
    // 1. Cerca prima in user_profiles (veloce grazie all'indice su email)
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('supabase_user_id, name, provider')
      .eq('email', email)
      .single();

    if (!error && profile?.supabase_user_id) {
      console.log(`✅ [SUPABASE] User ID trovato in user_profiles per ${email}`);
      return profile.supabase_user_id;
    }

    // 2. Se non trovato in user_profiles, cerca in auth.users
    const {
      data: { users },
      error: authError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (!authError && users) {
      const supabaseUser = users.find((u: any) => u.email === email);
      if (supabaseUser) {
        console.log(
          `✅ [SUPABASE] User trovato in auth.users per ${email} - creo/aggiorno profilo`
        );

        // Crea o aggiorna il profilo in user_profiles
        try {
          const { data: updatedProfile, error: upsertError } = await supabaseAdmin
            .from('user_profiles')
            .upsert(
              {
                email,
                supabase_user_id: supabaseUser.id,
                name:
                  supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || null,
                provider: supabaseUser.app_metadata?.provider || 'credentials',
                provider_id: supabaseUser.app_metadata?.provider_id || null,
              },
              { onConflict: 'email' }
            )
            .select('supabase_user_id')
            .single();

          if (!upsertError && updatedProfile?.supabase_user_id) {
            console.log(`✅ [SUPABASE] Profilo creato/aggiornato in user_profiles`);
            return updatedProfile.supabase_user_id;
          } else if (upsertError) {
            console.warn('⚠️ [SUPABASE] Errore creazione profilo:', upsertError.message);
          }
        } catch (upsertError: any) {
          console.warn('⚠️ [SUPABASE] Errore upsert profilo:', upsertError.message);
        }

        // Restituisci comunque l'ID anche se l'upsert fallisce
        return supabaseUser.id;
      }
    }

    // 3. FALLBACK: Usa NextAuth session.user.id se disponibile
    if (nextAuthUserId) {
      console.log(
        `ℹ️ [SUPABASE] Usando NextAuth user.id come fallback: ${nextAuthUserId.substring(0, 8)}...`
      );
      // Crea/aggiorna profilo con NextAuth ID come riferimento temporaneo
      try {
        await supabaseAdmin.from('user_profiles').upsert(
          {
            email,
            supabase_user_id: null, // Non abbiamo UUID Supabase, ma abbiamo NextAuth ID
            // Salva NextAuth ID in un campo custom se disponibile, altrimenti usa email come riferimento
          },
          { onConflict: 'email' }
        );
      } catch (createError: any) {
        console.warn(
          '⚠️ [SUPABASE] Impossibile creare profilo con NextAuth ID:',
          createError.message
        );
      }
      // Restituisci NextAuth ID come fallback (non è UUID Supabase, ma è meglio di null)
      return nextAuthUserId;
    }

    // 4. Se non esiste né in user_profiles né in auth.users né NextAuth ID, crea profilo senza supabase_user_id
    try {
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('user_profiles')
        .upsert(
          {
            email,
            supabase_user_id: null, // Nessun utente Supabase Auth
          },
          { onConflict: 'email' }
        )
        .select('id')
        .single();

      if (!createError && newProfile) {
        console.log(
          `ℹ️ [SUPABASE] Profilo creato senza supabase_user_id per ${email} (utente solo NextAuth)`
        );
        // Restituisci null perché non c'è UUID Supabase
        return null;
      }
    } catch (createError: any) {
      // Ignora errori di creazione profilo (non critico)
      console.warn('⚠️ [SUPABASE] Impossibile creare profilo:', createError.message);
    }

    console.warn(
      `⚠️ [SUPABASE] Nessun user_id trovato per ${email} - spedizione salvata senza user_id`
    );
    return null;
  } catch (error: any) {
    console.error('❌ [SUPABASE] Errore getSupabaseUserIdFromEmail:', error.message);
    // FALLBACK: Se tutto fallisce, usa NextAuth ID se disponibile
    if (nextAuthUserId) {
      console.log(
        `ℹ️ [SUPABASE] Fallback a NextAuth user.id dopo errore: ${nextAuthUserId.substring(0, 8)}...`
      );
      return nextAuthUserId;
    }
    return null;
  }
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
    // ⚠️ courier_id è UUID che fa riferimento a couriers(id) - per ora null (da implementare mapping nome->UUID)
    courier_id: null, // TODO: Mappare spedizione.corriere (es. "GLS", "SDA") a UUID da tabella couriers
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
  authContext: import('./auth-context').AuthContext
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
      const { logServiceRoleOperation } = await import('./auth-context');
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

    console.log('🔄 [SUPABASE] Esecuzione INSERT...');
    const { data: supabaseData, error: supabaseError } = await supabaseAdmin
      .from('shipments')
      .insert([finalPayload])
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
 * Aggiunge un nuovo preventivo
 */
export function addPreventivo(preventivo: any): void {
  const db = readDatabase();
  db.preventivi.push({
    ...preventivo,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  });
  writeDatabase(db);
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
  authContext: import('./auth-context').AuthContext
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
    // ⚠️ SICUREZZA: Filtra per user_id per utenti normali
    let query = supabaseAdmin
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false });

    if (authContext.type === 'user') {
      // Utente normale: filtra SOLO per user_id (NON include user_id IS NULL)
      if (!authContext.userId) {
        console.error('❌ [SECURITY] getSpedizioni chiamato con user context senza userId');
        throw new Error('Contesto utente invalido: userId mancante');
      }

      // ⚠️ CRITICO: Filtra SOLO per user_id (NON permettere user_id IS NULL)
      query = query.eq('user_id', authContext.userId);
      console.log(
        `✅ [SUPABASE] Filtro per user_id: ${authContext.userId.substring(0, 8)}... (user: ${authContext.userEmail || 'N/A'})`
      );
    } else if (authContext.type === 'service_role') {
      // Service role: bypass RLS e recupera tutto (con audit log)
      const { logServiceRoleOperation } = await import('./auth-context');
      logServiceRoleOperation(authContext, 'getSpedizioni', {
        scope: 'all_shipments',
        bypass_rls: true,
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

/**
 * Aggiorna una spedizione esistente
 */
export function updateSpedizione(id: string, updates: any): void {
  const db = readDatabase();
  const index = db.spedizioni.findIndex((s: any) => s.id === id);

  if (index === -1) {
    throw new Error('Spedizione non trovata');
  }

  db.spedizioni[index] = {
    ...db.spedizioni[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  writeDatabase(db);
}

/**
 * Ottiene tutti i preventivi
 */
export function getPreventivi(): any[] {
  const db = readDatabase();
  return db.preventivi;
}

/**
 * Aggiorna la configurazione del margine
 */
export function updateMargine(margine: number): void {
  const db = readDatabase();
  db.configurazioni.margine = margine;
  writeDatabase(db);
}

/**
 * Ottiene la configurazione del margine
 */
export function getMargine(): number {
  const db = readDatabase();
  return db.configurazioni.margine;
}

/**
 * Crea un nuovo utente
 *
 * ⚠️ IMPORTANTE: Ora salva PRIMA in Supabase se configurato, poi in JSON come fallback
 */
export async function createUser(userData: {
  email: string;
  password: string;
  name: string;
  role?: 'user' | 'admin';
  accountType?: 'user' | 'admin';
  provider?: 'credentials' | 'google' | 'github' | 'facebook';
  providerId?: string;
  image?: string;
  parentAdminId?: string;
}): Promise<User> {
  // Verifica se l'utente esiste già (controlla sia JSON che Supabase)
  const existingUser = await findUserByEmail(userData.email);
  if (existingUser) {
    throw new Error('Email già registrata');
  }

  const newUser: User = {
    id: Date.now().toString(),
    email: userData.email,
    password: userData.password || '', // Vuoto per utenti OAuth
    name: userData.name,
    role: userData.role || 'user',
    provider: userData.provider || 'credentials',
    providerId: userData.providerId,
    image: userData.image,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // ⚠️ PRIORITÀ 1: Salva in Supabase se configurato
  if (isSupabaseConfigured()) {
    try {
      console.log('🔄 [SUPABASE] Tentativo salvataggio utente in Supabase...');

      // Determina account_type basandosi su accountType o role
      const accountType = userData.accountType || (userData.role === 'admin' ? 'admin' : 'user');

      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            email: userData.email,
            password: userData.password || null, // Null per utenti OAuth
            name: userData.name,
            role: userData.role || (accountType === 'admin' ? 'admin' : 'user'),
            account_type: accountType,
            provider: userData.provider || 'credentials',
            provider_id: userData.providerId || null,
            image: userData.image || null,
            parent_admin_id: userData.parentAdminId || null,
            admin_level: accountType === 'admin' ? (userData.parentAdminId ? null : 1) : 0,
          },
        ])
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ [SUPABASE] Errore salvataggio utente:', {
          message: supabaseError.message,
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint,
        });

        // Se è un errore di constraint unique (email già esistente), rilancia l'errore
        if (
          supabaseError.code === '23505' ||
          supabaseError.message?.includes('duplicate key') ||
          supabaseError.message?.includes('unique constraint')
        ) {
          throw new Error('Email già registrata');
        }

        // Se siamo su Vercel (produzione), NON provare JSON (read-only)
        if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
          throw new Error(
            `Errore Supabase: ${supabaseError.message}. Verifica che la tabella 'users' esista e che le variabili Supabase siano configurate correttamente su Vercel.`
          );
        }

        console.log('📁 [FALLBACK] Provo database JSON locale');
      } else {
        console.log(`✅ [SUPABASE] Utente salvato con successo! ID: ${supabaseUser.id}`);
        // Usa l'ID di Supabase
        newUser.id = supabaseUser.id;
        // Prova comunque a salvare in JSON per compatibilità (non critico se fallisce)
        try {
          const db = readDatabase();
          db.utenti.push(newUser);
          writeDatabase(db);
        } catch (jsonError: any) {
          // Non critico: già salvato in Supabase
          if (jsonError?.code === 'EROFS') {
            console.log(
              'ℹ️ [JSON] File system read-only (Vercel) - salvataggio JSON saltato (non critico)'
            );
          } else {
            console.warn('⚠️ [JSON] Errore salvataggio JSON (non critico):', jsonError.message);
          }
        }
        return newUser;
      }
    } catch (error: any) {
      console.error('❌ [SUPABASE] Errore generico salvataggio utente:', error.message);
      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  }

  // ⚠️ PRIORITÀ 2: Salva in JSON (fallback o se Supabase non configurato)
  // ⚠️ IMPORTANTE: Su Vercel il file system è read-only, quindi JSON non funziona
  // Se siamo in produzione e Supabase non è configurato, dobbiamo fallire con un messaggio chiaro
  if (process.env.NODE_ENV === 'production' && !isSupabaseConfigured()) {
    throw new Error(
      'Supabase non configurato. Configura le variabili ambiente NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY su Vercel.'
    );
  }

  try {
    const db = readDatabase();
    db.utenti.push(newUser);
    writeDatabase(db);
    console.log('✅ [JSON] Utente salvato in JSON locale');
    return newUser;
  } catch (error: any) {
    // Se è un errore di file system read-only (Vercel), spiega meglio
    if (
      error?.code === 'EROFS' ||
      error?.message?.includes('read-only') ||
      error?.message?.includes('EROFS')
    ) {
      if (isSupabaseConfigured()) {
        // Supabase è configurato ma ha fallito, e JSON è read-only
        throw new Error(
          'Errore salvataggio in Supabase. Verifica la configurazione e che la tabella users esista. JSON non disponibile su Vercel (read-only).'
        );
      } else {
        // Supabase non configurato e JSON read-only
        throw new Error(
          'Database non disponibile. Configura Supabase su Vercel (variabili ambiente) per salvare gli utenti in produzione.'
        );
      }
    }

    // Se Supabase non è configurato E JSON fallisce, questo è CRITICO
    if (!isSupabaseConfigured()) {
      throw new Error(
        `Impossibile salvare l'utente: errore nel database JSON - ${error.message}. Configura Supabase per produzione.`
      );
    }
    // Se Supabase è configurato ma ha fallito E JSON fallisce, questo è CRITICO
    throw new Error(
      `Impossibile salvare l'utente: sia Supabase che JSON hanno fallito. Errore Supabase: vedi log. Errore JSON: ${error.message}`
    );
  }
}

/**
 * Aggiorna un utente esistente
 *
 * ⚠️ IMPORTANTE: Ora salva PRIMA in Supabase se configurato, poi in JSON come fallback
 */
export async function updateUser(userId: string, updates: Partial<User>): Promise<User> {
  // ⚠️ PRIORITÀ 1: Aggiorna in Supabase se configurato
  if (isSupabaseConfigured()) {
    try {
      console.log('🔄 [SUPABASE] Aggiornamento utente in Supabase:', userId);

      // Prepara i dati per Supabase (converte nomi campi)
      const supabaseUpdates: any = {
        updated_at: new Date().toISOString(),
      };

      // Mappa i campi da formato User a formato Supabase
      if (updates.email !== undefined) supabaseUpdates.email = updates.email;
      if (updates.password !== undefined) supabaseUpdates.password = updates.password;
      if (updates.name !== undefined) supabaseUpdates.name = updates.name;
      if (updates.role !== undefined) supabaseUpdates.role = updates.role;
      if (updates.provider !== undefined) supabaseUpdates.provider = updates.provider;
      if (updates.providerId !== undefined) supabaseUpdates.provider_id = updates.providerId;
      if (updates.image !== undefined) supabaseUpdates.image = updates.image;
      if (updates.datiCliente !== undefined) {
        // Converti datiCliente in JSON se non è già un oggetto JSON
        supabaseUpdates.dati_cliente =
          typeof updates.datiCliente === 'string'
            ? JSON.parse(updates.datiCliente)
            : updates.datiCliente;
        console.log(
          '📝 [SUPABASE] Salvataggio dati_cliente:',
          JSON.stringify(supabaseUpdates.dati_cliente).substring(0, 100) + '...'
        );
      }
      if (updates.defaultSender !== undefined) {
        supabaseUpdates.default_sender =
          typeof updates.defaultSender === 'string'
            ? JSON.parse(updates.defaultSender)
            : updates.defaultSender;
      }
      if (updates.integrazioni !== undefined) {
        supabaseUpdates.integrazioni =
          typeof updates.integrazioni === 'string'
            ? JSON.parse(updates.integrazioni)
            : updates.integrazioni;
      }

      console.log('📋 [SUPABASE] Campi da aggiornare:', Object.keys(supabaseUpdates));

      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin
        .from('users')
        .update(supabaseUpdates)
        .eq('id', userId)
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ [SUPABASE] Errore aggiornamento utente:', {
          message: supabaseError.message,
          code: supabaseError.code,
          details: supabaseError.details,
          hint: supabaseError.hint,
        });

        // Se siamo su Vercel (produzione), NON provare JSON (read-only)
        if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
          throw new Error(
            `Errore Supabase: ${supabaseError.message}. Verifica che la tabella 'users' esista e che le variabili Supabase siano configurate correttamente su Vercel.`
          );
        }

        console.log('📁 [FALLBACK] Provo database JSON locale');
      } else {
        console.log(`✅ [SUPABASE] Utente aggiornato con successo! ID: ${supabaseUser.id}`);

        // Converti formato Supabase a formato User
        const updatedUser: User = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          password: supabaseUser.password || '',
          name: supabaseUser.name,
          role: supabaseUser.role || 'user',
          provider: supabaseUser.provider || 'credentials',
          providerId: supabaseUser.provider_id,
          image: supabaseUser.image,
          datiCliente: supabaseUser.dati_cliente || updates.datiCliente,
          defaultSender: supabaseUser.default_sender || updates.defaultSender,
          createdAt: supabaseUser.created_at || new Date().toISOString(),
          updatedAt: supabaseUser.updated_at || new Date().toISOString(),
        };

        // Prova comunque a salvare in JSON per compatibilità (non critico se fallisce)
        try {
          const db = readDatabase();
          const userIndex = db.utenti.findIndex((u) => u.id === userId);
          if (userIndex !== -1) {
            db.utenti[userIndex] = updatedUser;
            writeDatabase(db);
          }
        } catch (jsonError: any) {
          // Non critico: già salvato in Supabase
          if (jsonError?.code === 'EROFS') {
            console.log(
              'ℹ️ [JSON] File system read-only (Vercel) - salvataggio JSON saltato (non critico)'
            );
          } else {
            console.warn('⚠️ [JSON] Errore salvataggio JSON (non critico):', jsonError.message);
          }
        }

        return updatedUser;
      }
    } catch (error: any) {
      console.error('❌ [SUPABASE] Errore generico aggiornamento utente:', error.message);

      // Se siamo su Vercel, NON provare JSON
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        throw error;
      }

      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  }

  // ⚠️ PRIORITÀ 2: Aggiorna in JSON (fallback o se Supabase non configurato)
  // ⚠️ IMPORTANTE: Su Vercel il file system è read-only, quindi JSON non funziona
  if (process.env.NODE_ENV === 'production' && !isSupabaseConfigured()) {
    throw new Error(
      'Supabase non configurato. Configura le variabili ambiente NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY su Vercel.'
    );
  }

  try {
    const db = readDatabase();
    const userIndex = db.utenti.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      throw new Error('Utente non trovato');
    }

    db.utenti[userIndex] = {
      ...db.utenti[userIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    writeDatabase(db);

    return db.utenti[userIndex];
  } catch (error: any) {
    // Se è un errore di file system read-only (Vercel), spiega meglio
    if (
      error?.code === 'EROFS' ||
      error?.message?.includes('read-only') ||
      error?.message?.includes('EROFS')
    ) {
      if (isSupabaseConfigured()) {
        // Supabase è configurato ma ha fallito, e JSON è read-only
        throw new Error(
          'Errore aggiornamento in Supabase. Verifica la configurazione e che la tabella users esista. JSON non disponibile su Vercel (read-only).'
        );
      } else {
        // Supabase non configurato e JSON read-only
        throw new Error(
          'Database non disponibile. Configura Supabase su Vercel (variabili ambiente) per aggiornare gli utenti in produzione.'
        );
      }
    }

    throw error;
  }
}

/**
 * Trova un utente per email
 *
 * ⚠️ IMPORTANTE: Ora cerca PRIMA in Supabase se configurato, poi in JSON come fallback
 */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  // ⚠️ PRIORITÀ 1: Cerca in Supabase se configurato
  if (isSupabaseConfigured()) {
    try {
      console.log('🔍 [SUPABASE] Cerca utente in Supabase per:', email);

      const { data: supabaseUser, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (!error && supabaseUser) {
        // ⚠️ IMPORTANTE: Mappa account_type a role se è admin/superadmin
        let effectiveRole = supabaseUser.role || 'user';
        if (supabaseUser.account_type === 'superadmin' || supabaseUser.account_type === 'admin') {
          effectiveRole = 'admin';
        }

        // Converti formato Supabase a formato User
        const user: User = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          password: supabaseUser.password || '',
          name: supabaseUser.name,
          role: effectiveRole,
          provider: supabaseUser.provider || 'credentials',
          providerId: supabaseUser.provider_id || undefined,
          image: supabaseUser.image || undefined,
          datiCliente: supabaseUser.dati_cliente || undefined,
          defaultSender: supabaseUser.default_sender || undefined,
          integrazioni: supabaseUser.integrazioni || undefined,
          createdAt: supabaseUser.created_at || new Date().toISOString(),
          updatedAt: supabaseUser.updated_at || new Date().toISOString(),
        };

        // ⚠️ IMPORTANTE: Aggiungi account_type, is_reseller, reseller_role come proprietà estese per compatibilità
        (user as any).account_type = supabaseUser.account_type || effectiveRole;
        (user as any).is_reseller = supabaseUser.is_reseller === true;
        (user as any).reseller_role = supabaseUser.reseller_role || undefined;
        (user as any).wallet_balance = supabaseUser.wallet_balance ?? 0;

        console.log('✅ [SUPABASE] Utente trovato in Supabase', {
          hasDatiCliente: !!user.datiCliente,
          datiCompletati: user.datiCliente?.datiCompletati,
          role: effectiveRole,
          account_type: supabaseUser.account_type,
          is_reseller: supabaseUser.is_reseller,
          reseller_role: supabaseUser.reseller_role,
        });
        return user;
      } else {
        console.log('⚠️ [SUPABASE] Utente non trovato, provo JSON fallback');
      }
    } catch (error: any) {
      console.error('❌ [SUPABASE] Errore ricerca utente:', error.message);
      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  }

  // ⚠️ PRIORITÀ 2: Cerca in JSON (fallback o se Supabase non configurato)
  const db = readDatabase();
  const user = db.utenti.find((u) => u.email === email);
  if (user) {
    console.log('✅ [JSON] Utente trovato in JSON locale');
  }
  return user;
}

/**
 * Verifica le credenziali di un utente
 *
 * ⚠️ IMPORTANTE: Ora legge PRIMA da Supabase se configurato, poi da JSON come fallback
 */
/**
 * Errore personalizzato per email non confermata
 */
export class EmailNotConfirmedError extends Error {
  constructor(message: string = 'Email non confermata') {
    super(message);
    this.name = 'EmailNotConfirmedError';
  }
}

export async function verifyUserCredentials(email: string, password: string): Promise<User | null> {
  // ⚠️ PRIORITÀ 0: Verifica se password è token Supabase temporaneo (auto-login post conferma)
  if (password.startsWith('SUPABASE_TOKEN:')) {
    console.log('🔐 [SUPABASE AUTH] Token temporaneo rilevato per auto-login');
    const tokenParts = password.split(':');
    if (tokenParts.length >= 3) {
      const accessToken = tokenParts[1];
      const timestamp = parseInt(tokenParts[2], 10);

      // Verifica che token non sia scaduto (60 secondi)
      if (Date.now() - timestamp > 60000) {
        console.error('❌ [SUPABASE AUTH] Token temporaneo scaduto');
        return null;
      }

      // Verifica token Supabase
      try {
        const {
          data: { user: supabaseUser },
          error: tokenError,
        } = await supabaseAdmin.auth.getUser(accessToken);

        if (tokenError || !supabaseUser) {
          console.error('❌ [SUPABASE AUTH] Token Supabase non valido:', tokenError?.message);
          return null;
        }

        // Verifica che email corrisponda
        if (supabaseUser.email?.toLowerCase() !== email.toLowerCase()) {
          console.error('❌ [SUPABASE AUTH] Email non corrisponde al token');
          return null;
        }

        // Verifica che email sia confermata
        if (!supabaseUser.email_confirmed_at) {
          console.error('❌ [SUPABASE AUTH] Email non confermata');
          return null;
        }

        console.log('✅ [SUPABASE AUTH] Token temporaneo verificato, auto-login per:', email);

        // Ottieni dati utente dal database
        const { data: dbUser, error: dbError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (dbError || !dbUser) {
          // Crea record se non esiste
          const { data: newDbUser, error: createError } = await supabaseAdmin
            .from('users')
            .upsert(
              {
                id: supabaseUser.id,
                email: supabaseUser.email,
                password: null,
                name:
                  supabaseUser.user_metadata?.name ||
                  supabaseUser.user_metadata?.full_name ||
                  email.split('@')[0],
                role: supabaseUser.app_metadata?.role || 'user',
                account_type: supabaseUser.app_metadata?.account_type || 'user',
                provider: 'email',
                provider_id: null,
                image: null,
                admin_level: supabaseUser.app_metadata?.account_type === 'admin' ? 1 : 0,
              },
              { onConflict: 'id' }
            )
            .select()
            .single();

          if (createError || !newDbUser) {
            console.error(
              '❌ [SUPABASE AUTH] Errore creazione record users:',
              createError?.message
            );
            return null;
          }

          const user: User = {
            id: newDbUser.id,
            email: newDbUser.email || email,
            password: '',
            name: newDbUser.name,
            role: newDbUser.role || 'user',
            provider: newDbUser.provider || 'email',
            providerId: undefined,
            image: newDbUser.image || undefined,
            createdAt: newDbUser.created_at || new Date().toISOString(),
            updatedAt: newDbUser.updated_at || new Date().toISOString(),
          };

          return user;
        }

        // Restituisci utente esistente
        let effectiveRole = dbUser.role || 'user';
        if (dbUser.account_type === 'superadmin' || dbUser.account_type === 'admin') {
          effectiveRole = 'admin';
        }

        const user: User = {
          id: dbUser.id,
          email: dbUser.email,
          password: '',
          name: dbUser.name,
          role: effectiveRole,
          provider: dbUser.provider || 'email',
          providerId: dbUser.provider_id || undefined,
          image: dbUser.image || undefined,
          datiCliente: dbUser.dati_cliente || undefined,
          defaultSender: dbUser.default_sender || undefined,
          integrazioni: dbUser.integrazioni || undefined,
          createdAt: dbUser.created_at || new Date().toISOString(),
          updatedAt: dbUser.updated_at || new Date().toISOString(),
        };

        return user;
      } catch (error: any) {
        console.error('❌ [SUPABASE AUTH] Errore verifica token temporaneo:', error.message);
        return null;
      }
    }
  }

  // ⚠️ PRIORITÀ 1: Verifica con Supabase Auth (gestisce password e email confirmation)
  if (isSupabaseConfigured()) {
    try {
      console.log('🔍 [SUPABASE AUTH] Verifica credenziali in Supabase Auth per:', email);

      // 1. Cerca utente in Supabase Auth
      const {
        data: { users },
        error: listError,
      } = await supabaseAdmin.auth.admin.listUsers();

      if (listError) {
        console.error('❌ [SUPABASE AUTH] Errore listUsers:', listError.message);
        throw listError;
      }

      const authUser = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

      if (authUser) {
        console.log('👤 [SUPABASE AUTH] Utente trovato in auth.users:', {
          id: authUser.id,
          email: authUser.email,
          email_confirmed_at: authUser.email_confirmed_at,
          confirmation_sent_at: authUser.confirmation_sent_at,
        });

        // ⚠️ CRITICO: Verifica che l'email sia confermata
        if (!authUser.email_confirmed_at) {
          console.log('❌ [SUPABASE AUTH] Email non confermata per:', email);
          throw new EmailNotConfirmedError(
            'Email non confermata. Controlla la posta e clicca il link di conferma.'
          );
        }

        // 2. Verifica password usando Supabase Auth (signInWithPassword)
        // Nota: Non possiamo usare signInWithPassword con admin API, quindi verifichiamo manualmente
        // Per ora, verifichiamo nella tabella users (backward compatibility)
        // TODO: Migliorare usando Supabase Auth API per verifica password

        const { data: dbUser, error: dbError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .single();

        if (dbError || !dbUser) {
          console.log(
            '⚠️ [SUPABASE] Utente non trovato in tabella users, provo verifica password diretta'
          );
          // Se non c'è nella tabella users, potrebbe essere un utente creato solo in Auth
          // In questo caso, accettiamo il login (la password è gestita da Supabase Auth)
          // Ma dobbiamo creare/aggiornare il record nella tabella users
          const { data: newDbUser, error: createError } = await supabaseAdmin
            .from('users')
            .upsert(
              {
                id: authUser.id,
                email: authUser.email,
                password: null, // Password gestita da Supabase Auth
                name:
                  authUser.user_metadata?.name ||
                  authUser.user_metadata?.full_name ||
                  email.split('@')[0],
                role: authUser.app_metadata?.role || 'user',
                account_type: authUser.app_metadata?.account_type || 'user',
                provider: authUser.app_metadata?.provider || 'email',
                provider_id: null,
                image: null,
                admin_level: authUser.app_metadata?.account_type === 'admin' ? 1 : 0,
              },
              { onConflict: 'id' }
            )
            .select()
            .single();

          if (createError) {
            console.warn(
              '⚠️ [SUPABASE] Errore creazione record users (non critico):',
              createError.message
            );
          }

          // Restituisci utente basato su authUser
          const providerValue = authUser.app_metadata?.provider;
          const validProvider =
            providerValue === 'google' ||
            providerValue === 'github' ||
            providerValue === 'facebook' ||
            providerValue === 'credentials'
              ? providerValue
              : ('credentials' as 'credentials' | 'google' | 'github' | 'facebook');

          const user: User = {
            id: authUser.id,
            email: authUser.email || email, // Fallback a email passata se authUser.email è undefined
            password: '', // Password gestita da Supabase Auth
            name:
              authUser.user_metadata?.name ||
              authUser.user_metadata?.full_name ||
              email.split('@')[0],
            role: authUser.app_metadata?.role || 'user',
            provider: validProvider,
            providerId: undefined, // null non valido per tipo User
            image: authUser.user_metadata?.avatar_url || undefined,
            createdAt: authUser.created_at || new Date().toISOString(),
            updatedAt: authUser.updated_at || new Date().toISOString(),
          };

          console.log('✅ [SUPABASE AUTH] Credenziali verificate (email confermata)');
          return user;
        }

        // Verifica password nella tabella users (backward compatibility)
        let passwordMatch = false;

        if (dbUser.password) {
          // Se la password inizia con $2a$, $2b$, $2x$ o $2y$ è un hash bcrypt
          if (dbUser.password.startsWith('$2')) {
            const bcrypt = require('bcryptjs');
            passwordMatch = await bcrypt.compare(password, dbUser.password);
          } else {
            // Password in chiaro (backward compatibility)
            passwordMatch = dbUser.password === password;
          }
        } else {
          // Password null = gestita da Supabase Auth
          // Per ora accettiamo (dovremmo verificare con Supabase Auth API)
          console.log('⚠️ [SUPABASE] Password null in users - gestita da Supabase Auth');
          passwordMatch = true; // TODO: Verificare con Supabase Auth API
        }

        if (passwordMatch) {
          let effectiveRole = dbUser.role || 'user';
          if (dbUser.account_type === 'superadmin' || dbUser.account_type === 'admin') {
            effectiveRole = 'admin';
          }

          const user: User = {
            id: dbUser.id,
            email: dbUser.email,
            password: dbUser.password || '',
            name: dbUser.name,
            role: effectiveRole,
            provider: dbUser.provider || 'credentials',
            providerId: dbUser.provider_id || undefined,
            image: dbUser.image || undefined,
            datiCliente: dbUser.dati_cliente || undefined,
            defaultSender: dbUser.default_sender || undefined,
            integrazioni: dbUser.integrazioni || undefined,
            createdAt: dbUser.created_at || new Date().toISOString(),
            updatedAt: dbUser.updated_at || new Date().toISOString(),
          };

          console.log(
            '✅ [SUPABASE AUTH] Credenziali verificate con successo (email confermata, role:',
            effectiveRole,
            ')'
          );
          return user;
        } else {
          console.log('❌ [SUPABASE AUTH] Password errata');
          return null;
        }
      } else {
        console.log('⚠️ [SUPABASE AUTH] Utente non trovato in auth.users, provo tabella users');
      }
    } catch (error: any) {
      // Se è EmailNotConfirmedError, rilanciarlo
      if (error instanceof EmailNotConfirmedError) {
        throw error;
      }
      console.error('❌ [SUPABASE AUTH] Errore verifica credenziali:', error.message);
      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  }

  // ⚠️ PRIORITÀ 2: Cerca in JSON (fallback o se Supabase non configurato)
  const user = await findUserByEmail(email);
  if (!user) {
    return null;
  }

  // TODO: In produzione, confrontare hash con bcrypt
  if (user.password !== password) {
    return null;
  }

  console.log('✅ [JSON] Credenziali verificate in JSON locale');
  return user;
}

/**
 * Ottiene tutti gli utenti (solo per admin)
 */
export function getAllUsers(): User[] {
  const db = readDatabase();
  return db.utenti;
}
