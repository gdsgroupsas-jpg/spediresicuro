/**
 * Onboarding Wizard - Tipi condivisi
 */

export type TipoCliente = 'persona' | 'azienda';
export type Sesso = 'M' | 'F' | '';
export type TipoDocumento = 'carta_identita' | 'patente' | 'passaporto' | '';

export interface DatiAnagrafici {
  nome: string;
  cognome: string;
  codiceFiscale: string;
  dataNascita: string;
  luogoNascita: string;
  sesso: Sesso;
  telefono: string;
  cellulare: string;
}

export interface Indirizzo {
  indirizzo: string;
  citta: string;
  provincia: string;
  cap: string;
  nazione: string;
}

export interface DatiAzienda {
  ragioneSociale: string;
  partitaIva: string;
  codiceSDI: string;
  pec: string;
  indirizzoFatturazione: string;
  cittaFatturazione: string;
  provinciaFatturazione: string;
  capFatturazione: string;
}

export interface DatiBancari {
  iban: string;
  banca: string;
  nomeIntestatario: string;
}

export interface DocumentoIdentita {
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  rilasciatoDa: string;
  dataRilascio: string;
  dataScadenza: string;
}

export interface OnboardingFormData {
  tipoCliente: TipoCliente;
  anagrafica: DatiAnagrafici;
  indirizzo: Indirizzo;
  azienda: DatiAzienda;
  bancari: DatiBancari;
  documento: DocumentoIdentita;
}

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  isOptional?: boolean;
  isConditional?: boolean; // Solo se tipoCliente === 'azienda'
  isAdminOnly?: boolean; // Solo per admin/reseller
  isSuperadminOnly?: boolean; // Solo per superadmin
  isResellerCreation?: boolean; // Solo per creazione reseller
  isClienteCreation?: boolean; // Solo per creazione cliente
}

export type WizardMode = 'self' | 'admin' | 'reseller' | 'superadmin';

/**
 * Tipo di utente da creare (solo per superadmin)
 */
export type UserCreationType = 'cliente' | 'reseller';

/**
 * Dati per creazione Reseller (flow completo come clienti)
 */
export interface ResellerFormData {
  // Account
  email: string;
  password: string;
  initialCredit: number;
  notes: string;
  // Tipo (persona fisica o azienda)
  tipoCliente: TipoCliente;
  // Anagrafica
  anagrafica: DatiAnagrafici;
  // Indirizzo
  indirizzo: Indirizzo;
  // Dati Azienda (se azienda)
  azienda: DatiAzienda;
  // Dati Bancari (opzionale)
  bancari: DatiBancari;
  // Documento (opzionale)
  documento: DocumentoIdentita;
  // Listino assegnato (opzionale)
  selectedPriceListId: string | null;
}

export const EMPTY_RESELLER_FORM_DATA: ResellerFormData = {
  email: '',
  password: '',
  initialCredit: 100,
  notes: '',
  tipoCliente: 'azienda', // Default azienda per reseller
  anagrafica: {
    nome: '',
    cognome: '',
    codiceFiscale: '',
    dataNascita: '',
    luogoNascita: '',
    sesso: '',
    telefono: '',
    cellulare: '',
  },
  indirizzo: {
    indirizzo: '',
    citta: '',
    provincia: '',
    cap: '',
    nazione: 'Italia',
  },
  azienda: {
    ragioneSociale: '',
    partitaIva: '',
    codiceSDI: '',
    pec: '',
    indirizzoFatturazione: '',
    cittaFatturazione: '',
    provinciaFatturazione: '',
    capFatturazione: '',
  },
  bancari: {
    iban: '',
    banca: '',
    nomeIntestatario: '',
  },
  documento: {
    tipoDocumento: '',
    numeroDocumento: '',
    rilasciatoDa: '',
    dataRilascio: '',
    dataScadenza: '',
  },
  selectedPriceListId: null,
};

/**
 * Listino disponibile per assegnazione
 */
export interface AssignablePriceList {
  id: string;
  name: string;
  description?: string;
  courier_id?: string;
  list_type?: string;
  status?: string;
  default_margin_percent?: number;
}

/**
 * Reseller disponibile per assegnazione cliente (solo superadmin)
 */
export interface AvailableReseller {
  id: string;
  name: string;
  email: string;
  company_name?: string;
}

export interface OnboardingWizardProps {
  mode: WizardMode;
  targetUserId?: string; // Per mode admin (utente esistente)
  targetUserEmail?: string; // Per mode admin/reseller
  /** Per superadmin: reseller preselezionato a cui assegnare il cliente */
  targetResellerId?: string;
  initialData?: Partial<OnboardingFormData>;
  /** Listini disponibili per assegnazione (mode reseller/admin) */
  availablePriceLists?: AssignablePriceList[];
  /** Callback per caricare listini on-demand */
  onLoadPriceLists?: () => Promise<AssignablePriceList[]>;
  /** Callback per caricare reseller disponibili (solo superadmin) */
  onLoadResellers?: () => Promise<AvailableReseller[]>;
  onComplete?: (
    data: (OnboardingFormData | ResellerFormData) & {
      userCreationType?: UserCreationType;
      clientId?: string;
      generatedPassword?: string;
      priceListId?: string;
      parentResellerId?: string;
    }
  ) => void;
  onCancel?: () => void;
}

