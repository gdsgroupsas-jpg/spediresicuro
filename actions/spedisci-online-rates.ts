"use server";

/**
 * Server Actions per Gestione Rates e Listini Prezzi da Spedisci.Online
 *
 * Funzionalità:
 * 1. Test endpoint /shipping/rates
 * 2. Sincronizzazione listini prezzi da spedisci.online
 * 3. Popolamento automatico listini nel database
 */

import { getSpedisciOnlineCredentials } from "@/lib/actions/spedisci-online";
import { SpedisciOnlineAdapter } from "@/lib/adapters/couriers/spedisci-online";
import { auth } from "@/lib/auth-config";
import { supabaseAdmin } from "@/lib/db/client";
import { addPriceListEntries, createPriceList } from "@/lib/db/price-lists";
import type { CreatePriceListInput } from "@/types/listini";

/**
 * Test endpoint /shipping/rates con parametri di esempio
 *
 * @param testParams - Parametri opzionali per il test (se non forniti, usa valori di default)
 * @returns Risultato del test con rates ottenuti
 */
export async function testSpedisciOnlineRates(testParams?: {
  packages?: Array<{
    length: number;
    width: number;
    height: number;
    weight: number;
  }>;
  shipFrom?: {
    name: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
    email?: string;
  };
  shipTo?: {
    name: string;
    company?: string;
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
    email?: string;
  };
  notes?: string;
  insuranceValue?: number;
  codValue?: number;

  accessoriServices?: string[];
  configId?: string; // ID configurazione opzionale per multi-account
}): Promise<{
  success: boolean;
  rates?: any[];
  error?: string;
  details?: {
    url?: string;
    responseTime?: number;
    carriersFound?: string[];
    contractsFound?: string[];
  };
}> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Recupera credenziali (usa configId se fornito)
    const credentialsResult = await getSpedisciOnlineCredentials(
      testParams?.configId
    );
    if (!credentialsResult.success || !credentialsResult.credentials) {
      return {
        success: false,
        error:
          "Credenziali spedisci.online non configurate. Configura le credenziali in /dashboard/integrazioni",
      };
    }

    const credentials = credentialsResult.credentials;

    // Crea adapter
    const adapter = new SpedisciOnlineAdapter({
      api_key: credentials.api_key,
      api_secret: credentials.api_secret,
      base_url: credentials.base_url || "https://api.spedisci.online/api/v2",
      contract_mapping: credentials.contract_mapping || {},
    });

    // Parametri di default per il test
    const defaultParams = {
      packages: [
        {
          length: 30,
          width: 20,
          height: 15,
          weight: 2,
        },
      ],
      shipFrom: {
        name: "Mittente Test",
        company: "Azienda Test",
        street1: "Via Roma 1",
        street2: "",
        city: "Roma",
        state: "RM",
        postalCode: "00100",
        country: "IT",
        email: "mittente@example.com",
      },
      shipTo: {
        name: "Destinatario Test",
        company: "",
        street1: "Via Milano 2",
        street2: "",
        city: "Milano",
        state: "MI",
        postalCode: "20100",
        country: "IT",
        email: "destinatario@example.com",
      },
      notes: "Test API rates",
      insuranceValue: 0,
      codValue: 0,
      accessoriServices: [],
    };

    const params = {
      packages: testParams?.packages || defaultParams.packages,
      shipFrom: testParams?.shipFrom || defaultParams.shipFrom,
      shipTo: testParams?.shipTo || defaultParams.shipTo,
      notes: testParams?.notes || defaultParams.notes,
      insuranceValue:
        testParams?.insuranceValue ?? defaultParams.insuranceValue,
      codValue: testParams?.codValue ?? defaultParams.codValue,
      accessoriServices:
        testParams?.accessoriServices || defaultParams.accessoriServices,
    };

    // Misura tempo di risposta
    const startTime = Date.now();
    const result = await adapter.getRates(params);
    const responseTime = Date.now() - startTime;

    if (!result.success || !result.rates) {
      return {
        success: false,
        error: result.error || "Errore sconosciuto durante il test",
        details: {
          responseTime,
        },
      };
    }

    // Estrai informazioni utili
    const carriersFound = [...new Set(result.rates.map((r) => r.carrierCode))];
    const contractsFound = result.rates.map((r) => r.contractCode);

    return {
      success: true,
      rates: result.rates,
      details: {
        responseTime,
        carriersFound,
        contractsFound,
      },
    };
  } catch (error: any) {
    console.error("Errore test rates spedisci.online:", error);
    return {
      success: false,
      error: error.message || "Errore durante il test dei rates",
    };
  }
}

