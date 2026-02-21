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
import { getCurrentWorkspaceId, injectWorkspaceIdSync } from '@/lib/workspace-injection';
import { addSpedizioneImpl } from './database-shipments.impl';
import { mapSpedizioneFromSupabase } from './database-shipment-mapper.impl';
import { getSupabaseUserIdFromEmailImpl } from './database-userid.impl';
import { verifyUserCredentialsImpl } from './database-auth.impl';
import { createUserImpl } from './database-users.impl';

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
  account_type?: string; // Source of truth per RBAC (superadmin, admin, user, reseller, byoc)
  is_reseller?: boolean;
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
/**
 * Helper: Ottiene user_id Supabase da email NextAuth
 */
export async function getSupabaseUserIdFromEmail(
  email: string,
  nextAuthUserId?: string | null
): Promise<string | null> {
  return getSupabaseUserIdFromEmailImpl(email, nextAuthUserId);
}

/**
 * Aggiunge una nuova spedizione
 */
export async function addSpedizione(
  spedizione: any,
  authContext: import('./auth-context').AuthContext
): Promise<any> {
  return addSpedizioneImpl(spedizione, authContext);
}
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
      const { logServiceRoleOperation } = await import('./auth-context');
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
/**
 * Crea un nuovo utente
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
  return createUserImpl(userData, { findUserByEmail, readDatabase, writeDatabase });
}
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
export { EmailNotConfirmedError } from './database-auth.impl';

export async function verifyUserCredentials(email: string, password: string): Promise<User | null> {
  return verifyUserCredentialsImpl(email, password, findUserByEmail);
}
export function getAllUsers(): User[] {
  const db = readDatabase();
  return db.utenti;
}
