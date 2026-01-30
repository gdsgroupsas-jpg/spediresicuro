/**
 * Seed Script: Popola listino fornitore Spedizioni Prime — UPS6 Internazionale
 *
 * UPS / Volumetrico 200 (5000) / Spedizioni Prime
 * Prezzi IVA ESCLUSA — vat_mode: 'excluded'
 * Provider: spedisci_online
 * Config: Spedizioni Prime
 * Carrier: ups
 * Contract: ups-internazionale
 *
 * Zone: ZONA 5, ZONA 51, ZONA 52 (ISOLE ALTRI PAESI = €0, non coperto)
 * 7 fasce peso fino a 30kg
 *
 * Usage: npx tsx scripts/seed-spedizioni-prime-ups-price-list.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── ZONE DEFINITIONS ───

interface ZoneDefinition {
  code: string;
  label: string;
  countries: string[];
}

// UPS zone mapping (standard UPS zones for Spedizioni Prime)
const ZONES: ZoneDefinition[] = [
  {
    code: 'EU-UPS-PRIME-Z5',
    label: 'Zona 5',
    countries: ['AT', 'BE', 'DE', 'FR', 'LU', 'MC', 'NL'],
  },
  {
    code: 'EU-UPS-PRIME-Z51',
    label: 'Zona 51',
    countries: ['CZ', 'DK', 'ES', 'HU', 'IE', 'PL', 'PT', 'SI', 'SK'],
  },
  {
    code: 'EU-UPS-PRIME-Z52',
    label: 'Zona 52',
    countries: ['BG', 'EE', 'FI', 'GR', 'HR', 'LT', 'LV', 'RO', 'SE', 'GB', 'NO', 'CH'],
  },
];

const ZONE_CSV_MAP: Record<string, string> = {
  zona5: 'EU-UPS-PRIME-Z5',
  zona51: 'EU-UPS-PRIME-Z51',
  zona52: 'EU-UPS-PRIME-Z52',
};

// ─── PRICE DATA (IVA esclusa) ───

interface ZoneWeightPrice {
  zone: string;
  weight_to: number;
  price: number;
}

const WEIGHT_ENTRIES: ZoneWeightPrice[] = [
  // Zona 5
  { zone: 'zona5', weight_to: 2, price: 9.3 },
  { zone: 'zona5', weight_to: 4, price: 13.1 },
  { zone: 'zona5', weight_to: 6, price: 16.2 },
  { zone: 'zona5', weight_to: 8, price: 18.7 },
  { zone: 'zona5', weight_to: 10, price: 21.3 },
  { zone: 'zona5', weight_to: 20, price: 22.5 },
  { zone: 'zona5', weight_to: 30, price: 24.4 },

  // Zona 51
  { zone: 'zona51', weight_to: 2, price: 9.7 },
  { zone: 'zona51', weight_to: 4, price: 13.4 },
  { zone: 'zona51', weight_to: 6, price: 16.5 },
  { zone: 'zona51', weight_to: 8, price: 19.1 },
  { zone: 'zona51', weight_to: 10, price: 21.7 },
  { zone: 'zona51', weight_to: 20, price: 25.0 },
  { zone: 'zona51', weight_to: 30, price: 28.1 },

  // Zona 52
  { zone: 'zona52', weight_to: 2, price: 16.7 },
  { zone: 'zona52', weight_to: 4, price: 23.6 },
  { zone: 'zona52', weight_to: 6, price: 30.4 },
  { zone: 'zona52', weight_to: 8, price: 37.0 },
  { zone: 'zona52', weight_to: 10, price: 43.6 },
  { zone: 'zona52', weight_to: 20, price: 48.9 },
  { zone: 'zona52', weight_to: 30, price: 55.5 },
];

// ─── SUPPLEMENTI (stored in metadata, IVA esclusa) ───
// Using same surcharges as PD5 until user provides specific UPS6 screenshots

const SURCHARGES = {
  assicurazione: {
    soglia_500: { fixed: 4.0, percent: 0, note: 'Fino a €500 valore dichiarato (da confermare)' },
  },
  contrassegno: {
    soglia_516: { fixed: 1.6, percent: 0, note: 'Fino a €516 (da confermare)' },
    soglia_1000: {
      fixed: 1.6,
      percent: 1.7,
      note: '€516-€1000, 1.7% sulla differenza (da confermare)',
    },
  },
  giacenze: {
    riconsegna: { fixed: 2.5, percent: 0, note: 'Riconsegna (da confermare)' },
    reso_mittente: {
      fixed: 0,
      percent: 100,
      note: 'Reso mittente (100% costo spedizione) (da confermare)',
    },
  },
};

// ─── MAIN SEED ───

async function seed() {
  const { supabaseAdmin } = await import('@/lib/db/client');
  const { createPriceList, addPriceListEntries } = await import('@/lib/db/price-lists');

  console.log('═══════════════════════════════════════════════════');
  console.log('  SEED: Spedizioni Prime — UPS6 Internazionale');
  console.log('═══════════════════════════════════════════════════\n');

  // Get admin user
  const { data: adminUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('account_type', ['superadmin', 'admin'])
    .limit(1)
    .single();

  if (!adminUser) throw new Error('Nessun admin/superadmin trovato.');
  const adminId = adminUser.id;
  console.log(`Admin user: ${adminId}\n`);

  // Find Spedizioni Prime config ID
  const { data: primeConfig } = await supabaseAdmin
    .from('courier_configs')
    .select('id')
    .ilike('name', '%spedizioni prime%')
    .maybeSingle();

  const PRIME_CONFIG_ID = primeConfig?.id;
  if (!PRIME_CONFIG_ID) throw new Error('Config Spedizioni Prime non trovata');
  console.log(`  Config ID Spedizioni Prime: ${PRIME_CONFIG_ID}\n`);

  // Get or create UPS courier
  let courierId: string;
  const { data: courier } = await supabaseAdmin
    .from('couriers')
    .select('id')
    .or('name.ilike.%ups%')
    .maybeSingle();

  if (courier) {
    courierId = courier.id;
    console.log(`  Courier UPS -> ${courierId}`);
  } else {
    const { data: newCourier } = await supabaseAdmin
      .from('couriers')
      .insert({ name: 'ups', display_name: 'UPS', code: 'UPS' })
      .select('id')
      .single();
    if (!newCourier) throw new Error('Impossibile creare courier UPS');
    courierId = newCourier.id;
    console.log(`  Courier UPS CREATO -> ${courierId}`);
  }

  const listName = 'Spedizioni Prime - UPS6 Internazionale';
  console.log(`Creazione: ${listName}`);

  // Check if already exists
  const { data: existing } = await supabaseAdmin
    .from('price_lists')
    .select('id')
    .eq('name', listName)
    .maybeSingle();

  if (existing) {
    console.log(`   Skip, già esistente (${existing.id})`);
    process.exit(0);
  }

  // Build zone_mapping for metadata
  const zoneMapMetadata: Record<string, { label: string; countries: string[] }> = {};
  ZONES.forEach((z) => {
    zoneMapMetadata[z.code] = { label: z.label, countries: z.countries };
  });

  const priceList = await createPriceList(
    {
      courier_id: courierId,
      name: listName,
      version: '1.0',
      status: 'active',
      list_type: 'supplier',
      is_global: true,
      source_type: 'manual',
      source_file_name: 'spedizioni_prime_ups6_internazionale.png',
      vat_mode: 'excluded',
      vat_rate: 22,
      description:
        'Listino fornitore Spedizioni Prime — UPS6 Internazionale. Volumetrico 200 (5000). Prezzi IVA esclusa. 3 zone europee.',
      notes:
        'Carrier: UPS. Provider: spedisci_online (Spedizioni Prime). Contract: ups-internazionale. ISOLE ALTRI PAESI non coperto. Supplementi da confermare.',
      metadata: {
        provider: 'spediscionline',
        courier_slug: 'ups',
        carrier_code: 'ups',
        contract_code: 'ups-internazionale',
        volumetric_divisor: 200,
        courier_config_id: PRIME_CONFIG_ID,
        config_id: PRIME_CONFIG_ID,
        region: 'europa',
        fuel_included: false,
        zone_mapping: zoneMapMetadata,
        surcharges: SURCHARGES,
      },
    },
    adminId
  );

  // Build entries
  const uniqueWeightTos = [...new Set(WEIGHT_ENTRIES.map((e) => e.weight_to))].sort(
    (a, b) => a - b
  );

  const dbEntries = WEIGHT_ENTRIES.map((e) => {
    const zoneCode = ZONE_CSV_MAP[e.zone];
    const idx = uniqueWeightTos.indexOf(e.weight_to);
    const weightFrom = idx <= 0 ? 0 : uniqueWeightTos[idx - 1];

    return {
      zone_code: zoneCode,
      weight_from: weightFrom,
      weight_to: e.weight_to,
      base_price: e.price,
      service_type: 'standard' as const,
      fuel_surcharge_percent: 0,
      estimated_delivery_days_min: 2,
      estimated_delivery_days_max: 5,
    };
  });

  await addPriceListEntries(priceList.id, dbEntries);

  console.log(`   ✅ Creato: ${priceList.id} (${dbEntries.length} entries, ${ZONES.length} zone)`);
  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  COMPLETATO: 1 listino, ${dbEntries.length} entries`);
  console.log('═══════════════════════════════════════════════════');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('ERRORE SEED:', err);
    process.exit(1);
  });
