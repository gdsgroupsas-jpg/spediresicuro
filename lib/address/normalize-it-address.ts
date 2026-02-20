/**
 * Normalizzazione Indirizzi Italiani (Sprint 2.3)
 *
 * Funzioni pure per estrarre e normalizzare dati indirizzo da testo libero.
 * NO LLM, NO API esterne, solo regex e logica deterministica.
 *
 * ⚠️ NO PII nei log
 */

import { Recipient, Parcel, ShipmentDraft, mergeShipmentDraft } from './shipment-draft';

// ==================== REGEX PATTERNS ====================

// CAP: 5 cifre
const CAP_REGEX = /\b(\d{5})\b/;

// Province italiane (2 lettere)
const PROVINCE_REGEX = /\b([A-Z]{2})\b/i;

// Peso: numero + kg/chili/kilo
const WEIGHT_REGEX = /(\d+(?:[.,]\d+)?)\s*(?:kg|chili|kilo|chilogrammi)/i;

// Peso con parola "peso"
const WEIGHT_ALT_REGEX = /peso\s*[:\s]*(\d+(?:[.,]\d+)?)/i;

// Via/Piazza/Corso + indirizzo
const ADDRESS_REGEX =
  /(?:via|v\.|piazza|p\.zza|p\.za|corso|c\.so|viale|v\.le|largo|l\.go)\s+[\w\s]+\s*(?:\d+[a-z]?)?/i;

// Nome (prima di "via" o dopo comuni pattern)
const NAME_BEFORE_ADDRESS_REGEX = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*,?\s*(?:via|piazza|corso)/i;

// Città comuni italiane (subset)
const COMMON_CITIES = new Set([
  'milano',
  'roma',
  'napoli',
  'torino',
  'palermo',
  'genova',
  'bologna',
  'firenze',
  'bari',
  'catania',
  'venezia',
  'verona',
  'messina',
  'padova',
  'trieste',
  'taranto',
  'brescia',
  'parma',
  'prato',
  'modena',
  'reggio calabria',
  'reggio emilia',
  'perugia',
  'livorno',
  'ravenna',
  'cagliari',
  'foggia',
  'rimini',
  'salerno',
  'ferrara',
  'sassari',
  'siracusa',
  'pescara',
  'monza',
  'bergamo',
  'forlì',
  'trento',
  'vicenza',
  'terni',
  'bolzano',
  'novara',
  'piacenza',
  'ancona',
  'andria',
  'arezzo',
  'udine',
  'cesena',
  'lecce',
  'pesaro',
  'barletta',
]);

// Province italiane valide
const VALID_PROVINCES = new Set([
  'AG',
  'AL',
  'AN',
  'AO',
  'AR',
  'AP',
  'AT',
  'AV',
  'BA',
  'BT',
  'BL',
  'BN',
  'BG',
  'BI',
  'BO',
  'BZ',
  'BS',
  'BR',
  'CA',
  'CL',
  'CB',
  'CE',
  'CT',
  'CZ',
  'CH',
  'CO',
  'CS',
  'CR',
  'KR',
  'CN',
  'EN',
  'FM',
  'FE',
  'FI',
  'FG',
  'FC',
  'FR',
  'GE',
  'GO',
  'GR',
  'IM',
  'IS',
  'SP',
  'AQ',
  'LT',
  'LE',
  'LC',
  'LI',
  'LO',
  'LU',
  'MC',
  'MN',
  'MS',
  'MT',
  'ME',
  'MI',
  'MO',
  'MB',
  'NA',
  'NO',
  'NU',
  'OR',
  'PD',
  'PA',
  'PR',
  'PV',
  'PG',
  'PU',
  'PE',
  'PC',
  'PI',
  'PT',
  'PN',
  'PZ',
  'PO',
  'RG',
  'RA',
  'RC',
  'RE',
  'RI',
  'RN',
  'RM',
  'RO',
  'SA',
  'SS',
  'SV',
  'SI',
  'SR',
  'SO',
  'SU',
  'TA',
  'TE',
  'TR',
  'TO',
  'TP',
  'TN',
  'TV',
  'TS',
  'UD',
  'VA',
  'VE',
  'VB',
  'VC',
  'VR',
  'VV',
  'VI',
  'VT',
]);

// ==================== EXTRACTION FUNCTIONS ====================

/**
 * Estrae CAP dal testo
 */
export function extractPostalCode(text: string): string | undefined {
  const match = text.match(CAP_REGEX);
  return match ? match[1] : undefined;
}

/**
 * Estrae provincia dal testo (solo se valida)
 */
export function extractProvince(text: string): string | undefined {
  const match = text.match(PROVINCE_REGEX);
  if (match) {
    const province = match[1].toUpperCase();
    if (VALID_PROVINCES.has(province)) {
      return province;
    }
  }
  return undefined;
}

/**
 * Estrae peso dal testo
 */
export function extractWeight(text: string): number | undefined {
  let match = text.match(WEIGHT_REGEX);
  if (!match) {
    match = text.match(WEIGHT_ALT_REGEX);
  }
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  return undefined;
}

/**
 * Estrae indirizzo (via/piazza/corso)
 */
export function extractAddressLine1(text: string): string | undefined {
  const match = text.match(ADDRESS_REGEX);
  if (match) {
    return normalizeText(match[0]);
  }
  return undefined;
}

/**
 * Estrae città dal testo
 */
