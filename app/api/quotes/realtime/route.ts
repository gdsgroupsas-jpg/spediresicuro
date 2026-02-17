/**
 * API Route: Quote Real-Time Multi-Provider
 *
 * MULTI-CONFIG + MULTI-PROVIDER: Chiama API per OGNI configurazione dell'utente
 * (SpedisciOnline + SpediamoPro + altri) e unisce tutti i rates ricevuti.
 *
 * Se un reseller ha N configurazioni API (es. 2 SpedisciOnline + 1 SpediamoPro),
 * faremo N chiamate in parallelo e uniremo tutti i rates.
 *
 * ENTERPRISE: Include cache Redis (TTL 5min), multi-config, multi-provider support
 */

import { testSpedisciOnlineRates } from '@/actions/spedisci-online-rates';
import { getAllUserSpedisciOnlineConfigs } from '@/lib/actions/spedisci-online';
import { getAllUserSpediamoProConfigs, getSpediamoProQuotes } from '@/lib/actions/spediamopro';
import { getCurrentUser } from '@/lib/auth-helper';
import { supabaseAdmin } from '@/lib/db/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Create context-like structure for consistency with getSafeAuth pattern
    const context = { actor: { email: user.email, id: user.id } };
    console.log(`[QUOTES API] Auth success via ${user.authMethod} (User: ${user.email})`);

    const body = await request.json();
    const {
      weight,
      zip,
      province,
      city,
      courier,
      contractCode,
      services = [],
      insuranceValue = 0,
      codValue = 0,
      shipFrom,
      shipTo,
      allContracts = false,
      dimensions,
    } = body;

    // Validazione parametri minimi
    if (!weight || weight <= 0) {
      return NextResponse.json({ error: 'Peso obbligatorio e deve essere > 0' }, { status: 400 });
    }

    if (!zip) {
      return NextResponse.json({ error: 'CAP destinazione obbligatorio' }, { status: 400 });
    }

    // MULTI-CONFIG + MULTI-PROVIDER: Recupera configurazioni da TUTTI i provider in parallelo
    const [configsResult, spediamoProConfigsResult] = await Promise.all([
      getAllUserSpedisciOnlineConfigs(),
      getAllUserSpediamoProConfigs().catch((err) => {
        console.warn('[QUOTES API] Errore recupero config SpediamoPro:', err.message);
        return { success: false, configs: [] as any[] };
      }),
    ]);

    const hasSpedisciOnline =
      configsResult.success && configsResult.configs && configsResult.configs.length > 0;
    const hasSpediamoPro =
      spediamoProConfigsResult.success &&
      spediamoProConfigsResult.configs &&
      spediamoProConfigsResult.configs.length > 0;

    if (!hasSpedisciOnline && !hasSpediamoPro) {
      console.log('[QUOTES API] Nessuna configurazione API trovata, uso fallback listini');
      return await handleListinoFallback(
        context.actor.email,
        weight,
        zip,
        province,
        courier,
        contractCode,
        codValue,
        insuranceValue
      );
    }

    const soConfigCount = configsResult.configs?.length || 0;
    const spConfigCount = spediamoProConfigsResult.configs?.length || 0;
    console.log(
      `[QUOTES API] Trovate ${soConfigCount} config SpedisciOnline + ${spConfigCount} config SpediamoPro`
    );

    // Prepara parametri base per le chiamate
    const baseParams = {
      packages: [
        {
          length: dimensions?.length ? parseFloat(dimensions.length) : 30,
          width: dimensions?.width ? parseFloat(dimensions.width) : 20,
          height: dimensions?.height ? parseFloat(dimensions.height) : 15,
          weight: parseFloat(weight),
        },
      ],
      shipFrom: shipFrom || {
        name: 'Mittente',
        street1: 'Via Roma 1',
        city: 'Roma',
        state: 'RM',
        postalCode: '00100',
        country: 'IT',
        email: context.actor.email || 'mittente@example.com',
      },
      shipTo: shipTo || {
        name: 'Destinatario',
        street1: 'Via Destinazione 1',
        city: city || 'Milano',
        state: province || 'MI',
        postalCode: zip,
        country: 'IT',
        email: 'destinatario@example.com',
      },
      notes: `Quote real-time multi-config`,
      insuranceValue: parseFloat(insuranceValue) || 0,
      codValue: parseFloat(codValue) || 0,
      accessoriServices: services || [],
    };

    // ✨ MULTI-CONFIG: Chiama API per OGNI configurazione
    const allRates: any[] = [];
    const errors: string[] = [];
    let anyCached = false;
    let maxCacheAge = 0;

    // Usa TUTTE le configurazioni senza deduplica errata
    const uniqueConfigs = configsResult.configs || [];

    console.log(
      `[QUOTES API] Configurazioni da chiamare: ${uniqueConfigs.length} SpedisciOnline + ${spConfigCount} SpediamoPro`
    );

    // Esegui chiamate SpedisciOnline in parallelo
    const promises = uniqueConfigs.map(async (config) => {
      try {
        console.log(
          `🔄 [QUOTES API] Chiamata API per config "${config.configName}" (${config.configId.substring(0, 8)}...)`
        );
        console.log(
          `   - Contratti in questa config: ${Object.keys(config.contract_mapping).join(', ')}`
        );

        const result = await testSpedisciOnlineRates({
          ...baseParams,
          configId: config.configId, // ✨ Passa il configId specifico!
        });

        if (result.success && result.rates && result.rates.length > 0) {
          console.log(
            `✅ [QUOTES API] Config "${config.configName}": ${result.rates.length} rates ricevuti`
          );

          // ✨ DEBUG: Log dettaglio rates per debugging matching
          console.log(`📊 [QUOTES API] Dettaglio rates config "${config.configName}":`);
          result.rates.forEach((rate: any, idx: number) => {
            console.log(
              `   Rate ${idx + 1}: carrierCode="${rate.carrierCode}", contractCode="${rate.contractCode}", total_price="${rate.total_price}"`
            );
          });

          // Aggiungi metadata per tracciare la provenienza
          const ratesWithMeta = result.rates.map((rate: any) => ({
            ...rate,
            _configId: config.configId,
            _configName: config.configName,
          }));

          return {
            success: true,
            rates: ratesWithMeta,
            cached: result.details?.cached,
            cacheAge: result.details?.cacheAge,
          };
        } else {
          console.warn(
            `⚠️ [QUOTES API] Config "${config.configName}": ${result.error || 'Nessun rate'}`
          );
          return { success: false, error: result.error, configName: config.configName };
        }
      } catch (error: any) {
        console.error(`❌ [QUOTES API] Errore config "${config.configName}":`, error.message);
        return { success: false, error: error.message, configName: config.configName };
      }
    });

    // Esegui chiamate SpediamoPro in parallelo (contemporaneamente a SpedisciOnline)
    const spediamoProPromises = (spediamoProConfigsResult.configs || []).map(async (config) => {
      try {
        console.log(
          `[QUOTES API] Chiamata SpediamoPro per config "${config.configName}" (${config.configId.substring(0, 8)}...)`
        );

        const result = await getSpediamoProQuotes({
          configId: config.configId,
          senderCap: baseParams.shipFrom.postalCode,
          senderCity: baseParams.shipFrom.city,
          senderProv: baseParams.shipFrom.state,
          recipientCap: baseParams.shipTo.postalCode,
          recipientCity: baseParams.shipTo.city,
          recipientProv: baseParams.shipTo.state,
          parcels: baseParams.packages,
          insuranceValue: baseParams.insuranceValue,
          codValue: baseParams.codValue,
        });

        if (result.success && result.rates && result.rates.length > 0) {
          console.log(
            `[QUOTES API] SpediamoPro "${config.configName}": ${result.rates.length} rates`
          );

          const ratesWithMeta = result.rates.map((rate: any) => ({
            ...rate,
            _configId: config.configId,
            _configName: config.configName,
            _provider: 'spediamopro',
          }));

          return { success: true, rates: ratesWithMeta };
        } else {
          return { success: false, error: result.error, configName: config.configName };
        }
      } catch (error: any) {
        console.error(`[QUOTES API] Errore SpediamoPro "${config.configName}":`, error.message);
        return { success: false, error: error.message, configName: config.configName };
      }
    });

    // Aspetta TUTTI i risultati (SpedisciOnline + SpediamoPro) in parallelo
    const [soResults, spResults] = await Promise.all([
      Promise.all(promises),
      Promise.all(spediamoProPromises),
    ]);
    const results = [...soResults, ...spResults];

    // Unisci tutti i rates da tutti i provider
    for (const result of results) {
      if (result.success && result.rates) {
        allRates.push(...result.rates);
        const r = result as any;
        if (r.cached) anyCached = true;
        if (r.cacheAge && r.cacheAge > maxCacheAge) maxCacheAge = r.cacheAge;
      } else if (result.error) {
        const r = result as any;
        errors.push(`${r.configName || 'unknown'}: ${result.error}`);
      }
    }

    const totalConfigs = uniqueConfigs.length + (spediamoProConfigsResult.configs?.length || 0);
    console.log(
      `[QUOTES API] Totale rates unificati: ${allRates.length} da ${totalConfigs} configurazioni`
    );

    // Se nessun rate da nessuna config, prova fallback listini
    if (allRates.length === 0) {
      console.log('⚠️ [QUOTES API] Nessun rate da API, uso fallback listini');
      return await handleListinoFallback(
        context.actor.email,
        weight,
        zip,
        province,
        courier,
        contractCode,
        codValue,
        insuranceValue
      );
    }

    // ✨ Applica filtri se richiesto (comportamento legacy)
    let rates = allRates;

    if (!allContracts) {
      if (courier) {
        rates = rates.filter(
          (r: any) =>
            r.carrierCode?.toLowerCase() === courier.toLowerCase() ||
            r.carrierCode?.toLowerCase().includes(courier.toLowerCase())
        );
      }

      if (contractCode && rates.length > 0) {
        rates = rates.filter((r: any) => r.contractCode === contractCode);
      }
    }

    return NextResponse.json({
      success: true,
      rates,
      details: {
        cached: anyCached,
        cacheAge: maxCacheAge > 0 ? maxCacheAge : undefined,
        totalRates: rates.length,
        configsUsed: uniqueConfigs.length,
        carriersFound: [...new Set(rates.map((r: any) => r.carrierCode))],
        contractsFound: [...new Set(rates.map((r: any) => r.contractCode))],
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error: any) {
    console.error('Errore quote real-time:', error);
    return NextResponse.json(
      { error: 'Errore durante il calcolo preventivi in tempo reale' },
      { status: 500 }
    );
  }
}

/**
 * Fallback a listini quando API non disponibile
 *
 * ✨ M3: Aggiunto supporto workspace per isolamento multi-tenant
 */
async function handleListinoFallback(
  userEmail: string,
  weight: string | number,
  zip: string,
  province: string,
  courier?: string,
  contractCode?: string,
  codValue: number = 0,
  insuranceValue: number = 0
) {
  try {
    const { calculatePriceWithRules } = await import('@/lib/db/price-lists-advanced');
    // ✨ M3: Recupera user con primary_workspace_id per isolamento
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, primary_workspace_id')
      .eq('email', userEmail)
      .single();

    if (user && courier) {
      // ✨ M3: Usa primary_workspace_id o fallback a empty string
      const workspaceId = user.primary_workspace_id || '';

      const listinoResult = await calculatePriceWithRules(user.id, workspaceId, {
        weight: parseFloat(String(weight)),
        destination: {
          zip: zip,
          province: province,
          country: 'IT',
        },
        courierId: courier,
        serviceType: 'standard',
        options: {
          cashOnDelivery: codValue > 0,
          insurance: insuranceValue > 0,
          declaredValue: insuranceValue > 0 ? insuranceValue : undefined,
        },
      });

      if (listinoResult) {
        return NextResponse.json({
          success: true,
          rates: [
            {
              carrierCode: courier,
              contractCode: contractCode || 'listino',
              weight_price: listinoResult.basePrice.toString(),
              insurance_price: '0',
              cod_price: '0',
              services_price: listinoResult.surcharges.toString(),
              fuel: '0',
              total_price: listinoResult.finalPrice.toString(),
              source: 'listino',
              fallback: true,
            },
          ],
          details: {
            cached: false,
            source: 'listino',
            fallback: true,
            message: 'Quote da listino (API non disponibile)',
          },
        });
      }
    }
  } catch (fallbackError) {
    console.error('Errore fallback a listino:', fallbackError);
  }

  return NextResponse.json(
    {
      error: 'Nessuna configurazione API e nessun listino disponibile',
      details: {
        requiresConfig: true,
        configUrl: '/dashboard/configurazioni-corrieri',
      },
    },
    { status: 422 }
  );
}