export const WIZARD_STEPS: WizardStep[] = [
  // Step 0: Solo per superadmin - scelta tipo utente
  {
    id: 'selezione-tipo-utente',
    title: 'Tipo Utente',
    description: 'Che tipo di utente vuoi creare?',
    isSuperadminOnly: true,
  },
  // ========== STEP PER CREAZIONE RESELLER (superadmin) ==========
  // Step 1: Account base (email, password)
  {
    id: 'reseller-account',
    title: 'Account',
    description: 'Email e password del reseller',
    isSuperadminOnly: true,
    isResellerCreation: true,
  },
  // Step 2: Tipo cliente (persona/azienda)
  {
    id: 'reseller-tipo-cliente',
    title: 'Tipo Account',
    description: 'Persona fisica o azienda?',
    isSuperadminOnly: true,
    isResellerCreation: true,
  },
  // Step 3: Anagrafica
  {
    id: 'reseller-anagrafica',
    title: 'Anagrafica',
    description: 'Dati del titolare/rappresentante',
    isSuperadminOnly: true,
    isResellerCreation: true,
  },
  // Step 4: Indirizzo
  {
    id: 'reseller-indirizzo',
    title: 'Indirizzo',
    description: 'Sede legale o residenza',
    isSuperadminOnly: true,
    isResellerCreation: true,
  },
  // Step 5: Dati Azienda (condizionale)
  {
    id: 'reseller-azienda',
    title: 'Dati Azienda',
    description: 'Informazioni fiscali azienda',
    isSuperadminOnly: true,
    isResellerCreation: true,
    isConditional: true, // Solo se tipoCliente === 'azienda'
  },
  // Step 6: Dati Bancari (opzionale)
  {
    id: 'reseller-bancari',
    title: 'Dati Bancari',
    description: 'Per rimborsi e pagamenti',
    isSuperadminOnly: true,
    isResellerCreation: true,
    isOptional: true,
  },
  // Step 7: Credito Iniziale
  {
    id: 'reseller-credito',
    title: 'Credito',
    description: 'Configura il wallet iniziale',
    isSuperadminOnly: true,
    isResellerCreation: true,
  },
  // Step 8: Listino (opzionale)
  {
    id: 'reseller-listino',
    title: 'Listino',
    description: 'Assegna un listino prezzi iniziale',
    isSuperadminOnly: true,
    isResellerCreation: true,
    isOptional: true,
  },
  // Step 9: Riepilogo
  {
    id: 'reseller-riepilogo',
    title: 'Riepilogo',
    description: 'Verifica e conferma',
    isSuperadminOnly: true,
    isResellerCreation: true,
  },
  // Step per assegnazione reseller parent (superadmin crea cliente)
  {
    id: 'selezione-reseller',
    title: 'Reseller',
    description: 'Seleziona il reseller di appartenenza',
    isSuperadminOnly: true,
    isClienteCreation: true,
  },
  // Step standard per creazione cliente
  {
    id: 'tipo-cliente',
    title: 'Tipo Account',
    description: 'Persona fisica o azienda?',
    isClienteCreation: true,
  },
  {
    id: 'anagrafica',
    title: 'Dati Anagrafici',
    description: 'Informazioni personali del titolare',
    isClienteCreation: true,
  },
  {
    id: 'indirizzo',
    title: 'Indirizzo',
    description: 'Indirizzo di residenza o sede legale',
    isClienteCreation: true,
  },
  {
    id: 'azienda',
    title: 'Dati Azienda',
    description: "Informazioni fiscali dell'azienda",
    isConditional: true,
    isClienteCreation: true,
  },
  {
    id: 'bancari',
    title: 'Dati Bancari',
    description: 'Per rimborsi e pagamenti',
    isOptional: true,
    isClienteCreation: true,
  },
  {
    id: 'documento',
    title: 'Documento',
    description: 'Documento di identità',
    isOptional: true,
    isClienteCreation: true,
  },
  {
    id: 'listino',
    title: 'Listino',
    description: 'Assegna un listino prezzi',
    isOptional: true,
    isAdminOnly: true,
    isClienteCreation: true,
  },
  {
    id: 'riepilogo',
    title: 'Riepilogo',
    description: 'Verifica e conferma i dati',
    isClienteCreation: true,
  },
];

export const EMPTY_FORM_DATA: OnboardingFormData = {
  tipoCliente: 'persona',
  anagrafica: {
    nome: '',
    cognome: '',
    codiceFiscale: '',
    dataNascita: '',
    luogoNascita: '',
    sesso: '',
    telefono: '',
    cellulare: '',
  },
  indirizzo: {
    indirizzo: '',
    citta: '',
    provincia: '',
    cap: '',
    nazione: 'Italia',
  },
  azienda: {
    ragioneSociale: '',
    partitaIva: '',
    codiceSDI: '',
    pec: '',
    indirizzoFatturazione: '',
    cittaFatturazione: '',
    provinciaFatturazione: '',
    capFatturazione: '',
  },
  bancari: {
    iban: '',
    banca: '',
    nomeIntestatario: '',
  },
  documento: {
    tipoDocumento: '',
    numeroDocumento: '',
    rilasciatoDa: '',
    dataRilascio: '',
    dataScadenza: '',
  },
};
