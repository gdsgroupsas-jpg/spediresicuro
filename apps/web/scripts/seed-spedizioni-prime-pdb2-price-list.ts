/**
 * Seed Script: Popola listino fornitore Spedizioni Prime — PosteDeliveryBusiness PDB_4
 *
 * PosteDeliveryBusiness / Volumetrico 200 (5000) / Spedizioni Prime
 * Prezzi IVA ESCLUSA — vat_mode: 'excluded'
 * Provider: spedisci_online
 * Config: Spedizioni Prime
 * Carrier: postedeliverybusiness
 * Contract: postedeliverybusiness-Solution-and-Shipi-2
 *
 * Zone: Italia, SCS (Sardegna/Calabria/Sicilia supplemento)
 * Livigno/Campione = €0 (non coperto)
 * 8 fasce peso fino a 100kg
 *
 * Usage: npx tsx scripts/seed-spedizioni-prime-pdb2-price-list.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── ZONE MAPPING ───

const ZONE_MAP: Record<string, string> = {
  italia: 'IT-ITALIA',
  scs: 'IT-SCS', // Sardegna + Calabria + Sicilia (supplemento)
};

// ─── PRICE DATA (IVA esclusa) ───

interface ZoneWeightPrice {
  zone: string;
  weight_to: number;
  price: number;
}

const WEIGHT_ENTRIES: ZoneWeightPrice[] = [
  // Italia
  { zone: 'italia', weight_to: 2, price: 4.2 },
  { zone: 'italia', weight_to: 5, price: 5.5 },
  { zone: 'italia', weight_to: 10, price: 7.0 },
  { zone: 'italia', weight_to: 20, price: 8.0 },
  { zone: 'italia', weight_to: 30, price: 11.0 },
  { zone: 'italia', weight_to: 50, price: 13.9 },
  { zone: 'italia', weight_to: 70, price: 20.5 },
  { zone: 'italia', weight_to: 100, price: 27.0 },

  // SCS (Sardegna/Calabria/Sicilia) — supplemento
  { zone: 'scs', weight_to: 2, price: 0 },
  { zone: 'scs', weight_to: 5, price: 0.7 },
  { zone: 'scs', weight_to: 10, price: 0.8 },
  { zone: 'scs', weight_to: 20, price: 1.0 },
  { zone: 'scs', weight_to: 30, price: 2.5 },
  { zone: 'scs', weight_to: 50, price: 4.5 },
  { zone: 'scs', weight_to: 70, price: 6.5 },
  { zone: 'scs', weight_to: 100, price: 11.0 },
];

// ─── SUPPLEMENTI (stored in metadata, IVA esclusa) ───

const SURCHARGES = {
  assicurazione: {
    soglia_600: { fixed: 15.0, percent: 0, note: 'Fino a €600 valore dichiarato' },
  },
  contrassegno: {
    soglia_100: { fixed: 3.5, percent: 0, note: 'Fino a €100' },
    soglia_1000: { fixed: 3.5, percent: 2.5, note: '€100-€1000, 2.5% sulla differenza' },
  },
  accessori: {
    andata_ritorno: { fixed: 0, percent: 100, note: 'Andata & Ritorno (100% costo spedizione)' },
    reverse_puntoposte: { fixed: 0, percent: 0, note: 'Reverse PuntoPoste' },
  },
  giacenze: {
    riconsegna: { fixed: 0, percent: 100, note: 'Riconsegna (100% costo spedizione)' },
    riconsegna_nuovo_destinatario: { fixed: 0, percent: 0, note: 'Riconsegna nuovo destinatario' },
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
  console.log('  SEED: Spedizioni Prime — PosteDeliveryBusiness PDB_4');
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

  // Get or create PosteDeliveryBusiness courier
  let courierId: string;

  const { data: allCouriers } = await supabaseAdmin
    .from('couriers')
    .select('id, name, display_name, code');

  console.log('  Couriers nel DB:', allCouriers?.map((c) => `${c.name} (${c.id})`).join(', '));

  const posteCourier = allCouriers?.find(
    (c) =>
      c.name?.toLowerCase().includes('poste') ||
      c.name?.toLowerCase().includes('sda') ||
      c.name?.toLowerCase().includes('postedeliverybusiness') ||
      c.code?.toLowerCase().includes('poste') ||
      c.code?.toLowerCase().includes('sda')
  );

  if (posteCourier) {
    courierId = posteCourier.id;
    console.log(`  Courier PosteDeliveryBusiness -> ${courierId} (${posteCourier.name})`);
  } else {
    const { data: newCourier, error: insertErr } = await supabaseAdmin
      .from('couriers')
      .insert({
        name: 'postedeliverybusiness',
        display_name: 'Poste Delivery Business',
        code: 'POSTEDELIVERYBUSINESS',
      })
      .select('id')
      .single();
    if (!newCourier)
      throw new Error(`Impossibile creare courier PosteDeliveryBusiness: ${insertErr?.message}`);
    courierId = newCourier.id;
    console.log(`  Courier PosteDeliveryBusiness CREATO -> ${courierId}`);
  }

  const listName = 'Spedizioni Prime - PosteDeliveryBusiness PDB_4';
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
      source_type: 'manual',
      source_file_name: 'spedizioni_prime_pdb4.png',
      vat_mode: 'excluded',
      vat_rate: 22,
      description:
        'Listino fornitore Spedizioni Prime — PosteDeliveryBusiness PDB_4. Volumetrico 200 (5000). Prezzi IVA esclusa. Italia + SCS.',
      notes:
        'Carrier: PosteDeliveryBusiness. Provider: spedisci_online (Spedizioni Prime). Contract: postedeliverybusiness-Solution-and-Shipi-2. SCS = Sardegna+Calabria+Sicilia (supplemento). Livigno/Campione non coperto.',
      metadata: {
        provider: 'spediscionline',
        courier_slug: 'postedeliverybusiness',
        carrier_code: 'postedeliverybusiness',
        contract_code: 'postedeliverybusiness-Solution-and-Shipi-2',
        volumetric_divisor: 200,
        courier_config_id: PRIME_CONFIG_ID,
        config_id: PRIME_CONFIG_ID,
        fuel_included: false,
        scs_note: 'SCS = Sardegna + Calabria + Sicilia (supplemento zona)',
        livigno_campione: 'non_coperto',
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
      base_price: e.price,
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
