import { BaseCourierClient } from './base-courier.interface';
import { SpedisciOnlineClient } from './spediscionline.client';
import { SpediamoProClient } from './spediamopro.client';

export class CourierFactory {
  static getClient(
    provider: string, // 'spediscionline', 'spediamopro', 'poste_native', 'gls_native'
    carrier: string, // 'GLS', 'POSTE', 'BRT', 'UPS', 'BRTEXP', 'SDASTD'
    config: {
      apiKey: string;
      baseUrl: string;
      contractId?: string;
    }
  ): BaseCourierClient {
    switch (provider.toLowerCase()) {
      case 'spediscionline':
      case 'spedisci.online':
      case 'spedisci_online':
        // SpedisciOnline gestisce TUTTI i corrieri (GLS, Poste, BRT, UPS, DHL, etc)
        return new SpedisciOnlineClient({
          ...config,
          carrier, // Passa il corriere specifico
        });

      case 'spediamopro':
      case 'spediamo_pro':
      case 'spediamo.pro':
        // SpediamoPro: broker con JWT auth e flusso multi-step
        // Corrieri: SDA, BRT, UPS, InPost (codici: SDASTD, BRTEXP, UPSSTD, etc)
        return new SpediamoProClient({
          ...config,
          carrier,
        });

      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
