/**
 * Seed Script: Popola listino fornitore Spedizioni Prime — Interno (CL)
 *
 * Spedizioni Prime CL / Volumetrico 1 kg/m³ / Solo Italia
 * Prezzi IVA ESCLUSA — vat_mode: 'excluded'
 * Provider: spedisci_online
 * Config: Spedizioni Prime (a39b55f1-...)
 * Carrier: interno
 * Contract: interno
 *
 * Solo 4 fasce peso, zona Italia
 * Copertura limitata (solo alcuni CAP)
 *
 * Usage: npx tsx scripts/seed-spedizioni-prime-interno-price-list.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── PRICE DATA (IVA esclusa) ───

const WEIGHT_ENTRIES = [
  { weight_to: 2, price: 3.7 },
  { weight_to: 5, price: 4.3 },
  { weight_to: 10, price: 5.4 },
  { weight_to: 20, price: 7.5 },
];

// ─── SUPPLEMENTI (stored in metadata, IVA esclusa) ───

const SURCHARGES = {
  assicurazione: {
    soglia_500: { fixed: 4.0, percent: 0, note: 'Fino a €500 valore dichiarato' },
  },
  contrassegno: {
    soglia_516: { fixed: 1.6, percent: 0, note: 'Fino a €516' },
    soglia_1000: { fixed: 1.6, percent: 1.7, note: '€516-€1000, 1.7% sulla differenza' },
  },
  giacenze: {
    riconsegna: { fixed: 0, percent: 100, note: 'Riconsegna (100% costo spedizione)' },
    reso_mittente: { fixed: 0, percent: 100, note: 'Reso mittente (100% costo spedizione)' },
    distruggere: { fixed: 0, percent: 0, note: 'Distruggere' },
    ritiro_in_sede: { fixed: 0, percent: 0, note: 'Ritiro in sede' },
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
  console.log('  SEED: Listino Fornitore Spedizioni Prime — Interno (CL)');
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

  const PRIME_CONFIG_ID = primeConfig?.id || 'a39b55f1-0000-0000-0000-000000000000';
  console.log(`  Config ID Spedizioni Prime: ${PRIME_CONFIG_ID}\n`);

  // Get or create "Interno" courier
  let courierId: string;
  const { data: courier } = await supabaseAdmin
    .from('couriers')
    .select('id')
    .or('name.ilike.%interno%')
    .maybeSingle();

  if (courier) {
    courierId = courier.id;
    console.log(`  Courier Interno -> ${courierId}`);
  } else {
    const { data: newCourier } = await supabaseAdmin
      .from('couriers')
      .insert({ name: 'interno', display_name: 'Spedizioni Prime CL (Interno)', code: 'INTERNO' })
      .select('id')
      .single();
    if (!newCourier) throw new Error('Impossibile creare courier Interno');
    courierId = newCourier.id;
    console.log(`  Courier Interno CREATO -> ${courierId}`);
  }

  const listName = 'Spedizioni Prime - Interno CL';
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
      courier_id: courierId,
      name: listName,
      version: '1.0',
      status: 'active',
      list_type: 'supplier',
      is_global: true,
      source_type: 'csv',
      source_file_name: 'spedizioni_prime_interno_cl.csv',
      vat_mode: 'excluded',
      vat_rate: 22,
      description:
        'Listino fornitore Spedizioni Prime — Interno CL. Solo Italia, copertura limitata (solo alcuni CAP). Prezzi IVA esclusa.',
      notes:
        'Carrier: Interno. Provider: spedisci_online (Spedizioni Prime). Contract: interno. Volumetrico 1 kg/m³. Solo 4 fasce peso.',
      metadata: {
        provider: 'spediscionline',
        courier_slug: 'interno',
        carrier_code: 'interno',
        contract_code: 'interno',
        volumetric_divisor: 1,
        courier_config_id: PRIME_CONFIG_ID,
        config_id: PRIME_CONFIG_ID,
        fuel_included: false,
        limited_coverage: true,
        surcharges: SURCHARGES,
      },
    },
    adminId
  );

  // Build entries — solo zona Italia
  const uniqueWeightTos = WEIGHT_ENTRIES.map((e) => e.weight_to).sort((a, b) => a - b);

  const dbEntries = WEIGHT_ENTRIES.map((e) => {
    const idx = uniqueWeightTos.indexOf(e.weight_to);
    const weightFrom = idx <= 0 ? 0 : uniqueWeightTos[idx - 1];

    return {
      zone_code: 'IT-ITALIA',
      weight_from: weightFrom,
      weight_to: e.weight_to,
      base_price: e.price,
      service_type: 'standard' as const,
      fuel_surcharge_percent: 0,
      estimated_delivery_days_min: 1,
      estimated_delivery_days_max: 3,
    };
  });

  await addPriceListEntries(priceList.id, dbEntries);

  console.log(`   ✅ Creato: ${priceList.id} (${dbEntries.length} entries, 1 zona)`);
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
