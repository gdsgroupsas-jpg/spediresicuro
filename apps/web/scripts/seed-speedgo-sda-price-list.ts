/**
 * Seed Script: Popola listino fornitore SpeedGo — SDA Express H24+ (PosteDeliveryBusiness PDB-4)
 *
 * SDA / Volumetrico 200 / SpeedGo
 * Prezzi IVA INCLUSA (22%) — vat_mode: 'included'
 * Provider: spedisci_online
 * Config: SpeedGo (c8c6cdc4-2de7-4d45-ac93-7f7b1e5c16f3)
 * Carrier: postedeliverybusiness
 * Contract: postedeliverybusiness-PDB-4
 *
 * Crea 1 listino supplier con:
 *   - Entries per zona (italia, sardegna, calabria, sicilia, livigno_campione, localita_disagiate)
 *   - Fasce peso fino a 100kg + extra_step per oltre 100kg
 *   - Supplementi: assicurazione, accessori, giacenze nel metadata
 *
 * Usage: npx tsx scripts/seed-speedgo-sda-price-list.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── ZONE MAPPING ───

const ZONE_MAP: Record<string, string> = {
  italia: 'IT-ITALIA',
  sardegna: 'IT-SARDEGNA',
  calabria: 'IT-CALABRIA',
  sicilia: 'IT-SICILIA',
  livigno_campione: 'IT-LIVIGNO',
  localita_disagiate: 'IT-DISAGIATE',
};

// ─── PRICE DATA (IVA inclusa 22%) ───

interface ZoneWeightPrice {
  zone: string;
  weight_to: number;
  price_iva_inc: number;
}

const WEIGHT_ENTRIES: ZoneWeightPrice[] = [
  // 2 kg
  { zone: 'sardegna', weight_to: 2, price_iva_inc: 7.32 },
  { zone: 'italia', weight_to: 2, price_iva_inc: 5.37 },
  { zone: 'calabria', weight_to: 2, price_iva_inc: 7.32 },
  { zone: 'sicilia', weight_to: 2, price_iva_inc: 7.32 },
  { zone: 'livigno_campione', weight_to: 2, price_iva_inc: 148.84 },
  { zone: 'localita_disagiate', weight_to: 2, price_iva_inc: 13.69 },

  // 5 kg
  { zone: 'sardegna', weight_to: 5, price_iva_inc: 7.56 },
  { zone: 'italia', weight_to: 5, price_iva_inc: 5.98 },
  { zone: 'calabria', weight_to: 5, price_iva_inc: 7.56 },
  { zone: 'sicilia', weight_to: 5, price_iva_inc: 7.56 },
  { zone: 'livigno_campione', weight_to: 5, price_iva_inc: 223.26 },
  { zone: 'localita_disagiate', weight_to: 5, price_iva_inc: 13.99 },

  // 10 kg
  { zone: 'sardegna', weight_to: 10, price_iva_inc: 8.78 },
  { zone: 'italia', weight_to: 10, price_iva_inc: 7.81 },
  { zone: 'calabria', weight_to: 10, price_iva_inc: 8.78 },
  { zone: 'sicilia', weight_to: 10, price_iva_inc: 8.78 },
  { zone: 'livigno_campione', weight_to: 10, price_iva_inc: 297.68 },
  { zone: 'localita_disagiate', weight_to: 10, price_iva_inc: 15.48 },

  // 20 kg
  { zone: 'sardegna', weight_to: 20, price_iva_inc: 10.98 },
  { zone: 'italia', weight_to: 20, price_iva_inc: 9.15 },
  { zone: 'calabria', weight_to: 20, price_iva_inc: 10.98 },
  { zone: 'sicilia', weight_to: 20, price_iva_inc: 10.98 },
  { zone: 'livigno_campione', weight_to: 20, price_iva_inc: 372.1 },
  { zone: 'localita_disagiate', weight_to: 20, price_iva_inc: 17.12 },

  // 30 kg
  { zone: 'sardegna', weight_to: 30, price_iva_inc: 12.81 },
  { zone: 'italia', weight_to: 30, price_iva_inc: 10.49 },
  { zone: 'calabria', weight_to: 30, price_iva_inc: 12.81 },
  { zone: 'sicilia', weight_to: 30, price_iva_inc: 12.81 },
  { zone: 'livigno_campione', weight_to: 30, price_iva_inc: 446.52 },
  { zone: 'localita_disagiate', weight_to: 30, price_iva_inc: 18.61 },

  // 50 kg
  { zone: 'sardegna', weight_to: 50, price_iva_inc: 24.4 },
  { zone: 'italia', weight_to: 50, price_iva_inc: 20.74 },
  { zone: 'calabria', weight_to: 50, price_iva_inc: 24.4 },
  { zone: 'sicilia', weight_to: 50, price_iva_inc: 24.4 },
  { zone: 'livigno_campione', weight_to: 50, price_iva_inc: 520.94 },
  { zone: 'localita_disagiate', weight_to: 50, price_iva_inc: 29.03 },

  // 70 kg
  { zone: 'sardegna', weight_to: 70, price_iva_inc: 28.06 },
  { zone: 'italia', weight_to: 70, price_iva_inc: 24.4 },
  { zone: 'calabria', weight_to: 70, price_iva_inc: 28.06 },
  { zone: 'sicilia', weight_to: 70, price_iva_inc: 28.06 },
  { zone: 'livigno_campione', weight_to: 70, price_iva_inc: 595.36 },
  { zone: 'localita_disagiate', weight_to: 70, price_iva_inc: 33.49 },

  // 100 kg
  { zone: 'sardegna', weight_to: 100, price_iva_inc: 31.72 },
  { zone: 'italia', weight_to: 100, price_iva_inc: 26.23 },
  { zone: 'calabria', weight_to: 100, price_iva_inc: 31.72 },
  { zone: 'sicilia', weight_to: 100, price_iva_inc: 31.72 },
  { zone: 'livigno_campione', weight_to: 100, price_iva_inc: 669.78 },
  { zone: 'localita_disagiate', weight_to: 100, price_iva_inc: 34.98 },
];

// Extra step: prezzo per ogni kg oltre 100kg (stessi valori della fascia 100kg)
const EXTRA_STEP: Record<string, number> = {
  sardegna: 31.72,
  italia: 26.23,
  calabria: 31.72,
  sicilia: 31.72,
  livigno_campione: 669.78,
  localita_disagiate: 34.98,
};

// ─── SUPPLEMENTI (stored in metadata, IVA inclusa) ───

const SURCHARGES = {
  assicurazione: {
    soglia_200: { fixed: 2.32, percent: 0, note: 'Fino a €200 valore dichiarato' },
    soglia_2600: { fixed: 2.32, percent: 2, note: 'Fino a €2600, 2% sul totale' },
  },
  accessori: {
    andata_ritorno: {
      fixed: 12.2,
      percent: 100,
      note: 'Servizio andata e ritorno (100% costo spedizione)',
    },
  },
  giacenze: {
    riconsegna: { fixed: 5.49, percent: 0, note: 'Riconsegna' },
    riconsegna_nuovo_destinatario: {
      fixed: 5.49,
      percent: 0,
      note: 'Riconsegna nuovo destinatario',
    },
    reso_mittente: { fixed: 0, percent: 100, note: 'Reso mittente (100% costo spedizione)' },
    distruggere: { fixed: 0, percent: 0, note: 'Distruggere' },
    ritiro_in_sede: { fixed: 0, percent: 0, note: 'Ritiro in sede' },
    consegna_parziale_rendi: { fixed: 0, percent: 0, note: 'Consegna parziale + rendi' },
    consegna_parziale_distruggi: { fixed: 0, percent: 0, note: 'Consegna parziale + distruggi' },
    apertura_dossier: { fixed: 0.61, percent: 0, note: 'Apertura dossier' },
  },
};

// ─── MAIN SEED ───

async function seed() {
  const { supabaseAdmin } = await import('@/lib/db/client');
  const { createPriceList, addPriceListEntries } = await import('@/lib/db/price-lists');

  console.log('═══════════════════════════════════════════════════');
  console.log('  SEED: Listino Fornitore SpeedGo — SDA H24+ (PDB-4)');
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

  // Get or create SDA/PosteDeliveryBusiness courier
  let courierId: string;

  // List all couriers to find the right one
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
        display_name: 'SDA Express (Poste)',
        code: 'POSTEDELIVERYBUSINESS',
      })
      .select('id')
      .single();
    if (!newCourier)
      throw new Error(`Impossibile creare courier PosteDeliveryBusiness: ${insertErr?.message}`);
    courierId = newCourier.id;
    console.log(`  Courier PosteDeliveryBusiness CREATO -> ${courierId}`);
  }

  const SPEEDGO_CONFIG_ID = 'c8c6cdc4-2de7-4d45-ac93-7f7b1e5c16f3';
  console.log(`  Config ID SpeedGo: ${SPEEDGO_CONFIG_ID}\n`);

  const listName = 'SpeedGo - SDA H24+ (PosteDeliveryBusiness PDB-4)';
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
      source_file_name: 'speedgo_sda_h24plus_consolidato.csv',
      vat_mode: 'included',
      vat_rate: 22,
      description:
        'Listino fornitore SpeedGo — SDA Express H24+. PosteDeliveryBusiness PDB-4. Volumetrico 200. Prezzi IVA inclusa (22%). Italia + Isole + Calabria.',
      notes:
        'Carrier: PosteDeliveryBusiness. Provider: spedisci_online (SpeedGo). Contract: postedeliverybusiness-PDB-4. Extra step oltre 100kg nei metadata.',
      metadata: {
        provider: 'spediscionline',
        courier_slug: 'postedeliverybusiness',
        carrier_code: 'postedeliverybusiness',
        contract_code: 'postedeliverybusiness-PDB-4',
        volumetric_divisor: 200,
        courier_config_id: SPEEDGO_CONFIG_ID,
        config_id: SPEEDGO_CONFIG_ID,
        fuel_included: false,
        extra_step_per_100kg: EXTRA_STEP,
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
      estimated_delivery_days_max: 2,
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
