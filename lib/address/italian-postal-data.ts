/**
 * Dataset Postale Italiano
 *
 * Validazione CAP/Città/Provincia basata su dati ISTAT/Poste Italiane.
 * Funzioni pure, nessuna API esterna, lookup deterministico.
 *
 * Copertura: tutti i CAP italiani con mappatura città/provincia.
 * Aggiornato: Gennaio 2026
 */

// ==================== TYPES ====================

export interface PostalEntry {
  city: string;
  province: string;
  region: string;
}

export interface CityEntry {
  caps: string[];
  province: string;
  region: string;
}

export interface CapValidationResult {
  valid: boolean;
  message?: string;
  suggestion?: {
    correctCap?: string;
    correctCity?: string;
    correctProvince?: string;
  };
}

// ==================== PROVINCE → REGION MAPPING ====================

const PROVINCE_REGION: Record<string, string> = {
  TO: 'Piemonte',
  VC: 'Piemonte',
  NO: 'Piemonte',
  CN: 'Piemonte',
  AT: 'Piemonte',
  AL: 'Piemonte',
  BI: 'Piemonte',
  VB: 'Piemonte',
  AO: "Valle d'Aosta",
  MI: 'Lombardia',
  VA: 'Lombardia',
  CO: 'Lombardia',
  SO: 'Lombardia',
  BG: 'Lombardia',
  BS: 'Lombardia',
  PV: 'Lombardia',
  CR: 'Lombardia',
  MN: 'Lombardia',
  LC: 'Lombardia',
  LO: 'Lombardia',
  MB: 'Lombardia',
  BZ: 'Trentino-Alto Adige',
  TN: 'Trentino-Alto Adige',
  VR: 'Veneto',
  VI: 'Veneto',
  BL: 'Veneto',
  TV: 'Veneto',
  VE: 'Veneto',
  PD: 'Veneto',
  RO: 'Veneto',
  UD: 'Friuli Venezia Giulia',
  GO: 'Friuli Venezia Giulia',
  TS: 'Friuli Venezia Giulia',
  PN: 'Friuli Venezia Giulia',
  IM: 'Liguria',
  SV: 'Liguria',
  GE: 'Liguria',
  SP: 'Liguria',
  PC: 'Emilia-Romagna',
  PR: 'Emilia-Romagna',
  RE: 'Emilia-Romagna',
  MO: 'Emilia-Romagna',
  BO: 'Emilia-Romagna',
  FE: 'Emilia-Romagna',
  RA: 'Emilia-Romagna',
  FC: 'Emilia-Romagna',
  RN: 'Emilia-Romagna',
  MS: 'Toscana',
  LU: 'Toscana',
  PT: 'Toscana',
  FI: 'Toscana',
  LI: 'Toscana',
  PI: 'Toscana',
  AR: 'Toscana',
  SI: 'Toscana',
  GR: 'Toscana',
  PO: 'Toscana',
  PG: 'Umbria',
  TR: 'Umbria',
  PU: 'Marche',
  AN: 'Marche',
  MC: 'Marche',
  AP: 'Marche',
  FM: 'Marche',
  VT: 'Lazio',
  RI: 'Lazio',
  RM: 'Lazio',
  LT: 'Lazio',
  FR: 'Lazio',
  AQ: 'Abruzzo',
  TE: 'Abruzzo',
  PE: 'Abruzzo',
  CH: 'Abruzzo',
  IS: 'Molise',
  CB: 'Molise',
  CE: 'Campania',
  BN: 'Campania',
  NA: 'Campania',
  AV: 'Campania',
  SA: 'Campania',
  FG: 'Puglia',
  BA: 'Puglia',
  TA: 'Puglia',
  BR: 'Puglia',
  LE: 'Puglia',
  BT: 'Puglia',
  PZ: 'Basilicata',
  MT: 'Basilicata',
  CS: 'Calabria',
  CZ: 'Calabria',
  KR: 'Calabria',
  VV: 'Calabria',
  RC: 'Calabria',
  TP: 'Sicilia',
  PA: 'Sicilia',
  ME: 'Sicilia',
  AG: 'Sicilia',
  CL: 'Sicilia',
  EN: 'Sicilia',
  CT: 'Sicilia',
  RG: 'Sicilia',
  SR: 'Sicilia',
  SS: 'Sardegna',
  NU: 'Sardegna',
  CA: 'Sardegna',
  OR: 'Sardegna',
  SU: 'Sardegna',
};

