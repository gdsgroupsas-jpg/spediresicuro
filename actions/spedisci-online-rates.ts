'use server';

/**
 * Server Actions per Gestione Rates e Listini Prezzi da Spedisci.Online
 * 
 * Funzionalità:
 * 1. Test endpoint /shipping/rates
 * 2. Sincronizzazione listini prezzi da spedisci.online
 * 3. Popolamento automatico listini nel database
 */

import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';
import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online';
import { getSpedisciOnlineCredentials } from '@/lib/actions/spedisci-online';
import { createPriceList, addPriceListEntries } from '@/lib/db/price-lists';
import type { CreatePriceListInput } from '@/types/listini';

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
      return { success: false, error: 'Non autenticato' };
    }

    // Recupera credenziali
    const credentialsResult = await getSpedisciOnlineCredentials();
    if (!credentialsResult.success || !credentialsResult.credentials) {
      return {
        success: false,
        error: 'Credenziali spedisci.online non configurate. Configura le credenziali in /dashboard/integrazioni',
      };
    }

    const credentials = credentialsResult.credentials;

    // Crea adapter
    const adapter = new SpedisciOnlineAdapter({
      api_key: credentials.api_key,
      api_secret: credentials.api_secret,
      base_url: credentials.base_url || 'https://api.spedisci.online/api/v2',
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
        name: 'Mittente Test',
        company: 'Azienda Test',
        street1: 'Via Roma 1',
        street2: '',
        city: 'Roma',
        state: 'RM',
        postalCode: '00100',
        country: 'IT',
        email: 'mittente@example.com',
      },
      shipTo: {
        name: 'Destinatario Test',
        company: '',
        street1: 'Via Milano 2',
        street2: '',
        city: 'Milano',
        state: 'MI',
        postalCode: '20100',
        country: 'IT',
        email: 'destinatario@example.com',
      },
      notes: 'Test API rates',
      insuranceValue: 0,
      codValue: 0,
      accessoriServices: [],
    };

    const params = {
      packages: testParams?.packages || defaultParams.packages,
      shipFrom: testParams?.shipFrom || defaultParams.shipFrom,
      shipTo: testParams?.shipTo || defaultParams.shipTo,
      notes: testParams?.notes || defaultParams.notes,
      insuranceValue: testParams?.insuranceValue ?? defaultParams.insuranceValue,
      codValue: testParams?.codValue ?? defaultParams.codValue,
      accessoriServices: testParams?.accessoriServices || defaultParams.accessoriServices,
    };

    // Misura tempo di risposta
    const startTime = Date.now();
    const result = await adapter.getRates(params);
    const responseTime = Date.now() - startTime;

    if (!result.success || !result.rates) {
      return {
        success: false,
        error: result.error || 'Errore sconosciuto durante il test',
        details: {
          responseTime,
        },
      };
    }

    // Estrai informazioni utili
    const carriersFound = [
      ...new Set(result.rates.map((r) => r.carrierCode)),
    ];
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
    console.error('Errore test rates spedisci.online:', error);
    return {
      success: false,
      error: error.message || 'Errore durante il test dei rates',
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
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    // Verifica permessi: solo admin, reseller e BYOC possono sincronizzare
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, account_type, is_reseller')
      .eq('email', session.user.email)
      .single();

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    const isAdmin =
      user.account_type === 'admin' || user.account_type === 'superadmin';
    const isReseller = user.is_reseller === true;
    const isBYOC = user.account_type === 'byoc';

    if (!isAdmin && !isReseller && !isBYOC) {
      return {
        success: false,
        error: 'Solo admin, reseller e BYOC possono sincronizzare listini',
      };
    }

    // 1. Ottieni rates da spedisci.online
    const testResult = await testSpedisciOnlineRates(options?.testParams);
    if (!testResult.success || !testResult.rates || testResult.rates.length === 0) {
      return {
        success: false,
        error: testResult.error || 'Nessun rate ottenuto da spedisci.online',
      };
    }

    const rates = testResult.rates;
    const carriersProcessed = [
      ...new Set(rates.map((r) => r.carrierCode)),
    ];

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
      }>
    > = {};

    for (const rate of rates) {
      if (!ratesByCarrier[rate.carrierCode]) {
        ratesByCarrier[rate.carrierCode] = [];
      }
      ratesByCarrier[rate.carrierCode].push(rate);
    }

    // 3. Per ogni corriere, crea/aggiorna listino
    // NOTA: Non dipendiamo più dalla tabella 'couriers' che potrebbe non esistere
    // Creiamo listini con courier_id = null e memorizziamo il carrier_code nei notes
    let priceListsCreated = 0;
    let priceListsUpdated = 0;
    let entriesAdded = 0;

    // Prova a recuperare corrieri esistenti (opzionale, non blocca se fallisce)
    let couriers: Array<{ id: string; code: string | null; name: string | null }> | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('couriers')
        .select('id, code, name');
      
      if (!error && data) {
        couriers = data;
      }
    } catch (e) {
      console.log('ℹ️ Tabella couriers non accessibile, proseguo senza matching corrieri');
    }

    // Crea mappa per matching intelligente (se abbiamo corrieri)
    const courierMap = new Map<string, { id: string; code: string | null; name: string | null }>();
    if (couriers) {
      couriers.forEach((c) => {
        if (c.code) {
          courierMap.set(c.code.toLowerCase(), c);
        }
        if (c.name) {
          const normalizedName = c.name.toLowerCase().replace(/\s+/g, '');
          courierMap.set(normalizedName, c);
        }
      });
    }

    // Mappa alias corrieri da spedisci.online a nomi DB
    const courierAliases: Record<string, string[]> = {
      'postedeliverybusiness': ['poste', 'posteitaliane', 'sda'],
      'poste': ['poste', 'posteitaliane'],
      'sda': ['sda'],
      'gls': ['gls'],
      'brt': ['bartolini', 'brt'],
      'bartolini': ['bartolini', 'brt'],
      'dhl': ['dhl'],
      'ups': ['ups'],
      'fedex': ['fedex', 'fdx'],
      'tnt': ['tnt'],
    };

    for (const [carrierCode, carrierRates] of Object.entries(ratesByCarrier)) {
      // Prova a trovare courier_id se abbiamo la tabella couriers
      let courierId: string | undefined = undefined;
      const courierName = carrierCode;
      
      if (options?.courierId) {
        courierId = options.courierId;
      } else if (courierMap.size > 0) {
        // Prova matching intelligente
        const normalizedCarrierCode = carrierCode.toLowerCase().replace(/\s+/g, '');
        let courier = courierMap.get(normalizedCarrierCode);
        
        // Prova con gli alias
        if (!courier) {
          const aliases = courierAliases[normalizedCarrierCode] || [];
          for (const alias of aliases) {
            courier = courierMap.get(alias.toLowerCase().replace(/\s+/g, ''));
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
        console.log(`ℹ️ Corriere ${carrierCode}: creazione listino senza courier_id (tabella couriers non disponibile o corriere non trovato)`);
      }

      // Verifica se esiste già un listino per questo corriere
      // Cerca sia per courier_id (se disponibile) che per nome (per fallback)
      let existingPriceList: { id: string } | null = null;
      
      if (courierId) {
        const { data } = await supabaseAdmin
          .from('price_lists')
          .select('id')
          .eq('courier_id', courierId)
          .eq('created_by', user.id)
          .eq('list_type', 'supplier')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        existingPriceList = data;
      }
      
      // Se non trovato per courier_id, cerca per nome contenente il carrier code
      if (!existingPriceList) {
        const { data } = await supabaseAdmin
          .from('price_lists')
          .select('id')
          .eq('created_by', user.id)
          .eq('list_type', 'supplier')
          .ilike('name', `%${carrierCode}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        existingPriceList = data;
      }

      const priceListName =
        options?.priceListName ||
        `Listino ${carrierCode.toUpperCase()} - ${new Date().toLocaleDateString('it-IT')}`;

      let priceListId: string;

      if (existingPriceList && !options?.overwriteExisting) {
        // Aggiorna listino esistente
        priceListId = existingPriceList.id;
        priceListsUpdated++;

        // Elimina entries esistenti
        await supabaseAdmin
          .from('price_list_entries')
          .delete()
          .eq('price_list_id', priceListId);
      } else {
        // Crea nuovo listino
        // courier_id può essere undefined, quindi usiamo null esplicitamente
        const priceListData: CreatePriceListInput = {
          name: priceListName,
          version: '1.0',
          status: 'draft',
          courier_id: courierId || null,
          list_type: 'supplier',
          is_global: false,
          source_type: 'api',
          notes: `Corriere: ${carrierCode.toUpperCase()} | Sincronizzato da spedisci.online il ${new Date().toISOString()}`,
        };

        const newPriceList = await createPriceList(priceListData, user.id);
        priceListId = newPriceList.id;
        priceListsCreated++;
        console.log(`✅ Listino creato: ${priceListName} (ID: ${priceListId})`);
      }

      // 4. Aggiungi entries al listino
      // Converti rates in entries del listino
      // Nota: I rates di spedisci.online sono per una spedizione specifica,
      // quindi creiamo entries basate su questi dati
      const entries = carrierRates.map((rate) => {
        // Parsing sicuro con validazione
        const basePrice = Math.max(0, parseFloat(rate.weight_price) || 0);
        const insurancePrice = Math.max(0, parseFloat(rate.insurance_price) || 0);
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
        let serviceType: 'standard' | 'express' | 'economy' | 'same_day' | 'next_day' = 'standard';
        
        if (contractCodeLower.includes('express') || contractCodeLower.includes('rapid')) {
          serviceType = 'express';
        } else if (contractCodeLower.includes('economy') || contractCodeLower.includes('economico')) {
          serviceType = 'economy';
        } else if (contractCodeLower.includes('same_day') || contractCodeLower.includes('stesso_giorno')) {
          serviceType = 'same_day';
        } else if (contractCodeLower.includes('next_day') || contractCodeLower.includes('giorno_successivo')) {
          serviceType = 'next_day';
        }

        // Validazione valori per compatibilità DECIMAL
        // DECIMAL(10,2) = max 99999999.99
        // DECIMAL(5,2) = max 999.99
        // DECIMAL(10,3) = max 9999999.999
        const validatedBasePrice = Math.min(99999999.99, Math.max(0, basePrice));
        const validatedCodPrice = Math.min(99999999.99, Math.max(0, codPrice));
        const validatedFuelPercent = Math.min(999.99, Math.max(0, fuelSurchargePercent));
        const validatedInsurancePercent = Math.min(999.99, Math.max(0, insuranceRatePercent));

        return {
          weight_from: 0, // I rates sono per un peso specifico, usiamo 0 come minimo
          weight_to: 999.999, // Massimo per DECIMAL(10,3)
          zone_code: 'IT', // Default Italia
          base_price: validatedBasePrice,
          service_type: serviceType,
          fuel_surcharge_percent: validatedFuelPercent,
          cash_on_delivery_surcharge: validatedCodPrice,
          insurance_rate_percent: validatedInsurancePercent,
          // Nota: services_price e fuel sono già inclusi nel total_price
          // quindi non li aggiungiamo come surcharge separati
        };
      });

      await addPriceListEntries(priceListId, entries);
      entriesAdded += entries.length;
    }

    return {
      success: true,
      priceListsCreated,
      priceListsUpdated,
      entriesAdded,
      details: {
        ratesProcessed: rates.length,
        carriersProcessed,
      },
    };
  } catch (error: any) {
    console.error('Errore sincronizzazione listini da spedisci.online:', error);
    return {
      success: false,
      error: error.message || 'Errore durante la sincronizzazione',
    };
  }
}

