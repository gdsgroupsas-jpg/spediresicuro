import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { PRICING_MATRIX } from '@/lib/constants/pricing-matrix';
import { supabaseAdmin } from '@/lib/db/client';
import { createPriceList } from '@/lib/db/price-lists';
import { testSpedisciOnlineRates } from './spedisci-online-rates';

/**
 * Sincronizza listini completi (Matrice Pesi x Zone) da spedisci.online
 *
 * Esegue una scansione sistematica ("Smart Probe") chiamando l'API /rates
 * per diverse combinazioni di Pesi e Zone (definite in PRICING_MATRIX).
 *
 * @param options - Opzioni personalizzate
 */
export async function syncPriceListsFromSpedisciOnlineMatrix(options?: {
  courierId?: string;
  overwriteExisting?: boolean;
  batchSize?: number; // Numero di richieste parallele (default 3)
}): Promise<{
  success: boolean;
  priceListsCreated?: number;
  priceListsUpdated?: number;
  entriesAdded?: number;
  error?: string;
  details?: {
    probesTotal: number;
    probesSuccessful: number;
    carriersFound: string[];
  };
}> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', context.actor.email)
      .single();

    if (!user) return { success: false, error: 'Utente non trovato' };

    console.log('🚀 [MATRIX SYNC] Avvio sincronizzazione completa (Smart Probe)...');
    console.log(
      `📋 [MATRIX SYNC] Matrix: ${PRICING_MATRIX.WEIGHTS.length} pesi x ${PRICING_MATRIX.ZONES.length} zone`
    );

    // 1. Prepare Probes (Combinations of Weight & Zone)
    const probes = [];
    for (const zone of PRICING_MATRIX.ZONES) {
      for (const weight of PRICING_MATRIX.WEIGHTS) {
        probes.push({ zone, weight });
      }
    }

    console.log(`🔢 [MATRIX SYNC] Totale richieste da effettuare: ${probes.length}`);

    // 2. Execute Probes (in batches to avoid rate limits)
    const BATCH_SIZE = options?.batchSize || 3;
    const allRates: any[] = [];
    let probesCompleted = 0;
    let probesSuccessful = 0;

    // Helper for delay
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let i = 0; i < probes.length; i += BATCH_SIZE) {
      const batch = probes.slice(i, i + BATCH_SIZE);
      console.log(
        `⏳ [MATRIX SYNC] Esecuzione batch ${
          Math.floor(i / BATCH_SIZE) + 1
        }/${Math.ceil(probes.length / BATCH_SIZE)}...`
      );

      const batchPromises = batch.map(async (probe) => {
        // Prepare params based on Probe
        const testParams = {
          packages: [
            {
              length: 20, // Standard dimensions
              width: 20,
              height: 20,
              weight: probe.weight,
            },
          ],
          shipFrom: {
            // Standard Sender (Rome)
            name: 'Mittente Probe',
            street1: 'Via Roma 1',
            city: 'Roma',
            state: 'RM',
            postalCode: '00100',
            country: 'IT',
            email: 'probe@test.com',
          },
          shipTo: {
            // Receiver based on Zone
            name: 'Destinatario Probe',
            street1: 'Via Test 1',
            city: probe.zone.sampleAddress.city,
            state: probe.zone.sampleAddress.state,
            postalCode: probe.zone.sampleAddress.postalCode,
            country: probe.zone.sampleAddress.country,
            email: 'receiver@probe.com',
          },
        };

        const result = await testSpedisciOnlineRates(testParams);
        return { probe, result };
      });

      const results = await Promise.all(batchPromises);

      for (const { probe, result } of results) {
        probesCompleted++;
        if (result.success && result.rates) {
          probesSuccessful++;
          // Enrich rates with Zone Code and Weight Bracket info for creating entries later
          const enrichedRates = result.rates.map((r) => ({
            ...r,
            _probe_zone: probe.zone.code,
            _probe_weight: probe.weight,
            _probe_weight_min: 0, // Simplified, logic to determine range needed later?
          }));
          allRates.push(...enrichedRates);
        }
      }

      // Respectful delay between batches
      if (i + BATCH_SIZE < probes.length) await delay(1000);
    }

    console.log(`✅ [MATRIX SYNC] Scansione completata. Rates raccolti: ${allRates.length}`);

    // 3. Process Data & Save to DB
    // Group by Carrier
    const ratesByCarrier: Record<string, any[]> = {};
    for (const rate of allRates) {
      if (!ratesByCarrier[rate.carrierCode]) {
        ratesByCarrier[rate.carrierCode] = [];
      }
      ratesByCarrier[rate.carrierCode].push(rate);
    }

    let priceListsCreated = 0;
    let priceListsUpdated = 0;
    let entriesAddedTotal = 0;

    for (const [carrierCode, rates] of Object.entries(ratesByCarrier)) {
      console.log(`📦 [MATRIX SYNC] Elaborazione listino per: ${carrierCode}`);

      // Find existing List
      const { data: existingList } = await supabaseAdmin
        .from('price_lists')
        .select('id')
        .eq('created_by', user.id)
        .eq('list_type', 'supplier')
        .ilike('name', `%${carrierCode}%`)
        .maybeSingle();

      let listId = existingList?.id;
      const listName = `M-SYNC: ${carrierCode.toUpperCase()} (${new Date().toLocaleDateString()})`;

      if (listId) {
        // Update
        if (options?.overwriteExisting !== false) {
          // Default true
          console.log(`   🔄 Aggiornamento listino esistente: ${listId}`);
          // Delete old entries
          await supabaseAdmin.from('price_list_entries').delete().eq('price_list_id', listId);
          priceListsUpdated++;
        } else {
          console.log(`   ⏭️ Listino esistente, skip overwrite.`);
          continue;
        }
      } else {
        // Create
        const newList = await createPriceList(
          {
            name: listName,
            version: '2.0', // V2 Matrix
            status: 'active',
            courier_id: null, // Link later if needed
            list_type: 'supplier',
            source_type: 'api',
            notes: 'Matrix Sync V2 - Full Zone/Weight scan',
          },
          user.id
        );
        listId = newList.id;
        priceListsCreated++;
        console.log(`   ✨ Creato nuovo listino: ${listId}`);
      }

      // Create Entries
      // We need to deduplicate and structure entries.
      // Spedisci.Online returns specific price for specific weight.
      // We map this to: Weight_To = Probe_Weight.
      // Weight_From = Previous_Probe_Weight (safe assumption for "Up To X kg") or 0.

      // Sort standard weights to determine ranges
      const sortedWeights = [...PRICING_MATRIX.WEIGHTS].sort((a, b) => a - b);

      const entries = rates.map((rate) => {
        const weightTo = rate._probe_weight;
        // Find weightFrom: the bracket immediately before this one
        const weightIndex = sortedWeights.indexOf(weightTo);
        let weightFrom = 0;
        if (weightIndex > 0) {
          // E.g. if To=5, From is >3. So From=3.001? Or 3?
          // Standard logic: 0-3, 3-5. So From = Previous Weight.
          weightFrom = sortedWeights[weightIndex - 1];
        }

        // Determine Service Type
        const contractLower = rate.contractCode.toLowerCase();
        let serviceType = 'standard';
        if (contractLower.includes('express') || contractLower.includes('fast'))
          serviceType = 'express';
        if (contractLower.includes('economy')) serviceType = 'economy';

        return {
          price_list_id: listId,
          weight_from: weightFrom,
          weight_to: weightTo,
          zone_code: rate._probe_zone,
          base_price: parseFloat(rate.total_price),
          service_type: serviceType,
          // Additional metadata?
        };
      });

      // Batch Insert Entries (avoiding duplicates if multiple probes returned same rate?
      // Actually, matrix ensures unique Zone+Weight probe. But multiple contracts might exist for same probe.)
      // e.g. "GLS Standard" and "GLS Express" will both appear for 3kg/Roma.

      // We can insert all of them.
      const { error: insertError } = await supabaseAdmin.from('price_list_entries').insert(entries);
      if (insertError) {
        console.error('   ❌ Errore inserimento voci:', insertError.message);
      } else {
        console.log(`   ✅ Inserite ${entries.length} voci.`);
        entriesAddedTotal += entries.length;
      }
    }

    return {
      success: true,
      priceListsCreated,
      priceListsUpdated,
      entriesAdded: entriesAddedTotal,
      details: {
        probesTotal: probes.length,
        probesSuccessful,
        carriersFound: Object.keys(ratesByCarrier),
      },
    };
  } catch (error: any) {
    console.error('❌ [MATRIX SYNC] Error:', error);
    return { success: false, error: error.message };
  }
}
