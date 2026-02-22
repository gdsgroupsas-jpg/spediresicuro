/**
 * Tipi e interfacce condivise del database
 *
 * Contiene tutte le interfacce pubbliche (User, DatiCliente, ecc.)
 * e tipi interni (Database) usati dai moduli json-store, users, shipments.
 */

// Interfaccia per i dati del database (usata da json-store)
export interface Database {
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

/**
 * Errore personalizzato per email non confermata
 */
export class EmailNotConfirmedError extends Error {
  constructor(message: string = 'Email non confermata') {
    super(message);
    this.name = 'EmailNotConfirmedError';
  }
}
