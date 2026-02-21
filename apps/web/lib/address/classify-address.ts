/**
 * Classificazione Indirizzo: Residenziale vs Business
 *
 * Euristica deterministica per classificare un indirizzo come
 * residenziale o business. Nessuna API esterna.
 *
 * Utilizzato per:
 * - Ottimizzazione tariffe corriere (surcharge residenziale)
 * - Analytics per tipologia clientela
 * - Routing intelligente
 */

export type AddressType = 'residential' | 'business' | 'unknown';

export interface ClassificationInput {
  companyName?: string;
  vatNumber?: string;
  addressLine1?: string;
  fullName?: string;
  recipientNotes?: string;
}

export interface ClassificationResult {
  type: AddressType;
  confidence: number; // 0-1
  reasons: string[];
}

// ==================== BUSINESS INDICATORS ====================

/** Forme societarie italiane */
const BUSINESS_SUFFIXES = [
  'srl',
  's.r.l.',
  's.r.l',
  'spa',
  's.p.a.',
  's.p.a',
  'snc',
  's.n.c.',
  's.n.c',
  'sas',
  's.a.s.',
  's.a.s',
  'srls',
  's.r.l.s.',
  's.r.l.s',
  'sapa',
  's.a.p.a.',
  'scarl',
  's.c.a.r.l.',
  'scrl',
  's.c.r.l.',
  'onlus',
  'cooperativa',
  'coop',
  'fondazione',
  'associazione',
  'consorzio',
  'impresa',
  'ditta',
  'azienda',
];

/** Keyword business nell'indirizzo */
const BUSINESS_ADDRESS_KEYWORDS = [
  'c/o',
  'c.o.',
  'presso',
  'zona industriale',
  'z.i.',
  'zi ',
  'zona artigianale',
  'z.a.',
  'centro commerciale',
  'c.c.',
  'centro direzionale',
  'interporto',
  'magazzino',
  'capannone',
  'ufficio',
  'uffici',
  'stabilimento',
  'sede legale',
  'sede operativa',
  'piano',
  'p.',
  'int.',
  'scala',
];

/** Pattern P.IVA italiana */
const PIVA_REGEX = /^(?:IT)?(\d{11})$/i;

// ==================== CLASSIFICATION ====================

/**
 * Classifica un indirizzo come residenziale o business
 *
 * @param input - Dati indirizzo da classificare
 * @returns Classificazione con confidence e motivazioni
 */
export function classifyAddress(input: ClassificationInput): ClassificationResult {
  const reasons: string[] = [];
  let score = 0; // positivo = business, negativo = residenziale

  // 1. P.IVA presente → forte indicatore business
  if (input.vatNumber) {
    const cleaned = input.vatNumber.replace(/[\s\-.]/g, '');
    if (PIVA_REGEX.test(cleaned)) {
      score += 3;
      reasons.push('P.IVA valida presente');
    }
  }

  // 2. Nome azienda presente → indicatore business
  if (input.companyName && input.companyName.trim().length > 0) {
    const lowerCompany = input.companyName.toLowerCase().trim();

    // Check forme societarie
    const hasSuffix = BUSINESS_SUFFIXES.some((suffix) => lowerCompany.includes(suffix));
    if (hasSuffix) {
      score += 3;
      reasons.push('Forma societaria nel nome azienda');
    } else {
      score += 1;
      reasons.push('Nome azienda presente');
    }
  }

  // 3. Keyword business nell'indirizzo (peso 2: forte indicatore)
  if (input.addressLine1) {
    const lowerAddress = input.addressLine1.toLowerCase();
    for (const keyword of BUSINESS_ADDRESS_KEYWORDS) {
      if (lowerAddress.includes(keyword)) {
        score += 2;
        reasons.push(`Keyword business in indirizzo: "${keyword}"`);
        break; // Un solo match basta
      }
    }
  }

  // 4. Keyword business nelle note
  if (input.recipientNotes) {
    const lowerNotes = input.recipientNotes.toLowerCase();
    for (const keyword of BUSINESS_ADDRESS_KEYWORDS) {
      if (lowerNotes.includes(keyword)) {
        score += 1;
        reasons.push(`Keyword business nelle note: "${keyword}"`);
        break;
      }
    }
  }

  // Determina tipo
  if (score >= 2) {
    return {
      type: 'business',
      confidence: Math.min(score / 5, 1),
      reasons,
    };
  }

  if (score === 0) {
    return {
      type: 'residential',
      confidence: 0.6, // Confidence media: assenza di indicatori business
      reasons: ['Nessun indicatore business rilevato'],
    };
  }

  return {
    type: 'unknown',
    confidence: 0.3,
    reasons,
  };
}