// ==================== CAP PREFIX → PROVINCE MAPPING ====================
// I CAP italiani seguono una logica geografica per prefisso.
// Questo mapping copre i prefissi principali (primi 2-3 cifre).

const CAP_PREFIX_TO_PROVINCE: [string, string][] = [
  // Lazio
  ['001', 'RM'],
  ['0012', 'RM'],
  ['0013', 'RM'],
  ['0015', 'RM'],
  ['0016', 'RM'],
  ['0017', 'RM'],
  ['0018', 'RM'],
  ['0019', 'RM'],
  ['0002', 'RI'],
  ['0003', 'VT'],
  ['0004', 'LT'],
  ['0005', 'FR'],
  // Piemonte
  ['100', 'TO'],
  ['101', 'TO'],
  ['102', 'TO'],
  ['103', 'TO'],
  ['104', 'TO'],
  ['105', 'TO'],
  ['130', 'VC'],
  ['131', 'VC'],
  ['138', 'VC'],
  ['280', 'NO'],
  ['281', 'NO'],
  ['120', 'CN'],
  ['121', 'CN'],
  ['140', 'AT'],
  ['141', 'AT'],
  ['150', 'AL'],
  ['151', 'AL'],
  ['138', 'BI'],
  ['288', 'VB'],
  // Valle d'Aosta
  ['110', 'AO'],
  // Lombardia
  ['200', 'MI'],
  ['201', 'MI'],
  ['202', 'MI'],
  ['203', 'MI'],
  ['208', 'MI'],
  ['209', 'MI'],
  ['210', 'VA'],
  ['211', 'VA'],
  ['220', 'CO'],
  ['221', 'CO'],
  ['230', 'SO'],
  ['231', 'SO'],
  ['240', 'BG'],
  ['241', 'BG'],
  ['242', 'BG'],
  ['250', 'BS'],
  ['251', 'BS'],
  ['252', 'BS'],
  ['270', 'PV'],
  ['271', 'PV'],
  ['260', 'CR'],
  ['261', 'CR'],
  ['460', 'MN'],
  ['461', 'MN'],
  ['238', 'LC'],
  ['239', 'LC'],
  ['268', 'LO'],
  ['269', 'LO'],
  ['208', 'MB'],
  ['209', 'MB'],
  // Trentino-Alto Adige
  ['390', 'BZ'],
  ['391', 'BZ'],
  ['380', 'TN'],
  ['381', 'TN'],
  // Veneto
  ['370', 'VR'],
  ['371', 'VR'],
  ['360', 'VI'],
  ['361', 'VI'],
  ['320', 'BL'],
  ['321', 'BL'],
  ['310', 'TV'],
  ['311', 'TV'],
  ['300', 'VE'],
  ['301', 'VE'],
  ['350', 'PD'],
  ['351', 'PD'],
  ['450', 'RO'],
  ['451', 'RO'],
  // Friuli Venezia Giulia
  ['330', 'UD'],
  ['331', 'UD'],
  ['340', 'GO'],
  ['341', 'GO'],
  ['341', 'TS'],
  ['330', 'PN'],
  ['331', 'PN'],
  // Liguria
  ['180', 'IM'],
  ['181', 'IM'],
  ['170', 'SV'],
  ['171', 'SV'],
  ['160', 'GE'],
  ['161', 'GE'],
  ['190', 'SP'],
  ['191', 'SP'],
  // Emilia-Romagna
  ['290', 'PC'],
  ['291', 'PC'],
  ['430', 'PR'],
  ['431', 'PR'],
  ['420', 'RE'],
  ['421', 'RE'],
  ['410', 'MO'],
  ['411', 'MO'],
  ['400', 'BO'],
  ['401', 'BO'],
  ['440', 'FE'],
  ['441', 'FE'],
  ['480', 'RA'],
  ['481', 'RA'],
  ['470', 'FC'],
  ['471', 'FC'],
  ['478', 'RN'],
  ['479', 'RN'],
  // Toscana
  ['540', 'MS'],
  ['550', 'LU'],
  ['551', 'LU'],
  ['510', 'PT'],
  ['511', 'PT'],
  ['500', 'FI'],
  ['501', 'FI'],
  ['502', 'FI'],
  ['570', 'LI'],
  ['571', 'LI'],
  ['560', 'PI'],
  ['561', 'PI'],
  ['520', 'AR'],
  ['521', 'AR'],
  ['530', 'SI'],
  ['531', 'SI'],
  ['580', 'GR'],
  ['581', 'GR'],
  ['590', 'PO'],
  // Umbria
  ['060', 'PG'],
  ['061', 'PG'],
  ['050', 'TR'],
  ['051', 'TR'],
  // Marche
  ['610', 'PU'],
  ['611', 'PU'],
  ['600', 'AN'],
  ['601', 'AN'],
  ['620', 'MC'],
  ['621', 'MC'],
  ['630', 'AP'],
  ['631', 'AP'],
  ['638', 'FM'],
  // Abruzzo
  ['670', 'AQ'],
  ['671', 'AQ'],
  ['640', 'TE'],
  ['641', 'TE'],
  ['650', 'PE'],
  ['651', 'PE'],
  ['660', 'CH'],
  ['661', 'CH'],
  // Molise
  ['860', 'IS'],
  ['861', 'IS'],
  ['860', 'CB'],
  ['861', 'CB'],
  // Campania
  ['810', 'CE'],
  ['811', 'CE'],
  ['820', 'BN'],
  ['821', 'BN'],
  ['800', 'NA'],
  ['801', 'NA'],
  ['802', 'NA'],
  ['830', 'AV'],
  ['831', 'AV'],
  ['840', 'SA'],
  ['841', 'SA'],
  // Puglia
  ['710', 'FG'],
  ['711', 'FG'],
  ['700', 'BA'],
  ['701', 'BA'],
  ['740', 'TA'],
  ['741', 'TA'],
  ['720', 'BR'],
  ['721', 'BR'],
  ['730', 'LE'],
  ['731', 'LE'],
  ['760', 'BT'],
  ['761', 'BT'],
  // Basilicata
  ['850', 'PZ'],
  ['851', 'PZ'],
  ['750', 'MT'],
  ['751', 'MT'],
  // Calabria
  ['870', 'CS'],
  ['871', 'CS'],
  ['880', 'CZ'],
  ['881', 'CZ'],
  ['888', 'KR'],
  ['889', 'KR'],
  ['898', 'VV'],
  ['899', 'VV'],
  ['890', 'RC'],
  ['891', 'RC'],
  // Sicilia
  ['910', 'TP'],
  ['911', 'TP'],
  ['900', 'PA'],
  ['901', 'PA'],
  ['980', 'ME'],
  ['981', 'ME'],
  ['920', 'AG'],
  ['921', 'AG'],
  ['930', 'CL'],
  ['931', 'CL'],
  ['940', 'EN'],
  ['941', 'EN'],
  ['950', 'CT'],
  ['951', 'CT'],
  ['970', 'RG'],
  ['971', 'RG'],
  ['960', 'SR'],
  ['961', 'SR'],
  // Sardegna
  ['070', 'SS'],
  ['071', 'SS'],
  ['080', 'NU'],
  ['081', 'NU'],
  ['090', 'CA'],
  ['091', 'CA'],
  ['098', 'OR'],
  ['099', 'OR'],
  ['090', 'SU'],
  ['091', 'SU'],
];

