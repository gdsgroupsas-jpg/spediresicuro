/**
 * Seed Script: Popola listino fornitore SpeedGo — GLS Europa (gls-europa)
 *
 * GLS / Volumetrico 166.66 (6000) / SpeedGo
 * Prezzi IVA INCLUSA (22%) — vat_mode: 'included'
 * Provider: spedisci_online
 * Config: SpeedGo (c8c6cdc4-2de7-4d45-ac93-7f7b1e5c16f3)
 * Carrier: gls
 * Contract: gls-europa
 *
 * 4 zone × 8 fasce peso = 32 entries
 *
 * Usage: npx tsx scripts/seed-speedgo-gls-europa-price-list.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── ZONE DEFINITIONS ───
// TODO: Confermare mappatura paesi per zona con l'utente

interface ZoneDefinition {
  code: string;
  label: string;
  countries: string[];
}

const ZONES: ZoneDefinition[] = [
  { code: 'EU-GLS-Z1', label: 'Zona 1', countries: ['AT', 'DE', 'LU'] },
  { code: 'EU-GLS-Z2', label: 'Zona 2', countries: ['BE', 'FR', 'NL', 'MC'] },
  {
    code: 'EU-GLS-Z3',
    label: 'Zona 3',
    countries: ['CZ', 'DK', 'ES', 'HU', 'PL', 'PT', 'SI', 'SK'],
  },
  {
    code: 'EU-GLS-Z4',
    label: 'Zona 4',
    countries: ['BG', 'EE', 'FI', 'GR', 'HR', 'IE', 'LT', 'LV', 'RO', 'SE', 'GB'],
  },
];

const ZONE_CSV_MAP: Record<string, string> = {
  zona1: 'EU-GLS-Z1',
  zona2: 'EU-GLS-Z2',
  zona3: 'EU-GLS-Z3',
  zona4: 'EU-GLS-Z4',
};

// ─── PRICE DATA (IVA inclusa 22%) ───

interface ZoneWeightPrice {
  zone: string;
  weight_to: number;
  price_iva_inc: number;
}

const WEIGHT_ENTRIES: ZoneWeightPrice[] = [
  // 3 kg
  { zone: 'zona1', weight_to: 3, price_iva_inc: 8.72 },
  { zone: 'zona2', weight_to: 3, price_iva_inc: 10.98 },
  { zone: 'zona3', weight_to: 3, price_iva_inc: 14.75 },
  { zone: 'zona4', weight_to: 3, price_iva_inc: 20.62 },

  // 5 kg
  { zone: 'zona1', weight_to: 5, price_iva_inc: 9.99 },
  { zone: 'zona2', weight_to: 5, price_iva_inc: 13.42 },
  { zone: 'zona3', weight_to: 5, price_iva_inc: 16.65 },
  { zone: 'zona4', weight_to: 5, price_iva_inc: 21.41 },

  // 10 kg
  { zone: 'zona1', weight_to: 10, price_iva_inc: 13.09 },
  { zone: 'zona2', weight_to: 10, price_iva_inc: 18.4 },
  { zone: 'zona3', weight_to: 10, price_iva_inc: 21.66 },
  { zone: 'zona4', weight_to: 10, price_iva_inc: 23.72 },

  // 15 kg
  { zone: 'zona1', weight_to: 15, price_iva_inc: 16.18 },
  { zone: 'zona2', weight_to: 15, price_iva_inc: 22.36 },
  { zone: 'zona3', weight_to: 15, price_iva_inc: 26.57 },
  { zone: 'zona4', weight_to: 15, price_iva_inc: 29.5 },

  // 20 kg
  { zone: 'zona1', weight_to: 20, price_iva_inc: 19.28 },
  { zone: 'zona2', weight_to: 20, price_iva_inc: 26.49 },
  { zone: 'zona3', weight_to: 20, price_iva_inc: 31.49 },
  { zone: 'zona4', weight_to: 20, price_iva_inc: 35.37 },

  // 25 kg
  { zone: 'zona1', weight_to: 25, price_iva_inc: 22.36 },
  { zone: 'zona2', weight_to: 25, price_iva_inc: 30.45 },
  { zone: 'zona3', weight_to: 25, price_iva_inc: 36.48 },
  { zone: 'zona4', weight_to: 25, price_iva_inc: 41.16 },

  // 30 kg
  { zone: 'zona1', weight_to: 30, price_iva_inc: 25.53 },
  { zone: 'zona2', weight_to: 30, price_iva_inc: 34.42 },
  { zone: 'zona3', weight_to: 30, price_iva_inc: 41.39 },
  { zone: 'zona4', weight_to: 30, price_iva_inc: 47.1 },

  // 40 kg
  { zone: 'zona1', weight_to: 40, price_iva_inc: 31.72 },
  { zone: 'zona2', weight_to: 40, price_iva_inc: 42.49 },
  { zone: 'zona3', weight_to: 40, price_iva_inc: 51.23 },
  { zone: 'zona4', weight_to: 40, price_iva_inc: 64.55 },
];

// ─── SUPPLEMENTI (stored in metadata, IVA inclusa) ───

const SURCHARGES = {
  assicurazione: {
    max_1500: { fixed: 4.88, percent: 0, note: 'Fino a €1500 valore dichiarato' },
  },
  contrassegno: {
    soglia_100: { fixed: 1.83, percent: 0, note: 'Fino a €100' },
    soglia_5000: { fixed: 0, percent: 1.5, note: 'Oltre €100, 1.5% sul totale' },
  },
  giacenze: {
    riconsegna: { fixed: 0, percent: 0, note: 'Riconsegna gratuita' },
    riconsegna_nuovo_destinatario: {
      fixed: 0,
      percent: 0,
      note: 'Riconsegna nuovo destinatario gratuita',
    },
    reso_mittente: { fixed: 0, percent: 120, note: 'Reso mittente 120% costo spedizione' },
    distruggere: { fixed: 0, percent: 0, note: 'Distruggere gratuito' },
    ritiro_in_sede: { fixed: 0, percent: 0, note: 'Ritiro in sede gratuito' },
    consegna_parziale_rendi: { fixed: 0, percent: 0, note: 'Consegna parziale + rendi' },
    consegna_parziale_distruggi: { fixed: 0, percent: 0, note: 'Consegna parziale + distruggi' },
    apertura_dossier: { fixed: 0, percent: 0, note: 'Apertura dossier' },
  },
};

// ─── MAIN SEED ───

async function seed() {
  const { supabaseAdmin } = await import('@/lib/db/client');
  const { createPriceList, addPriceListEntries } = await import('@/lib/db/price-lists');

  console.log('═══════════════════════════════════════════════════');
  console.log('  SEED: Listino Fornitore SpeedGo — GLS Europa');
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

  // Get or create GLS courier
  let glsCourierId: string;
  const { data: glsCourier } = await supabaseAdmin
    .from('couriers')
    .select('id')
    .or('name.eq.gls,name.eq.GLS')
    .maybeSingle();

  if (glsCourier) {
    glsCourierId = glsCourier.id;
    console.log(`  Courier GLS -> ${glsCourierId}`);
  } else {
    const { data: newCourier } = await supabaseAdmin
      .from('couriers')
      .insert({ name: 'gls', display_name: 'GLS', code: 'GLS' })
      .select('id')
      .single();
    if (!newCourier) throw new Error('Impossibile creare courier GLS');
    glsCourierId = newCourier.id;
    console.log(`  Courier GLS CREATO -> ${glsCourierId}`);
  }

  const SPEEDGO_CONFIG_ID = 'c8c6cdc4-2de7-4d45-ac93-7f7b1e5c16f3';
  console.log(`  Config ID SpeedGo: ${SPEEDGO_CONFIG_ID}\n`);

  const listName = 'SpeedGo - GLS Europa (Volumetrico 166.66)';
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
      courier_id: glsCourierId,
      name: listName,
      version: '1.0',
      status: 'active',
      list_type: 'supplier',
      is_global: true,
      source_type: 'csv',
      source_file_name: 'speedgo_gls_europa_consolidato.csv',
      vat_mode: 'included',
      vat_rate: 22,
      description:
        'Listino fornitore SpeedGo — GLS Europa. Volumetrico 166.66 (6000). Prezzi IVA inclusa (22%). 4 zone europee.',
      notes:
        'Carrier: GLS. Provider: spedisci_online (SpeedGo). Contract: gls-europa. 4 zone × 8 fasce peso.',
      metadata: {
        provider: 'spediscionline',
        courier_slug: 'gls',
        carrier_code: 'gls',
        contract_code: 'gls-europa',
        volumetric_divisor: 166.66,
        courier_config_id: SPEEDGO_CONFIG_ID,
        config_id: SPEEDGO_CONFIG_ID,
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
      base_price: e.price_iva_inc,
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
