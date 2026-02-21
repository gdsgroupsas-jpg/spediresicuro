'use server';

import { syncPriceListsFromSpedisciOnlineImpl } from './spedisci-online-rates-sync.impl';
import { testSpedisciOnlineRatesImpl } from './spedisci-online-rates-test.impl';
import type {
  SpedisciOnlineRatesTestResult,
  SpedisciOnlineTestParams,
  SyncPriceListsOptions,
  SyncPriceListsResult,
} from './spedisci-online-rates.types';

export async function testSpedisciOnlineRates(
  testParams?: SpedisciOnlineTestParams
): Promise<SpedisciOnlineRatesTestResult> {
  return testSpedisciOnlineRatesImpl(testParams);
}

export async function syncPriceListsFromSpedisciOnline(
  options?: SyncPriceListsOptions
): Promise<SyncPriceListsResult> {
  return syncPriceListsFromSpedisciOnlineImpl(options);
}
