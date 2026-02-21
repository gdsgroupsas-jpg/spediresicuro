export interface SpedisciOnlineClientConfigInput {
  apiKey: string;
  baseUrl?: string;
}

const KNOWN_DEMO_TOKENS = ['qCL7FN2RKFQDngWb6kJ7', '8ZZmDdwA', 'demo', 'example', 'test'];

export function isLikelyDemoApiKey(apiKey: string): boolean {
  const normalized = apiKey.toLowerCase();
  return KNOWN_DEMO_TOKENS.some(
    (token) => normalized.includes(token.toLowerCase()) || apiKey.startsWith(token)
  );
}

export function normalizeSpedisciOnlineBaseUrl(baseUrl?: string): string {
  const input = (baseUrl || 'https://api.spedisci.online/api/v2').trim();
  return input.endsWith('/') ? input : `${input}/`;
}

export function validateSpedisciOnlineClientConfig(
  input: SpedisciOnlineClientConfigInput
): { apiKey: string; baseUrl: string } {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error('Spedisci.Online: API Key mancante per la creazione LDV.');
  }
  if (isLikelyDemoApiKey(apiKey)) {
    throw new Error(
      'Spedisci.Online API key not configured correctly (using demo token). Please configure a valid API key in /dashboard/integrazioni'
    );
  }
  if (apiKey.length < 10) {
    throw new Error(
      'Spedisci.Online API key too short. Please configure a valid API key in /dashboard/integrazioni'
    );
  }
  return {
    apiKey,
    baseUrl: normalizeSpedisciOnlineBaseUrl(input.baseUrl),
  };
}