export function extractCity(text: string): string | undefined {
  const lowerText = text.toLowerCase();

  // Cerca città comuni
  for (const city of COMMON_CITIES) {
    if (lowerText.includes(city)) {
      return capitalizeWords(city);
    }
  }

  // Pattern: dopo CAP spesso c'è la città
  const afterCapMatch = text.match(/\b\d{5}\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (afterCapMatch) {
    return afterCapMatch[1];
  }

  return undefined;
}

/**
 * Estrae nome/destinatario dal testo
 */
export function extractFullName(text: string): string | undefined {
  // Pattern: "a Mario Rossi", "per Mario Rossi", "destinatario Mario Rossi", "destinatario: Mario Rossi" (con o senza due punti)
  const patterns = [
    /(?:a|per|destinatario|consegna)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /(?:destinatario|consegna)\s*:\s*([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)+?)(?=[,\s]|$)/i,
    NAME_BEFORE_ADDRESS_REGEX,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = normalizeText(match[1].replace(/[,;.]$/, ''));
      if (name.length >= 3) return name;
    }
  }

  return undefined;
}

// ==================== NORMALIZATION ====================

/**
 * Normalizza testo: trim, capitalizza, rimuove spazi doppi
 */
export function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[,;.]+$/, ''); // Rimuove punteggiatura finale
}

/**
 * Capitalizza ogni parola
 */
export function capitalizeWords(text: string): string {
  return text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ==================== POSTAL NORMALIZATION ====================

/**
 * Abbreviazioni standard postali italiane
 * Usate per normalizzare indirizzi secondo formato Poste Italiane
 */
const POSTAL_ABBREVIATIONS: [RegExp, string][] = [
  [/\bvia\b/gi, 'V.'],
  [/\bviale\b/gi, 'V.le'],
  [/\bpiazza\b/gi, 'P.zza'],
  [/\bpiazzale\b/gi, 'P.le'],
  [/\bcorso\b/gi, 'C.so'],
  [/\blargo\b/gi, 'L.go'],
  [/\bvicolo\b/gi, 'Vic.'],
  [/\bstrada\b/gi, 'Str.'],
  [/\btraversa\b/gi, 'Trav.'],
  [/\bcontrada\b/gi, 'C.da'],
  [/\blocalità\b/gi, 'Loc.'],
  [/\blocalita\b/gi, 'Loc.'],
  [/\bfrazione\b/gi, 'Fraz.'],
  [/\bborgo\b/gi, 'B.go'],
  [/\bsalita\b/gi, 'Sal.'],
  [/\blungotevere\b/gi, 'Lgotev.'],
  [/\blungomare\b/gi, 'Lgomare'],
];

/**
 * Normalizza un indirizzo secondo il formato postale italiano
 * Converte forme estese in abbreviazioni standard.
 *
 * @example normalizeStreetForPostal("Via Roma 20") → "V. Roma 20"
 * @example normalizeStreetForPostal("Piazza Garibaldi 1") → "P.zza Garibaldi 1"
 */
export function normalizeStreetForPostal(street: string): string {
  if (!street) return '';

  let normalized = normalizeText(street);

  for (const [pattern, replacement] of POSTAL_ABBREVIATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized;
}

/**
 * Estrae il numero civico dall'indirizzo, separandolo dalla via
 *
 * @example extractStreetNumber("Via Roma 20") → { street: "Via Roma", number: "20" }
 * @example extractStreetNumber("Via Roma 20/A") → { street: "Via Roma", number: "20/A" }
 * @example extractStreetNumber("Via Roma") → { street: "Via Roma", number: null }
 */
export function extractStreetNumber(address: string): { street: string; number: string | null } {
  if (!address) return { street: '', number: null };

  const cleaned = normalizeText(address);

  // Pattern: indirizzo seguito da numero civico (opzionalmente con lettera, /A, /B, bis, etc.)
  const match = cleaned.match(/^(.+?)\s+(\d+(?:\s*[/\\]\s*[A-Za-z0-9]+)?(?:\s*(?:bis|ter))?)\s*$/i);

  if (match) {
    return {
      street: normalizeText(match[1]),
      number: match[2].replace(/\s+/g, '').toUpperCase(),
    };
  }

  return { street: cleaned, number: null };
}

// ==================== MAIN EXTRACTION ====================

export interface AddressExtractionResult {
  recipient: Partial<Recipient>;
  parcel: Partial<Parcel>;
  extractedAnything: boolean;
}

/**
 * Estrae tutti i dati indirizzo/spedizione da testo libero
 *
 * @param text - Messaggio utente
 * @returns Dati estratti (parziali)
 */
export function extractAddressDataFromText(text: string): AddressExtractionResult {
  const recipient: Partial<Recipient> = {};
  const parcel: Partial<Parcel> = {};

  // Estrai dati
  const postalCode = extractPostalCode(text);
  const province = extractProvince(text);
  const city = extractCity(text);
  const addressLine1 = extractAddressLine1(text);
  const fullName = extractFullName(text);
  const weightKg = extractWeight(text);

  // Popola recipient
  if (postalCode) recipient.postalCode = postalCode;
  if (province) recipient.province = province;
  if (city) recipient.city = city;
  if (addressLine1) recipient.addressLine1 = addressLine1;
  if (fullName) recipient.fullName = fullName;
  recipient.country = 'IT'; // Default

  // Popola parcel
  if (weightKg) parcel.weightKg = weightKg;

  const extractedAnything = !!(
    postalCode ||
    province ||
    city ||
    addressLine1 ||
    fullName ||
    weightKg
  );

  return {
    recipient,
    parcel,
    extractedAnything,
  };
}

/**
 * Estrae dati e li merge con draft esistente
 */
export function extractAndMerge(text: string, existingDraft?: ShipmentDraft): ShipmentDraft {
  const { recipient, parcel } = extractAddressDataFromText(text);

  return mergeShipmentDraft(existingDraft, {
    recipient,
    parcel,
  });
}
