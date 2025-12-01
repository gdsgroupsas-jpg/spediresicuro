/**
 * Database Adapter: Supabase + JSON (Fallback)
 * 
 * ⚠️ MIGRAZIONE IN CORSO: Questo file ora usa Supabase come database principale.
 * Mantiene compatibilità con formato JSON esistente per transizione graduale.
 * 
 * Funzioni per leggere e scrivere dati:
 * - PRIORITÀ: Supabase (database principale)
 * - FALLBACK: JSON locale (per compatibilità)
 */

import fs from 'fs';
import path from 'path';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

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
function initDatabase(): Database {
  // Utenti demo: sempre creati (sia sviluppo che produzione)
  // ⚠️ IMPORTANTE: In produzione, questi utenti verranno creati in Supabase se configurato
  const demoUsers: User[] = [
    {
      id: '1',
      email: 'admin@spediresicuro.it',
      password: 'admin123',
      name: 'Admin',
      role: 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      email: 'demo@spediresicuro.it',
      password: 'demo123',
      name: 'Demo User',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const defaultData: Database = {
    spedizioni: [],
    preventivi: [],
    utenti: demoUsers,
    configurazioni: {
      margine: 15, // Margine predefinito 15%
    },
  };

  // Crea la cartella data se non esiste
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Crea il file database se non esiste
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData, null, 2), 'utf-8');
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
      // Utenti demo sempre creati (sia sviluppo che produzione)
      db.utenti = [
        {
          id: '1',
          email: 'admin@spediresicuro.it',
          password: 'admin123',
          name: 'Admin',
          role: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          email: 'demo@spediresicuro.it',
          password: 'demo123',
          name: 'Demo User',
          role: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      // Salva la migrazione
      try {
        writeDatabase(db);
      } catch (error: any) {
        // Non critico: se è read-only (Vercel), l'utente verrà creato in Supabase
        if (error?.code !== 'EROFS') {
          console.warn('⚠️ [JSON] Errore salvataggio migrazione utenti:', error.message);
        }
      }
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
    'in_preparazione': 'pending',
    'pending': 'pending',
    'in_transito': 'in_transit',
    'consegnata': 'delivered',
    'eccezione': 'failed',
    'annullata': 'cancelled',
  };
  return statusMap[status] || 'pending';
}

/**
 * Helper: Mappa status da formato Supabase a formato JSON
 */
function mapStatusFromSupabase(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': 'in_preparazione',
    'draft': 'in_preparazione',
    'in_transit': 'in_transito',
    'shipped': 'in_transito',
    'delivered': 'consegnata',
    'failed': 'eccezione',
    'cancelled': 'annullata',
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
async function getSupabaseUserIdFromEmail(email: string): Promise<string | null> {
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
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (!authError && users) {
      const supabaseUser = users.find((u: any) => u.email === email);
      if (supabaseUser) {
        console.log(`✅ [SUPABASE] User trovato in auth.users per ${email} - creo/aggiorno profilo`);
        
        // Crea o aggiorna il profilo in user_profiles
        try {
          const { data: updatedProfile, error: upsertError } = await supabaseAdmin
            .from('user_profiles')
            .upsert(
              {
                email,
                supabase_user_id: supabaseUser.id,
                name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || null,
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

    // 3. Se non esiste né in user_profiles né in auth.users, crea profilo senza supabase_user_id
    // Questo permette di tracciare utenti NextAuth anche senza Supabase Auth
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
        console.log(`ℹ️ [SUPABASE] Profilo creato senza supabase_user_id per ${email} (utente solo NextAuth)`);
        // Restituisci null perché non c'è UUID Supabase
        return null;
      }
    } catch (createError: any) {
      // Ignora errori di creazione profilo (non critico)
      console.warn('⚠️ [SUPABASE] Impossibile creare profilo:', createError.message);
    }

    console.warn(`⚠️ [SUPABASE] Nessun user_id trovato per ${email} - spedizione salvata senza user_id`);
    return null;
  } catch (error: any) {
    console.error('❌ [SUPABASE] Errore getSupabaseUserIdFromEmail:', error.message);
    return null;
  }
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
  const tracking = spedizione.tracking || spedizione.ldv || spedizione.tracking_number || spedizione.trackingNumber || `TRK${Date.now()}`;
  
  // Mappa status
  const statusSupabase = mapStatusToSupabase(spedizione.status || 'in_preparazione');
  
  // Prepara payload Supabase
  return {
    // ⚠️ NUOVO: Multi-tenancy
    user_id: userId || null, // Se null, Supabase userà auth.uid() se disponibile
    // Tracking
    tracking_number: tracking,
    status: statusSupabase,
    // Mittente
    sender_name: mittente.nome || spedizione.mittenteNome || 'Mittente Predefinito',
    sender_address: mittente.indirizzo || spedizione.mittenteIndirizzo || '',
    sender_city: mittente.citta || spedizione.mittenteCitta || '',
    sender_zip: mittente.cap || spedizione.mittenteCap || '',
    sender_province: mittente.provincia || spedizione.mittenteProvincia || '',
    sender_country: 'IT', // Default Italia
    sender_phone: mittente.telefono || spedizione.mittenteTelefono || '',
    sender_email: mittente.email || spedizione.mittenteEmail || '',
    // Destinatario
    recipient_name: destinatario.nome || spedizione.destinatarioNome || spedizione.nome || spedizione.nominativo || '',
    recipient_type: 'B2C', // Default B2C (da implementare logica B2B se necessario)
    recipient_address: destinatario.indirizzo || spedizione.destinatarioIndirizzo || spedizione.indirizzo || '',
    recipient_city: destinatario.citta || spedizione.destinatarioCitta || spedizione.citta || spedizione.localita || '',
    recipient_zip: destinatario.cap || spedizione.destinatarioCap || spedizione.cap || '',
    recipient_province: destinatario.provincia || spedizione.destinatarioProvincia || spedizione.provincia || '',
    recipient_country: 'IT', // Default Italia
    recipient_phone: destinatario.telefono || spedizione.destinatarioTelefono || spedizione.telefono || '',
    recipient_email: destinatario.email || spedizione.destinatarioEmail || spedizione.email_dest || spedizione.email || '',
    // Pacco
    weight: spedizione.peso || 1,
    length: spedizione.dimensioni?.lunghezza || null,
    width: spedizione.dimensioni?.larghezza || null,
    height: spedizione.dimensioni?.altezza || null,
    // ⚠️ NOTA: packages_count NON esiste nello schema Supabase - rimosso
    // Servizio
    // ⚠️ courier_id è UUID che fa riferimento a couriers(id) - per ora null (da implementare mapping nome->UUID)
    courier_id: null, // TODO: Mappare spedizione.corriere (es. "GLS", "SDA") a UUID da tabella couriers
    service_type: (spedizione.tipoSpedizione === 'express' ? 'express' : 
                   spedizione.tipoSpedizione === 'economy' ? 'economy' : 
                   spedizione.tipoSpedizione === 'same_day' ? 'same_day' : 
                   spedizione.tipoSpedizione === 'next_day' ? 'next_day' : 'standard'),
    cash_on_delivery: !!spedizione.contrassegno,
    cash_on_delivery_amount: spedizione.contrassegno ? parseFloat(String(spedizione.contrassegno)) : null,
    insurance: !!spedizione.assicurazione,
    declared_value: spedizione.valoreDichiarato ? parseFloat(String(spedizione.valoreDichiarato)) : (spedizione.assicurazione ? parseFloat(String(spedizione.assicurazione)) : null),
    currency: 'EUR', // Default EUR
    // Pricing
    base_price: spedizione.prezzoBase || null,
    surcharges: (spedizione.costoContrassegno || 0) + (spedizione.costoAssicurazione || 0),
    total_cost: (spedizione.prezzoBase || 0) + (spedizione.costoContrassegno || 0) + (spedizione.costoAssicurazione || 0),
    final_price: spedizione.prezzoFinale || spedizione.totale_ordine || spedizione.costo || 0,
    margin_percent: spedizione.margine || 15,
    // E-commerce (per order_reference visto negli screenshot)
    ecommerce_order_number: spedizione.order_id || spedizione.order_reference || spedizione.rif_destinatario || null,
    ecommerce_order_id: spedizione.order_id || null,
    // Note
    notes: spedizione.note || '',
    // Campi aggiuntivi (salvati in JSONB o come note)
    // Nota: packages_count (colli) non esiste nello schema Supabase - non può essere salvato
  };
}

/**
 * Helper: Converte formato Supabase a formato JSON spedizione
 */
function mapSpedizioneFromSupabase(s: any): any {
  return {
    id: s.id,
    tracking: s.tracking_number,
    ldv: s.tracking_number, // Per compatibilità
    status: mapStatusFromSupabase(s.status),
    createdAt: s.created_at,
    // Destinatario (formato JSON annidato)
    destinatario: {
      nome: s.recipient_name,
      indirizzo: s.recipient_address,
      citta: s.recipient_city,
      provincia: s.recipient_province,
      cap: s.recipient_zip,
      telefono: s.recipient_phone,
      email: s.recipient_email || '',
    },
    // Mittente
    mittente: {
      nome: s.sender_name,
      indirizzo: s.sender_address || '',
      citta: s.sender_city || '',
      provincia: s.sender_province || '',
      cap: s.sender_zip || '',
      telefono: s.sender_phone || '',
      email: s.sender_email || '',
    },
    // Pacco
    peso: s.weight,
    dimensioni: s.length && s.width && s.height ? {
      lunghezza: s.length,
      larghezza: s.width,
      altezza: s.height,
    } : undefined,
    // Servizio
    contrassegno: s.cash_on_delivery_amount || (s.cash_on_delivery ? 0 : undefined),
    assicurazione: s.insurance,
    // Pricing
    prezzoBase: s.base_price,
    prezzoFinale: s.final_price,
    margine: s.margin_percent,
    // Note
    note: s.notes || '',
    // Campi aggiuntivi (mantenuti per compatibilità)
    corriere: s.courier_id || '',
    tipoSpedizione: s.service_type || 'standard',
    // ⚠️ NUOVO: packages_count (colli) - non presente in schema, usa default
    colli: 1, // TODO: aggiungere campo packages_count allo schema Supabase
    // Campi per export CSV (rif_mittente, rif_destinatario, contenuto, order_id, totale_ordine)
    rif_mittente: s.sender_name || '', // Usa sender_name come rif_mittente
    rif_destinatario: s.recipient_name || '', // Usa recipient_name come rif_destinatario
    contenuto: s.internal_notes || '', // Usa internal_notes per contenuto
    order_id: s.ecommerce_order_id || s.ecommerce_order_number || '',
    totale_ordine: s.final_price || 0,
    deleted: false,
  };
}

/**
 * Aggiunge una nuova spedizione
 * 
 * ⚠️ IMPORTANTE: Ora salva PRIMA in Supabase, poi in JSON per compatibilità
 * - Supabase: database principale
 * - JSON: fallback/compatibilità
 *
 * Gestisce correttamente ldv (Lettera di Vettura) e tracking
 * - ldv è il tracking number per ordini da Spedisci.Online
 * - Se ldv è presente, viene usato anche come tracking
 * - Se tracking non è presente, usa ldv come fallback
 */
export async function addSpedizione(spedizione: any, userEmail?: string): Promise<any> {
  // ⚠️ CRITICO: Normalizza tracking/ldv
  // PRIORITÀ: ldv > tracking > generato automaticamente
  const ldv = spedizione.ldv || '';
  const tracking = spedizione.tracking || spedizione.ldv || spedizione.tracking_number || spedizione.trackingNumber || `TRK${Date.now()}`;

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
    created_by_user_email: userEmail || '',
    // Assicura struttura destinatario (priorità: struttura esistente > campi separati)
    // ⚠️ IMPORTANTE: Se esiste già destinatario con nome, mantienilo, altrimenti costruiscilo
    destinatario: (spedizione.destinatario && spedizione.destinatario.nome) 
      ? spedizione.destinatario 
      : {
          nome: spedizione.destinatarioNome || spedizione.nome || spedizione.nominativo || spedizione.destinatario?.nome || '',
          indirizzo: spedizione.destinatarioIndirizzo || spedizione.indirizzo || spedizione.destinatario?.indirizzo || '',
          citta: spedizione.destinatarioCitta || spedizione.citta || spedizione.localita || spedizione.destinatario?.citta || '',
          provincia: spedizione.destinatarioProvincia || spedizione.provincia || spedizione.destinatario?.provincia || '',
          cap: spedizione.destinatarioCap || spedizione.cap || spedizione.destinatario?.cap || '',
          telefono: spedizione.destinatarioTelefono || spedizione.telefono || spedizione.destinatario?.telefono || '',
          email: spedizione.destinatarioEmail || spedizione.email_dest || spedizione.email || spedizione.destinatario?.email || '',
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

  // 🔒 Traccia se almeno un salvataggio è riuscito (CRITICO per prevenire data loss)
  let savedSuccessfully = false;
  let supabaseSuccess = false;
  let jsonSuccess = false;
  let jsonError: Error | null = null;

  // ⚠️ PRIORITÀ 1: Salva in Supabase (database principale) se configurato
  if (isSupabaseConfigured()) {
    try {
      console.log('🔄 Tentativo salvataggio in Supabase...');
      
      // Ottieni user_id Supabase da email NextAuth
      let supabaseUserId: string | null = null;
      if (userEmail) {
        supabaseUserId = await getSupabaseUserIdFromEmail(userEmail);
        if (!supabaseUserId) {
          console.warn(`⚠️ [SUPABASE] Nessun user_id trovato per email: ${userEmail}. La spedizione sarà salvata senza user_id.`);
        } else {
          console.log(`✅ [SUPABASE] User ID trovato: ${supabaseUserId.substring(0, 8)}...`);
        }
      }

      const supabasePayload = mapSpedizioneToSupabase(nuovaSpedizione, supabaseUserId);
      
      const { data: supabaseData, error: supabaseError } = await supabaseAdmin
        .from('shipments')
        .insert([supabasePayload])
        .select()
        .single();

      if (supabaseError) {
        console.error('❌ [SUPABASE] Errore salvataggio:', supabaseError.message);
        console.log('📁 [FALLBACK] Provo database JSON locale');
      } else {
        console.log(`✅ [SUPABASE] Spedizione salvata con successo! ID: ${supabaseData.id}`);
        // Aggiorna ID con quello di Supabase
        nuovaSpedizione.id = supabaseData.id;
        supabaseSuccess = true;
        savedSuccessfully = true;
      }
    } catch (error: any) {
      console.error('❌ [SUPABASE] Errore generico:', error.message);
      console.log('📁 [FALLBACK] Provo database JSON locale');
    }
  } else {
    console.log('📁 [JSON] Supabase non configurato, uso database JSON locale');
  }
  
  // ⚠️ PRIORITÀ 2: Salva in JSON per compatibilità/fallback
  // Solo se Supabase non è configurato O se Supabase ha fallito
  if (!supabaseSuccess) {
    try {
      const db = readDatabase();
      db.spedizioni.push(nuovaSpedizione);
      writeDatabase(db);
      console.log('✅ [JSON] Spedizione salvata in JSON locale');
      jsonSuccess = true;
      savedSuccessfully = true;
    } catch (error: any) {
      jsonError = error;
      console.error('❌ [JSON] Errore salvataggio JSON:', error.message);
      
      // Se Supabase non è configurato O ha fallito E JSON fallisce, questo è CRITICO
      if (!savedSuccessfully) {
        const errorMessage = isSupabaseConfigured()
          ? 'Impossibile salvare la spedizione: sia Supabase che JSON hanno fallito'
          : `Impossibile salvare la spedizione: errore nel database JSON - ${error.message}`;
        throw new Error(errorMessage);
      }
    }
  } else {
    // Supabase ha avuto successo, prova comunque JSON per compatibilità (ma non è critico se fallisce)
    try {
      const db = readDatabase();
      db.spedizioni.push(nuovaSpedizione);
      writeDatabase(db);
      console.log('✅ [JSON] Spedizione salvata anche in JSON locale');
      jsonSuccess = true;
    } catch (error: any) {
      jsonError = error;
      // Non critico: già salvato in Supabase
      // Distingue tra EROFS (non critico) e altri errori (warning)
      if (error?.code === 'EROFS' || error?.message?.includes('EROFS') || error?.message?.includes('read-only')) {
        console.log('ℹ️ [JSON] File system read-only (Vercel) - salvataggio JSON saltato (non critico)');
      } else {
        console.warn('⚠️ [JSON] Errore salvataggio JSON (non critico, già salvato in Supabase):', error.message);
      }
    }
  }
  
  // 🔒 CRITICO: Verifica che almeno un salvataggio sia riuscito (previene data loss)
  if (!savedSuccessfully) {
    const errorDetails = [
      isSupabaseConfigured() && !supabaseSuccess ? 'Supabase: fallito' : null,
      !jsonSuccess && jsonError ? `JSON: ${jsonError.message}` : null,
    ].filter(Boolean).join(', ');
    
    throw new Error(`Impossibile salvare la spedizione. Fallimenti: ${errorDetails}`);
  }
  
  return nuovaSpedizione;
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
 * ⚠️ NUOVO: Ora legge PRIMA da Supabase filtrando per user_id, poi da JSON come fallback
 * 
 * @param userEmail Email utente per filtrare le spedizioni (multi-tenancy)
 */
export async function getSpedizioni(userEmail?: string): Promise<any[]> {
  // ⚠️ IMPORTANTE: Se Supabase non è configurato, usa sempre JSON
  if (!isSupabaseConfigured()) {
    console.log('📁 [JSON] Supabase non configurato, uso database JSON locale');
    const db = readDatabase();
    const filtered = db.spedizioni.filter((s: any) => 
      !s.deleted && (!userEmail || !s.created_by_user_email || s.created_by_user_email === userEmail)
    );
    console.log(`📁 [JSON] Trovate ${filtered.length} spedizioni nel database JSON`);
    return filtered;
  }

  try {
    // Se abbiamo email, filtra per user_id
    let query = supabaseAdmin
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false });

    // ⚠️ IMPORTANTE: Filtra per user_id se email fornita (multi-tenancy)
    if (userEmail) {
      const supabaseUserId = await getSupabaseUserIdFromEmail(userEmail);
      if (supabaseUserId) {
        query = query.eq('user_id', supabaseUserId);
      } else {
        // Se non trovato user_id, filtra per email nel campo notes o usa JSON fallback
        console.warn(`⚠️ Nessun user_id trovato per ${userEmail}, uso JSON fallback`);
        const db = readDatabase();
        return db.spedizioni.filter((s: any) => 
          !s.deleted && (!s.created_by_user_email || s.created_by_user_email === userEmail)
        );
      }
    }

    const { data: supabaseSpedizioni, error } = await query;

    if (!error && supabaseSpedizioni && supabaseSpedizioni.length > 0) {
      // Converti formato Supabase a formato JSON
      const spedizioniJSON = supabaseSpedizioni.map(mapSpedizioneFromSupabase);
      console.log(`✅ [SUPABASE] Recuperate ${spedizioniJSON.length} spedizioni${userEmail ? ` per ${userEmail}` : ''}`);
      return spedizioniJSON;
    }

    // Fallback: leggi da JSON
    console.log('⚠️ [SUPABASE] Nessuna spedizione trovata o errore, uso JSON come fallback');
    const db = readDatabase();
    const filtered = db.spedizioni.filter((s: any) => 
      !s.deleted && (!userEmail || !s.created_by_user_email || s.created_by_user_email === userEmail)
    );
    console.log(`📁 [JSON] Trovate ${filtered.length} spedizioni nel database JSON`);
    return filtered;
  } catch (error: any) {
    console.error('❌ [SUPABASE] Errore lettura:', error.message);
    console.log('📁 [FALLBACK] Uso database JSON locale');
    // Fallback: leggi da JSON
    const db = readDatabase();
    const filtered = db.spedizioni.filter((s: any) => 
      !s.deleted && (!userEmail || !s.created_by_user_email || s.created_by_user_email === userEmail)
    );
    console.log(`📁 [JSON] Trovate ${filtered.length} spedizioni nel database JSON`);
    return filtered;
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
  provider?: 'credentials' | 'google' | 'github' | 'facebook';
  providerId?: string;
  image?: string;
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
      
      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            email: userData.email,
            password: userData.password || null, // Null per utenti OAuth
            name: userData.name,
            role: userData.role || 'user',
            provider: userData.provider || 'credentials',
            provider_id: userData.providerId || null,
            image: userData.image || null,
          },
        ])
        .select()
        .single();
      
      if (supabaseError) {
        console.error('❌ [SUPABASE] Errore salvataggio utente:', supabaseError.message);
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
            console.log('ℹ️ [JSON] File system read-only (Vercel) - salvataggio JSON saltato (non critico)');
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
  try {
    const db = readDatabase();
    db.utenti.push(newUser);
    writeDatabase(db);
    console.log('✅ [JSON] Utente salvato in JSON locale');
    return newUser;
  } catch (error: any) {
    // Se Supabase non è configurato E JSON fallisce, questo è CRITICO
    if (!isSupabaseConfigured()) {
      throw new Error(`Impossibile salvare l'utente: errore nel database JSON - ${error.message}`);
    }
    // Se Supabase è configurato ma ha fallito E JSON fallisce, questo è CRITICO
    throw new Error(`Impossibile salvare l'utente: sia Supabase che JSON hanno fallito - ${error.message}`);
  }
}

/**
 * Aggiorna un utente esistente
 */
export function updateUser(userId: string, updates: Partial<User>): User {
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
        // Converti formato Supabase a formato User
        const user: User = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          password: supabaseUser.password || '',
          name: supabaseUser.name,
          role: supabaseUser.role || 'user',
          provider: supabaseUser.provider || 'credentials',
          providerId: supabaseUser.provider_id || undefined,
          image: supabaseUser.image || undefined,
          createdAt: supabaseUser.created_at || new Date().toISOString(),
          updatedAt: supabaseUser.updated_at || new Date().toISOString(),
        };
        console.log('✅ [SUPABASE] Utente trovato in Supabase');
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
export async function verifyUserCredentials(
  email: string,
  password: string
): Promise<User | null> {
  // ⚠️ PRIORITÀ 1: Cerca in Supabase se configurato
  if (isSupabaseConfigured()) {
    try {
      console.log('🔍 [SUPABASE] Verifica credenziali in Supabase per:', email);
      
      const { data: supabaseUser, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      
      if (!error && supabaseUser) {
        // Verifica password (TODO: in produzione usare bcrypt)
        if (supabaseUser.password && supabaseUser.password === password) {
          // Converti formato Supabase a formato User
          const user: User = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            password: supabaseUser.password || '',
            name: supabaseUser.name,
            role: supabaseUser.role || 'user',
            provider: supabaseUser.provider || 'credentials',
            providerId: supabaseUser.provider_id || undefined,
            image: supabaseUser.image || undefined,
            createdAt: supabaseUser.created_at || new Date().toISOString(),
            updatedAt: supabaseUser.updated_at || new Date().toISOString(),
          };
          console.log('✅ [SUPABASE] Credenziali verificate con successo');
          return user;
        } else if (!supabaseUser.password && password === '') {
          // Utente OAuth (password vuota)
          const user: User = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            password: '',
            name: supabaseUser.name,
            role: supabaseUser.role || 'user',
            provider: supabaseUser.provider || 'credentials',
            providerId: supabaseUser.provider_id || undefined,
            image: supabaseUser.image || undefined,
            createdAt: supabaseUser.created_at || new Date().toISOString(),
            updatedAt: supabaseUser.updated_at || new Date().toISOString(),
          };
          console.log('✅ [SUPABASE] Utente OAuth trovato');
          return user;
        } else {
          console.log('❌ [SUPABASE] Password errata');
          return null;
        }
      } else {
        console.log('⚠️ [SUPABASE] Utente non trovato, provo JSON fallback');
      }
    } catch (error: any) {
      console.error('❌ [SUPABASE] Errore verifica credenziali:', error.message);
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
