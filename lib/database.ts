/**
 * Database Locale (JSON)
 * 
 * ATTENZIONE: Questo è un database temporaneo in JSON.
 * In futuro verrà sostituito con PostgreSQL su Vercel.
 * 
 * Funzioni per leggere e scrivere dati nel file JSON locale.
 */

import fs from 'fs';
import path from 'path';

// Percorso del file database JSON
const DB_PATH = path.join(process.cwd(), 'data', 'database.json');

// Interfaccia per i dati del database
interface Database {
  spedizioni: any[];
  preventivi: any[];
  configurazioni: {
    margine: number;
  };
}

// Inizializza il database se non esiste
function initDatabase(): Database {
  const defaultData: Database = {
    spedizioni: [],
    preventivi: [],
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
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('Errore lettura database:', error);
    return initDatabase();
  }
}

/**
 * Scrive i dati nel database JSON
 */
export function writeDatabase(data: Database): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Errore scrittura database:', error);
    throw new Error('Impossibile salvare i dati');
  }
}

/**
 * Aggiunge una nuova spedizione
 */
export function addSpedizione(spedizione: any): void {
  const db = readDatabase();
  db.spedizioni.push({
    ...spedizione,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  });
  writeDatabase(db);
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
 */
export function getSpedizioni(): any[] {
  const db = readDatabase();
  return db.spedizioni;
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

