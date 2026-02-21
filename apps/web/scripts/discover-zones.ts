import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// 1. Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing env vars');
  process.exit(1);
}

const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// DISCOVERY SET:
// A broad selection of CAPs to identify Pricing Clusters.
const DISCOVERY_SET = [
  // --- STANDARD (Major Cities) ---
  { cap: '20100', city: 'Milano', state: 'MI', info: 'Nord - Standard' },
  { cap: '00100', city: 'Roma', state: 'RM', info: 'Centro - Standard' },
  { cap: '10100', city: 'Torino', state: 'TO', info: 'Nord - Standard' },
  { cap: '40100', city: 'Bologna', state: 'BO', info: 'Centro - Standard' },
  { cap: '50100', city: 'Firenze', state: 'FI', info: 'Centro - Standard' },

  // --- SOUTH (Often distinct for some carriers) ---
  { cap: '80100', city: 'Napoli', state: 'NA', info: 'Sud - Napoli' },
  { cap: '70100', city: 'Bari', state: 'BA', info: 'Sud - Puglia' },

  // --- CALABRIA / SICILIA (Screenshot Column: Calabria, Sicilia) ---
  { cap: '89100', city: 'Reggio Calabria', state: 'RC', info: 'Calabria' },
  { cap: '88100', city: 'Catanzaro', state: 'CZ', info: 'Calabria' },
  { cap: '90100', city: 'Palermo', state: 'PA', info: 'Sicilia' },
  { cap: '95100', city: 'Catania', state: 'CT', info: 'Sicilia' },
  { cap: '98100', city: 'Messina', state: 'ME', info: 'Sicilia' },

  // --- SARDEGNA (Screenshot Column: Sardegna) ---
  { cap: '09100', city: 'Cagliari', state: 'CA', info: 'Sardegna' },
  { cap: '07100', city: 'Sassari', state: 'SS', info: 'Sardegna' },

  // --- VENEZIA LAGUNA (Often +Cost) ---
  { cap: '30124', city: 'Venezia', state: 'VE', info: 'Venezia Laguna' },
  { cap: '30100', city: 'Venezia', state: 'VE', info: 'Venezia Generic' },
  {
    cap: '30133',
    city: 'Venezia Giudecca',
    state: 'VE',
    info: 'Venezia Giudecca',
  },
  { cap: '30141', city: 'Murano', state: 'VE', info: 'Venezia Murano' },
  { cap: '30142', city: 'Burano', state: 'VE', info: 'Venezia Burano' },

  // --- LIVIGNO / CAMPIONE (Screenshot Column: Livigno) ---
  {
    cap: '23041',
    city: 'Livigno',
    state: 'SO',
    info: 'Livigno (Remota/Doganale)',
  },
  {
    cap: '23030',
    city: 'Livigno (Generic)',
    state: 'SO',
    info: 'Livigno Area',
  },
  {
    cap: '22061',
    city: "Campione d'Italia",
    state: 'CO',
    info: 'Campione (Exclave)',
  },

  // --- ISOLE MINORI (Screenshot Column: Isole Minori) ---
  { cap: '80073', city: 'Capri', state: 'NA', info: 'Isole Minori (NA)' },
  { cap: '80077', city: 'Ischia', state: 'NA', info: 'Isole Minori (NA)' },
  { cap: '80079', city: 'Procida', state: 'NA', info: 'Isole Minori (NA)' },
  { cap: '04027', city: 'Ponza', state: 'LT', info: 'Isole Minori (LT)' },
  {
    cap: '57032',
    city: 'Capoliveri (Elba)',
    state: 'LI',
    info: 'Isole Minori (LI)',
  },
  {
    cap: '58012',
    city: 'Isola del Giglio',
    state: 'GR',
    info: 'Isole Minori (GR)',
  },
  { cap: '91010', city: 'Pantelleria', state: 'TP', info: 'Isole Minori (TP)' },
  { cap: '91023', city: 'Favignana', state: 'TP', info: 'Isole Minori (TP)' },
  { cap: '98050', city: 'Lipari', state: 'ME', info: 'Isole Minori (ME)' },
  { cap: '92010', city: 'Lampedusa', state: 'AG', info: 'Isole Minori (AG)' },
  {
    cap: '07024',
    city: 'La Maddalena',
    state: 'SS',
    info: 'Isole Minori (SS)',
  },
  { cap: '09014', city: 'Carloforte', state: 'SU', info: 'Isole Minori (SU)' },
];