/**
 * Sincronizza listini prezzi da spedisci.online
 *
 * Crea o aggiorna listini nel database basandosi sui rates ottenuti da spedisci.online
 *
 * @param options - Opzioni per la sincronizzazione
 * @returns Risultato della sincronizzazione
 */
export async function syncPriceListsFromSpedisciOnline(options?: {
  courierId?: string;
  testParams?: Parameters<typeof testSpedisciOnlineRates>[0];
  priceListName?: string;
  overwriteExisting?: boolean;
  configId?: string; // ID configurazione opzionale
  mode?: "fast" | "balanced" | "matrix"; // fast = 2 zone x 3 pesi (6 entries), balanced = 5 zone x 11 pesi (55 entries), matrix = tutte le zone x tutti i pesi (può essere lenta)
}): Promise<{
  success: boolean;
  priceListsCreated?: number;
  priceListsUpdated?: number;
  entriesAdded?: number;
  error?: string;
  details?: {
    ratesProcessed?: number;
    carriersProcessed?: string[];
  };
}> {
  // ⚠️ RIMOZIONE LOCK: Le sync dei listini non sono critiche come le spedizioni.
  // Non c'è rischio finanziario, quindi il lock causa più problemi che benefici.
  // Se necessario, possiamo aggiungere un semplice flag in-memory per prevenire sync simultanee.
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: "Non autenticato" };
    }

    // Verifica permessi: solo admin, reseller e BYOC possono sincronizzare
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, account_type, is_reseller")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return { success: false, error: "Utente non trovato" };
    }

    const isAdmin =
      user.account_type === "admin" || user.account_type === "superadmin";
    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === "byoc";

    if (!isAdmin && !isReseller && !isBYOC) {
      return {
        success: false,
        error: "Solo admin, reseller e BYOC possono sincronizzare listini",
      };
    }

    // 1. Matrix Sync Logic
    const { PRICING_MATRIX } = await import("@/lib/constants/pricing-matrix");

    // Preparazione array risultati
    const allRates: any[] = [];
    const processedCombinations = new Set<string>();

    // ⚠️ Importante: su Vercel (piano free) le azioni server-side possono essere limitate come tempo.
    // Per UX/affidabilità, default = "balanced": buon compromesso tra completezza e velocità.
    const mode: "fast" | "balanced" | "matrix" = options?.mode ?? "balanced";

    const zones =
      mode === "matrix"
        ? PRICING_MATRIX.ZONES // Tutte le zone (8 zone)
        : mode === "balanced"
        ? // BALANCED: zone principali italiane (5 zone) - buon compromesso
          PRICING_MATRIX.ZONES.filter((z: any) =>
            ["IT-STD", "IT-CAL", "IT-SIC", "IT-SAR", "IT-LIV"].includes(z.code)
          )
        : // FAST: 2 zone rappresentative (standard + sud) per restare sotto timeout
          PRICING_MATRIX.ZONES.filter((z: any) =>
            ["IT-STD", "IT-CAL"].includes(z.code)
          );

    const weightsToProbe =
      mode === "matrix"
        ? // Matrix: tutti i pesi (1-100kg + 105kg = 101 pesi)
          PRICING_MATRIX.WEIGHTS
        : mode === "balanced"
        ? // BALANCED: pesi chiave che coprono gli scaglioni principali (11 pesi)
          [1, 2, 3, 5, 10, 20, 30, 50, 70, 100, 105]
        : // FAST: 3 pesi chiave per ridurre chiamate
          [1, 10, 30];

    console.log(
      `🚀 Starting Price List Sync (${mode}): ${zones.length} Zones x ${weightsToProbe.length} Weights`
    );

    // Loop through Zones and Weights
    for (const zone of zones) {
      for (const weight of weightsToProbe) {
        // Validation params for this iteration
        const currentParams = {
          packages: [{ length: 30, width: 20, height: 15, weight }],
          shipFrom: {
            name: "Mittente Test",
            city: "Roma",
            state: "RM",
            postalCode: "00100",
            country: "IT",
            street1: "Via Roma 1",
          },
          shipTo: {
            name: "Destinatario Test",
            street1: "Via Test 123",
            city: zone.sampleAddress.city,
            state: zone.sampleAddress.state,
            postalCode: zone.sampleAddress.postalCode,
            country: zone.sampleAddress.country,
          },
          configId: options?.configId, // Pass config ID for multi-account support
        };

        // Call API (using existing test function logic but we need to inject credentials efficiently)
        // Optimization: We re-use getSpedisciOnlineCredentials only once outside loop if possible,
        // but testSpedisciOnlineRates fetches it every time.
        // For now, to keep it robust, we call testSpedisciOnlineRates but we need to be mindful of rate limits.
        // In a real prod scenario, we'd refactor to pass the adapter instance.

        // Call the test function (which instantiates a new adapter each time - inefficient but safe for now)
        const result = await testSpedisciOnlineRates(currentParams);

        if (result.success && result.rates) {
          for (const rate of result.rates) {
            // Enrich rate with our probe metadata
            (rate as any)._probe_weight = weight;
            (rate as any)._probe_zone = zone.code;
            allRates.push(rate);
          }
        }

        // Small delay to avoid rate limiting (balanced mode più veloce ma sicuro)
        await new Promise((r) =>
          setTimeout(
            r,
            mode === "matrix" ? 200 : mode === "balanced" ? 100 : 50
          )
        );
      }
    }

    if (allRates.length === 0) {
      return {
        success: false,
        error:
          "Nessun rate ottenuto durante il Matrix Scan. Verifica credenziali.",
      };
    }

    const rates = allRates;
    const carriersProcessed = [...new Set(rates.map((r) => r.carrierCode))];

    // Salva weightsToProbe per usarlo nella creazione delle entries
    const probedWeightsSorted = [...weightsToProbe].sort((a, b) => a - b);

    // 2. Raggruppa rates per corriere
    const ratesByCarrier: Record<
      string,
      Array<{
        carrierCode: string;
        contractCode: string;
        weight_price: string;
        insurance_price: string;
        cod_price: string;
        services_price: string;
        fuel: string;
        total_price: string;
        _probe_weight?: number;
        _probe_zone?: string;
      }>
    > = {};

    for (const rate of rates) {
      const carrierCode = rate.carrierCode;
      if (!carrierCode) {
        console.warn(
          `⚠️ [SYNC] Rate senza carrierCode, salto:`,
          JSON.stringify(rate).substring(0, 200)
        );
        continue;
      }
      if (!ratesByCarrier[carrierCode]) {
        ratesByCarrier[carrierCode] = [];
      }
      ratesByCarrier[carrierCode].push(rate);
    }
    
    const groupingSummary = Object.keys(ratesByCarrier).map((code) => ({
      carrierCode: code,
      ratesCount: ratesByCarrier[code].length,
      sampleRate: ratesByCarrier[code][0] ? {
        carrierCode: ratesByCarrier[code][0].carrierCode,
        contractCode: ratesByCarrier[code][0].contractCode,
      } : null,
      // Verifica che tutti i rates nel gruppo abbiano lo stesso carrierCode
      allRatesHaveSameCarrierCode: ratesByCarrier[code].every(
        (r) => r.carrierCode === code
      ),
    }));
    
    console.log(
      `📊 [SYNC] Raggruppamento rates completato:`,
      JSON.stringify(groupingSummary, null, 2)
    );
    
    // Verifica mismatch nel raggruppamento
    for (const summary of groupingSummary) {
      if (!summary.allRatesHaveSameCarrierCode) {
        console.error(
          `❌ [SYNC] ERRORE RAGGRUPPAMENTO: Il gruppo "${summary.carrierCode}" contiene rates con carrierCode diversi!`
        );
        // Mostra i carrierCode unici nel gruppo
        const uniqueCarrierCodes = [
          ...new Set(ratesByCarrier[summary.carrierCode].map((r) => r.carrierCode)),
        ];
        console.error(
          `   CarrierCode trovati nel gruppo: ${uniqueCarrierCodes.join(", ")}`
        );
      }
    }

    // 3. Per ogni corriere, crea/aggiorna listino
    // NOTA: Non dipendiamo più dalla tabella 'couriers' che potrebbe non esistere
    // Creiamo listini con courier_id = null e memorizziamo il carrier_code nei notes
    let priceListsCreated = 0;
    let priceListsUpdated = 0;
    let entriesAdded = 0;

    // Recupera nome configurazione se configId è presente (per nome listino)
    let configName: string | null = null;
    if (options?.configId) {
      try {
        const { data: configData } = await supabaseAdmin
          .from("courier_configs")
          .select("name")
          .eq("id", options.configId)
          .maybeSingle();
        if (configData?.name) {
          configName = configData.name;
          console.log(
            `📋 [SYNC] Nome configurazione trovato: "${configName}" per configId ${options.configId.substring(0, 8)}...`
          );
        }
      } catch (e) {
        console.warn(
          `⚠️ [SYNC] Errore recupero nome configurazione:`,
          e
        );
      }
    }

    // Prova a recuperare corrieri esistenti (opzionale, non blocca se fallisce)
    let couriers: Array<{
      id: string;
      code: string | null;
      name: string | null;
    }> | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from("couriers")
        .select("id, code, name");

      if (!error && data) {
        couriers = data;
      }
    } catch (e) {
      console.log(
        "ℹ️ Tabella couriers non accessibile, proseguo senza matching corrieri"
      );
    }

    // Crea mappa per matching intelligente (se abbiamo corrieri)
    const courierMap = new Map<
      string,
      { id: string; code: string | null; name: string | null }
    >();
    if (couriers) {
      couriers.forEach((c) => {
        if (c.code) {
          courierMap.set(c.code.toLowerCase(), c);
        }
        if (c.name) {
          const normalizedName = c.name.toLowerCase().replace(/\s+/g, "");
          courierMap.set(normalizedName, c);
        }
      });
    }

    // Mappa alias corrieri da spedisci.online a nomi DB
    const courierAliases: Record<string, string[]> = {
      postedeliverybusiness: ["poste", "posteitaliane", "sda"],
      poste: ["poste", "posteitaliane"],
      sda: ["sda"],
      gls: ["gls"],
      brt: ["bartolini", "brt"],
      bartolini: ["bartolini", "brt"],
      dhl: ["dhl"],
      ups: ["ups"],
      fedex: ["fedex", "fdx"],
      tnt: ["tnt"],
    };

    console.log(
      `📊 [SYNC] Corrieri da processare: ${Object.keys(ratesByCarrier).join(", ")} (totale: ${Object.keys(ratesByCarrier).length})`
    );
    console.log(
      `📊 [SYNC] Dettagli ratesByCarrier:`,
      Object.keys(ratesByCarrier).map((code) => ({
        carrierCode: code,
        ratesCount: ratesByCarrier[code].length,
      }))
    );

    let carrierIndex = 0;
    const totalCarriers = Object.keys(ratesByCarrier).length;
    
    for (const [carrierCode, carrierRates] of Object.entries(ratesByCarrier)) {
      carrierIndex++;
      console.log(
        `🔄 [SYNC] [${carrierIndex}/${totalCarriers}] Processando corriere: ${carrierCode} (${carrierRates.length} rates)`
      );
      try {
        // Prova a trovare courier_id se abbiamo la tabella couriers
        let courierId: string | undefined = undefined;
        const courierName = carrierCode;

      if (options?.courierId) {
        courierId = options.courierId;
      } else if (courierMap.size > 0) {
        // Prova matching intelligente
        const normalizedCarrierCode = carrierCode
          .toLowerCase()
          .replace(/\s+/g, "");
        let courier = courierMap.get(normalizedCarrierCode);

        // Prova con gli alias
        if (!courier) {
          const aliases = courierAliases[normalizedCarrierCode] || [];
          for (const alias of aliases) {
            courier = courierMap.get(alias.toLowerCase().replace(/\s+/g, ""));
            if (courier) break;
          }
        }

        if (courier) {
          courierId = courier.id;
        }
      }

      // Log per debug
      if (courierId) {
        console.log(`✅ Corriere ${carrierCode} associato a ID: ${courierId}`);
      } else {
        console.log(
          `ℹ️ Corriere ${carrierCode}: creazione listino senza courier_id (tabella couriers non disponibile o corriere non trovato)`
        );
      }

      // Verifica se esiste già un listino per questo corriere E configurazione
      // IMPORTANTE: Se ci sono più configurazioni per lo stesso corriere, ogni configurazione
      // deve avere il suo listino separato (identificato da metadata->courier_config_id)
      let existingPriceList: { id: string } | null = null;

      // Se configId è presente, cerca listino specifico per questa configurazione E questo carrierCode
      if (options?.configId) {
        // Cerca per metadata->carrier_code + courier_config_id
        // IMPORTANTE: Filtra per ENTRAMBI carrier_code E courier_config_id per evitare di matchare
        // listini di corrieri diversi della stessa configurazione API
        const { data: dataByMetadata } = await supabaseAdmin
          .from("price_lists")
          .select("id, name, metadata, source_metadata")
          .eq("created_by", user.id)
          .eq("list_type", "supplier")
          .order("created_at", { ascending: false })
          .limit(20); // Prendi più risultati per filtrare in memoria

        if (dataByMetadata) {
          // Filtra in memoria per:
          // 1. courier_config_id (può essere in metadata o source_metadata)
          // 2. carrier_code DEVE corrispondere al corriere corrente
          const matchingList = dataByMetadata.find((pl: any) => {
            const metadata = pl.metadata || pl.source_metadata || {};
            const matchesConfigId = metadata.courier_config_id === options.configId;
            const matchesCarrierCode = 
              metadata.carrier_code?.toLowerCase() === carrierCode.toLowerCase() ||
              pl.name?.toLowerCase().startsWith(carrierCode.toLowerCase());
            return matchesConfigId && matchesCarrierCode;
          });
          if (matchingList) {
            existingPriceList = { id: matchingList.id };
            console.log(
              `🔍 [SYNC] Trovato listino esistente per configId ${options.configId.substring(0, 8)} e carrierCode ${carrierCode}`
            );
          } else {
            console.log(
              `ℹ️ [SYNC] Nessun listino esistente per configId ${options.configId.substring(0, 8)} e carrierCode ${carrierCode}`
            );
          }
        }

        // Se non trovato per metadata, cerca anche per courier_id + nome (per retrocompatibilità)
        if (!existingPriceList && courierId) {
          const { data } = await supabaseAdmin
            .from("price_lists")
            .select("id")
            .eq("courier_id", courierId)
            .eq("created_by", user.id)
            .eq("list_type", "supplier")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          existingPriceList = data;
        }
      } else {
        // Se configId non è presente, usa la logica originale (cerca per courier_id o nome)
        if (courierId) {
          const { data } = await supabaseAdmin
            .from("price_lists")
            .select("id")
            .eq("courier_id", courierId)
            .eq("created_by", user.id)
            .eq("list_type", "supplier")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          existingPriceList = data;
        }

        // Se non trovato per courier_id, cerca per nome contenente il carrier code
        if (!existingPriceList) {
          const { data } = await supabaseAdmin
            .from("price_lists")
            .select("id")
            .eq("created_by", user.id)
            .eq("list_type", "supplier")
            .ilike("name", `%${carrierCode}%`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          existingPriceList = data;
        }
      }

      // Nome listino: formato CARRIER_NOMECONFIG per distinguere configurazioni multiple
      // Esempio: POSTEDELIVERY_NOMELISTINO o GLS_AccountStandard
      const priceListName =
        options?.priceListName ||
        (configName
          ? `${carrierCode.toUpperCase()}_${configName}`
          : options?.configId
          ? `${carrierCode.toUpperCase()}_Config${options.configId.substring(0, 8)}`
          : `${carrierCode.toUpperCase()}_${new Date().toLocaleDateString("it-IT")}`);

      let priceListId: string;

      if (existingPriceList && !options?.overwriteExisting) {
        // Aggiorna listino esistente
        priceListId = existingPriceList.id;
        priceListsUpdated++;

        // Aggiorna metadati listino esistente se configId è presente
        // Nota: metadata potrebbe non esistere in produzione, quindi usiamo source_metadata come fallback
        if (options?.configId) {
          try {
            await supabaseAdmin
              .from("price_lists")
              .update({
                metadata: { courier_config_id: options.configId },
              })
              .eq("id", priceListId);
          } catch (err: any) {
            // Fallback: usa source_metadata se metadata non esiste
            if (
              err?.code === "PGRST204" ||
              err?.message?.includes("metadata")
            ) {
              await supabaseAdmin
                .from("price_lists")
                .update({
                  source_metadata: { courier_config_id: options.configId },
                })
                .eq("id", priceListId);
            } else {
              throw err;
            }
          }
        }

        // Elimina entries esistenti
        await supabaseAdmin
          .from("price_list_entries")
          .delete()
          .eq("price_list_id", priceListId);
      } else {
        // Crea nuovo listino
        // courier_id può essere undefined, quindi usiamo null esplicitamente
        const priceListData: CreatePriceListInput = {
          name: priceListName,
          version: "1.0",
          status: "draft",
          courier_id: courierId || null,
          list_type: "supplier",
          is_global: false,
          source_type: "api",
          notes: `Corriere: ${carrierCode.toUpperCase()} | Sincronizzato da spedisci.online il ${new Date().toISOString()}`,
          // Nota: metadata potrebbe non esistere in produzione, quindi lo aggiungiamo solo se disponibile
          // metadata: options?.configId
          //   ? { courier_config_id: options.configId }
          //   : undefined,
        };

        // Metadata ora esiste (migration 059 applicata), possiamo includerlo direttamente
        console.log(
          `📝 [SYNC] Creazione listino: ${priceListName}, courier_id=${courierId}, list_type=supplier, created_by=${user.id}`
        );
        const newPriceList = await createPriceList(
          priceListData as CreatePriceListInput,
          user.id
        );
        console.log(
          `✅ [SYNC] Listino creato con successo: id=${newPriceList.id}, name=${newPriceList.name}`
        );

        // Aggiungi metadata con carrier_code e courier_config_id per tracciabilità
        // IMPORTANTE: carrier_code è fondamentale per distinguere listini di corrieri diversi
        // dalla stessa configurazione API
        const metadataToSave = {
          carrier_code: carrierCode,
          ...(options?.configId && { courier_config_id: options.configId }),
          synced_at: new Date().toISOString(),
        };
        
        try {
          await supabaseAdmin
            .from("price_lists")
            .update({ metadata: metadataToSave })
            .eq("id", newPriceList.id);
          console.log(
            `✅ [SYNC] Metadata salvati: carrier_code=${carrierCode}, configId=${options?.configId?.substring(0, 8) || "N/A"}`
          );
        } catch (err: any) {
          // Fallback: usa source_metadata se metadata non esiste
          if (
            err?.code === "PGRST204" ||
            err?.message?.includes("metadata")
          ) {
            await supabaseAdmin
              .from("price_lists")
              .update({ source_metadata: metadataToSave })
              .eq("id", newPriceList.id);
          }
          // Ignora errore se entrambi falliscono (non critico)
        }
        priceListId = newPriceList.id;
        priceListsCreated++;
        // P1-3: evita log di UUID completi (riduce leakage in log condivisi)
        console.log(
          `✅ Listino creato: ${priceListName} (id=${String(priceListId).slice(
            0,
            8
          )}...)`
        );
      }

      // 4. Aggiungi entries al listino
      // Converti rates in entries del listino
      // Nota: I rates di spedisci.online sono per una spedizione specifica,
      // quindi creiamo entries basate su questi dati
      
      if (!carrierRates || carrierRates.length === 0) {
        console.warn(
          `⚠️ [SYNC] [${carrierIndex}/${totalCarriers}] Nessun rate per ${carrierCode}, salto`
        );
        continue;
      }
      
      // Rimuovi duplicati basati su (weight_to, zone_code, service_type)
      const seenEntries = new Set<string>();
      const uniqueRates = carrierRates.filter((rate) => {
        const probeWeight = (rate as any)._probe_weight || 0;
        const probeZone = (rate as any)._probe_zone || "IT";
        const contractCode = rate.contractCode || "standard";
        const key = `${probeWeight}-${probeZone}-${contractCode}`;
        if (seenEntries.has(key)) {
          return false;
        }
        seenEntries.add(key);
        return true;
      });

      console.log(
        `📊 [SYNC] ${carrierRates.length} rates totali, ${uniqueRates.length} unici per ${carrierCode}`
      );

      const entries = uniqueRates.map((rate) => {
        // Verifica che il rate appartenga al corriere corretto
        if (rate.carrierCode !== carrierCode) {
          console.error(
            `❌ [SYNC] MISMATCH: Rate con carrierCode=${rate.carrierCode} trovato in gruppo ${carrierCode}!`,
            {
              rateCarrierCode: rate.carrierCode,
              expectedCarrierCode: carrierCode,
              contractCode: rate.contractCode,
            }
          );
        }
        
        // Parsing sicuro con validazione
        const basePrice = Math.max(0, parseFloat(rate.weight_price) || 0);
        const insurancePrice = Math.max(
          0,
          parseFloat(rate.insurance_price) || 0
        );
        const codPrice = Math.max(0, parseFloat(rate.cod_price) || 0);
        const fuelPrice = Math.max(0, parseFloat(rate.fuel) || 0);

        // Calcola percentuale fuel surcharge se disponibile (max 100%)
        const fuelSurchargePercent = Math.min(
          100,
          basePrice > 0 ? (fuelPrice / basePrice) * 100 : 0
        );

        // Calcola percentuale insurance se disponibile (max 100%)
        const insuranceRatePercent = Math.min(
          100,
          basePrice > 0 ? (insurancePrice / basePrice) * 100 : 0
        );

        // Mappa contractCode a CourierServiceType
        // Esempi: "gls-standard" -> "standard", "gls-express" -> "express"
        const contractCodeLower = rate.contractCode.toLowerCase();
        let serviceType:
          | "standard"
          | "express"
          | "economy"
          | "same_day"
          | "next_day" = "standard";

        if (
          contractCodeLower.includes("express") ||
          contractCodeLower.includes("rapid")
        ) {
          serviceType = "express";
        } else if (
          contractCodeLower.includes("economy") ||
          contractCodeLower.includes("economico")
        ) {
          serviceType = "economy";
        } else if (
          contractCodeLower.includes("same_day") ||
          contractCodeLower.includes("stesso_giorno")
        ) {
          serviceType = "same_day";
        } else if (
          contractCodeLower.includes("next_day") ||
          contractCodeLower.includes("giorno_successivo")
        ) {
          serviceType = "next_day";
        }

        // Validazione valori per compatibilità DECIMAL
        // DECIMAL(10,2) = max 99999999.99
        // DECIMAL(5,2) = max 999.99
        // DECIMAL(10,3) = max 9999999.999
        const validatedBasePrice = Math.min(
          99999999.99,
          Math.max(0, basePrice)
        );
        const validatedCodPrice = Math.min(99999999.99, Math.max(0, codPrice));
        const validatedFuelPercent = Math.min(
          999.99,
          Math.max(0, fuelSurchargePercent)
        );
        const validatedInsurancePercent = Math.min(
          999.99,
          Math.max(0, insuranceRatePercent)
        );

        const probeWeight = (rate as any)._probe_weight;
        const probeZone = (rate as any)._probe_zone || "IT";

        // Weights used in the probe loop - usa gli stessi pesi effettivamente probati
        // Questo garantisce che weight_from e weight_to siano corretti per ogni modalità
        if (!probeWeight || probeWeight === 999.999) {
          console.warn(
            `⚠️ [SYNC] Rate senza _probe_weight valido, uso fallback: ${JSON.stringify(rate)}`
          );
          // Fallback: usa il primo peso probato come weight_to
          return {
            weight_from: 0,
            weight_to: probedWeightsSorted[0] || 1,
            zone_code: probeZone,
            base_price: validatedBasePrice,
            service_type: serviceType,
            fuel_surcharge_percent: validatedFuelPercent,
            cash_on_delivery_surcharge: validatedCodPrice,
            insurance_rate_percent: validatedInsurancePercent,
          };
        }

        const currentIndex = probedWeightsSorted.indexOf(probeWeight);
        if (currentIndex === -1) {
          console.warn(
            `⚠️ [SYNC] probeWeight ${probeWeight} non trovato in probedWeightsSorted, uso fallback`
          );
          // Fallback: trova il peso più vicino
          const closestWeight = probedWeightsSorted.reduce((prev, curr) =>
            Math.abs(curr - probeWeight) < Math.abs(prev - probeWeight)
              ? curr
              : prev
          );
          const closestIndex = probedWeightsSorted.indexOf(closestWeight);
          const weightFrom =
            closestIndex > 0 ? probedWeightsSorted[closestIndex - 1] : 0;
          return {
            weight_from: weightFrom,
            weight_to: closestWeight,
            zone_code: probeZone,
            base_price: validatedBasePrice,
            service_type: serviceType,
            fuel_surcharge_percent: validatedFuelPercent,
            cash_on_delivery_surcharge: validatedCodPrice,
            insurance_rate_percent: validatedInsurancePercent,
          };
        }

        const weightFrom =
          currentIndex > 0 ? probedWeightsSorted[currentIndex - 1] : 0; // Start from exact previous weight
        // Note: Logic handles intervals (e.g. >10 to <=20).
        // Sync logic: "From previous breakpoint to current breakpoint".

        return {
          weight_from: weightFrom,
          weight_to: probeWeight,
          zone_code: probeZone,
          base_price: validatedBasePrice,
          service_type: serviceType,
          fuel_surcharge_percent: validatedFuelPercent,
          cash_on_delivery_surcharge: validatedCodPrice,
          insurance_rate_percent: validatedInsurancePercent,
          // Nota: services_price e fuel sono già inclusi nel total_price
          // quindi non li aggiungiamo come surcharge separati
        };
      });

      console.log(
        `📝 [SYNC] Aggiungo ${entries.length} entries al listino ${priceListId.substring(0, 8)}...`
      );
      try {
        await addPriceListEntries(priceListId, entries);
        entriesAdded += entries.length;
        console.log(
          `✅ [SYNC] ${entries.length} entries aggiunte con successo per ${carrierCode}`
        );
      } catch (err: any) {
        console.error(
          `❌ [SYNC] Errore aggiunta entries per ${carrierCode}:`,
          err.message || err
        );
        // Non bloccare la sync se alcune entries falliscono
        // Logga l'errore ma continua
      }
      console.log(
        `✅ [SYNC] [${carrierIndex}/${totalCarriers}] Corriere ${carrierCode} processato con successo: listino "${priceListName}", ${entries.length} entries`
      );
      } catch (carrierError: any) {
        // Errore durante creazione/aggiornamento listino per questo corriere
        console.error(
          `❌ [SYNC] [${carrierIndex}/${totalCarriers}] Errore processamento corriere ${carrierCode}:`,
          carrierError.message || carrierError,
          carrierError.stack
        );
        // Continua con il prossimo corriere invece di interrompere tutto
        continue;
      }
    }
    
    console.log(
      `📊 [SYNC] Riepilogo finale: ${priceListsCreated} listini creati, ${priceListsUpdated} aggiornati, ${entriesAdded} entries totali su ${totalCarriers} corrieri`
    );

    const result = {
      success: true,
      priceListsCreated,
      priceListsUpdated,
      entriesAdded,
      details: {
        ratesProcessed: rates.length,
        carriersProcessed,
      },
    };
    
    console.log(
      `✅ [SYNC] Sincronizzazione completata: ${priceListsCreated} creati, ${priceListsUpdated} aggiornati, ${entriesAdded} entries aggiunte`
    );
    console.log(
      `📊 [SYNC] Riepilogo finale:`,
      {
        totalCarriers: totalCarriers,
        carriersProcessed: carriersProcessed.length,
        carriersProcessedList: carriersProcessed,
        priceListsCreated,
        priceListsUpdated,
        entriesAdded,
      }
    );
    
    // Verifica che tutti i corrieri siano stati processati
    if (carriersProcessed.length !== totalCarriers) {
      console.warn(
        `⚠️ [SYNC] ATTENZIONE: ${totalCarriers} corrieri trovati ma solo ${carriersProcessed.length} processati!`
      );
    }
    
    return result;
  } catch (error: any) {
    console.error("Errore sincronizzazione listini da spedisci.online:", error);
    return {
      success: false,
      error: error.message || "Errore durante la sincronizzazione",
    };
  }
}
