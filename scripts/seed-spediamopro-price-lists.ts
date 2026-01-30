/**
 * Seed Script: Popola listini fornitore SpediamoPro dal PDF listino_italia_2026.pdf
 *
 * Crea 3 listini per ogni corriere (base, sconto 12%, sconto 22%)
 * oppure 1 listino base per corriere con le 3 fasce come note.
 *
 * Strategia: 1 listino supplier per corriere/servizio con prezzo BASE (listino base).
 * I prezzi sono IVA esclusa, fuel surcharge incluso.
 *
 * Usage: npx tsx scripts/seed-spediamopro-price-lists.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// ─── PDF DATA: Listino SpediamoPro Italia 2026 ───

interface WeightEntry {
  weight_to: number;
  base: number;
  sconto12: number;
  sconto22: number;
}

interface CarrierData {
  name: string;
  courier_slug: string; // maps to couriers.name
  carrier_code: string; // SpediamoPro carrier code
  service_type: 'standard' | 'express';
  delivery_days_min: number;
  delivery_days_max: number;
  entries: WeightEntry[];
}

const carriers: CarrierData[] = [
  {
    name: 'UPS Italia',
    courier_slug: 'ups',
    carrier_code: 'UPSSTD',
    service_type: 'express',
    delivery_days_min: 1,
    delivery_days_max: 2,
    entries: [
      { weight_to: 2, base: 10.71, sconto12: 9.38, sconto22: 8.33 },
      { weight_to: 5, base: 11.39, sconto12: 9.96, sconto22: 8.86 },
      { weight_to: 10, base: 11.96, sconto12: 10.46, sconto22: 9.3 },
      { weight_to: 20, base: 13.3, sconto12: 11.64, sconto22: 10.34 },
      { weight_to: 30, base: 16.73, sconto12: 14.64, sconto22: 13.01 },
      { weight_to: 50, base: 26.26, sconto12: 22.97, sconto22: 20.42 },
      { weight_to: 70, base: 45.69, sconto12: 39.98, sconto22: 35.53 },
    ],
  },
  {
    name: 'BRT Express Italia',
    courier_slug: 'brt',
    carrier_code: 'BRTEXP',
    service_type: 'express',
    delivery_days_min: 1,
    delivery_days_max: 2,
    entries: [
      { weight_to: 3, base: 5.75, sconto12: 5.03, sconto22: 4.47 },
      { weight_to: 5, base: 6.63, sconto12: 5.8, sconto22: 5.16 },
      { weight_to: 10, base: 8.86, sconto12: 7.84, sconto22: 6.97 },
      { weight_to: 20, base: 10.89, sconto12: 9.53, sconto22: 8.47 },
      { weight_to: 30, base: 12.83, sconto12: 11.22, sconto22: 9.97 },
      { weight_to: 50, base: 19.25, sconto12: 16.84, sconto22: 14.97 },
      { weight_to: 75, base: 23.75, sconto12: 20.78, sconto22: 18.47 },
      { weight_to: 100, base: 26.96, sconto12: 23.59, sconto22: 20.97 },
    ],
  },
  {
    name: 'Poste Delivery Express',
    courier_slug: 'poste',
    carrier_code: 'SDASTD',
    service_type: 'express',
    delivery_days_min: 1,
    delivery_days_max: 2,
    entries: [
      { weight_to: 2, base: 6.16, sconto12: 5.39, sconto22: 4.79 },
      { weight_to: 5, base: 7.42, sconto12: 6.49, sconto22: 5.77 },
      { weight_to: 10, base: 9.57, sconto12: 8.37, sconto22: 7.44 },
      { weight_to: 20, base: 11.22, sconto12: 9.82, sconto22: 8.73 },
      { weight_to: 30, base: 13.21, sconto12: 11.56, sconto22: 10.27 },
      { weight_to: 50, base: 24.76, sconto12: 21.66, sconto22: 19.26 },
      { weight_to: 70, base: 26.4, sconto12: 23.1, sconto22: 20.53 },
      { weight_to: 100, base: 29.71, sconto12: 25.99, sconto22: 23.11 },
    ],
  },
  {
    name: 'InPost Italia (S)',
    courier_slug: 'inpost',
    carrier_code: 'INPOSTSTD',
    service_type: 'standard',
    delivery_days_min: 1,
    delivery_days_max: 2,
    entries: [
      { weight_to: 2, base: 4.97, sconto12: 4.35, sconto22: 3.87 },
      { weight_to: 5, base: 5.49, sconto12: 4.8, sconto22: 4.27 },
      { weight_to: 10, base: 6.13, sconto12: 5.36, sconto22: 4.77 },
      { weight_to: 25, base: 6.39, sconto12: 5.59, sconto22: 4.97 },
    ],
  },
  {
    name: 'InPost Italia (M)',
    courier_slug: 'inpost',
    carrier_code: 'INPOSTSTD',
    service_type: 'standard',
    delivery_days_min: 1,
    delivery_days_max: 2,
    entries: [
      { weight_to: 2, base: 5.74, sconto12: 5.03, sconto22: 4.47 },
      { weight_to: 5, base: 6.13, sconto12: 5.36, sconto22: 4.77 },
      { weight_to: 10, base: 6.13, sconto12: 5.36, sconto22: 4.77 },
      { weight_to: 25, base: 6.39, sconto12: 5.59, sconto22: 4.97 },
    ],
  },
  {
    name: 'InPost Italia (L)',
    courier_slug: 'inpost',
    carrier_code: 'INPOSTSTD',
    service_type: 'standard',
    delivery_days_min: 1,
    delivery_days_max: 2,
    entries: [
      { weight_to: 2, base: 6.39, sconto12: 5.59, sconto22: 4.97 },
      { weight_to: 5, base: 6.64, sconto12: 5.81, sconto22: 5.17 },
      { weight_to: 10, base: 6.64, sconto12: 5.81, sconto22: 5.17 },
      { weight_to: 25, base: 6.9, sconto12: 6.04, sconto22: 5.37 },
    ],
  },
  {
    name: 'Fermopoint BRT',
    courier_slug: 'brt',
    carrier_code: 'BRTPUDO',
    service_type: 'standard',
    delivery_days_min: 1,
    delivery_days_max: 2,
    entries: [
      { weight_to: 3, base: 5.61, sconto12: 4.91, sconto22: 4.37 },
      { weight_to: 5, base: 6.21, sconto12: 5.44, sconto22: 4.83 },
      { weight_to: 10, base: 7.67, sconto12: 6.71, sconto22: 5.97 },
      { weight_to: 20, base: 9.99, sconto12: 8.74, sconto22: 7.77 },
    ],
  },
];

const TIERS = [
  { key: 'base' as const, label: 'Base', suffix: '' },
  { key: 'sconto12' as const, label: 'Sconto 12%', suffix: ' (Sconto 12% - ricarica €250)' },
  { key: 'sconto22' as const, label: 'Sconto 22%', suffix: ' (Sconto 22% - ricarica €1000)' },
];

async function seed() {
  // Dynamic imports after dotenv has loaded
  const { supabaseAdmin } = await import('@/lib/db/client');
  const { createPriceList, addPriceListEntries } = await import('@/lib/db/price-lists');

  console.log('═══════════════════════════════════════════════════');
  console.log('  SEED: Listini Fornitore SpediamoPro Italia 2026');
  console.log('═══════════════════════════════════════════════════\n');

  // Get admin user
  const { data: adminUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('account_type', ['superadmin', 'admin'])
    .limit(1)
    .single();

  if (!adminUser) {
    throw new Error('Nessun admin/superadmin trovato. Impossibile creare listini.');
  }
  const adminId = adminUser.id;
  console.log(`Admin user: ${adminId}\n`);

  // Resolve courier slugs to UUIDs, create missing ones
  const courierUUIDs: Record<string, string> = {};
  const uniqueSlugs = [...new Set(carriers.map((c) => c.courier_slug))];

  // Alternate names for DB lookup
  const slugAliases: Record<string, string[]> = {
    brt: ['brt', 'bartolini'],
    poste: ['poste', 'postedeliverybusiness'],
  };

  for (const slug of uniqueSlugs) {
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
      // Create missing courier (e.g. inpost)
      const displayNames: Record<string, string> = {
        inpost: 'InPost',
        brt: 'BRT',
        ups: 'UPS',
        poste: 'Poste Italiane',
      };
      const codes: Record<string, string> = {
        inpost: 'INP',
        brt: 'BRT',
        ups: 'UPS',
        poste: 'PTI',
      };
      const { data: newCourier } = await supabaseAdmin
        .from('couriers')
        .insert({
          name: slug,
          display_name: displayNames[slug] || slug.toUpperCase(),
          code: codes[slug] || slug.toUpperCase(),
        })
        .select('id')
        .single();

      if (newCourier) {
        courierUUIDs[slug] = newCourier.id;
        console.log(`  Courier "${slug}" CREATO -> ${newCourier.id}`);
      } else {
        throw new Error(`Impossibile creare courier "${slug}"`);
      }
    }
  }
  console.log('');

  let totalLists = 0;
  let totalEntries = 0;

  for (const carrier of carriers) {
    for (const tier of TIERS) {
      const listName = `SpediamoPro - ${carrier.name}${tier.suffix}`;

      console.log(`Creazione: ${listName}`);

      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from('price_lists')
        .select('id')
        .eq('name', listName)
        .maybeSingle();

      if (existing) {
        console.log(`   Skip, gia esistente (${existing.id})\n`);
        continue;
      }

      const priceList = await createPriceList(
        {
          courier_id: courierUUIDs[carrier.courier_slug],
          name: listName,
          version: '1.0',
          status: 'active',
          list_type: 'supplier',
          is_global: true,
          source_type: 'pdf',
          source_file_name: 'listino_italia_2026.pdf',
          vat_mode: 'excluded',
          vat_rate: 22,
          description: `Listino fornitore SpediamoPro - ${carrier.name} - ${tier.label}. Consegne 24/48h Italia. Fuel surcharge incluso.`,
          notes: `Carrier code: ${carrier.carrier_code}. Provider: spediamopro. Aggiornamento: 01/2026.`,
          metadata: {
            provider: 'spediamopro',
            courier_slug: carrier.courier_slug,
            carrier_code: carrier.carrier_code,
            tier: tier.key,
            tier_label: tier.label,
            fuel_included: true,
          },
        },
        adminId
      );

      // Build entries
      const entries = carrier.entries.map((e, idx) => ({
        weight_from: idx === 0 ? 0 : carrier.entries[idx - 1].weight_to,
        weight_to: e.weight_to,
        base_price: e[tier.key],
        service_type: carrier.service_type as 'standard' | 'express',
        fuel_surcharge_percent: 0, // already included in price
        estimated_delivery_days_min: carrier.delivery_days_min,
        estimated_delivery_days_max: carrier.delivery_days_max,
      }));

      await addPriceListEntries(priceList.id, entries);

      totalLists++;
      totalEntries += entries.length;
      console.log(`   ✅ Creato: ${priceList.id} (${entries.length} fasce peso)\n`);
    }
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