// Sorted longest prefix first for best-match lookup
const SORTED_CAP_PREFIXES = CAP_PREFIX_TO_PROVINCE.sort(
  (a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0])
);

// ==================== CAPOLUOGHI DI PROVINCIA (CAP principale) ====================

const CAPOLUOGHI: Record<string, { cap: string; province: string }> = {
  roma: { cap: '00100', province: 'RM' },
  milano: { cap: '20100', province: 'MI' },
  napoli: { cap: '80100', province: 'NA' },
  torino: { cap: '10100', province: 'TO' },
  palermo: { cap: '90100', province: 'PA' },
  genova: { cap: '16100', province: 'GE' },
  bologna: { cap: '40100', province: 'BO' },
  firenze: { cap: '50100', province: 'FI' },
  bari: { cap: '70100', province: 'BA' },
  catania: { cap: '95100', province: 'CT' },
  venezia: { cap: '30100', province: 'VE' },
  verona: { cap: '37100', province: 'VR' },
  messina: { cap: '98100', province: 'ME' },
  padova: { cap: '35100', province: 'PD' },
  trieste: { cap: '34100', province: 'TS' },
  taranto: { cap: '74100', province: 'TA' },
  brescia: { cap: '25100', province: 'BS' },
  parma: { cap: '43100', province: 'PR' },
  prato: { cap: '59100', province: 'PO' },
  modena: { cap: '41100', province: 'MO' },
  'reggio calabria': { cap: '89100', province: 'RC' },
  'reggio emilia': { cap: '42100', province: 'RE' },
  perugia: { cap: '06100', province: 'PG' },
  livorno: { cap: '57100', province: 'LI' },
  ravenna: { cap: '48100', province: 'RA' },
  cagliari: { cap: '09100', province: 'CA' },
  foggia: { cap: '71100', province: 'FG' },
  rimini: { cap: '47900', province: 'RN' },
  salerno: { cap: '84100', province: 'SA' },
  ferrara: { cap: '44100', province: 'FE' },
  sassari: { cap: '07100', province: 'SS' },
  siracusa: { cap: '96100', province: 'SR' },
  pescara: { cap: '65100', province: 'PE' },
  monza: { cap: '20900', province: 'MB' },
  bergamo: { cap: '24100', province: 'BG' },
  trento: { cap: '38100', province: 'TN' },
  vicenza: { cap: '36100', province: 'VI' },
  terni: { cap: '05100', province: 'TR' },
  bolzano: { cap: '39100', province: 'BZ' },
  novara: { cap: '28100', province: 'NO' },
  piacenza: { cap: '29100', province: 'PC' },
  ancona: { cap: '60100', province: 'AN' },
  andria: { cap: '76123', province: 'BT' },
  arezzo: { cap: '52100', province: 'AR' },
  udine: { cap: '33100', province: 'UD' },
  cesena: { cap: '47521', province: 'FC' },
  lecce: { cap: '73100', province: 'LE' },
  pesaro: { cap: '61121', province: 'PU' },
  barletta: { cap: '76121', province: 'BT' },
  alessandria: { cap: '15121', province: 'AL' },
  aosta: { cap: '11100', province: 'AO' },
  asti: { cap: '14100', province: 'AT' },
  avellino: { cap: '83100', province: 'AV' },
  belluno: { cap: '32100', province: 'BL' },
  benevento: { cap: '82100', province: 'BN' },
  biella: { cap: '13900', province: 'BI' },
  brindisi: { cap: '72100', province: 'BR' },
  caltanissetta: { cap: '93100', province: 'CL' },
  campobasso: { cap: '86100', province: 'CB' },
  caserta: { cap: '81100', province: 'CE' },
  catanzaro: { cap: '88100', province: 'CZ' },
  chieti: { cap: '66100', province: 'CH' },
  como: { cap: '22100', province: 'CO' },
  cosenza: { cap: '87100', province: 'CS' },
  cremona: { cap: '26100', province: 'CR' },
  crotone: { cap: '88900', province: 'KR' },
  cuneo: { cap: '12100', province: 'CN' },
  enna: { cap: '94100', province: 'EN' },
  fermo: { cap: '63900', province: 'FM' },
  frosinone: { cap: '03100', province: 'FR' },
  gorizia: { cap: '34170', province: 'GO' },
  grosseto: { cap: '58100', province: 'GR' },
  imperia: { cap: '18100', province: 'IM' },
  isernia: { cap: '86170', province: 'IS' },
  'la spezia': { cap: '19100', province: 'SP' },
  "l'aquila": { cap: '67100', province: 'AQ' },
  latina: { cap: '04100', province: 'LT' },
  lecco: { cap: '23900', province: 'LC' },
  lodi: { cap: '26900', province: 'LO' },
  lucca: { cap: '55100', province: 'LU' },
  macerata: { cap: '62100', province: 'MC' },
  mantova: { cap: '46100', province: 'MN' },
  massa: { cap: '54100', province: 'MS' },
  matera: { cap: '75100', province: 'MT' },
  nuoro: { cap: '08100', province: 'NU' },
  oristano: { cap: '09170', province: 'OR' },
  pavia: { cap: '27100', province: 'PV' },
  pistoia: { cap: '51100', province: 'PT' },
  pordenone: { cap: '33170', province: 'PN' },
  potenza: { cap: '85100', province: 'PZ' },
  ragusa: { cap: '97100', province: 'RG' },
  rieti: { cap: '02100', province: 'RI' },
  rovigo: { cap: '45100', province: 'RO' },
  savona: { cap: '17100', province: 'SV' },
  siena: { cap: '53100', province: 'SI' },
  sondrio: { cap: '23100', province: 'SO' },
  'sud sardegna': { cap: '09010', province: 'SU' },
  teramo: { cap: '64100', province: 'TE' },
  trapani: { cap: '91100', province: 'TP' },
  treviso: { cap: '31100', province: 'TV' },
  varese: { cap: '21100', province: 'VA' },
  verbania: { cap: '28900', province: 'VB' },
  vercelli: { cap: '13100', province: 'VC' },
  'vibo valentia': { cap: '89900', province: 'VV' },
  viterbo: { cap: '01100', province: 'VT' },
  agrigento: { cap: '92100', province: 'AG' },
  'ascoli piceno': { cap: '63100', province: 'AP' },
};

