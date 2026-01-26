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
  isAdminOnly?: boolean; // ✨ Solo per admin/reseller
}

export type WizardMode = 'self' | 'admin' | 'reseller';

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

export interface OnboardingWizardProps {
  mode: WizardMode;
  targetUserId?: string; // Per mode admin (utente esistente)
  targetUserEmail?: string; // Per mode admin/reseller
  initialData?: Partial<OnboardingFormData>;
  /** ✨ Listini disponibili per assegnazione (mode reseller/admin) */
  availablePriceLists?: AssignablePriceList[];
  /** ✨ Callback per caricare listini on-demand */
  onLoadPriceLists?: () => Promise<AssignablePriceList[]>;
  onComplete?: (
    data: OnboardingFormData & {
      clientId?: string;
      generatedPassword?: string;
      priceListId?: string;
    }
  ) => void;
  onCancel?: () => void;
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'tipo-cliente',
    title: 'Tipo Account',
    description: "Sei una persona fisica o un'azienda?",
  },
  {
    id: 'anagrafica',
    title: 'Dati Anagrafici',
    description: 'Informazioni personali del titolare',
  },
  {
    id: 'indirizzo',
    title: 'Indirizzo',
    description: 'Indirizzo di residenza o sede legale',
  },
  {
    id: 'azienda',
    title: 'Dati Azienda',
    description: "Informazioni fiscali dell'azienda",
    isConditional: true,
  },
  {
    id: 'bancari',
    title: 'Dati Bancari',
    description: 'Per rimborsi e pagamenti',
    isOptional: true,
  },
  {
    id: 'documento',
    title: 'Documento',
    description: 'Documento di identità',
    isOptional: true,
  },
  {
    id: 'listino',
    title: 'Listino',
    description: 'Assegna un listino prezzi',
    isOptional: true,
    isAdminOnly: true, // ✨ Solo per admin/reseller
  },
  {
    id: 'riepilogo',
    title: 'Riepilogo',
    description: 'Verifica e conferma i dati',
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
