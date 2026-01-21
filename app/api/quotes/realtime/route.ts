/**
 * API Route: Quote Real-Time da Spedisci.Online
 *
 * ✨ MULTI-CONFIG: Chiama API per OGNI configurazione dell'utente
 * e unisce tutti i rates ricevuti.
 *
 * Se un reseller ha N configurazioni API (N account Spedisci.Online),
 * faremo N chiamate e uniremo tutti i rates.
 *
 * ⚠️ ENTERPRISE: Include cache Redis (TTL 5min), multi-config support
 */

import { testSpedisciOnlineRates } from '@/actions/spedisci-online-rates';
import { getAllUserSpedisciOnlineConfigs } from '@/lib/actions/spedisci-online';
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

    // ✨ MULTI-CONFIG: Recupera TUTTE le configurazioni dell'utente
    const configsResult = await getAllUserSpedisciOnlineConfigs();

    if (!configsResult.success || !configsResult.configs || configsResult.configs.length === 0) {
      // Nessuna configurazione API: prova fallback a listini
      console.log('⚠️ [QUOTES API] Nessuna configurazione API trovata, uso fallback listini');
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

    console.log(`✅ [QUOTES API] Trovate ${configsResult.configs.length} configurazioni API`);
    console.log(`📊 [QUOTES API] Dettaglio configurazioni trovate:`);
    configsResult.configs.forEach((config, idx) => {
      console.log(
        `   Config ${idx + 1}: "${config.configName}" (${config.configId.substring(0, 8)}...)`
      );
      console.log(`      - Contratti: ${Object.keys(config.contract_mapping).join(', ')}`);
      console.log(`      - Base URL: ${config.base_url}`);
      console.log(
        `      - API Key (hash): ${config.api_key ? config.api_key.substring(0, 10) + '...' : 'MANCANTE'}`
      );
    });
    console.log(`📊 [QUOTES API] Servizi accessori richiesti:`, services);

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

    // ⚠️ FIX: Usa TUTTE le configurazioni senza deduplica errata
    // Ogni configId è già univoco - se l'utente ha N configurazioni, le chiamiamo tutte
    // La deduplica per API key (substring) causava bug: configurazioni diverse venivano saltate
    const uniqueConfigs = configsResult.configs;

    console.log(`📊 [QUOTES API] Configurazioni da chiamare: ${uniqueConfigs.length}`);

    // Esegui chiamate in parallelo per performance
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

    const results = await Promise.all(promises);

    // Unisci tutti i rates
    for (const result of results) {
      if (result.success && result.rates) {
        allRates.push(...result.rates);
        if (result.cached) anyCached = true;
        if (result.cacheAge && result.cacheAge > maxCacheAge) maxCacheAge = result.cacheAge;
      } else if (result.error) {
        errors.push(`${result.configName}: ${result.error}`);
      }
    }

    console.log(
      `✅ [QUOTES API] Totale rates unificati: ${allRates.length} da ${uniqueConfigs.length} configurazioni uniche`
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
    return NextResponse.json({ error: error.message || 'Errore sconosciuto' }, { status: 500 });
  }
}

/**
 * Fallback a listini quando API non disponibile
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
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (user && courier) {
      const listinoResult = await calculatePriceWithRules(user.id, {
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
        configUrl: '/dashboard/integrazioni',
      },
    },
    { status: 422 }
  );
}