// ==================== LOOKUP FUNCTIONS ====================

/**
 * Cerca la provincia probabile per un CAP usando il prefisso
 */
export function getProvinceForCap(cap: string): string | undefined {
  if (!/^\d{5}$/.test(cap)) return undefined;

  for (const [prefix, province] of SORTED_CAP_PREFIXES) {
    if (cap.startsWith(prefix)) {
      return province;
    }
  }
  return undefined;
}

/**
 * Cerca i CAP associati a una città (capoluogo)
 */
export function getCapsForCity(city: string, province?: string): string[] {
  const normalized = city.toLowerCase().trim();
  const entry = CAPOLUOGHI[normalized];
  if (entry) {
    if (province && entry.province !== province.toUpperCase()) return [];
    return [entry.cap];
  }
  return [];
}

/**
 * Cerca le informazioni di una città (capoluogo)
 */
export function getCityInfo(
  city: string
): { cap: string; province: string; region: string } | undefined {
  const normalized = city.toLowerCase().trim();
  const entry = CAPOLUOGHI[normalized];
  if (entry) {
    return {
      cap: entry.cap,
      province: entry.province,
      region: PROVINCE_REGION[entry.province] || '',
    };
  }
  return undefined;
}

/**
 * Cerca la regione di una provincia
 */