// Test Weight: 10kg is a good middle ground to see surcharges clearly.
const PROBE_WEIGHT = 10;

async function main() {
  const { SpedisciOnlineAdapter } = await import('../lib/adapters/couriers/spedisci-online');
  const { decryptCredential, isEncrypted } = await import('../lib/security/encryption');

  console.log('Listen up! Starting ZONE DISCOVERY SCAN...');
  console.log(`Probe Weight: ${PROBE_WEIGHT}kg`);
  console.log(`Targets: ${DISCOVERY_SET.length} distinct CAPs`);

  // 1. Get User/Config
  const { data: user } = await supabase.from('users').select('id').eq('email', TEST_EMAIL).single();

  if (!user) {
    console.error('User not found');
    return;
  }
  const { data: config } = await supabase
    .from('courier_configs')
    .select('*')
    .eq('owner_user_id', user.id)
    .eq('provider_id', 'spedisci_online')
    .single();

  if (!config) {
    console.error('Config not found');
    return;
  }

  let apiKey = config.api_key;
  if (isEncrypted(apiKey)) apiKey = decryptCredential(apiKey);

  const adapter = new SpedisciOnlineAdapter({
    api_key: apiKey,
    base_url: config.base_url,
  });

  const results: any[] = [];

  for (const target of DISCOVERY_SET) {
    process.stdout.write(`Scanning ${target.city} (${target.cap})... `);

    const testParams = {
      packages: [{ length: 20, width: 20, height: 20, weight: PROBE_WEIGHT }],
      shipFrom: {
        name: 'Sender',
        street1: 'Via Roma 1',
        city: 'Roma',
        state: 'RM',
        postalCode: '00100',
        country: 'IT',
        email: 's@s.com',
      },
      shipTo: {
        name: 'Receiver',
        street1: 'Via Test 1',
        city: target.city,
        state: target.state,
        postalCode: target.cap,
        country: 'IT',
        email: 'r@r.com',
      },
      notes: 'Discovery',
      insuranceValue: 0,
      codValue: 0,
      accessoriServices: [],
    };

    // DEBUG: Print actual shipTo being sent
    console.log(`Payload ShipTo: ${JSON.stringify(testParams.shipTo)}`);

    try {
      const res = await adapter.getRates(testParams);
      if (res.success && res.rates) {
        console.log(`FOUND ${res.rates.length} rates`);
        // Store the best price for each carrier to fingerprint the zone
        res.rates.forEach((r) => {
          results.push({
            cap: target.cap,
            city: target.city,
            info: target.info,
            carrier: r.carrierCode,
            service: r.contractCode,
            price: r.total_price,
          });
        });
      } else {
        console.log(`NO RATES`);
      }
    } catch (e: any) {
      console.log(`ERROR: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, 1000)); // be nice
  }

  console.log('\n--- CLUSTERING RESULTS ---');

  // Pivot results: Group by Carrier -> Service -> Price -> List of CAPs
  const clusters: Record<string, Record<string, Record<string, string[]>>> = {};

  for (const r of results) {
    if (!clusters[r.carrier]) clusters[r.carrier] = {};
    if (!clusters[r.carrier][r.service]) clusters[r.carrier][r.service] = {};

    if (!clusters[r.carrier][r.service][r.price]) {
      clusters[r.carrier][r.service][r.price] = [];
    }
    clusters[r.carrier][r.service][r.price].push(`${r.city} (${r.cap})`);
  }

  let report = '\n--- CLUSTERING RESULTS ---\n';

  for (const carrier in clusters) {
    report += `\n📦 CARRIER: ${carrier.toUpperCase()}\n`;
    for (const service in clusters[carrier]) {
      report += `  🔹 Service: ${service}\n`;
      for (const price in clusters[carrier][service]) {
        const locations = clusters[carrier][service][price];
        report += `     💰 Price: €${price} | Zones (${
          locations.length
        }): ${locations.slice(0, 5).join(', ')}${locations.length > 5 ? '...' : ''}\n`;
      }
    }
  }

  // Also dump raw clusters for deep inspection if needed
  report += '\n\n--- RAW FULL ZONES ---\n';
  report += JSON.stringify(clusters, null, 2);

  fs.writeFileSync('discovery_report.txt', report, 'utf-8');
  console.log('✅ Report saved to discovery_report.txt');
}

main().catch(console.error);
