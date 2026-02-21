/**
 * Seed Script: Popola listini fornitore SpediamoPro Europa dal PDF Listini_Europa_2026.pdf
 *
 * Crea 1 listino per servizio (solo Sconto 22% — ricarica €1000):
 *   1. UPS Standard Europa (economy, 2-5gg, zone 3/4/5/51/52/704)
 *   2. DPD/BRT Europa (economy, 2-5gg, zone 1/2/3)
 *   3. EuroExpress (economy, 2-5gg, per nazione, pesi 50-100kg + supplemento 50kg)
 *   4. UPS Express Saver Europa (express, 24h, zone 2-3/4/41-42/5/Canarie/UK)
 *
 * Ogni entry ha zone_code per identificare la zona geografica.
 * Il metadata del listino include il mapping zone→nazioni (ISO 2-letter codes).
 *
 * Prezzi IVA esclusa, fuel surcharge incluso.
 *
 * Usage: npx tsx scripts/seed-spediamopro-price-lists-europa.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── ZONE DEFINITIONS ───

interface ZoneDefinition {
  code: string;
  label: string;
  countries: string[]; // ISO 3166-1 alpha-2
}

const UPS_STANDARD_ZONES: ZoneDefinition[] = [
  { code: 'EU-UPS-Z3', label: 'Zona 3', countries: ['FR', 'DE'] },
  {
    code: 'EU-UPS-Z4',
    label: 'Zona 4',
    countries: ['BE', 'IE', 'DK', 'LU', 'MC', 'NL', 'PT', 'ES'],
  },
  { code: 'EU-UPS-Z5', label: 'Zona 5', countries: ['AT', 'HR', 'FI', 'SE', 'SI'] },
  { code: 'EU-UPS-Z51', label: 'Zona 51', countries: ['CZ', 'GR', 'PL', 'SK', 'HU'] },
  { code: 'EU-UPS-Z52', label: 'Zona 52', countries: ['BG', 'EE', 'LV', 'LT', 'RO'] },
  { code: 'EU-UPS-Z704', label: 'Zona 704', countries: ['GB'] },
];

const DPD_BRT_ZONES: ZoneDefinition[] = [
  { code: 'EU-DPD-Z1', label: 'Zona 1', countries: ['DE', 'FR', 'ES'] },
  {
    code: 'EU-DPD-Z2',
    label: 'Zona 2',
    countries: ['EE', 'LV', 'LT', 'PL', 'HU', 'SI', 'RO', 'BG', 'HR', 'GR', 'IE', 'FI', 'SE'],
  },
  {
    code: 'EU-DPD-Z3',
    label: 'Zona 3',
    countries: ['AT', 'CZ', 'SK', 'BE', 'LU', 'NL', 'PT', 'DK'],
  },
];

const UPS_EXPRESS_ZONES: ZoneDefinition[] = [
  {
    code: 'EU-UPSEXP-Z23',
    label: 'Zona 2/3',
    countries: ['BE', 'FR', 'DE', 'AT', 'LU', 'NL', 'ES'],
  },
  { code: 'EU-UPSEXP-Z4', label: 'Zona 4', countries: ['DK', 'FI', 'GR', 'IE', 'PT', 'SE'] },
  {
    code: 'EU-UPSEXP-Z4142',
    label: 'Zona 41/42',
    countries: ['CZ', 'HR', 'EE', 'LV', 'LT', 'PL', 'SI', 'SK', 'BG', 'CY', 'MT', 'RO', 'HU'],
  },
  { code: 'EU-UPSEXP-Z5', label: 'Zona 5', countries: ['AD', 'JE', 'LI', 'NO', 'CH'] },
  { code: 'EU-UPSEXP-CANARIE', label: 'Canarie', countries: ['IC'] }, // Canary Islands
  { code: 'EU-UPSEXP-UK', label: 'U.K.', countries: ['GB'] },
];

// EuroExpress: price per country (no zones, direct country mapping)
// Each country gets its own zone_code: EU-EUROEXP-{ISO}

// ─── PRICE DATA (Sconto 22% only) ───

interface ZoneWeightEntry {
  zone_code: string;
  weight_to: number;
  price: number; // Sconto 22%
}

// ── UPS STANDARD EUROPA (Economy 2-5gg) ──
// MRPP = 8.00 per tutte le zone (costo minimo per pacco multi-collo)

const UPS_STANDARD_ENTRIES: ZoneWeightEntry[] = [
  // Zona 3 (FR, DE)
  { zone_code: 'EU-UPS-Z3', weight_to: 2, price: 9.53 },
  { zone_code: 'EU-UPS-Z3', weight_to: 5, price: 9.53 },
  { zone_code: 'EU-UPS-Z3', weight_to: 10, price: 11.37 },
  { zone_code: 'EU-UPS-Z3', weight_to: 15, price: 11.84 },
  { zone_code: 'EU-UPS-Z3', weight_to: 20, price: 12.56 },
  { zone_code: 'EU-UPS-Z3', weight_to: 25, price: 13.53 },

  // Zona 4 (BE, IE, DK, LU, MC, NL, PT, ES)
  { zone_code: 'EU-UPS-Z4', weight_to: 2, price: 9.5 },
  { zone_code: 'EU-UPS-Z4', weight_to: 5, price: 9.5 },
  { zone_code: 'EU-UPS-Z4', weight_to: 10, price: 11.38 },
  { zone_code: 'EU-UPS-Z4', weight_to: 15, price: 11.65 },
  { zone_code: 'EU-UPS-Z4', weight_to: 20, price: 12.99 },
  { zone_code: 'EU-UPS-Z4', weight_to: 25, price: 14.19 },

  // Zona 5 (AT, HR, FI, SE, SI)
  { zone_code: 'EU-UPS-Z5', weight_to: 2, price: 9.54 },
  { zone_code: 'EU-UPS-Z5', weight_to: 5, price: 9.54 },
  { zone_code: 'EU-UPS-Z5', weight_to: 10, price: 11.97 },
  { zone_code: 'EU-UPS-Z5', weight_to: 15, price: 12.67 },
  { zone_code: 'EU-UPS-Z5', weight_to: 20, price: 13.39 },
  { zone_code: 'EU-UPS-Z5', weight_to: 25, price: 14.72 },

  // Zona 51 (CZ, GR, PL, SK, HU)
  { zone_code: 'EU-UPS-Z51', weight_to: 2, price: 9.48 },
  { zone_code: 'EU-UPS-Z51', weight_to: 5, price: 9.48 },
  { zone_code: 'EU-UPS-Z51', weight_to: 10, price: 12.2 },
  { zone_code: 'EU-UPS-Z51', weight_to: 15, price: 14.02 },
  { zone_code: 'EU-UPS-Z51', weight_to: 20, price: 14.74 },
  { zone_code: 'EU-UPS-Z51', weight_to: 25, price: 16.77 },

  // Zona 52 (BG, EE, LV, LT, RO)
  { zone_code: 'EU-UPS-Z52', weight_to: 2, price: 9.64 },
  { zone_code: 'EU-UPS-Z52', weight_to: 5, price: 15.23 },
  { zone_code: 'EU-UPS-Z52', weight_to: 10, price: 24.37 },
  { zone_code: 'EU-UPS-Z52', weight_to: 15, price: 27.36 },
  { zone_code: 'EU-UPS-Z52', weight_to: 20, price: 28.08 },
  { zone_code: 'EU-UPS-Z52', weight_to: 25, price: 32.01 },

  // Zona 704 (GB)
  { zone_code: 'EU-UPS-Z704', weight_to: 2, price: 9.59 },
  { zone_code: 'EU-UPS-Z704', weight_to: 5, price: 11.69 },
  { zone_code: 'EU-UPS-Z704', weight_to: 10, price: 13.04 },
  { zone_code: 'EU-UPS-Z704', weight_to: 15, price: 39.69 },
  { zone_code: 'EU-UPS-Z704', weight_to: 20, price: 43.12 },
  { zone_code: 'EU-UPS-Z704', weight_to: 25, price: 43.42 },
];

// ── DPD/BRT EUROPA (Economy 2-5gg) ──

const DPD_BRT_ENTRIES: ZoneWeightEntry[] = [
  // Zona 1 (DE, FR, ES)
  { zone_code: 'EU-DPD-Z1', weight_to: 2, price: 6.97 },
  { zone_code: 'EU-DPD-Z1', weight_to: 5, price: 9.2 },
  { zone_code: 'EU-DPD-Z1', weight_to: 10, price: 11.86 },
  { zone_code: 'EU-DPD-Z1', weight_to: 15, price: 12.48 },
  { zone_code: 'EU-DPD-Z1', weight_to: 20, price: 13.82 },
  { zone_code: 'EU-DPD-Z1', weight_to: 25, price: 15.02 },
  { zone_code: 'EU-DPD-Z1', weight_to: 30, price: 14.58 },

  // Zona 2 (EE, LV, LT, PL, HU, SI, RO, BG, HR, GR, IE, FI, SE)
  { zone_code: 'EU-DPD-Z2', weight_to: 2, price: 10.71 },
  { zone_code: 'EU-DPD-Z2', weight_to: 5, price: 12.49 },
  { zone_code: 'EU-DPD-Z2', weight_to: 10, price: 14.36 },
  { zone_code: 'EU-DPD-Z2', weight_to: 15, price: 14.98 },
  { zone_code: 'EU-DPD-Z2', weight_to: 20, price: 15.62 },
  { zone_code: 'EU-DPD-Z2', weight_to: 25, price: 16.33 },
  { zone_code: 'EU-DPD-Z2', weight_to: 30, price: 16.82 },

  // Zona 3 (AT, CZ, SK, BE, LU, NL, PT, DK)
  { zone_code: 'EU-DPD-Z3', weight_to: 2, price: 8.33 },
  { zone_code: 'EU-DPD-Z3', weight_to: 5, price: 10.11 },
  { zone_code: 'EU-DPD-Z3', weight_to: 10, price: 11.86 },
  { zone_code: 'EU-DPD-Z3', weight_to: 15, price: 12.48 },
  { zone_code: 'EU-DPD-Z3', weight_to: 20, price: 13.82 },
  { zone_code: 'EU-DPD-Z3', weight_to: 25, price: 15.02 },
  { zone_code: 'EU-DPD-Z3', weight_to: 30, price: 15.02 },
];

// ── EUROEXPRESS (Economy 2-5gg, per nazione, 50-100kg) ──
// Sconto 22% prices per country

interface EuroExpressEntry {
  country_code: string;
  country_name: string;
  kg50: number;
  kg75: number;
  kg100: number;
  kg50_extra: number; // supplemento per ogni 50kg oltre 100kg
}

const EUROEXPRESS_DATA: EuroExpressEntry[] = [
  {
    country_code: 'AT',
    country_name: 'Austria',
    kg50: 25.37,
    kg75: 34.3,
    kg100: 43.22,
    kg50_extra: 25.38,
  },
  {
    country_code: 'BE',
    country_name: 'Belgio',
    kg50: 35.7,
    kg75: 49.17,
    kg100: 64.05,
    kg50_extra: 37.63,
  },
  {
    country_code: 'BG',
    country_name: 'Bulgaria',
    kg50: 72.97,
    kg75: 104.12,
    kg100: 108.67,
    kg50_extra: 63.88,
  },
  {
    country_code: 'HR',
    country_name: 'Croazia',
    kg50: 40.25,
    kg75: 55.12,
    kg100: 59.5,
    kg50_extra: 35.0,
  },
  {
    country_code: 'DK',
    country_name: 'Danimarca',
    kg50: 71.4,
    kg75: 86.27,
    kg100: 113.05,
    kg50_extra: 66.5,
  },
  {
    country_code: 'EE',
    country_name: 'Estonia',
    kg50: 65.45,
    kg75: 98.17,
    kg100: 130.9,
    kg50_extra: 77.0,
  },
  {
    country_code: 'FI',
    country_name: 'Finlandia',
    kg50: 71.4,
    kg75: 99.75,
    kg100: 132.47,
    kg50_extra: 77.88,
  },
  {
    country_code: 'FR',
    country_name: 'Francia',
    kg50: 31.32,
    kg75: 44.62,
    kg100: 56.52,
    kg50_extra: 33.25,
  },
  {
    country_code: 'DE',
    country_name: 'Germania',
    kg50: 32.72,
    kg75: 44.62,
    kg100: 56.52,
    kg50_extra: 33.25,
  },
  {
    country_code: 'IE',
    country_name: 'Irlanda',
    kg50: 81.9,
    kg75: 104.12,
    kg100: 119.0,
    kg50_extra: 70.0,
  },
  {
    country_code: 'LV',
    country_name: 'Lettonia',
    kg50: 65.45,
    kg75: 98.17,
    kg100: 130.9,
    kg50_extra: 77.0,
  },
  {
    country_code: 'LT',
    country_name: 'Lituania',
    kg50: 65.45,
    kg75: 98.17,
    kg100: 130.9,
    kg50_extra: 77.0,
  },
  {
    country_code: 'LU',
    country_name: 'Lussemburgo',
    kg50: 35.7,
    kg75: 49.17,
    kg100: 64.05,
    kg50_extra: 37.63,
  },
  {
    country_code: 'NL',
    country_name: 'Olanda',
    kg50: 37.27,
    kg75: 53.55,
    kg100: 68.42,
    kg50_extra: 40.25,
  },
  {
    country_code: 'PL',
    country_name: 'Polonia',
    kg50: 58.1,
    kg75: 75.95,
    kg100: 90.82,
    kg50_extra: 53.38,
  },
  {
    country_code: 'PT',
    country_name: 'Portogallo',
    kg50: 34.3,
    kg75: 50.57,
    kg100: 67.02,
    kg50_extra: 39.38,
  },
  {
    country_code: 'CZ',
    country_name: 'Rep. Ceca',
    kg50: 35.7,
    kg75: 49.17,
    kg100: 53.55,
    kg50_extra: 31.5,
  },
  {
    country_code: 'RO',
    country_name: 'Romania',
    kg50: 80.32,
    kg75: 114.62,
    kg100: 119.0,
    kg50_extra: 70.0,
  },
  {
    country_code: 'SK',
    country_name: 'Slovacchia',
    kg50: 35.7,
    kg75: 49.17,
    kg100: 53.55,
    kg50_extra: 31.5,
  },
  {
    country_code: 'SI',
    country_name: 'Slovenia',
    kg50: 35.7,
    kg75: 49.17,
    kg100: 53.55,
    kg50_extra: 31.5,
  },
  {
    country_code: 'ES',
    country_name: 'Spagna',
    kg50: 25.37,
    kg75: 35.7,
    kg100: 44.62,
    kg50_extra: 26.25,
  },
  {
    country_code: 'SE',
    country_name: 'Svezia',
    kg50: 81.9,
    kg75: 102.72,
    kg100: 105.7,
    kg50_extra: 62.13,
  },
  {
    country_code: 'HU',
    country_name: 'Ungheria',
    kg50: 35.7,
    kg75: 49.17,
    kg100: 53.55,
    kg50_extra: 31.5,
  },
];

// ── UPS EXPRESS SAVER EUROPA (Express 24h) ──

const UPS_EXPRESS_ENTRIES: ZoneWeightEntry[] = [
  // Zona 2/3 (BE, FR, DE, AT, LU, NL, ES)
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 0.5, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 1, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 1.5, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 2, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 2.5, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 3, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 4, price: 16.36 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 5, price: 18.73 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 6, price: 20.46 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 7, price: 22.2 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 8, price: 23.94 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 9, price: 25.67 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 10, price: 27.41 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 12, price: 29.6 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 14, price: 32.2 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 16, price: 34.84 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 18, price: 37.47 },
  { zone_code: 'EU-UPSEXP-Z23', weight_to: 20, price: 40.13 },

  // Zona 4 (DK, FI, GR, IE, PT, SE)
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 0.5, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 1, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 1.5, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 2, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 2.5, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 3, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 4, price: 17.42 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 5, price: 19.94 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 6, price: 21.77 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 7, price: 23.62 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 8, price: 25.5 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 9, price: 27.34 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 10, price: 29.21 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 12, price: 31.53 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 14, price: 34.64 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 16, price: 37.76 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 18, price: 40.86 },
  { zone_code: 'EU-UPSEXP-Z4', weight_to: 20, price: 43.99 },

  // Zona 41/42 (CZ, HR, EE, LV, LT, PL, SI, SK, BG, CY, MT, RO, HU)
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 0.5, price: 13.37 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 1, price: 15.31 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 1.5, price: 17.62 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 2, price: 21.02 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 2.5, price: 24.43 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 3, price: 27.27 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 4, price: 34.01 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 5, price: 40.75 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 6, price: 44.74 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 7, price: 48.72 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 8, price: 52.69 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 9, price: 56.67 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 10, price: 60.66 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 12, price: 68.95 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 14, price: 76.4 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 16, price: 83.86 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 18, price: 91.31 },
  { zone_code: 'EU-UPSEXP-Z4142', weight_to: 20, price: 98.97 },

  // Zona 5 (AD, JE, LI, NO, CH)
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 0.5, price: 19.36 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 1, price: 19.36 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 1.5, price: 19.36 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 2, price: 19.36 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 2.5, price: 19.36 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 3, price: 21.31 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 4, price: 24.04 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 5, price: 28.52 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 6, price: 31.95 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 7, price: 34.49 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 8, price: 37.02 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 9, price: 39.55 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 10, price: 42.06 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 12, price: 44.59 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 14, price: 47.77 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 16, price: 51.56 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 18, price: 55.42 },
  { zone_code: 'EU-UPSEXP-Z5', weight_to: 20, price: 59.24 },

  // Canarie
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 0.5, price: 14.15 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 1, price: 14.51 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 1.5, price: 14.51 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 2, price: 14.69 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 2.5, price: 15.58 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 3, price: 17.19 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 4, price: 20.36 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 5, price: 23.55 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 6, price: 25.96 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 7, price: 28.44 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 8, price: 30.87 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 9, price: 33.28 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 10, price: 35.59 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 12, price: 38.45 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 14, price: 42.53 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 16, price: 45.59 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 18, price: 50.65 },
  { zone_code: 'EU-UPSEXP-CANARIE', weight_to: 20, price: 54.74 },

  // U.K.
  { zone_code: 'EU-UPSEXP-UK', weight_to: 0.5, price: 19.51 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 1, price: 19.51 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 1.5, price: 19.51 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 2, price: 21.61 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 2.5, price: 23.62 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 3, price: 25.07 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 4, price: 28.52 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 5, price: 31.95 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 6, price: 34.49 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 7, price: 37.02 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 8, price: 39.55 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 9, price: 42.06 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 10, price: 44.59 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 12, price: 47.77 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 14, price: 51.56 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 16, price: 55.42 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 18, price: 59.24 },
  { zone_code: 'EU-UPSEXP-UK', weight_to: 20, price: 63.12 },
];

// ─── SERVICE DEFINITIONS ───

interface EuropaService {
  name: string;
  courier_slug: string;
  carrier_code: string;
  service_type: 'standard' | 'express' | 'economy';
  delivery_days_min: number;
  delivery_days_max: number;
  zones: ZoneDefinition[];
  entries: ZoneWeightEntry[];
  mrpp?: number; // minimum per-package price for multi-collo
}

const EUROPA_SERVICES: EuropaService[] = [
  {
    name: 'UPS Standard Europa',
    courier_slug: 'ups',
    carrier_code: 'UPSSTD',
    service_type: 'economy',
    delivery_days_min: 2,
    delivery_days_max: 5,
    zones: UPS_STANDARD_ZONES,
    entries: UPS_STANDARD_ENTRIES,
    mrpp: 8.0,
  },
  {
    name: 'DPD/BRT Europa',
    courier_slug: 'brt',
    carrier_code: 'DPDBRT',
    service_type: 'economy',
    delivery_days_min: 2,
    delivery_days_max: 5,
    zones: DPD_BRT_ZONES,
    entries: DPD_BRT_ENTRIES,
  },
  {
    name: 'UPS Express Saver Europa',
    courier_slug: 'ups',
    carrier_code: 'UPSEXPSAVER',
    service_type: 'express',
    delivery_days_min: 1,
    delivery_days_max: 1,
    zones: UPS_EXPRESS_ZONES,
    entries: UPS_EXPRESS_ENTRIES,
    mrpp: 13.36,
  },
];

// ─── WEIGHT BRACKETS HELPER ───

// Build weight_from from sorted entries per zone
function getWeightFrom(entries: ZoneWeightEntry[], zoneCode: string, weightTo: number): number {
  const zoneEntries = entries
    .filter((e) => e.zone_code === zoneCode)
    .sort((a, b) => a.weight_to - b.weight_to);

  const idx = zoneEntries.findIndex((e) => e.weight_to === weightTo);
  return idx <= 0 ? 0 : zoneEntries[idx - 1].weight_to;
}

// ─── MAIN SEED ───

async function seed() {
  const { supabaseAdmin } = await import('@/lib/db/client');
  const { createPriceList, addPriceListEntries } = await import('@/lib/db/price-lists');

  console.log('═══════════════════════════════════════════════════');
  console.log('  SEED: Listini Fornitore SpediamoPro Europa 2026');
  console.log('═══════════════════════════════════════════════════\n');

  // Get admin user
  const { data: adminUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('account_type', ['superadmin', 'admin'])
    .limit(1)
    .single();

  if (!adminUser) {
    throw new Error('Nessun admin/superadmin trovato.');
  }
  const adminId = adminUser.id;
  console.log(`Admin user: ${adminId}\n`);

  // Resolve courier slugs to UUIDs
  const courierUUIDs: Record<string, string> = {};
  const slugAliases: Record<string, string[]> = {
    brt: ['brt', 'bartolini'],
    poste: ['poste', 'postedeliverybusiness'],
  };

  for (const slug of ['ups', 'brt']) {
    const namesToTry = slugAliases[slug] || [slug];
    let courier: { id: string } | null = null;
    for (const name of namesToTry) {
      const { data } = await supabaseAdmin
        .from('couriers')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      if (data) {
        courier = data;
        break;
      }
    }
    if (courier) {
      courierUUIDs[slug] = courier.id;
      console.log(`  Courier "${slug}" -> ${courier.id}`);
    } else {
      throw new Error(`Courier "${slug}" non trovato. Esegui prima il seed Italia.`);
    }
  }

  // Also need EuroExpress courier — could be a separate carrier or re-use existing
  // EuroExpress uses its own courier entity
  let euroExpressCourierId: string;
  const { data: euroExpCourier } = await supabaseAdmin
    .from('couriers')
    .select('id')
    .eq('name', 'euroexpress')
    .maybeSingle();

  if (euroExpCourier) {
    euroExpressCourierId = euroExpCourier.id;
    console.log(`  Courier "euroexpress" -> ${euroExpressCourierId}`);
  } else {
    const { data: newCourier } = await supabaseAdmin
      .from('couriers')
      .insert({
        name: 'euroexpress',
        display_name: 'EuroExpress',
        code: 'EEX',
      })
      .select('id')
      .single();
    if (!newCourier) throw new Error('Impossibile creare courier EuroExpress');
    euroExpressCourierId = newCourier.id;
    console.log(`  Courier "euroexpress" CREATO -> ${euroExpressCourierId}`);
  }
  console.log('');

  // Get courier_config_id from existing SpediamoPro lists (same account)
  const { data: existingConfig } = await supabaseAdmin
    .from('price_lists')
    .select('metadata')
    .eq('status', 'active')
    .ilike('name', 'SpediamoPro%')
    .not('metadata->courier_config_id', 'is', null)
    .limit(1)
    .maybeSingle();

  const courierConfigId = (existingConfig?.metadata as any)?.courier_config_id || null;
  if (courierConfigId) {
    console.log(`  Config ID SpediamoPro: ${courierConfigId}\n`);
  } else {
    console.log('  ⚠️  Nessun courier_config_id trovato nei listini esistenti\n');
  }

  let totalLists = 0;
  let totalEntries = 0;

  // ── 1. Zone-based services (UPS Standard, DPD/BRT, UPS Express Saver) ──

  for (const service of EUROPA_SERVICES) {
    const listName = `SpediamoPro - ${service.name} (Sconto 22% - ricarica €1000)`;
    console.log(`Creazione: ${listName}`);

    const { data: existing } = await supabaseAdmin
      .from('price_lists')
      .select('id')
      .eq('name', listName)
      .maybeSingle();

    if (existing) {
      console.log(`   Skip, già esistente (${existing.id})\n`);
      continue;
    }

    // Build zone mapping for metadata
    const zoneMapping: Record<string, { label: string; countries: string[] }> = {};
    for (const z of service.zones) {
      zoneMapping[z.code] = { label: z.label, countries: z.countries };
    }

    const priceList = await createPriceList(
      {
        courier_id: courierUUIDs[service.courier_slug],
        name: listName,
        version: '1.0',
        status: 'active',
        list_type: 'supplier',
        is_global: true,
        source_type: 'pdf',
        source_file_name: 'Listini_Europa_2026.pdf',
        vat_mode: 'excluded',
        vat_rate: 22,
        description: `Listino fornitore SpediamoPro - ${service.name}. Consegne ${service.delivery_days_min}-${service.delivery_days_max}gg Europa. Fuel surcharge incluso. Solo Sconto 22%.`,
        notes: `Carrier code: ${service.carrier_code}. Provider: spediamopro. Aggiornamento: 01/2026.${service.mrpp ? ` MRPP: €${service.mrpp}` : ''}`,
        metadata: {
          provider: 'spediamopro',
          courier_slug: service.courier_slug,
          carrier_code: service.carrier_code,
          tier: 'sconto22',
          tier_label: 'Sconto 22%',
          fuel_included: true,
          region: 'europa',
          zone_mapping: zoneMapping,
          mrpp: service.mrpp || null,
          courier_config_id: courierConfigId,
          config_id: courierConfigId,
        },
      },
      adminId
    );

    // Build entries with weight_from
    const dbEntries = service.entries.map((e) => ({
      zone_code: e.zone_code,
      weight_from: getWeightFrom(service.entries, e.zone_code, e.weight_to),
      weight_to: e.weight_to,
      base_price: e.price,
      service_type: service.service_type,
      fuel_surcharge_percent: 0,
      estimated_delivery_days_min: service.delivery_days_min,
      estimated_delivery_days_max: service.delivery_days_max,
    }));

    await addPriceListEntries(priceList.id, dbEntries);
    totalLists++;
    totalEntries += dbEntries.length;
    console.log(
      `   ✅ Creato: ${priceList.id} (${dbEntries.length} entries, ${service.zones.length} zone)\n`
    );
  }

  // ── 2. EuroExpress (per-country service, heavy parcels 50-100kg) ──

  const euroExpListName = 'SpediamoPro - EuroExpress (Sconto 22% - ricarica €1000)';
  console.log(`Creazione: ${euroExpListName}`);

  const { data: existingEuroExp } = await supabaseAdmin
    .from('price_lists')
    .select('id')
    .eq('name', euroExpListName)
    .maybeSingle();

  if (existingEuroExp) {
    console.log(`   Skip, già esistente (${existingEuroExp.id})\n`);
  } else {
    // Build zone mapping: one zone per country
    const euroExpZoneMapping: Record<string, { label: string; countries: string[] }> = {};
    for (const entry of EUROEXPRESS_DATA) {
      const zoneCode = `EU-EUROEXP-${entry.country_code}`;
      euroExpZoneMapping[zoneCode] = {
        label: entry.country_name,
        countries: [entry.country_code],
      };
    }

    const euroExpList = await createPriceList(
      {
        courier_id: euroExpressCourierId,
        name: euroExpListName,
        version: '1.0',
        status: 'active',
        list_type: 'supplier',
        is_global: true,
        source_type: 'pdf',
        source_file_name: 'Listini_Europa_2026.pdf',
        vat_mode: 'excluded',
        vat_rate: 22,
        description:
          'Listino fornitore SpediamoPro - EuroExpress. Consegne 2-5gg Europa. Pesi 50-100kg + supplemento oltre 100kg. Fuel surcharge incluso. Solo Sconto 22%.',
        notes:
          'Carrier code: EUROEXP. Provider: spediamopro. Aggiornamento: 01/2026. * Supplemento per ogni 50kg oltre 100kg indicato come fascia 100-150kg.',
        metadata: {
          provider: 'spediamopro',
          courier_slug: 'euroexpress',
          carrier_code: 'EUROEXP',
          tier: 'sconto22',
          tier_label: 'Sconto 22%',
          fuel_included: true,
          region: 'europa',
          zone_mapping: euroExpZoneMapping,
          courier_config_id: courierConfigId,
          config_id: courierConfigId,
        },
      },
      adminId
    );

    // Build entries: 3 weight brackets (50, 75, 100) + extra 50kg bracket per country
    const euroExpEntries: Array<{
      zone_code: string;
      weight_from: number;
      weight_to: number;
      base_price: number;
      service_type: 'economy';
      fuel_surcharge_percent: number;
      estimated_delivery_days_min: number;
      estimated_delivery_days_max: number;
    }> = [];

    for (const country of EUROEXPRESS_DATA) {
      const zoneCode = `EU-EUROEXP-${country.country_code}`;
      euroExpEntries.push(
        {
          zone_code: zoneCode,
          weight_from: 0,
          weight_to: 50,
          base_price: country.kg50,
          service_type: 'economy',
          fuel_surcharge_percent: 0,
          estimated_delivery_days_min: 2,
          estimated_delivery_days_max: 5,
        },
        {
          zone_code: zoneCode,
          weight_from: 50,
          weight_to: 75,
          base_price: country.kg75,
          service_type: 'economy',
          fuel_surcharge_percent: 0,
          estimated_delivery_days_min: 2,
          estimated_delivery_days_max: 5,
        },
        {
          zone_code: zoneCode,
          weight_from: 75,
          weight_to: 100,
          base_price: country.kg100,
          service_type: 'economy',
          fuel_surcharge_percent: 0,
          estimated_delivery_days_min: 2,
          estimated_delivery_days_max: 5,
        },
        {
          zone_code: zoneCode,
          weight_from: 100,
          weight_to: 150,
          base_price: country.kg50_extra,
          service_type: 'economy',
          fuel_surcharge_percent: 0,
          estimated_delivery_days_min: 2,
          estimated_delivery_days_max: 5,
        }
      );
    }

    await addPriceListEntries(euroExpList.id, euroExpEntries);
    totalLists++;
    totalEntries += euroExpEntries.length;
    console.log(
      `   ✅ Creato: ${euroExpList.id} (${euroExpEntries.length} entries, ${EUROEXPRESS_DATA.length} nazioni)\n`
    );
  }

  console.log('═══════════════════════════════════════════════════');
  console.log(`  COMPLETATO: ${totalLists} listini, ${totalEntries} entries totali`);
  console.log('═══════════════════════════════════════════════════');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('ERRORE SEED:', err);
    process.exit(1);
  });
