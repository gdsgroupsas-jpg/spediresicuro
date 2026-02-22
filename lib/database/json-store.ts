/**
 * JSON Store: Operazioni legacy su file JSON
 *
 * Funzioni per leggere/scrivere il database JSON locale.
 * Usato come fallback o per dati non ancora migrati a Supabase.
 *
 * ⚠️ IMPORTANTE: Su Vercel (produzione) il file system è read-only.
 */

import fs from 'fs';
import path from 'path';
import type { Database, User } from './types';

// --- CONFIGURAZIONE AMBIENTE ---
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Percorso del file database JSON
const DB_PATH = path.join(process.cwd(), 'data', 'database.json');

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
 * Ottiene tutti i preventivi
 */
export function getPreventivi(): any[] {
  const db = readDatabase();
  return db.preventivi;
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
 * Ottiene tutti gli utenti (solo per admin)
 */
export function getAllUsers(): User[] {
  const db = readDatabase();
  return db.utenti;
}