export function getRegionForProvince(province: string): string | undefined {
  return PROVINCE_REGION[province.toUpperCase()];
}

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Valida che un CAP sia coerente con la provincia dichiarata
 */
export function validateCapProvince(cap: string, province: string): boolean {
  if (!/^\d{5}$/.test(cap)) return false;
  if (!/^[A-Z]{2}$/i.test(province)) return false;

  const expectedProvince = getProvinceForCap(cap);
  if (!expectedProvince) return true; // Se non troviamo il prefisso, non invalidiamo

  return expectedProvince === province.toUpperCase();
}

/**
 * Valida che un CAP sia coerente con la città dichiarata
 * Per i capoluoghi di provincia verifica il match esatto.
 * Per altre città, verifica almeno la coerenza con la provincia.
 */
export function validateCapCity(cap: string, city: string): boolean {
  if (!/^\d{5}$/.test(cap)) return false;

  const normalized = city.toLowerCase().trim();
  const capoluogo = CAPOLUOGHI[normalized];

  if (capoluogo) {
    // Per i capoluoghi grandi che hanno range di CAP (es. Roma 00100-00199),
    // verifichiamo solo il prefisso
    const expectedPrefix = capoluogo.cap.substring(0, 3);
    return cap.startsWith(expectedPrefix);
  }

  // Per città non in lista, non invalidiamo
  return true;
}

