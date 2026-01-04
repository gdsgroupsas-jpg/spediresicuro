/**
 * Spedisci.Online Price List Matrix Configuration
 *
 * Defines the standard Zones and Weight Brackets to probe when synchronizing price lists
 * from Spedisci.Online.
 *
 * UPDATED (High Fidelity):
 * - Weights: 1-100kg (Continuous/Dense) + >100kg check.
 * - Zones: Standard, South (Calabria/Sicily), Sardinia, Remote (Venice/Livigno), Minor Islands.
 */

// Generate 1-105kg array.
// 1-30kg: 1kg steps.
// 30-100kg: 1kg steps (User requested granular check).
// >100kg: 105kg probe.
const WEIGHTS = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
WEIGHTS.push(105); // Check over 100kg

export const PRICING_MATRIX = {
  WEIGHTS: WEIGHTS,

  // Representative Addresses for "High Fidelity" Zone Scanning
  ZONES: [
    {
      code: "IT-STD",
      name: "Italia (Standard - Milano)",
      sampleAddress: {
        city: "Milano",
        state: "MI",
        postalCode: "20100",
        country: "IT",
      },
    },
    {
      code: "IT-CAL",
      name: "Italia (Calabria - Reggio)",
      sampleAddress: {
        city: "Reggio Calabria",
        state: "RC",
        postalCode: "89100",
        country: "IT",
      },
    },
    {
      code: "IT-SIC",
      name: "Italia (Sicilia - Palermo)",
      sampleAddress: {
        city: "Palermo",
        state: "PA",
        postalCode: "90100",
        country: "IT",
      },
    },
    {
      code: "IT-SAR",
      name: "Italia (Sardegna - Cagliari)",
      sampleAddress: {
        city: "Cagliari",
        state: "CA",
        postalCode: "09100",
        country: "IT",
      },
    },
    {
      // Zone Disagiate / Lagunari
      code: "IT-VEN",
      name: "Italia (Venezia Laguna)",
      sampleAddress: {
        city: "Venezia",
        state: "VE",
        postalCode: "30124",
        country: "IT",
      },
    },
    {
      // Zone Remote
      code: "IT-LIV",
      name: "Italia (Livigno - Remota)",
      sampleAddress: {
        city: "Livigno",
        state: "SO",
        postalCode: "23041",
        country: "IT",
      },
    },
    {
      // Isole Minori
      code: "IT-ISO",
      name: "Italia (Isole Minori - Capri)",
      sampleAddress: {
        city: "Capri",
        state: "NA",
        postalCode: "80073",
        country: "IT",
      },
    },
    // EU Zones (Simplified for now, can be expanded)
    {
      code: "EU-Z1",
      name: "Europa Zona 1 (Germania)",
      sampleAddress: {
        city: "Berlin",
        state: "Berlin",
        postalCode: "10115",
        country: "DE",
      },
    },
  ],
};
