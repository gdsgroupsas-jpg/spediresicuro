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
  const defaultData: Database = {
    spedizioni: [],
    preventivi: [],
    utenti: [
      // Utenti demo predefiniti (in produzione rimuovere)
      {
        id: '1',
        email: 'admin@spediresicuro.it',
        password: 'admin123', // In produzione: hash con bcrypt
        name: 'Admin',
        role: 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        email: 'demo@spediresicuro.it',
        password: 'demo123', // In produzione: hash con bcrypt
        name: 'Demo User',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
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
      writeDatabase(db);
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

/**
 * Crea un nuovo utente
 */
export function createUser(userData: {
  email: string;
  password: string;
  name: string;
  role?: 'user' | 'admin';
  provider?: 'credentials' | 'google' | 'github' | 'facebook';
  providerId?: string;
  image?: string;
}): User {
  const db = readDatabase();
  
  // Verifica se l'email esiste già
  const existingUser = db.utenti.find((u) => u.email === userData.email);
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
  
  db.utenti.push(newUser);
  writeDatabase(db);
  
  return newUser;
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
 */
export function findUserByEmail(email: string): User | undefined {
  const db = readDatabase();
  return db.utenti.find((u) => u.email === email);
}

/**
 * Verifica le credenziali di un utente
 */
export function verifyUserCredentials(
  email: string,
  password: string
): User | null {
  const user = findUserByEmail(email);
  if (!user) {
    return null;
  }
  
  // TODO: In produzione, confrontare hash con bcrypt
  if (user.password !== password) {
    return null;
  }
  
  return user;
}

/**
 * Ottiene tutti gli utenti (solo per admin)
 */
export function getAllUsers(): User[] {
  const db = readDatabase();
  return db.utenti;
}

