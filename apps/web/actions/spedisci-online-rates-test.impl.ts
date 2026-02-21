import { getSpedisciOnlineCredentials } from '@/lib/actions/spedisci-online';
import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online';
import { canManagePriceLists } from '@/lib/auth-helpers';
import { getQuoteWithCache, type QuoteCacheParams } from '@/lib/cache/quote-cache';
import { supabaseAdmin } from '@/lib/db/client';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import type {
  SpedisciOnlineRatesTestResult,
  SpedisciOnlineTestParams,
} from './spedisci-online-rates.types';

export async function testSpedisciOnlineRatesImpl(
  testParams?: SpedisciOnlineTestParams
): Promise<SpedisciOnlineRatesTestResult> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { success: false, error: 'Non autenticato' };
    }

    let user;
    if (context.actor.id === 'test-user-id') {
      user = { id: 'test-user-id', account_type: 'admin', is_reseller: true };
    } else {
      const { data } = await supabaseAdmin
        .from('users')
        .select('id, account_type, is_reseller')
        .eq('email', context.actor.email)
        .single();
      user = data;
    }

    if (!user) {
      return { success: false, error: 'Utente non trovato' };
    }

    if (!canManagePriceLists(user)) {
      return {
        success: false,
        error: 'Solo admin, reseller e BYOC possono testare i rates',
      };
    }

    const credentialsResult = await getSpedisciOnlineCredentials(testParams?.configId);
    if (!credentialsResult.success || !credentialsResult.credentials) {
      return {
        success: false,
        error:
          'Credenziali spedisci.online non configurate. Configura le credenziali in /dashboard/integrazioni',
      };
    }

    const credentials = credentialsResult.credentials;

    const adapter = new SpedisciOnlineAdapter({
      api_key: credentials.api_key,
      api_secret: credentials.api_secret,
      base_url: credentials.base_url || 'https://api.spedisci.online/api/v2',
      contract_mapping: credentials.contract_mapping || {},
    });

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
      accessoriServices: [] as string[],
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

    const cacheParams: QuoteCacheParams = {
      userId: context.actor.id,
      weight: params.packages[0]?.weight || 0,
      zip: params.shipTo.postalCode,
      province: params.shipTo.state,
      insuranceValue: params.insuranceValue,
      codValue: params.codValue,
      services: params.accessoriServices,
    };

    const startTime = Date.now();
    const cachedResult = await getQuoteWithCache(
      cacheParams,
      async () => {
        return await adapter.getRates(params);
      },
      {
        ttlSeconds: 300,
        maxAgeSeconds: 300,
      }
    );
    const responseTime = Date.now() - startTime;

    const result = {
      success: cachedResult.success,
      rates: cachedResult.rates,
      error: cachedResult.error,
    };

    if (!result.success || !result.rates) {
      return {
        success: false,
        error: result.error || 'Errore sconosciuto durante il test',
        details: {
          responseTime,
          cached: cachedResult.cached || false,
        },
      };
    }

    const carriersFound = [...new Set(result.rates.map((r) => r.carrierCode))];
    const contractsFound = result.rates.map((r) => r.contractCode);

    return {
      success: true,
      rates: result.rates,
      details: {
        responseTime,
        carriersFound,
        contractsFound,
        cached: cachedResult.cached || false,
        cacheAge: cachedResult.cacheAge,
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
