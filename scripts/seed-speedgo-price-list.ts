/**
 * Seed Script: Popola listino fornitore SpeedGo (GLS 5000) da CSV consolidato
 *
 * GLS / Volumetrico 200 / SpeedGo
 * Prezzi IVA INCLUSA (22%) — vat_mode: 'included'
 * Provider: spedisci_online
 *
 * Crea 1 listino supplier con:
 *   - Entries per zona (italia, sardegna, sicilia, isole_minori, livigno_campione)
 *   - Fasce peso fino a 100kg + extra_step per oltre 100kg
 *   - Supplementi: assicurazione, contrassegno, accessori, giacenze nel metadata
 *
 * Usage: npx tsx scripts/seed-speedgo-price-list.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── ZONE MAPPING ───
// CSV zone names → standard zone codes

const ZONE_MAP: Record<string, string> = {
  italia: 'IT-ITALIA',
  sardegna: 'IT-SARDEGNA',
  sicilia: 'IT-SICILIA',
  isole_minori: 'IT-ISOLE-MINORI',
  livigno_campione: 'IT-LIVIGNO',
};

// ─── PRICE DATA (IVA inclusa 22%) ───

interface ZoneWeightPrice {
  zone: string;
  weight_to: number;
  price_iva_inc: number;
}

const WEIGHT_ENTRIES: ZoneWeightPrice[] = [
  // Italia
  { zone: 'italia', weight_to: 3, price_iva_inc: 5.21 },
  { zone: 'italia', weight_to: 5, price_iva_inc: 5.21 },
  { zone: 'italia', weight_to: 7, price_iva_inc: 7.08 },
  { zone: 'italia', weight_to: 10, price_iva_inc: 8.54 },
  { zone: 'italia', weight_to: 12, price_iva_inc: 10.15 },
  { zone: 'italia', weight_to: 18, price_iva_inc: 11.9 },
  { zone: 'italia', weight_to: 25, price_iva_inc: 13.32 },
  { zone: 'italia', weight_to: 50, price_iva_inc: 22.68 },
  { zone: 'italia', weight_to: 100, price_iva_inc: 39.49 },

  // Sardegna
  { zone: 'sardegna', weight_to: 3, price_iva_inc: 6.34 },
  { zone: 'sardegna', weight_to: 5, price_iva_inc: 7.56 },
  { zone: 'sardegna', weight_to: 7, price_iva_inc: 16.49 },
  { zone: 'sardegna', weight_to: 10, price_iva_inc: 16.49 },
  { zone: 'sardegna', weight_to: 12, price_iva_inc: 16.49 },
  { zone: 'sardegna', weight_to: 18, price_iva_inc: 22.84 },
  { zone: 'sardegna', weight_to: 25, price_iva_inc: 22.84 },
  { zone: 'sardegna', weight_to: 50, price_iva_inc: 35.04 },
  { zone: 'sardegna', weight_to: 100, price_iva_inc: 57.89 },

  // Sicilia
  { zone: 'sicilia', weight_to: 3, price_iva_inc: 5.21 },
  { zone: 'sicilia', weight_to: 5, price_iva_inc: 5.21 },
  { zone: 'sicilia', weight_to: 7, price_iva_inc: 7.08 },
  { zone: 'sicilia', weight_to: 10, price_iva_inc: 8.54 },
  { zone: 'sicilia', weight_to: 12, price_iva_inc: 10.15 },
  { zone: 'sicilia', weight_to: 18, price_iva_inc: 11.9 },
  { zone: 'sicilia', weight_to: 25, price_iva_inc: 13.32 },
  { zone: 'sicilia', weight_to: 50, price_iva_inc: 22.68 },
  { zone: 'sicilia', weight_to: 100, price_iva_inc: 39.49 },

  // Isole Minori
  { zone: 'isole_minori', weight_to: 3, price_iva_inc: 15.25 },
  { zone: 'isole_minori', weight_to: 5, price_iva_inc: 16.47 },
  { zone: 'isole_minori', weight_to: 7, price_iva_inc: 30.38 },
  { zone: 'isole_minori', weight_to: 10, price_iva_inc: 30.38 },
  { zone: 'isole_minori', weight_to: 12, price_iva_inc: 19.91 },
  { zone: 'isole_minori', weight_to: 18, price_iva_inc: 21.66 },
  { zone: 'isole_minori', weight_to: 25, price_iva_inc: 23.08 },
  { zone: 'isole_minori', weight_to: 50, price_iva_inc: 32.44 },
  { zone: 'isole_minori', weight_to: 100, price_iva_inc: 49.25 },

  // Livigno / Campione d'Italia
  { zone: 'livigno_campione', weight_to: 3, price_iva_inc: 164.0 },
  { zone: 'livigno_campione', weight_to: 5, price_iva_inc: 164.0 },
  { zone: 'livigno_campione', weight_to: 7, price_iva_inc: 317.2 },
  { zone: 'livigno_campione', weight_to: 10, price_iva_inc: 317.2 },
  { zone: 'livigno_campione', weight_to: 12, price_iva_inc: 168.75 },
  { zone: 'livigno_campione', weight_to: 18, price_iva_inc: 317.2 },
  { zone: 'livigno_campione', weight_to: 25, price_iva_inc: 171.92 },
  { zone: 'livigno_campione', weight_to: 50, price_iva_inc: 182.55 },
  { zone: 'livigno_campione', weight_to: 100, price_iva_inc: 200.63 },
];

// Extra step: prezzo per ogni 50kg oltre 100kg
const EXTRA_STEP: Record<string, number> = {
  italia: 20.62,
  sardegna: 39.65,
  sicilia: 20.62,
  isole_minori: 30.38,
  livigno_campione: 317.2,
};

// ─── SUPPLEMENTI (stored in metadata, IVA inclusa) ───

const SURCHARGES = {
  assicurazione: {
    max_1499: { fixed: 4.88, percent: 0, note: 'Fino a €1499 valore dichiarato' },
  },
  contrassegno: {
    soglia_200: { fixed: 2.32, percent: 0, note: 'Fino a €200' },
    soglia_300: { fixed: 2.93, percent: 1.2, note: '€200-€300, 1.2% sul totale' },
    soglia_5000: { fixed: 0, percent: 1.5, note: 'Oltre €300, 1.5% sul totale' },
  },
  accessori: {
    exchange: { fixed: 4.88, note: 'Servizio di scambio' },
    saturday_service: { fixed: 122.0, note: 'Consegna sabato' },
    express12: { fixed: 36.6, note: 'Express entro le 12' },
    preavviso_telefonico: { fixed: 0.61, note: 'Preavviso telefonico' },
  },
  giacenze: {
    riconsegna: { percent: 100, note: '100% del costo spedizione' },
    reso_mittente: { percent: 106, note: '106% del costo spedizione' },
  },
};

// ─── MAIN SEED ───

async function seed() {
  const { supabaseAdmin } = await import('@/lib/db/client');
  const { createPriceList, addPriceListEntries } = await import('@/lib/db/price-lists');

  console.log('═══════════════════════════════════════════════════');
  console.log('  SEED: Listino Fornitore SpeedGo (GLS 5000)');
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

  // Get SpeedGo config ID
  const SPEEDGO_CONFIG_ID = 'c8c6cdc4-2de7-4d45-ac93-7f7b1e5c16f3';
  console.log(`  Config ID SpeedGo: ${SPEEDGO_CONFIG_ID}\n`);

  const listName = 'SpeedGo - GLS 5000 (Volumetrico 200)';
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

  const priceList = await createPriceList(
    {
      courier_id: glsCourierId,
      name: listName,
      version: '1.0',
      status: 'active',
      list_type: 'supplier',
      is_global: true,
      source_type: 'csv',
      source_file_name: 'speedgo_gls5000_consolidato.csv',
      vat_mode: 'included',
      vat_rate: 22,
      description:
        'Listino fornitore SpeedGo - GLS 5000. Volumetrico 200. Prezzi IVA inclusa (22%). Italia + Isole.',
      notes:
        'Carrier: GLS. Provider: spedisci_online (SpeedGo). Extra step: +50kg oltre 100kg. Assicurazione, contrassegno e accessori nei metadata.',
      metadata: {
        provider: 'spediscionline',
        courier_slug: 'gls',
        carrier_code: 'GLS',
        contract_code: '5000',
        volumetric_divisor: 200,
        courier_config_id: SPEEDGO_CONFIG_ID,
        config_id: SPEEDGO_CONFIG_ID,
        fuel_included: false,
        extra_step_per_50kg: EXTRA_STEP,
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
    const zoneCode = ZONE_MAP[e.zone];
    const idx = uniqueWeightTos.indexOf(e.weight_to);
    const weightFrom = idx <= 0 ? 0 : uniqueWeightTos[idx - 1];

    return {
      zone_code: zoneCode,
      weight_from: weightFrom,
      weight_to: e.weight_to,
      base_price: e.price_iva_inc,
      service_type: 'standard' as const,
      fuel_surcharge_percent: 0,
      estimated_delivery_days_min: 1,
      estimated_delivery_days_max: 3,
    };
  });

  await addPriceListEntries(priceList.id, dbEntries);

  console.log(
    `   ✅ Creato: ${priceList.id} (${dbEntries.length} entries, ${Object.keys(ZONE_MAP).length} zone)`
  );
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