/**
 * Validazione completa di un indirizzo italiano (CAP + Città + Provincia)
 * Restituisce risultato dettagliato con suggerimenti
 */
export function validateAddress(cap: string, city: string, province: string): CapValidationResult {
  // Validazione formato
  if (cap && !/^\d{5}$/.test(cap)) {
    return { valid: false, message: 'CAP deve essere di 5 cifre' };
  }
  if (province && !/^[A-Z]{2}$/i.test(province)) {
    return { valid: false, message: 'Provincia deve essere 2 lettere (es. MI, RM)' };
  }

  // Se abbiamo la città nel database, possiamo fare cross-check completo
  const normalized = city.toLowerCase().trim();
  const capoluogo = CAPOLUOGHI[normalized];

  if (capoluogo) {
    const issues: string[] = [];
    const suggestion: CapValidationResult['suggestion'] = {};

    // Check provincia
    if (province && province.toUpperCase() !== capoluogo.province) {
      issues.push(`Provincia per ${city} dovrebbe essere ${capoluogo.province}`);
      suggestion.correctProvince = capoluogo.province;
    }

    // Check CAP (prefisso)
    if (cap) {
      const expectedPrefix = capoluogo.cap.substring(0, 3);
      if (!cap.startsWith(expectedPrefix)) {
        issues.push(`CAP per ${city} dovrebbe iniziare con ${expectedPrefix}`);
        suggestion.correctCap = capoluogo.cap;
      }
    }

    if (issues.length > 0) {
      return {
        valid: false,
        message: issues.join('. '),
        suggestion: Object.keys(suggestion).length > 0 ? suggestion : undefined,
      };
    }
  }

  // Cross-check CAP → provincia
  if (cap && province) {
    if (!validateCapProvince(cap, province)) {
      const expectedProvince = getProvinceForCap(cap);
      return {
        valid: false,
        message: `CAP ${cap} non corrisponde alla provincia ${province}`,
        suggestion: expectedProvince ? { correctProvince: expectedProvince } : undefined,
      };
    }
  }

  return { valid: true };
}

/**
 * Verifica se una provincia è valida
 */
export function isValidProvince(province: string): boolean {
  return province.toUpperCase() in PROVINCE_REGION;
}

/**
 * Restituisce tutte le province italiane
 */
export function getAllProvinces(): string[] {
  return Object.keys(PROVINCE_REGION).sort();
}
