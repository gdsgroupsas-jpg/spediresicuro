export type SyncMode = 'fast' | 'balanced' | 'matrix' | 'semi-auto';

export type SpedisciOnlineTestParams = {
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
  configId?: string;
};

export type SpedisciOnlineRatesTestResult = {
  success: boolean;
  rates?: any[];
  error?: string;
  details?: {
    url?: string;
    responseTime?: number;
    carriersFound?: string[];
    contractsFound?: string[];
    cached?: boolean;
    cacheAge?: number;
  };
};

export type SyncPriceListsOptions = {
  courierId?: string;
  testParams?: SpedisciOnlineTestParams;
  priceListName?: string;
  overwriteExisting?: boolean;
  configId?: string;
  mode?: SyncMode;
  targetZones?: string[];
};

export type SyncPriceListsResult = {
  success: boolean;
  priceListsCreated?: number;
  priceListsUpdated?: number;
  entriesAdded?: number;
  error?: string;
  details?: {
    ratesProcessed?: number;
    carriersProcessed?: string[];
  };
};

export type SyncZone = {
  code: string;
  sampleAddress: {
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
};

export type SpedisciOnlineRate = {
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
  [key: string]: any;
};

export type SyncScanOutput = {
  rates: SpedisciOnlineRate[];
  carriersProcessed: string[];
  weightsToProbe: number[];
  zones: SyncZone[];
  mode: SyncMode;
  probedWeightsSorted: number[];
};

export type SyncScanCollectResult = {
  earlyResult?: SyncPriceListsResult;
  scanOutput?: SyncScanOutput;
};
